'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const {
  getPriceVisibility,
  serializeWithPriceVisibility,
} = require('../utils/priceVisibility');

const pricingPayload = {
  pricing: [{
    id: 7,
    packagePrice: '725.00',
    restorationPrice: '600.00',
    revenueShare: '125.00',
    invoiceAmount: '475.00',
    package: { name: 'Memorial care' },
  }],
};

const requestPayload = {
  request: {
    id: 21,
    packagePrice: '725.00',
    restorationPrice: '600.00',
    revenueShare: '125.00',
    invoiceAmount: '475.00',
    customer: { name: 'Test Customer' },
  },
};

test('price visibility setting changes the partner API payload and removes the unselected price', () => {
  const retail = serializeWithPriceVisibility(pricingPayload, {
    mode: 'customer_retail',
    familyAdvisor: false,
  });
  assert.equal(retail.pricing[0].customerRetailPrice, '725.00');
  assert.equal('packagePrice' in retail.pricing[0], false);
  assert.equal('restorationPrice' in retail.pricing[0], false);

  const restoration = serializeWithPriceVisibility(pricingPayload, {
    mode: 'restoration',
    familyAdvisor: false,
  });
  assert.equal(restoration.pricing[0].restorationPrice, '600.00');
  assert.equal('customerRetailPrice' in restoration.pricing[0], false);
  assert.equal('packagePrice' in restoration.pricing[0], false);
  assert.notDeepEqual(retail, restoration);
});

test('none removes prices and invoice values recursively from partner API payloads', () => {
  const response = serializeWithPriceVisibility(requestPayload, {
    mode: 'none',
    familyAdvisor: false,
  });
  assert.deepEqual(response, {
    request: {
      id: 21,
      customer: { name: 'Test Customer' },
    },
  });
});

test('family advisors never receive invoice or financial values, even when a price is enabled', () => {
  const response = serializeWithPriceVisibility(requestPayload, {
    mode: 'customer_retail',
    familyAdvisor: true,
  });
  assert.equal(response.request.customerRetailPrice, '725.00');
  for (const hidden of ['packagePrice', 'restorationPrice', 'invoiceAmount', 'revenueShare']) {
    assert.equal(hidden in response.request, false, `${hidden} must not be returned to Family Advisors`);
  }
});

test('price visibility is loaded independently for each account role and defaults safely to none', async () => {
  const settings = {
    familyAdvisorPriceVisibility: 'customer_retail',
    clientAdminPriceVisibility: 'restoration',
  };
  const ClientAccount = {
    async findByPk(_id, options) {
      const field = options.attributes[0];
      return { [field]: settings[field] };
    },
  };

  assert.deepEqual(
    await getPriceVisibility({ clientAccountId: 3, accountRole: 'family_advisor' }, ClientAccount),
    { mode: 'customer_retail', familyAdvisor: true }
  );
  assert.deepEqual(
    await getPriceVisibility({ clientAccountId: 3, accountRole: 'client_admin' }, ClientAccount),
    { mode: 'restoration', familyAdvisor: false }
  );
  settings.familyAdvisorPriceVisibility = 'not-valid';
  assert.deepEqual(
    await getPriceVisibility({ clientAccountId: 3, accountRole: 'family_advisor' }, ClientAccount),
    { mode: 'none', familyAdvisor: true }
  );
});

test('the available-pricing API changes on setting switch and never returns a hidden advisor price', async () => {
  const settings = { familyAdvisorPriceVisibility: 'none' };
  const pricingRow = {
    id: 7,
    clientAccountId: 3,
    locationId: 4,
    packageId: 9,
    restorationPrice: '600.00',
    revenueShare: '125.00',
    package: { name: 'Memorial care' },
    location: { name: 'North Property' },
  };
  const models = {
    ClientAccount: {
      findByPk: async (_id, { attributes }) => ({
        [attributes[0]]: settings[attributes[0]],
      }),
    },
    PricingConfiguration: { findAll: async () => [pricingRow] },
    Location: {},
    MemorialRequest: {},
    RequestPhoto: {},
    Partner: {},
    PricingPackage: {},
  };
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../models' && parent?.filename.endsWith('/controller/request.js')) return models;
    if (request === 'sequelize' && parent?.filename.endsWith('/controller/request.js')) {
      return { Op: { lte: Symbol('less-than-or-equal') } };
    }
    if (request === 'multer' && parent?.filename.endsWith('/controller/request.js')) {
      const multer = () => ({ array: () => (_req, _res, next) => next?.() });
      multer.diskStorage = (options) => options;
      return multer;
    }
    if (request === 'bcrypt' && parent?.filename.endsWith('/controller/request.js')) return {};
    return originalLoad.call(this, request, parent, isMain);
  };

  const controllerPath = require.resolve('../controller/request');
  try {
    delete require.cache[controllerPath];
    const { getAvailablePricing } = require('../controller/request');
    const advisor = { clientAccountId: 3, accountRole: 'family_advisor', userRole: 'family_advisor' };
    const getResponse = async () => {
      const response = {
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
      };
      await getAvailablePricing(advisor, response);
      return response.body;
    };

    const hidden = await getResponse();
    assert.equal('restorationPrice' in hidden.pricing[0], false);
    assert.equal('revenueShare' in hidden.pricing[0], false);

    settings.familyAdvisorPriceVisibility = 'restoration';
    const shown = await getResponse();
    assert.equal(shown.pricing[0].restorationPrice, '600.00');
    assert.equal('customerRetailPrice' in shown.pricing[0], false);
    assert.equal('revenueShare' in shown.pricing[0], false);
    assert.notDeepEqual(hidden, shown);
  } finally {
    Module._load = originalLoad;
    delete require.cache[controllerPath];
  }
});