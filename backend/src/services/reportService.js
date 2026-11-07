const db = require('../db/database');
const { code, haversineKm, nowIso } = require('../utils/helpers');
const { hasCoordinates, filterNearby } = require('./reportCoordinates');

const addEvent = (reportId, title, note, at = nowIso()) =>
  db.prepare('INSERT INTO report_events (report_id, title, note, created_at) VALUES (?,?,?,?)').run(reportId, title, note || null, at);

// Shape a DB row for the API (adds the SC-n code, photo url, timeline).
function present(row, { events = false } = {}) {
  if (!row) return null;
  const out = {
    id: row.id,
    code: code(row.id),
    type: row.animal_type,
    severity: row.severity,
    desc: row.description,
    loc: row.location,
    lat: row.lat,
    lng: row.lng,
    hasCoordinates: hasCoordinates(row),
    photo: row.photo_path ? `/api/reports/${row.id}/photo` : null,
    status: row.status,
    radiusLevel: row.radius_level,
    radiusKm: row.radius_km,
    assignedTo: row.assigned_to,
    responderType: row.responder_type,
    reporter: row.reporter_name || null,
    ts: row.created_at
  };
  if (row.distance_km !== undefined) out.distanceKm = row.distance_km;
  if (events) {
    out.timeline = db.prepare('SELECT title AS s, note AS n, created_at AS t FROM report_events WHERE report_id = ? ORDER BY id').all(row.id);
  }
  return out;
}

const BASE = `SELECT r.*, u.name AS reporter_name FROM reports r LEFT JOIN users u ON u.id = r.reporter_id`;

const getRow = id => db.prepare(`${BASE} WHERE r.id = ?`).get(id);

module.exports = {
  addEvent,
  present,
  BASE,
  getRow,
  filterNearby: (rows, lat, lng) => filterNearby(rows, lat, lng, haversineKm)
};
