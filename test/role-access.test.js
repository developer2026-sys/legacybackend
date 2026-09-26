'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');

const requireRole = require('../middleware/requireRole');

function responseRecorder() {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return response;
}

test('requireRole permits only the resolved server-side role', () => {
  const next = () => {};
  const allowed = { partner: { accountRole: 'client_admin' } };
  requireRole('client_admin')(allowed, responseRecorder(), next);
  assert.equal(allowed.userRole, 'client_admin');

  const deniedResponse = responseRecorder();
  requireRole('client_admin')(
    { partner: { accountRole: 'family_advisor' } },
    deniedResponse,
    next,
  );
  assert.equal(deniedResponse.statusCode, 403);
});

test('super_admin is accepted from the loaded admin record, not a partner role', () => {
  const req = { admin: { role: 'super_admin' } };
  let called = false;
  requireRole('super_admin')(req, responseRecorder(), () => {
    called = true;
  });
  assert.equal(called, true);
});

test('family advisors cannot read another advisor request in the same client', async () => {
  const records = [
    { id: 1, clientAccountId: 10, partnerId: 101 },
    { id: 2, clientAccountId: 10, partnerId: 202 },
    { id: 3, clientAccountId: 20, partnerId: 303 },
  ];
  const models = {
    ClientAccount: {
      findByPk: async () => ({
        familyAdvisorPriceVisibility: 'none',
        clientAdminPriceVisibility: 'none',
      }),
    },
    MemorialRequest: {
      findAll: async ({ where }) => records.filter((record) =>
        Object.entries(where).every(([key, value]) => record[key] === value),
      ),
      findOne: async ({ where }) => records.find((record) =>
        Object.entries(where).every(([key, value]) => record[key] === value),
      ) || null,
    },
    RequestPhoto: {},
    Partner: {},
    Location: {},
  };

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../models' && parent?.filename.endsWith('/controller/request.js')) {
      return models;
    }
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

  try {
    const { getRequests, getRequest } = require('../controller/request');
    const advisor = {
      partner: { id: 101 },
      clientAccountId: 10,
      accountRole: 'family_advisor',
      userRole: 'family_advisor',
    };

    const listResponse = responseRecorder();
    await getRequests(advisor, listResponse);
    assert.deepEqual(listResponse.body.requests.map((request) => request.id), [1]);

    const otherAdvisorResponse = responseRecorder();
    await getRequest(
      { ...advisor, params: { id: 2 } },
      otherAdvisorResponse,
    );
    assert.equal(otherAdvisorResponse.statusCode, 404);

    const otherClientResponse = responseRecorder();
    await getRequest(
      { ...advisor, params: { id: 3 } },
      otherClientResponse,
    );
    assert.equal(otherClientResponse.statusCode, 404);
  } finally {
    Module._load = originalLoad;
  }
});

test('client admins see their client requests but not another client', async () => {
  const records = [
    { id: 1, clientAccountId: 10, partnerId: 101 },
    { id: 2, clientAccountId: 10, partnerId: 202 },
    { id: 3, clientAccountId: 20, partnerId: 303 },
  ];
  const models = {
    ClientAccount: {
      findByPk: async () => ({
        familyAdvisorPriceVisibility: 'none',
        clientAdminPriceVisibility: 'none',
      }),
    },
    MemorialRequest: {
      findAll: async ({ where }) => records.filter((record) =>
        Object.entries(where).every(([key, value]) => record[key] === value),
      ),
      findOne: async ({ where }) => records.find((record) =>
        Object.entries(where).every(([key, value]) => record[key] === value),
      ) || null,
    },
    RequestPhoto: {},
    Partner: {},
    Location: {},
  };

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../models' && parent?.filename.endsWith('/controller/request.js')) {
      return models;
    }
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

  try {
    delete require.cache[require.resolve('../controller/request')];
    const { getRequests, getRequest } = require('../controller/request');
    const clientAdmin = {
      partner: { id: 101 },
      clientAccountId: 10,
      accountRole: 'client_admin',
      userRole: 'client_admin',
    };

    const listResponse = responseRecorder();
    await getRequests(clientAdmin, listResponse);
    assert.deepEqual(listResponse.body.requests.map((request) => request.id), [1, 2]);

    const otherClientResponse = responseRecorder();
    await getRequest(
      { ...clientAdmin, params: { id: 3 } },
      otherClientResponse,
    );
    assert.equal(otherClientResponse.statusCode, 404);
  } finally {
    Module._load = originalLoad;
    delete require.cache[require.resolve('../controller/request')];
  }
});

test('family advisors cannot read another advisor monument-setting request', async () => {
  const records = [
    { id: 11, clientAccountId: 10, partnerId: 101 },
    { id: 12, clientAccountId: 10, partnerId: 202 },
  ];
  const models = {
    MonumentSettingRequest: {
      findAll: async ({ where }) => records.filter((record) =>
        Object.entries(where).every(([key, value]) => record[key] === value),
      ),
      findOne: async ({ where }) => records.find((record) =>
        Object.entries(where).every(([key, value]) => record[key] === value),
      ) || null,
    },
    MonumentSettingDocument: {},
    Partner: {},
    MemorialRequest: {},
    Location: {},
  };

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../models' && parent?.filename.endsWith('/controller/monumentSetting.js')) {
      return models;
    }
    if (request === 'multer' && parent?.filename.endsWith('/controller/monumentSetting.js')) {
      const middleware = (_req, _res, next) => next?.();
      const multer = () => ({
        array: () => middleware,
        fields: () => middleware,
        single: () => middleware,
      });
      multer.diskStorage = (options) => options;
      return multer;
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const {
      getMonumentSettingRequests,
      getMonumentSettingRequest,
    } = require('../controller/monumentSetting');
    const advisor = {
      partner: { id: 101 },
      clientAccountId: 10,
      accountRole: 'family_advisor',
      userRole: 'family_advisor',
    };

    const listResponse = responseRecorder();
    await getMonumentSettingRequests(advisor, listResponse);
    assert.deepEqual(listResponse.body.requests.map((request) => request.id), [11]);

    const otherAdvisorResponse = responseRecorder();
    await getMonumentSettingRequest(
      { ...advisor, params: { id: 12 } },
      otherAdvisorResponse,
    );
    assert.equal(otherAdvisorResponse.statusCode, 404);
  } finally {
    Module._load = originalLoad;
    delete require.cache[require.resolve('../controller/monumentSetting')];
  }
});

test('pending and inactive users cannot log in', async () => {
  const partners = [
    { id: 1, email: 'pending@example.com', status: 'pending_approval' },
    { id: 2, email: 'inactive@example.com', status: 'inactive' },
  ];
  const models = {
    Partner: {
      findOne: async ({ where }) => partners.find((partner) => partner.email === where.email) || null,
    },
    PartnerTeamMember: { findOne: async () => null },
  };
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../models' && parent?.filename.endsWith('/controller/auth.js')) return models;
    if (request === 'bcrypt') return { compare: async () => true };
    if (request === 'jsonwebtoken') return { sign: () => 'token' };
    if (request === 'sequelize' && parent?.filename.endsWith('/controller/auth.js')) return { Op: {} };
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[require.resolve('../controller/auth')];
    const { login } = require('../controller/auth');
    for (const email of ['pending@example.com', 'inactive@example.com']) {
      const response = responseRecorder();
      await login({ body: { email, password: 'password' } }, response);
      assert.equal(response.statusCode, 403);
      assert.match(response.body.message, /cannot log in/);
    }
  } finally {
    Module._load = originalLoad;
    delete require.cache[require.resolve('../controller/auth')];
  }
});

test('client admins cannot activate users through the shared role guard', () => {
  const response = responseRecorder();
  requireRole('super_admin')(
    { partner: { accountRole: 'client_admin' } },
    response,
    () => {},
  );
  assert.equal(response.statusCode, 403);
});

test('deactivating a user retains their existing requests and writes a log', async () => {
  const requests = [{ id: 501, clientAccountId: 10, partnerId: 7 }];
  const partner = {
    id: 7,
    status: 'active',
    requests,
    async update(fields) {
      Object.assign(this, fields);
    },
  };
  const logs = [];
  const { changePartnerStatus } = require('../utils/userLifecycle');
  await changePartnerStatus({
    partner,
    newStatus: 'inactive',
    UserStatusLog: { create: async (log) => logs.push(log) },
    changedByType: 'super_admin',
    changedById: 99,
    reason: 'User left the client account.',
  });

  assert.equal(partner.status, 'inactive');
  assert.deepEqual(partner.requests, requests);
  assert.deepEqual(logs, [{
    partnerId: 7,
    changedByType: 'super_admin',
    changedById: 99,
    oldStatus: 'active',
    newStatus: 'inactive',
    reason: 'User left the client account.',
  }]);
});