const assert = require('node:assert/strict');
const test = require('node:test');
const { canAccessReport } = require('../src/services/reportAccess');

const reporter = { id: 1, role: 'user' };
const admin = { id: 3, role: 'admin' };
const responderA = { id: 4, role: 'responder' };
const responderB = { id: 5, role: 'responder' };
const ownReport = { reporter_id: 1, responder_id: null, status: 'reported' };

test('reporters can access their own reports', () => {
  assert.equal(canAccessReport(reporter, ownReport), true);
  assert.equal(canAccessReport(reporter, { ...ownReport, reporter_id: 2 }), false);
});

test('admins can access any report', () => {
  assert.equal(canAccessReport(admin, { reporter_id: 2, responder_id: 5, status: 'completed' }), true);
});

test('responders can access open dispatch-pool reports', () => {
  assert.equal(canAccessReport(responderA, ownReport), true);
});

test('responders can access cases assigned to them, including closed cases', () => {
  assert.equal(canAccessReport(responderA, { reporter_id: 1, responder_id: 4, status: 'completed' }), true);
});

test('responders cannot access another responder cases or closed unassigned reports', () => {
  assert.equal(canAccessReport(responderA, { reporter_id: 1, responder_id: 5, status: 'completed' }), false);
  assert.equal(canAccessReport(responderA, { reporter_id: 1, responder_id: null, status: 'completed' }), false);
});
