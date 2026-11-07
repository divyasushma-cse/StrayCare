const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const db = require('../db/database');
const env = require('../config/env');
const { requireAuth, requireRole } = require('../middleware/auth');
const { HttpError, wrap, nowIso } = require('../utils/helpers');
const { RADII, POINTS, ANIMAL_TYPES, SEVERITIES, RESPONDER_TYPES, TIMELINE_LABELS } = require('../utils/constants');
const { addEvent, present, BASE, getRow } = require('../services/reportService');
const { canAccessReport } = require('../services/reportAccess');
const { parseCoordinates, filterNearby } = require('../services/reportCoordinates');
const { haversineKm } = require('../utils/helpers');

const reportSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: req => `user:${req.user.id}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many report submissions. Try again later.' }
});

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const upload = multer({
  storage: multer.diskStorage({
    destination: env.uploadDir,
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + EXT[file.mimetype])
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (EXT[file.mimetype] ? cb(null, true) : cb(new HttpError(400, 'Photo must be a JPG, PNG, WebP or GIF image')))
});

router.use(requireAuth);

// ---- Reporter ----
router.post('/', requireRole('user'), reportSubmitLimiter, upload.single('photo'), wrap(async (req, res) => {
  let reportPersisted = false;
  try {
    const { type, severity, desc, loc } = req.body;
    if (!ANIMAL_TYPES.includes(type)) throw new HttpError(400, 'Please select animal type');
    if (!SEVERITIES.includes(severity)) throw new HttpError(400, 'Please select severity level');
    if (String(desc || '').trim().length < 10) throw new HttpError(400, "Please describe the animal's condition (at least 10 characters)");
    if (!String(loc || '').trim()) throw new HttpError(400, 'Please enter a location or tap GPS');

    const { lat, lng } = parseCoordinates(req.body.lat, req.body.lng);
    const pts = POINTS[severity];
    const id = db.transaction(() => {
      const info = db.prepare(`INSERT INTO reports (reporter_id, animal_type, severity, description, location, lat, lng, photo_path, radius_km, pts_value)
        VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .run(req.user.id, type, severity, String(desc).trim(), String(loc).trim(), lat, lng, req.file ? req.file.filename : null, RADII[severity][0], pts);
      addEvent(info.lastInsertRowid, 'Reported', `Report submitted by ${req.user.name}`);
      return info.lastInsertRowid;
    })();
    reportPersisted = true;
    res.status(201).json({ report: present(getRow(id), { events: true }), pointsOnRescue: pts });
  } catch (error) {
    if (req.file && !reportPersisted) {
      try {
        await fs.promises.unlink(req.file.path);
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') console.error('Failed to remove photo for rejected report submission', cleanupError);
      }
    }
    throw error;
  }
}));

router.get('/mine', requireRole('user'), (req, res) => {
  const rows = db.prepare(`${BASE} WHERE r.reporter_id = ? ORDER BY r.id DESC`).all(req.user.id);
  res.json({ reports: rows.map(r => present(r)) });
});

// ---- Responder ----
router.get('/open', requireRole('responder'), (req, res) => {
  let rows = db.prepare(`${BASE} WHERE r.status = 'reported' AND r.is_demo = 0 ORDER BY (r.severity = 'critical') DESC, r.created_at DESC, r.id DESC`).all();
  const lat = parseFloat(req.query.lat), lng = parseFloat(req.query.lng);
  if (req.query.nearby === '1' && !Number.isNaN(lat) && !Number.isNaN(lng)) rows = filterNearby(rows, lat, lng, haversineKm);
  res.json({ reports: rows.map(r => present(r)) });
});

router.get('/assigned', requireRole('responder'), (req, res) => {
  const rows = db.prepare(`${BASE} WHERE r.responder_id = ? AND r.status != 'completed' ORDER BY r.id DESC`).all(req.user.id);
  res.json({ reports: rows.map(r => present(r)) });
});

router.get('/responder-stats', requireRole('responder'), (req, res) => {
  const q = (sql, ...p) => db.prepare(sql).get(...p).n;
  res.json({
    open: q("SELECT COUNT(*) n FROM reports WHERE status = 'reported' AND is_demo = 0"),
    accepted: q('SELECT COUNT(*) n FROM reports WHERE responder_id = ?', req.user.id),
    completed: q("SELECT COUNT(*) n FROM reports WHERE responder_id = ? AND status = 'completed'", req.user.id),
    critical: q("SELECT COUNT(*) n FROM reports WHERE status = 'reported' AND severity = 'critical' AND is_demo = 0")
  });
});

router.get('/:id/photo', (req, res, next) => {
  const row = getRow(req.params.id);
  if (!row) throw new HttpError(404, 'Report not found');
  if (!canAccessReport(req.user, row)) throw new HttpError(403, 'Access denied');
  if (!row.photo_path || path.basename(row.photo_path) !== row.photo_path) throw new HttpError(404, 'Photo not found');

  const photoPath = path.resolve(env.uploadDir, row.photo_path);
  if (path.dirname(photoPath) !== path.resolve(env.uploadDir)) throw new HttpError(404, 'Photo not found');
  res.set('Cache-Control', 'private, no-store');
  res.sendFile(photoPath, err => { if (err) next(err); });
});

router.get('/:id', wrap(async (req, res) => {
  const row = getRow(req.params.id);
  if (!row) throw new HttpError(404, 'Report not found');
  if (!canAccessReport(req.user, row)) throw new HttpError(403, 'Access denied');
  res.json({ report: present(row, { events: true }) });
}));

router.post('/:id/accept', requireRole('responder'), wrap(async (req, res) => {
  const type = req.user.responder_type || 'ngo';
  const label = RESPONDER_TYPES[type];
  const ts = nowIso();
  const done = db.transaction(() => {
    // Conditional update makes concurrent accepts safe: only one responder wins.
    const info = db.prepare(`UPDATE reports SET status = 'accepted', assigned_to = ?, responder_id = ?, responder_type = ?, accepted_at = ?, updated_at = ?
      WHERE id = ? AND status = 'reported'`).run(label, req.user.id, type, ts, ts, req.params.id);
    if (!info.changes) return false;
    addEvent(req.params.id, 'Request Accepted', `Accepted by ${label}`, ts);
    return true;
  })();
  if (!done) throw new HttpError(409, 'This case is no longer open');
  res.json({ report: present(getRow(req.params.id), { events: true }) });
}));

const NEXT = { accepted: 'onway', onway: 'rescued', rescued: 'completed' };

router.post('/:id/status', requireRole('responder'), wrap(async (req, res) => {
  const ns = req.body && req.body.status;
  if (!TIMELINE_LABELS[ns]) throw new HttpError(400, 'Invalid status');
  const row = getRow(req.params.id);
  if (!row) throw new HttpError(404, 'Report not found');
  if (row.responder_id !== req.user.id) throw new HttpError(403, 'This case is not assigned to you');
  if (NEXT[row.status] !== ns) throw new HttpError(409, `Cannot move a ${row.status} case to ${ns}`);

  const ts = nowIso();
  let awarded = 0;
  db.transaction(() => {
    db.prepare('UPDATE reports SET status = ?, updated_at = ?, rescued_at = CASE WHEN ? = \'rescued\' THEN ? ELSE rescued_at END WHERE id = ?')
      .run(ns, ts, ns, ts, row.id);
    addEvent(row.id, TIMELINE_LABELS[ns], 'Status updated by responder', ts);
    if (ns === 'rescued' && row.pts_value && !row.points_awarded && row.reporter_id) {
      db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(row.pts_value, row.reporter_id);
      db.prepare('UPDATE reports SET points_awarded = 1 WHERE id = ?').run(row.id);
      awarded = row.pts_value;
    }
  })();
  res.json({ report: present(getRow(row.id), { events: true }), pointsAwarded: awarded });
}));

router.post('/:id/drop', requireRole('responder'), wrap(async (req, res) => {
  const row = getRow(req.params.id);
  if (!row) throw new HttpError(404, 'Report not found');
  if (row.responder_id !== req.user.id || row.status !== 'accepted') throw new HttpError(409, 'Only your accepted cases can be dropped');
  const ts = nowIso();
  db.transaction(() => {
    // Restart the expansion clock so the case resumes searching from its current radius.
    db.prepare(`UPDATE reports SET status = 'reported', assigned_to = NULL, responder_id = NULL, responder_type = NULL,
      accepted_at = NULL, last_expanded_at = ?, updated_at = ? WHERE id = ?`).run(ts, ts, row.id);
    addEvent(row.id, 'Dropped', 'Responder dropped the case. Resuming search.', ts);
  })();
  res.json({ report: present(getRow(row.id), { events: true }) });
}));

module.exports = router;
