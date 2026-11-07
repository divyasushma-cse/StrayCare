const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const test = require('node:test');
const { migrateDemoReports } = require('../src/db/migrations');

function createDb() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL
  );
  CREATE TABLE reports (
    id INTEGER PRIMARY KEY,
    reporter_id INTEGER,
    animal_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL
  );
  INSERT INTO users (id, username, name, role) VALUES
    (1, 'user1', 'Priya S.', 'user'),
    (2, 'regular', 'Regular User', 'user'),
    (3, 'ngo1', 'Blue Cross NGO', 'responder');
  INSERT INTO reports (id, reporter_id, animal_type, severity, description, location) VALUES
    (1, 1, 'Dog', 'mild', 'Demo history record for analytics.', 'Chennai'),
    (2, 1, 'Dog', 'critical', 'Hit by vehicle near the signal, bleeding from hind leg. Cannot walk.', 'Adyar Signal, Chennai'),
    (3, 2, 'Cat', 'mild', 'A real report that should stay real.', 'Typed address'),
    (4, 3, 'Dog', 'critical', 'An unrelated matching phrase.', 'Another address');`);
  return db;
}

test('demo migration marks seeded fixtures and preserves ordinary reports as non-demo', () => {
  const db = createDb();
  migrateDemoReports(db);
  assert.deepEqual(db.prepare('SELECT username, is_demo FROM users ORDER BY id').all(), [
    { username: 'user1', is_demo: 1 },
    { username: 'regular', is_demo: 0 },
    { username: 'ngo1', is_demo: 1 }
  ]);
  assert.deepEqual(db.prepare('SELECT id, is_demo FROM reports ORDER BY id').all(), [
    { id: 1, is_demo: 1 },
    { id: 2, is_demo: 1 },
    { id: 3, is_demo: 0 },
    { id: 4, is_demo: 0 }
  ]);
  db.close();
});

test('demo migration is safe to run repeatedly and new reports default to real', () => {
  const db = createDb();
  migrateDemoReports(db);
  db.prepare(`INSERT INTO reports (id, reporter_id, animal_type, severity, description, location)
    VALUES (5, 2, 'Bird', 'mild', 'Recently filed report.', 'New address')`).run();
  migrateDemoReports(db);
  assert.equal(db.prepare('SELECT is_demo FROM reports WHERE id = 5').get().is_demo, 0);
  db.close();
});
