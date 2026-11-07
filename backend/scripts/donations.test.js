const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const test = require('node:test');
const { migrateDonationVerification } = require('../src/db/migrations');
const { verifyDonation } = require('../src/services/donationVerification');

function createDb() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE donations (
    id INTEGER PRIMARY KEY,
    amount REAL NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    verified_by INTEGER,
    created_at TEXT NOT NULL DEFAULT '2026-01-01'
  )`);
  return db;
}

test('migration adds verification timestamp and demotes unproven legacy records once', () => {
  const db = createDb();
  db.exec(`INSERT INTO donations (id, amount, verified) VALUES (1, 200, 1);
    INSERT INTO donations (id, amount, verified, verified_by) VALUES (2, 300, 1, 7);
    INSERT INTO donations (id, amount) VALUES (3, 400)`);

  migrateDonationVerification(db);
  const migrated = db.prepare('SELECT * FROM donations ORDER BY id').all();
  assert.equal(migrated[0].verified, 0);
  assert.equal(migrated[0].verified_by, null);
  assert.equal(migrated[0].verified_at, null);
  assert.equal(migrated[1].verified, 1);
  assert.equal(migrated[1].verified_by, 7);
  assert.equal(migrated[1].verified_at, null);
  assert.equal(migrated[2].verified, 0);

  db.prepare('UPDATE donations SET verified = 1, verified_by = 8 WHERE id = 3').run();
  migrateDonationVerification(db);
  assert.equal(db.prepare('SELECT verified FROM donations WHERE id = 3').get().verified, 1);
  db.close();
});

test('new payment claims default to pending and only an explicit verification records admin provenance', () => {
  const db = createDb();
  migrateDonationVerification(db);
  const insert = db.prepare('INSERT INTO donations (amount) VALUES (?)').run(500);
  const id = insert.lastInsertRowid;
  assert.deepEqual(db.prepare('SELECT verified, verified_by, verified_at FROM donations WHERE id = ?').get(id), {
    verified: 0,
    verified_by: null,
    verified_at: null
  });

  const verifiedAt = '2026-11-07T08:30:00.000Z';
  assert.deepEqual(verifyDonation(db, id, 42, { evidenceReviewed: true, verifiedAt }), { status: 'verified', verifiedAt });
  assert.deepEqual(db.prepare('SELECT verified, verified_by, verified_at FROM donations WHERE id = ?').get(id), {
    verified: 1,
    verified_by: 42,
    verified_at: verifiedAt
  });
  assert.deepEqual(verifyDonation(db, id, 99, { evidenceReviewed: true, verifiedAt: '2026-11-08T00:00:00.000Z' }), { status: 'already_verified' });
  assert.deepEqual(verifyDonation(db, 999, 42, { evidenceReviewed: true, verifiedAt }), { status: 'not_found' });
  assert.equal(db.prepare('SELECT verified_by FROM donations WHERE id = ?').get(id).verified_by, 42);
  assert.deepEqual(verifyDonation(db, id, 42), { status: 'evidence_required' });
  db.close();
});
