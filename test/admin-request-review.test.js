'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

function makeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function loadAdminController(notifications = []) {
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../models' && parent?.filename.endsWith('/controller/admin.js')) {
      return { TeamMember: {} };
    }
    if (request === '../emailService' && parent?.filename.endsWith('/controller/admin.js')) {
      return { sendRequestStatusUpdateEmail: async (message) => notifications.push(message) };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    delete require.cache[require.resolve('../controller/admin')];
    return require('../controller/admin');
  } finally {
    Module._load = originalLoad;
  }
}

function makeReviewModels(initialStatus = 'SUBMITTED') {
  const history = [];
  const request = {
    id: 41,
    clientAccountId: 12,
    partnerId: 8,
    requestNumber: 'LLC-41',
    customerName: 'Test Customer',
    memorialLocation: 'Oak Property',
    status: initialStatus,
    save: async () => {},
  };
  return {
    history,
    request,
    models: {
      Admin: {},
      Partner: { findByPk: async () => null },
      MemorialRequest: { findByPk: async () => request },
      RequestStatusHistory: {
        create: async (values) => {
          const event = { id: history.length + 1, createdAt: new Date(), ...values };
          history.push(event);
          return event;
        },
      },
    },
  };
}

test('denial and information requests require a non-empty reason', async () => {
  const createController = loadAdminController();
  for (const status of ['REJECTED', 'NEEDS_INFORMATION']) {
    const fixture = makeReviewModels();
    const controller = createController(fixture.models);
    const response = makeResponse();
    await controller.updateRequestStatus({
      params: { id: 41 },
      body: { status },
      admin: { id: 5, email: 'super@example.com', role: 'super_admin' },
    }, response);
    assert.equal(response.statusCode, 400);
    assert.equal(fixture.request.status, 'SUBMITTED');
    assert.equal(fixture.history.length, 0);
  }
});

test('denial and information actions retain their reasons in history and notify the advisor', async () => {
  for (const [status, reason] of [
    ['REJECTED', 'Missing required authorization.'],
    ['NEEDS_INFORMATION', 'Please provide the section and lot number.'],
  ]) {
    const notifications = [];
    const createController = loadAdminController(notifications);
    const fixture = makeReviewModels();
    fixture.models.Partner.findByPk = async () => ({
      email: 'advisor@example.com',
      username: 'Advisor',
    });
    const controller = createController(fixture.models);
    const response = makeResponse();

    await controller.updateRequestStatus({
      params: { id: 41 },
      body: { status, reason },
      admin: { id: 5, email: 'super@example.com', role: 'super_admin' },
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(fixture.request.status, status);
    assert.equal(fixture.history.length, 1);
    assert.equal(fixture.history[0].reason, reason);
    assert.equal(fixture.history[0].changedByUserId, 5);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].recipientEmail, 'advisor@example.com');
    assert.equal(notifications[0].status, status);
    assert.equal(notifications[0].reason, reason);
  }
});

test('approval records both lifecycle transitions with actor and timestamp', async () => {
  const controllerFactory = loadAdminController();
  const fixture = makeReviewModels();
  const controller = controllerFactory(fixture.models);
  const response = makeResponse();

  await controller.updateRequestStatus({
    params: { id: 41 },
    body: { status: 'APPROVED' },
    admin: { id: 5, email: 'super@example.com', role: 'super_admin' },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(fixture.request.status, 'INVOICE_PENDING');
  assert.deepEqual(fixture.history.map(({ fromStatus, toStatus }) => [fromStatus, toStatus]), [
    ['SUBMITTED', 'APPROVED'],
    ['APPROVED', 'INVOICE_PENDING'],
  ]);
  assert.ok(fixture.history.every((event) =>
    event.changedByUserId === 5
      && event.changedByRole === 'super_admin'
      && event.createdAt instanceof Date
  ));
});

test('opening a submitted request sets UNDER_REVIEW and writes its history event', async () => {
  const controllerFactory = loadAdminController();
  const fixture = makeReviewModels();
  const controller = controllerFactory(fixture.models);
  const response = makeResponse();

  await controller.markRequestUnderReview({
    params: { id: 41 },
    admin: { id: 5, email: 'super@example.com', role: 'super_admin' },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(fixture.request.status, 'UNDER_REVIEW');
  assert.equal(fixture.history.length, 1);
  assert.equal(fixture.history[0].fromStatus, 'SUBMITTED');
  assert.equal(fixture.history[0].toStatus, 'UNDER_REVIEW');
  assert.equal(fixture.history[0].changedByUserId, 5);
});