'use strict';

const { DataTypes } = require('sequelize');

const SNAPSHOT_COLUMNS = {
  package_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  package_name_snapshot: { type: DataTypes.STRING(255), allowNull: true },
  restoration_price: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  revenue_share: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  invoice_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  pricing_effective_date: { type: DataTypes.DATEONLY, allowNull: true },
};

const titleFromKey = (key) => String(key || '')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase())
  .slice(0, 255);

async function ensurePricing(sequelize, models) {
  const queryInterface = sequelize.getQueryInterface();
  const tables = (await queryInterface.showAllTables()).map((table) =>
    typeof table === 'string' ? table.toLowerCase() : String(table.tableName || table).toLowerCase()
  );

  if (!tables.includes('memorial_requests')) return;

  let description = await queryInterface.describeTable('memorial_requests');
  for (const [column, definition] of Object.entries(SNAPSHOT_COLUMNS)) {
    if (!description[column]) {
      await queryInterface.addColumn('memorial_requests', column, definition);
    }
  }

  // Existing request types used a closed MySQL ENUM. Package names are now
  // managed in pricing_packages, so keep the legacy field open for new keys.
  if (/^ENUM/i.test(String(description.package_type?.type || ''))) {
    await queryInterface.changeColumn('memorial_requests', 'package_type', {
      type: DataTypes.STRING(120),
      allowNull: false,
    });
  }

  await sequelize.query(
    'UPDATE memorial_requests SET restoration_price = package_price WHERE restoration_price IS NULL'
  );
  await sequelize.query(
    'UPDATE memorial_requests SET revenue_share = 0 WHERE revenue_share IS NULL'
  );
  await sequelize.query(
    'UPDATE memorial_requests SET invoice_amount = package_price WHERE invoice_amount IS NULL'
  );
  await sequelize.query(
    'UPDATE memorial_requests SET pricing_effective_date = DATE(created_at) WHERE pricing_effective_date IS NULL'
  );

  const requests = await models.MemorialRequest.findAll({
    where: { packageId: null },
    order: [['created_at', 'ASC']],
  });
  const latestObservedPrices = new Map();

  for (const request of requests) {
    if (!request.packageType) continue;
    const [pricingPackage] = await models.PricingPackage.findOrCreate({
      where: { key: String(request.packageType).slice(0, 120) },
      defaults: { name: titleFromKey(request.packageType) || `Package ${request.id}` },
    });
    await request.update({
      packageId: pricingPackage.id,
      packageNameSnapshot: request.packageNameSnapshot || pricingPackage.name,
    });

    if (!request.clientAccountId || !request.locationId) continue;
    const key = `${request.clientAccountId}:${request.locationId}:${pricingPackage.id}`;
    const prior = latestObservedPrices.get(key);
    if (!prior || new Date(request.createdAt) > new Date(prior.createdAt)) {
      latestObservedPrices.set(key, {
        clientAccountId: request.clientAccountId,
        locationId: request.locationId,
        packageId: pricingPackage.id,
        restorationPrice: request.restorationPrice ?? request.packagePrice,
        createdAt: request.createdAt,
      });
    }
  }

  for (const [key, observed] of latestObservedPrices) {
    const [clientAccountId, locationId, packageId] = key.split(':').map(Number);
    const existing = await models.PricingConfiguration.findOne({
      where: { clientAccountId, locationId, packageId },
    });
    if (!existing) {
      await models.PricingConfiguration.create({
        ...observed,
        clientAccountId,
        locationId,
        packageId,
        revenueShare: 0,
        effectiveDate: new Date(observed.createdAt).toISOString().slice(0, 10),
      });
    }
  }
}

module.exports = ensurePricing;