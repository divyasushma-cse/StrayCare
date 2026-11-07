const bcrypt = require('bcryptjs');

// Ensure the configured bootstrap account exists and keep the local demo login deterministic.
function ensureAdmin(database, configuration) {
  database = database || require('../db/database');
  configuration = configuration || require('../config/env');
  const existing = database.prepare('SELECT role, password_hash FROM users WHERE username = ?').get(configuration.admin.username);
  if (existing) {
    if (existing.role !== 'admin') {
      throw new Error(`Configured admin username "${configuration.admin.username}" is already assigned to a non-admin account.`);
    }
    const isLocalDefault = configuration.nodeEnv !== 'production'
      && configuration.admin.username === 'superadmin'
      && configuration.admin.password === 'StrayCareAdmin$2026';
    if (isLocalDefault && !bcrypt.compareSync(configuration.admin.password, existing.password_hash)) {
      const hash = bcrypt.hashSync(configuration.admin.password, 10);
      database.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(hash, configuration.admin.username);
      console.log('Reset local development admin password to the documented default.');
    }
    return;
  }
  const hash = bcrypt.hashSync(configuration.admin.password, 10);
  database.prepare("INSERT INTO users (username, password_hash, name, role, status) VALUES (?,?,?,'admin','active')")
    .run(configuration.admin.username, hash, configuration.admin.name);
  console.log(`Created initial admin "${configuration.admin.username}".`);
}

module.exports = { ensureAdmin };
