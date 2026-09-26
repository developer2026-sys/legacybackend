'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canAdvisorViewRequest,
  buildAdvisorRequestScope,
  canAdvisorEditRequest,
  buildAdvisorSubmissionValues,
} = require('../utils/advisorRequestWorkflow');

test('submitted requests are visible to their advisor but cannot be edited or resubmitted', () => {
  const submitted = {
    id: 31,
    partnerId: 7,
    status: 'SUBMITTED',
    requestNumber: 'LLC-20260924-LOCKED',
    submittedAt: new Date('2026-09-24T18:00:00.000Z'),
  };

  assert.equal(canAdvisorViewRequest(submitted, 7), true);
  assert.equal(canAdvisorEditRequest(submitted, 7), false);
  assert.throws(() => buildAdvisorSubmissionValues({
    request: submitted,
    advisorId: 7,
    values: { customerName: 'Changed name' },
    generatedRequestNumber: 'LLC-NEW',
    submittedAt: new Date(),
  }), /not editable/);
});

test('returned requests can be edited and resubmitted without changing their ID, number, timestamp, or decision history', () => {
  const originalSubmittedAt = new Date('2026-09-20T16:15:00.000Z');
  const history = [{
    fromStatus: 'SUBMITTED',
    toStatus: 'NEEDS_INFORMATION',
    reason: 'Please provide the cemetery section.',
  }];
  const returned = {
    id: 42,
    partnerId: 8,
    status: 'NEEDS_INFORMATION',
    requestNumber: 'LLC-20260920-ORIGINAL',
    submittedAt: originalSubmittedAt,
    submittedByUserId: 8,
    statusHistory: history,
  };

  assert.equal(canAdvisorEditRequest(returned, 8), true);
  const update = buildAdvisorSubmissionValues({
    request: returned,
    advisorId: 8,
    values: { section: 'Garden C' },
    generatedRequestNumber: 'LLC-20260924-NEW',
    submittedAt: new Date('2026-09-24T19:00:00.000Z'),
  });
  const resubmitted = { ...returned, ...update };

  assert.equal(resubmitted.id, 42);
  assert.equal(resubmitted.status, 'SUBMITTED');
  assert.equal(resubmitted.requestNumber, 'LLC-20260920-ORIGINAL');
  assert.equal(resubmitted.submittedAt, originalSubmittedAt);
  assert.equal(resubmitted.section, 'Garden C');
  assert.deepEqual(resubmitted.statusHistory, [{
    fromStatus: 'SUBMITTED',
    toStatus: 'NEEDS_INFORMATION',
    reason: 'Please provide the cemetery section.',
  }]);
});

test('an advisor cannot view, edit, or resubmit another advisor’s request', () => {
  const otherAdvisorRequest = {
    id: 55,
    partnerId: 12,
    status: 'REJECTED',
    requestNumber: 'LLC-20260921-OTHER',
    submittedAt: new Date('2026-09-21T16:15:00.000Z'),
  };

  assert.equal(canAdvisorViewRequest(otherAdvisorRequest, 7), false);
  assert.deepEqual(buildAdvisorRequestScope(7), { partnerId: 7 });
  assert.equal(canAdvisorEditRequest(otherAdvisorRequest, 7), false);
  assert.throws(() => buildAdvisorSubmissionValues({
    request: otherAdvisorRequest,
    advisorId: 7,
    values: { notes: 'Attempted update' },
    generatedRequestNumber: 'LLC-NEW',
    submittedAt: new Date(),
  }), /not editable/);
});

test('a returned rejection can be resubmitted by the owning advisor', () => {
  const rejected = {
    id: 63,
    partnerId: 3,
    status: 'REJECTED',
    requestNumber: 'LLC-20260922-REJECTED',
    submittedAt: new Date('2026-09-22T12:00:00.000Z'),
  };

  assert.equal(canAdvisorEditRequest(rejected, 3), true);
  assert.equal(buildAdvisorSubmissionValues({
    request: rejected,
    advisorId: 3,
    values: {},
    generatedRequestNumber: 'LLC-NEW',
    submittedAt: new Date(),
  }).status, 'SUBMITTED');
});