'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');

test('request snapshots keep the original price after a later pricing change', async () => {
  let currentPricing = {
    id: 31,
    clientAccountId: 8,
    locationId: 12,
    packageId: 17,
    restorationPrice: '549.00',
    revenueShare: '150.00',
    effectiveDate: '2026-01-01',
    package: { id: 17, key: 'annual-care', name: 'Annual Care' },
    location: { id: 12, name: 'North Property' },
  };
  const storedRequests = [];
  const statusHistory = [];
  const models = {
    ClientAccount: {
      findByPk: async () => ({
        requestPhotosRequired: false,
        familyAdvisorPriceVisibility: 'restoration',
        clientAdminPriceVisibility: 'restoration',
      }),
    },
    PricingConfiguration: {
      findOne: async ({ where }) => {
        if (where.id !== undefined && Number(where.id) !== currentPricing.id) return null;
        if (Number(where.clientAccountId) !== currentPricing.clientAccountId
          || Number(where.locationId) !== currentPricing.locationId
          || (where.packageId !== undefined && Number(where.packageId) !== currentPricing.packageId)) return null;
        return currentPricing;
      },
    },
    MemorialRequest: {
      findOne: async () => null,
      create: async (values) => {
        const request = { id: storedRequests.length + 1, ...values };
        storedRequests.push(request);
        return request;
      },
      findByPk: async (id) => storedRequests.find((request) => request.id === id),
    },
    RequestPhoto: { bulkCreate: async () => [], count: async () => 0 },
    RequestStatusHistory: {
      create: async (values) => {
        statusHistory.push(values);
        return values;
      },
    },
    Partner: { findAll: async () => [] },
    Location: {
      findOne: async () => currentPricing.location,
      findAll: async ({ where }) => {
        assert.deepEqual(where, { clientAccountId: 8, status: 'active' });
        return [{ id: 12, name: 'North Property' }, { id: 19, name: 'South Property' }];
      },
    },
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
    const { createRequest, getRequestOptions } = require('../controller/request');
    const optionsResponse = {
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await getRequestOptions({ clientAccountId: 8 }, optionsResponse);
    assert.deepEqual(optionsResponse.body.properties.map((property) => property.id), [12, 19]);
    const submit = async (pricingId) => {
      const req = {
        params: {},
        body: {
          pricingId: String(pricingId),
          locationId: '12',
          customerName: 'Example Customer',
          customerPhone: '555-0100',
          customerEmail: 'customer@example.com',
          nameOnMemorial: 'Example Memorial',
          memorialSize: '33" x 15" custom',
          memorialType: 'Granite',
          section: 'Garden A',
          lot: '18',
          space: '2',
          vaseInfo: 'No vase',
          notes: 'Please clean gently.',
          pricingId: String(pricingId),
          // Deliberately forged browser values must never replace Task 4 pricing.
          packagePrice: '1.00',
          restorationPrice: '1.00',
          revenueShare: '0.00',
          invoiceAmount: '1.00',
        },
        files: [],
        partner: { id: 5 },
        clientAccountId: 8,
      };
      const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
      };
      await createRequest(req, res);
      assert.equal(res.statusCode, 201, JSON.stringify(res.body));
      return res.body.request;
    };

    const oldRequest = await submit(currentPricing.id);
    assert.equal(oldRequest.restorationPrice, 549);
    assert.equal(oldRequest.invoiceAmount, 399);
    assert.equal('revenueShare' in oldRequest, false);
    assert.equal('packagePrice' in oldRequest, false);
    assert.equal(oldRequest.locationId, 12);
    assert.equal(oldRequest.packageId, 17);
    assert.equal(oldRequest.pricingEffectiveDate, '2026-01-01');
    assert.equal(oldRequest.memorialSize, '33" x 15" custom');
    assert.ok(oldRequest.requestNumber);
    assert.ok(oldRequest.submittedAt instanceof Date);
    assert.equal(oldRequest.submittedByUserId, 5);
    assert.equal(oldRequest.clientAccountId, 8);
    assert.equal(statusHistory[0].toStatus, 'SUBMITTED');

    currentPricing = {
      ...currentPricing,
      id: 32,
      restorationPrice: '649.00',
      revenueShare: '175.00',
      effectiveDate: '2026-06-01',
    };
    const newRequest = await submit(currentPricing.id);

    assert.equal(newRequest.restorationPrice, 649);
    assert.equal(newRequest.invoiceAmount, 474);
    assert.equal('revenueShare' in newRequest, false);
    assert.equal('packagePrice' in newRequest, false);
    assert.equal(storedRequests[0].restorationPrice, 549);
    assert.equal(storedRequests[0].revenueShare, 150);
    assert.equal(storedRequests[0].invoiceAmount, 399);
    assert.equal(storedRequests[0].pricingEffectiveDate, '2026-01-01');
    assert.equal(storedRequests[0].requestNumber, oldRequest.requestNumber);
    assert.equal(storedRequests[0].submittedAt, oldRequest.submittedAt);
  } finally {
    Module._load = originalLoad;
    delete require.cache[controllerPath];
  }
});