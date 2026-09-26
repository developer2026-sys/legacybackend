'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CHANNELS,
  NOTIFICATION_EVENTS,
  createNotificationService,
} = require('../services/notificationService');
const { createNotificationRecipients } = require('../services/notificationRecipients');

test('notification delivery defaults to email without coupling workflow events to email APIs', async () => {
  const delivered = [];
  const service = createNotificationService({
    channels: {
      email: {
        sendRequestStatusUpdateEmail: async (message) => {
          delivered.push(message);
          return { id: 'email-1' };
        },
      },
    },
  });

  await service.sendNotification({
    type: NOTIFICATION_EVENTS.REQUEST_STATUS_CHANGED,
    payload: { requestNumber: 'LLC-1', status: 'APPROVED' },
  }, { email: 'advisor@example.com', contactName: 'Advisor' });

  assert.deepEqual(delivered, [{
    requestNumber: 'LLC-1',
    status: 'APPROVED',
    recipientEmail: 'advisor@example.com',
    recipientName: 'Advisor',
  }]);
  assert.deepEqual(service.getChannels(), [CHANNELS.EMAIL]);
});

test('new channels can be registered without changing event or workflow code', async () => {
  const delivered = [];
  const service = createNotificationService({
    channels: {
      email: {
        sendRequestStatusUpdateEmail: async () => {},
      },
    },
  });
  service.registerChannel(CHANNELS.IN_APP, async (event, recipient) => {
    delivered.push({ event, recipient });
  });

  await service.sendNotification(
    { type: NOTIFICATION_EVENTS.REQUEST_STATUS_CHANGED, payload: { status: 'PAID' } },
    { email: 'advisor@example.com', id: 12 },
    CHANNELS.IN_APP,
  );

  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].event.payload.status, 'PAID');
  assert.equal(delivered[0].recipient.id, 12);
});

test('recipient policy deduplicates monument recipients independently of delivery', async () => {
  const recipients = createNotificationRecipients({
    Op: { ne: Symbol('not-equal') },
    Partner: {
      findOne: async () => ({ id: 8, email: 'advisor@example.com', username: 'Advisor' }),
      findAll: async () => ([
        { id: 9, email: 'advisor@example.com', username: 'Client admin' },
        { id: 10, email: 'admin@example.com', username: 'Admin' },
      ]),
    },
  });

  const result = await recipients.forMonumentSettingStatusChanged({
    partnerId: 8,
    clientAccountId: 12,
  });

  assert.deepEqual(result.map(({ email }) => email), [
    'advisor@example.com',
    'admin@example.com',
  ]);
});