'use strict';

const { ClientAccount, Location, PricingPackage, PricingConfiguration } = require('../models');

const PACKAGE_NAME = 'Test Package 1';
const RESTORATION_PRICE = '10.00';
const REVENUE_SHARE = '5.00';
const EFFECTIVE_DATE = '2026-09-27';

(async () => {
  try {
    // Find or create the package, mirroring the same key-derivation logic
    // the admin UI's controller uses (controller/pricing.js).
    let pricingPackage = await PricingPackage.findOne({ where: { name: PACKAGE_NAME } });
    if (!pricingPackage) {
      const baseKey = PACKAGE_NAME.toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 100) || 'package';
      let key = baseKey;
      let suffix = 2;
      while (await PricingPackage.findOne({ where: { key } })) {
        key = `${baseKey.slice(0, 112)}_${suffix++}`;
      }
      pricingPackage = await PricingPackage.create({ name: PACKAGE_NAME, key });
      console.log(`Created package "${PACKAGE_NAME}" (id ${pricingPackage.id}, key "${key}").`);
    } else {
      console.log(`Package "${PACKAGE_NAME}" already exists (id ${pricingPackage.id}).`);
    }

    const accounts = await ClientAccount.findAll({ attributes: ['id', 'name'] });
    console.log(`Found ${accounts.length} client account(s).`);

    for (const account of accounts) {
      const primaryLocation = await Location.findOne({
        where: { clientAccountId: account.id, name: 'Primary Location' },
      });

      if (!primaryLocation) {
        console.log(`Skipped "${account.name}" (id ${account.id}) — no "Primary Location" found.`);
        continue;
      }

      // Avoid creating a duplicate row if this script is run more than once
      // for the same client/location/package/date combination.
      const existing = await PricingConfiguration.findOne({
        where: {
          clientAccountId: account.id,
          locationId: primaryLocation.id,
          packageId: pricingPackage.id,
          effectiveDate: EFFECTIVE_DATE,
        },
      });
      if (existing) {
        console.log(`Skipped "${account.name}" — pricing for this package/date already exists.`);
        continue;
      }

      await PricingConfiguration.create({
        clientAccountId: account.id,
        locationId: primaryLocation.id,
        packageId: pricingPackage.id,
        restorationPrice: RESTORATION_PRICE,
        revenueShare: REVENUE_SHARE,
        effectiveDate: EFFECTIVE_DATE,
      });
      console.log(`Added "${PACKAGE_NAME}" pricing to "${account.name}" (id ${account.id}).`);
    }

    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Failed:', err);
    process.exit(1);
  }
})();