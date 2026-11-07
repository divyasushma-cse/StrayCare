const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const test = require('node:test');
const { migrateReportCoordinates } = require('../src/db/migrations');
const { parseCoordinates, hasCoordinates, filterNearby } = require('../src/services/reportCoordinates');
const { haversineKm } = require('../src/utils/helpers');

test('typed-address reports without GPS have null coordinates', () => {
  assert.deepEqual(parseCoordinates(undefined, undefined), { lat: null, lng: null });
  assert.deepEqual(parseCoordinates('', ''), { lat: null, lng: null });
  assert.deepEqual(parseCoordinates('13.08', '80.27'), { lat: 13.08, lng: 80.27 });
  assert.deepEqual(parseCoordinates('0', '0'), { lat: 0, lng: 0 });
});

test('rejects partial, malformed, and out-of-range GPS pairs', () => {
  for (const pair of [['13.08', undefined], [undefined, '80.27'], ['lat', '80.27'], ['91', '80.27'], ['13', '181']]) {
    assert.throws(() => parseCoordinates(...pair), error => error.status === 400);
  }
});

test('nearby filtering excludes unknown coordinates and preserves actual nearby reports', () => {
  const rows = [
    { id: 1, lat: 13.08, lng: 80.27, radius_km: 5 },
    { id: 2, lat: null, lng: null, radius_km: 100 },
    { id: 3, lat: 13.2, lng: 80.4, radius_km: 5 },
    { id: 4, lat: undefined, lng: undefined, radius_km: 5 }
  ];
  assert.equal(hasCoordinates(rows[0]), true);
  assert.equal(hasCoordinates(rows[1]), false);
  const result = filterNearby(rows, 13.08, 80.27, haversineKm);
  assert.deepEqual(result.map(row => row.id), [1]);
  assert.equal(result[0].distance_km, 0);
});

test('legacy report migration makes coordinates nullable and preserves rows and event foreign keys', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY);
    INSERT INTO users (id) VALUES (1);
    CREATE TABLE reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      animal_type TEXT NOT NULL CHECK (animal_type IN ('Dog','Cat','Bird','Cow','Horse','Other')),
      severity TEXT NOT NULL CHECK (severity IN ('critical','moderate','mild')),
      description TEXT NOT NULL, location TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
      photo_path TEXT, status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported','accepted','onway','rescued','completed')),
      radius_level INTEGER NOT NULL DEFAULT 0, radius_km REAL NOT NULL, last_expanded_at TEXT,
      assigned_to TEXT, responder_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      responder_type TEXT, pts_value INTEGER NOT NULL DEFAULT 0, points_awarded INTEGER NOT NULL DEFAULT 0,
      accepted_at TEXT, rescued_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_reports_status ON reports(status);
    CREATE INDEX idx_reports_reporter ON reports(reporter_id);
    CREATE INDEX idx_reports_responder ON reports(responder_id);
    CREATE INDEX idx_reports_created ON reports(created_at);
    INSERT INTO reports (id, reporter_id, animal_type, severity, description, location, lat, lng, radius_km, created_at, updated_at)
      VALUES (7, 1, 'Dog', 'mild', 'Legacy report', 'Typed street address', 13.08, 80.27, 2, 'created', 'updated');
    CREATE TABLE report_events (id INTEGER PRIMARY KEY, report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE);
    INSERT INTO report_events (id, report_id) VALUES (9, 7);`);

  migrateReportCoordinates(db);
  const info = db.prepare('PRAGMA table_info(reports)').all();
  assert.equal(info.find(column => column.name === 'lat').notnull, 0);
  assert.equal(info.find(column => column.name === 'lng').notnull, 0);
  assert.deepEqual(db.prepare('SELECT id, location, lat, lng FROM reports WHERE id = 7').get(), {
    id: 7, location: 'Typed street address', lat: 13.08, lng: 80.27
  });
  db.prepare(`INSERT INTO reports (reporter_id, animal_type, severity, description, location, lat, lng, radius_km, created_at, updated_at)
    VALUES (1, 'Cat', 'mild', 'No GPS report', 'Another typed address', NULL, NULL, 2, 'created', 'updated')`).run();
  assert.deepEqual(db.prepare('SELECT lat, lng FROM reports WHERE id = 8').get(), { lat: null, lng: null });
  assert.equal(db.prepare('SELECT report_id FROM report_events WHERE id = 9').get().report_id, 7);
  assert.deepEqual(db.pragma('foreign_key_check'), []);
  assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
  db.close();
});
