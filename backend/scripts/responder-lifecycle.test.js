const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const test = require('node:test');
const { recoverResponderCases } = require('../src/services/responderLifecycle');

function createDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY);
    INSERT INTO users (id) VALUES (10), (20);
    CREATE TABLE reports (
      id INTEGER PRIMARY KEY,
      reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL,
      assigned_to TEXT,
      responder_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      responder_type TEXT,
      accepted_at TEXT,
      last_expanded_at TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE report_events (
      id INTEGER PRIMARY KEY,
      report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    );
    INSERT INTO reports VALUES
      (1, 10, 'accepted', 'NGO Team', 20, 'ngo', 'old-accept', 'old-expand', 'old-update'),
      (2, 10, 'onway', 'Veterinarian', 20, 'vet', 'old-accept', 'old-expand', 'old-update'),
      (3, 10, 'rescued', 'Volunteer', 20, 'volunteer', 'old-accept', 'old-expand', 'old-update'),
      (4, 10, 'completed', 'NGO Team', 20, 'ngo', 'old-accept', 'old-expand', 'old-update'),
      (5, 10, 'reported', NULL, NULL, NULL, NULL, 'old-expand', 'old-update'),
      (6, 10, 'accepted', 'Other responder', 10, 'ngo', 'old-accept', 'old-expand', 'old-update');
    INSERT INTO report_events (report_id, title, note, created_at)
      VALUES (3, 'Existing history', 'Keep closed-case history', 'old-event');`);
  return db;
}

test('reopens only responders active cases and records reassignment events', () => {
  const db = createDb();
  const at = '2026-11-07T08:30:00.000Z';
  const count = db.transaction(() => recoverResponderCases(db, 20, at))();
  assert.equal(count, 2);

  const activeReports = db.prepare('SELECT * FROM reports WHERE id IN (1, 2) ORDER BY id').all();
  for (const report of activeReports) {
    assert.equal(report.status, 'reported');
    assert.equal(report.assigned_to, null);
    assert.equal(report.responder_id, null);
    assert.equal(report.responder_type, null);
    assert.equal(report.accepted_at, null);
    assert.equal(report.last_expanded_at, at);
    assert.equal(report.updated_at, at);
    assert.equal(report.reporter_id, 10);
  }
  const events = db.prepare("SELECT report_id, title, note, created_at FROM report_events WHERE title = 'Responder Unavailable' ORDER BY report_id").all();
  assert.equal(events.length, 2);
  assert.deepEqual(events.map(event => event.report_id), [1, 2]);
  assert.ok(events.every(event => event.note.includes('dispatch pool') && event.created_at === at));

  const unchanged = db.prepare('SELECT status, responder_id, last_expanded_at, updated_at FROM reports WHERE id IN (3, 4, 5, 6) ORDER BY id').all();
  assert.deepEqual(unchanged, [
    { status: 'rescued', responder_id: 20, last_expanded_at: 'old-expand', updated_at: 'old-update' },
    { status: 'completed', responder_id: 20, last_expanded_at: 'old-expand', updated_at: 'old-update' },
    { status: 'reported', responder_id: null, last_expanded_at: 'old-expand', updated_at: 'old-update' },
    { status: 'accepted', responder_id: 10, last_expanded_at: 'old-expand', updated_at: 'old-update' }
  ]);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM report_events WHERE report_id = 3 AND title = 'Existing history'").get().n, 1);
  db.close();
});
