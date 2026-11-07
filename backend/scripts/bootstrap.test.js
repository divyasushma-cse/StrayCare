const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const test = require('node:test');
const { ensureAdmin } = require('../src/services/bootstrap');

const config = {
  admin: {
    username: 'superadmin',
    password: 'StrayCareAdmin$2026',
    name: 'Chief Admin'
  }
};

function createDb() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
  )`);
  return db;
}

test('bootstrap provisions the configured admin even if another admin exists', () => {
  const db = createDb();
  db.prepare("INSERT INTO users (username, password_hash, name, role) VALUES ('other-admin', 'existing-hash', 'Other Admin', 'admin')").run();

  ensureAdmin(db, config);
  const created = db.prepare('SELECT * FROM users WHERE username = ?').get('superadmin');
  assert.equal(created.name, 'Chief Admin');
  assert.equal(created.role, 'admin');
  assert.equal(created.status, 'active');
  assert.equal(bcrypt.compareSync('StrayCareAdmin$2026', created.password_hash), true);

  ensureAdmin(db, config);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users WHERE username = 'superadmin'").get().n, 1);
  assert.equal(db.prepare("SELECT password_hash FROM users WHERE username = 'other-admin'").get().password_hash, 'existing-hash');
  db.close();
});

test('bootstrap resets an existing local superadmin password to the documented default', () => {
  const db = createDb();
  db.prepare("INSERT INTO users (username, password_hash, name, role) VALUES ('superadmin', 'existing-hash', 'Chief Admin', 'admin')").run();
  ensureAdmin(db, config);
  const existing = db.prepare("SELECT password_hash FROM users WHERE username = 'superadmin'").get();
  assert.equal(bcrypt.compareSync('StrayCareAdmin$2026', existing.password_hash), true);
  db.close();
});

test('bootstrap preserves an existing production admin password', () => {
  const db = createDb();
  const productionConfig = {
    nodeEnv: 'production',
    admin: { username: 'ops-admin', password: 'unique-production-password', name: 'Operations Admin' }
  };
  db.prepare("INSERT INTO users (username, password_hash, name, role) VALUES ('ops-admin', 'existing-hash', 'Operations Admin', 'admin')").run();
  ensureAdmin(db, productionConfig);
  assert.equal(db.prepare("SELECT password_hash FROM users WHERE username = 'ops-admin'").get().password_hash, 'existing-hash');
  db.close();
});

test('bootstrap fails clearly if configured username belongs to a non-admin', () => {
  const db = createDb();
  db.prepare("INSERT INTO users (username, password_hash, name, role) VALUES ('superadmin', 'existing-hash', 'Community Member', 'user')").run();
  assert.throws(() => ensureAdmin(db, config), /already assigned to a non-admin/);
  db.close();
});
