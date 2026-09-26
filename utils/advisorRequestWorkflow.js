'use strict';

const ADVISOR_EDITABLE_STATUSES = Object.freeze([
  'DRAFT',
  'NEEDS_INFORMATION',
  'REJECTED',
]);

const sameId = (left, right) =>
  left !== undefined && left !== null &&
  right !== undefined && right !== null &&
  String(left) === String(right);

function advisorOwnsRequest(request, advisorId) {
  return Boolean(request && sameId(request.partnerId, advisorId));
}

function canAdvisorViewRequest(request, advisorId) {
  return advisorOwnsRequest(request, advisorId);
}

function buildAdvisorRequestScope(advisorId) {
  return { partnerId: advisorId };
}

function canAdvisorEditRequest(request, advisorId) {
  return advisorOwnsRequest(request, advisorId) &&
    ADVISOR_EDITABLE_STATUSES.includes(request.status);
}

function getSubmissionLockFields(request, generatedRequestNumber, submittedAt, advisorId) {
  return {
    requestNumber: request?.requestNumber || generatedRequestNumber,
    submittedAt: request?.submittedAt || submittedAt,
    submittedByUserId: request?.submittedByUserId || advisorId,
  };
}

function buildAdvisorSubmissionValues({
  request,
  advisorId,
  values,
  generatedRequestNumber,
  submittedAt,
}) {
  if (request && !canAdvisorEditRequest(request, advisorId)) {
    throw new Error('Request not found or not editable.');
  }
  return {
    ...values,
    ...getSubmissionLockFields(request, generatedRequestNumber, submittedAt, advisorId),
    status: 'SUBMITTED',
  };
}

module.exports = {
  ADVISOR_EDITABLE_STATUSES,
  advisorOwnsRequest,
  canAdvisorViewRequest,
  buildAdvisorRequestScope,
  canAdvisorEditRequest,
  getSubmissionLockFields,
  buildAdvisorSubmissionValues,
};