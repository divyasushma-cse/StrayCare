const bcrypt = require('bcryptjs');
const db = require('../db/database');
const env = require('../config/env');

// Guarantees a first admin exists so the Access Control queue is reachable on a fresh database.
function ensureAdmin() {
  const hasAdmin = db.prepare("SELECT 1 FROM users WHERE role = 'admin' AND status = 'active'").get();
  if (hasAdmin) return;
  const hash = bcrypt.hashSync(env.admin.password, 10);
  db.prepare("INSERT OR IGNORE INTO users (username, password_hash, name, role, status) VALUES (?,?,?,'admin','active')")
    .run(env.admin.username, hash, env.admin.name);
  console.log(`Created initial admin "${env.admin.username}" (set ADMIN_USERNAME / ADMIN_PASSWORD in .env).`);
}

module.exports = { ensureAdmin };
