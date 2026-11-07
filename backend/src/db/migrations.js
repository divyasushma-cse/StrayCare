function migrateDonationVerification(db) {
  const columns = db.prepare('PRAGMA table_info(donations)').all().map(column => column.name);
  if (!columns.includes('verified_at')) {
    db.exec('ALTER TABLE donations ADD COLUMN verified_at TEXT');
    db.exec('UPDATE donations SET verified = 0, verified_by = NULL WHERE verified = 1 AND verified_by IS NULL');
  }
}

function migrateReportCoordinates(db) {
  const columns = db.prepare('PRAGMA table_info(reports)').all();
  const lat = columns.find(column => column.name === 'lat');
  const lng = columns.find(column => column.name === 'lng');
  if (!lat || !lng) throw new Error('Cannot migrate report coordinates: expected lat and lng columns.');
  if (!lat.notnull && !lng.notnull) return;

  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      db.exec(`CREATE TABLE reports_nullable_coordinates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        animal_type TEXT NOT NULL CHECK (animal_type IN ('Dog','Cat','Bird','Cow','Horse','Other')),
        severity TEXT NOT NULL CHECK (severity IN ('critical','moderate','mild')),
        description TEXT NOT NULL,
        location TEXT NOT NULL,
        lat REAL,
        lng REAL,
        photo_path TEXT,
        status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported','accepted','onway','rescued','completed')),
        radius_level INTEGER NOT NULL DEFAULT 0,
        radius_km REAL NOT NULL,
        last_expanded_at TEXT,
        assigned_to TEXT,
        responder_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        responder_type TEXT,
        pts_value INTEGER NOT NULL DEFAULT 0,
        points_awarded INTEGER NOT NULL DEFAULT 0,
        accepted_at TEXT,
        rescued_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      INSERT INTO reports_nullable_coordinates
        (id, reporter_id, animal_type, severity, description, location, lat, lng, photo_path, status,
         radius_level, radius_km, last_expanded_at, assigned_to, responder_id, responder_type, pts_value,
         points_awarded, accepted_at, rescued_at, created_at, updated_at)
      SELECT id, reporter_id, animal_type, severity, description, location, lat, lng, photo_path, status,
         radius_level, radius_km, last_expanded_at, assigned_to, responder_id, responder_type, pts_value,
         points_awarded, accepted_at, rescued_at, created_at, updated_at
      FROM reports;
      DROP TABLE reports;
      ALTER TABLE reports_nullable_coordinates RENAME TO reports;
      CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
      CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
      CREATE INDEX IF NOT EXISTS idx_reports_responder ON reports(responder_id);
      CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);`);
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

module.exports = { migrateDonationVerification, migrateReportCoordinates };
