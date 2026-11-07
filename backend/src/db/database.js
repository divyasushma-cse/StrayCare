const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const env = require('../config/env');

fs.mkdirSync(path.dirname(env.dbPath), { recursive: true });
const db = new Database(env.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database', 'schema.sql'), 'utf8');
db.exec(schema);
const migrations = require('./migrations');
migrations.migrateReportCoordinates(db);
migrations.migrateDemoReports(db);
migrations.migrateDonationVerification(db);

module.exports = db;
