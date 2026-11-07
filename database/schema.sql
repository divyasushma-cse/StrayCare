-- StrayCare database schema (SQLite). Applied automatically on server start.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash  TEXT    NOT NULL,
  name           TEXT    NOT NULL,
  role           TEXT    NOT NULL CHECK (role IN ('user','responder','admin')),
  is_demo        INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1)),
  status         TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','banned')),
  responder_type TEXT             CHECK (responder_type IN ('ngo','vet','volunteer')),
  points         INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS reports (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  animal_type        TEXT    NOT NULL CHECK (animal_type IN ('Dog','Cat','Bird','Cow','Horse','Other')),
  severity           TEXT    NOT NULL CHECK (severity IN ('critical','moderate','mild')),
  description        TEXT    NOT NULL,
  location           TEXT    NOT NULL,
  lat                REAL,
  lng                REAL,
  photo_path         TEXT,
  status             TEXT    NOT NULL DEFAULT 'reported'
                     CHECK (status IN ('reported','accepted','onway','rescued','completed')),
  radius_level       INTEGER NOT NULL DEFAULT 0,
  radius_km          REAL    NOT NULL,
  last_expanded_at   TEXT,
  assigned_to        TEXT,
  responder_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  responder_type     TEXT,                       -- ngo | vet | volunteer | admin
  is_demo            INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1)),
  pts_value          INTEGER NOT NULL DEFAULT 0, -- points the reporter earns on rescue
  points_awarded     INTEGER NOT NULL DEFAULT 0, -- 1 once points were paid (prevents double award)
  accepted_at        TEXT,
  rescued_at         TEXT,
  created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_reports_status    ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_reporter  ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_responder ON reports(responder_id);
CREATE INDEX IF NOT EXISTS idx_reports_created   ON reports(created_at);

CREATE TABLE IF NOT EXISTS report_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id  INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  title      TEXT    NOT NULL,
  note       TEXT,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_events_report ON report_events(report_id);

CREATE TABLE IF NOT EXISTS donations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ngo        TEXT    NOT NULL,
  amount     REAL    NOT NULL CHECK (amount >= 1 AND amount <= 100000),
  donor_name TEXT    NOT NULL DEFAULT 'Anonymous',
  verified   INTEGER NOT NULL DEFAULT 0,
  verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  verified_at TEXT,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_donations_user ON donations(user_id);
