'use strict';

const { ClientAccount, Location } = require('../models');

const CEMETERIES = [
  { name: 'Calvary Cemetery-TH', address: '435 W Troy Ave', city: 'Indianapolis', state: 'IN', zip: '46225' },
  { name: 'Floral Park Cemetery and Funeral Center', address: '4227 Wabash Avenue', city: 'Terre Haute', state: 'IN', zip: '47803' },
  { name: 'Hamilton Memorial Park and Funeral Center', address: '425 N Holt Rd', city: 'Indianapolis', state: 'IN', zip: '46222' },
  { name: 'Holy Cross / St. Joseph Cemetery', address: '435 W Troy Ave', city: 'Indianapolis', state: 'IN', zip: '46225' },
  { name: 'Memorial Park Cemetery and Funeral Center', address: '4180 Westfield Rd', city: 'Westfield', state: 'IN', zip: '46062' },
  { name: 'Oaklawn Memorial Gardens and Funeral Center', address: '9350 E Washington St', city: 'Indianapolis', state: 'IN', zip: '46229' },
  { name: 'Our Lady of Peace Cemetery', address: '9700 Allisonville Rd', city: 'Indianapolis', state: 'IN', zip: '46250' },
  { name: 'St. Malachy North', address: '9001 Haverstick Rd', city: 'Indianapolis', state: 'IN', zip: '46240' },
  { name: 'St. Malachy West', address: '267 E 56th St', city: 'Brownsburg', state: 'IN', zip: '46112' },
  { name: 'Union Chapel Cemetery', address: '9295 W 21st St', city: 'Indianapolis', state: 'IN', zip: '46234' },
  { name: 'Washington Park East Cemetery', address: '9001 Haverstick Rd', city: 'Indianapolis', state: 'IN', zip: '46240' },
  { name: 'Washington Park North Cemetery', address: '10612 E Washington St', city: 'Indianapolis', state: 'IN', zip: '46229' },
  { name: 'West Ridge Park Cemetery', address: '2702 Kessler Blvd. W. Dr', city: 'Indianapolis', state: 'IN', zip: '46228' },
];

(async () => {
  try {
    const accounts = await ClientAccount.findAll({ attributes: ['id', 'name'] });
    console.log(`Found ${accounts.length} client account(s).`);

    for (const account of accounts) {
      for (const cemetery of CEMETERIES) {
        await Location.create({
          clientAccountId: account.id,
          name: cemetery.name,
          address: cemetery.address,
          city: cemetery.city,
          state: cemetery.state,
          zip: cemetery.zip,
          status: 'active',
        });
      }
      console.log(`Added ${CEMETERIES.length} locations to "${account.name}" (id ${account.id}).`);
    }

    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Failed:', err);
    process.exit(1);
  }
})();