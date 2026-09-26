'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  REQUEST_STATUSES,
  normalizeLegacyRequestStatus,
  assertInitialRequestStatus,
  assertRequestTransition,
  getAllowedRequestTransitions,
  transitionRequestRecord,
} = require('../utils/requestStatus');

test('request status catalog is exactly the standardized lifecycle', () => {
  assert.deepEqual(REQUEST_STATUSES, [
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'NEEDS_INFORMATION',
    'APPROVED',
    'REJECTED',
    'INVOICE_PENDING',
    'PAYMENT_PENDING',
    'PAID',
    'PENDING_SCHEDULING',
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
  ]);
});

test('legacy request statuses migrate without changing their meaning', () => {
  assert.equal(normalizeLegacyRequestStatus('draft'), 'DRAFT');
  assert.equal(normalizeLegacyRequestStatus('pending_approval'), 'SUBMITTED');
  assert.equal(normalizeLegacyRequestStatus('approved'), 'APPROVED');
  assert.equal(normalizeLegacyRequestStatus('denied'), 'REJECTED');
  assert.equal(normalizeLegacyRequestStatus('completed'), 'COMPLETED');
  for (const status of REQUEST_STATUSES) {
    assert.equal(normalizeLegacyRequestStatus(status), status);
  }
});

test('state machine allows intended progression and rejects invalid jumps', () => {
  assert.equal(assertInitialRequestStatus('DRAFT'), 'DRAFT');
  assert.equal(assertInitialRequestStatus('SUBMITTED'), 'SUBMITTED');
  assert.equal(assertRequestTransition('DRAFT', 'SUBMITTED'), 'SUBMITTED');
  assert.equal(assertRequestTransition('SUBMITTED', 'APPROVED'), 'APPROVED');
  assert.throws(
    () => assertRequestTransition('DRAFT', 'COMPLETED'),
    /Invalid request status transition/
  );
});

test('invalid transition is blocked before the request record changes', () => {
  const request = {
    status: 'DRAFT',
  };
  assert.throws(() => transitionRequestRecord(request, 'COMPLETED'), /Invalid request status transition/);
  assert.equal(request.status, 'DRAFT');
});

test('pending scheduling is gated behind payment confirmation', () => {
  assert.throws(
    () => assertRequestTransition('PAYMENT_PENDING', 'PENDING_SCHEDULING'),
    /requires confirmed invoice payment/
  );
  assert.throws(
    () => transitionRequestRecord({ status: 'INVOICE_PENDING' }, 'PENDING_SCHEDULING'),
    /requires confirmed invoice payment/
  );
  assert.equal(
    assertRequestTransition('PAYMENT_PENDING', 'PENDING_SCHEDULING', { paymentConfirmed: true }),
    'PENDING_SCHEDULING'
  );
  assert.equal(
    assertRequestTransition('INVOICE_PENDING', 'PENDING_SCHEDULING', { paymentConfirmed: true }),
    'PENDING_SCHEDULING'
  );
  assert.equal(
    getAllowedRequestTransitions('PAYMENT_PENDING').includes('PENDING_SCHEDULING'),
    false
  );
});