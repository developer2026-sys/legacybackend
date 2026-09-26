'use strict';

// After
const STATUS_TO_ACTION = {
  APPROVED: 'REQUEST_APPROVED',
  REJECTED: 'REQUEST_DENIED',
  NEEDS_INFORMATION: 'REQUEST_INFO_REQUESTED',
  UNDER_REVIEW: 'REQUEST_OPENED_FOR_REVIEW',
  PENDING_SCHEDULING: 'REQUEST_PAYMENT_CONFIRMED',
  SCHEDULED: 'REQUEST_SCHEDULED',
  IN_PROGRESS: 'REQUEST_SERVICE_STARTED',
  COMPLETED: 'REQUEST_COMPLETED',
};

async function recordRequestStatusAudit(AuditLog, req, request, previousStatus, newStatus, notes, options) {
  if (!AuditLog?.create) return null;
  const actor = req.admin || req.partner;
  return AuditLog.create({
    userId: actor?.id,
    userRole: req.admin?.role || req.userRole || req.partner?.accountRole || 'system',
    clientId: request.clientAccountId ?? null,
    propertyId: request.locationId ?? null,
    requestId: request.id,
    action: STATUS_TO_ACTION[newStatus] || `REQUEST_STATUS_TO_${newStatus}`,
    previousStatus: previousStatus ?? null,
    newStatus,
    timestamp: new Date(),
    ipAddress: req.ip || null,
    notes: notes ?? null,
  }, options);
}

module.exports = { recordRequestStatusAudit };