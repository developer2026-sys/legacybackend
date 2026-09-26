'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const Module = require('node:module');

function makeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function loadAdminAuth(adminRecord) {
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../models' && parent?.filename.endsWith('/middleware/admin.js')) {
      return { Admin: { findByPk: async () => adminRecord } };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    delete require.cache[require.resolve('../middleware/admin')];
    return require('../middleware/admin');
  } finally {
    Module._load = originalLoad;
  }
}

test('client admin and family advisor tokens cannot authenticate as Super Admin by ID collision', async () => {
  for (const accountRole of ['client_admin', 'family_advisor']) {
    const adminAuth = loadAdminAuth({ id: 9, role: 'super_admin' });
    const token = jwt.sign(
      { id: 9, role: 'partner', accountRole, clientAccountId: 22 },
      'change_me_in_env',
    );
    const response = makeResponse();
    let nextCalled = false;
    await adminAuth(
      { headers: { authorization: `Bearer ${token}` } },
      response,
      () => { nextCalled = true; },
    );
    assert.equal(response.statusCode, 403);
    assert.equal(nextCalled, false);
  }
});

test('a signed Super Admin token is checked against the current Admin record', async () => {
  const adminAuth = loadAdminAuth({ id: 9, role: 'super_admin', email: 'super@example.com' });
  const token = jwt.sign({ id: 9, role: 'super_admin' }, 'change_me_in_env');
  const response = makeResponse();
  let nextCalled = false;
  const request = { headers: { authorization: `Bearer ${token}` } };
  await adminAuth(request, response, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(request.userRole, 'super_admin');
});