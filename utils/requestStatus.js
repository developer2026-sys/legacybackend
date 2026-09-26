'use strict';

const REQUEST_STATUSES = Object.freeze([
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

const TRANSITIONS = Object.freeze({
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['UNDER_REVIEW', 'NEEDS_INFORMATION', 'APPROVED', 'REJECTED', 'CANCELLED'],
  UNDER_REVIEW: ['NEEDS_INFORMATION', 'APPROVED', 'REJECTED', 'CANCELLED'],
  NEEDS_INFORMATION: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['INVOICE_PENDING', 'PAYMENT_PENDING', 'CANCELLED'],
  REJECTED: [],
  INVOICE_PENDING: ['PAYMENT_PENDING', 'CANCELLED'],
  PAYMENT_PENDING: ['CANCELLED'],
  PAID: ['SCHEDULED', 'CANCELLED'],
  PENDING_SCHEDULING: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
});

// Reserved for a future, explicit Super Admin override workflow. No UI or
// endpoint exposes this until the override is designed and audited.
const PAYMENT_CONFIRMATION_OVERRIDE_ENABLED = false;

const LEGACY_STATUS_MAP = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'SUBMITTED',
  APPROVED: 'APPROVED',
  DENIED: 'REJECTED',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED',
});

function normalizeLegacyRequestStatus(value) {
  const normalized = String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (REQUEST_STATUSES.includes(normalized)) return normalized;
  return LEGACY_STATUS_MAP[normalized] || 'UNDER_REVIEW';
}

function isRequestStatus(status) {
  return REQUEST_STATUSES.includes(status);
}

function getAllowedRequestTransitions(status) {
  return TRANSITIONS[status] || [];
}

function assertInitialRequestStatus(status) {
  if (!['DRAFT', 'SUBMITTED'].includes(status)) {
    throw new Error(`A new request cannot start in ${status}.`);
  }
  return status;
}

function assertRequestTransition(fromStatus, toStatus, {
  paymentConfirmed = false,
  paymentOverride = false,
} = {}) {
  if (!isRequestStatus(toStatus)) {
    throw new Error(`Unknown request status: ${toStatus}.`);
  }
  if (fromStatus === toStatus) return toStatus;
  const confirmedPaymentTransition = toStatus === 'PENDING_SCHEDULING'
    && paymentConfirmed
    && ['INVOICE_PENDING', 'PAYMENT_PENDING'].includes(fromStatus);
  const authorizedOverride = toStatus === 'PENDING_SCHEDULING'
    && paymentOverride
    && PAYMENT_CONFIRMATION_OVERRIDE_ENABLED;
  if (toStatus === 'PENDING_SCHEDULING' && !confirmedPaymentTransition && !authorizedOverride) {
    throw new Error('PENDING_SCHEDULING requires confirmed invoice payment.');
  }
  const allowed = getAllowedRequestTransitions(fromStatus);
  if (!allowed.includes(toStatus) && !confirmedPaymentTransition && !authorizedOverride) {
    throw new Error(`Invalid request status transition from ${fromStatus} to ${toStatus}.`);
  }
  return toStatus;
}

function transitionRequestRecord(request, toStatus, options) {
  const nextStatus = assertRequestTransition(request.status, toStatus, options);
  request.status = nextStatus;
  return nextStatus;
}

module.exports = {
  REQUEST_STATUSES,
  TRANSITIONS,
  PAYMENT_CONFIRMATION_OVERRIDE_ENABLED,
  LEGACY_STATUS_MAP,
  normalizeLegacyRequestStatus,
  isRequestStatus,
  getAllowedRequestTransitions,
  assertInitialRequestStatus,
  assertRequestTransition,
  transitionRequestRecord,
};