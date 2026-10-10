'use strict';

const { Op } = require('sequelize');
const { Location, PricingPackage, PricingConfiguration } = require('../models');
const { DEFAULT_LOCATIONS } = require('../constants/defaultLocations');
const DEFAULT_PRICING_PACKAGES = require('../constants/defaultPricingPackages');
const {
  TEST_PACKAGE_NAME,
  TEST_PACKAGE_RESTORATION_PRICE,
  TEST_PACKAGE_REVENUE_SHARE,
} = require('../constants/testPackagePricing');

const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

async function findOrCreateTestPackage() {
  let pricingPackage = await PricingPackage.findOne({ where: { name: TEST_PACKAGE_NAME } });
  if (!pricingPackage) {
    const baseKey = TEST_PACKAGE_NAME.toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 100) || 'package';
    let key = baseKey;
    let suffix = 2;
    while (await PricingPackage.findOne({ where: { key } })) {
      key = `${baseKey.slice(0, 112)}_${suffix++}`;
    }
    pricingPackage = await PricingPackage.create({ name: TEST_PACKAGE_NAME, key });
  }
  return pricingPackage;
}

async function seedBronzeAndGranite(clientAccountId, locations, effectiveDate) {
  const packages = await PricingPackage.findAll({
    where: { key: { [Op.in]: DEFAULT_PRICING_PACKAGES.map((p) => p.key) } },
  });
  const byKey = new Map(packages.map((p) => [p.key, p]));

  const rows = [];
  for (const def of DEFAULT_PRICING_PACKAGES) {
    let pkg = byKey.get(def.key);
    if (!pkg) {
      pkg = await PricingPackage.create({
        key: def.key,
        name: `${def.service} - ${def.item}`,
      });
      byKey.set(def.key, pkg);
    }
    for (const location of locations) {
      rows.push({
        clientAccountId,
        locationId: location.id,
        packageId: pkg.id,
        restorationPrice: def.price,
        revenueShare: 0,
        effectiveDate,
        service: def.service,
        item: def.item,
      });
    }
  }

  if (rows.length) await PricingConfiguration.bulkCreate(rows);
}

// Creates the default cemetery locations for a brand-new client account,
// then prices Test Package 1 plus the Bronze and Granite packages at every location.
async function seedDefaultsForNewAccount(clientAccountId) {
  await Location.bulkCreate(
    DEFAULT_LOCATIONS.map((loc) => ({
      clientAccountId,
      name: loc.name,
      address: loc.address,
      city: loc.city,
      state: loc.state,
      zip: loc.zip,
      status: 'active',
    }))
  );

  const locations = await Location.findAll({
    where: { clientAccountId, status: 'active' },
  });

  const pricingPackage = await findOrCreateTestPackage();
  const effectiveDate = localDate();

  await PricingConfiguration.bulkCreate(
    locations.map((location) => ({
      clientAccountId,
      locationId: location.id,
      packageId: pricingPackage.id,
      restorationPrice: TEST_PACKAGE_RESTORATION_PRICE,
      revenueShare: TEST_PACKAGE_REVENUE_SHARE,
      effectiveDate,
    }))
  );

  await seedBronzeAndGranite(clientAccountId, locations, effectiveDate);
}

module.exports = { seedDefaultsForNewAccount };