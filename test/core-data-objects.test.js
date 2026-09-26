'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL ||= 'mysql://user:password@localhost/lasting_legacy_test';

const models = require('../models');

test('core domain names resolve to one canonical request and user table', () => {
  assert.equal(models.ServiceRequest, models.MemorialRequest);
  assert.equal(models.User, models.Partner);
  assert.equal(models.Photo, models.RequestPhoto);
  assert.equal(models.Attachment, models.RequestPhoto);
  assert.equal(models.ActivityEvent, models.AuditLog);
});

test('operational records require the originating request ID', () => {
  for (const model of [
    models.ApprovalEvent,
    models.Payment,
    models.WorkOrder,
    models.Schedule,
  ]) {
    assert.equal(model.rawAttributes.requestId.allowNull, false, `${model.name}.requestId`);
  }
  assert.equal(models.Invoice.rawAttributes.requestId.allowNull, false);
  assert.equal(models.RequestPhoto.rawAttributes.requestId.allowNull, false);
  assert.equal(models.AuditLog.rawAttributes.requestId.allowNull, false);
});

test('payment and work order are linked back to invoice and request', () => {
  assert.equal(models.Payment.rawAttributes.invoiceId.allowNull, false);
  assert.equal(models.WorkOrder.rawAttributes.requestId.unique, true);
  assert.equal(models.Invoice.rawAttributes.pricingSnapshot.field, 'pricing_snapshot');
});