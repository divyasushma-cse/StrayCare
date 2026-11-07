const router = require('express').Router();
const db = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { HttpError, wrap, nowIso } = require('../utils/helpers');
const { DISPATCH_UNITS } = require('../utils/constants');
const { addEvent, present, BASE, getRow } = require('../services/reportService');
const exp = require('../services/exportService');
const { verifyDonation } = require('../services/donationVerification');
const { recoverResponderCases } = require('../services/responderLifecycle');
const donationPresent = require('./donations').present;

router.use(requireAuth, requireRole('admin'));

// ---- Live feed ----
router.get('/summary', (req, res) => {
  const n = sql => db.prepare(sql).get().n;
  res.json({
    total: n('SELECT COUNT(*) n FROM reports'),
    active: n("SELECT COUNT(*) n FROM reports WHERE status != 'completed'"),
    rescued: n("SELECT COUNT(*) n FROM reports WHERE status IN ('rescued','completed')"),
    critical: n("SELECT COUNT(*) n FROM reports WHERE severity = 'critical'"),
    open: n("SELECT COUNT(*) n FROM reports WHERE status = 'reported'")
  });
});

router.get('/reports', (req, res) => {
  const rows = db.prepare(`${BASE} ORDER BY r.id DESC LIMIT 500`).all();
  res.json({ reports: rows.map(r => present(r)) });
});

router.get('/units', (req, res) => res.json({ units: DISPATCH_UNITS }));

router.post('/reports/:id/dispatch', wrap(async (req, res) => {
  const unit = req.body && req.body.unit;
  if (!DISPATCH_UNITS.includes(unit)) throw new HttpError(400, 'Unknown dispatch unit');
  const ts = nowIso();
  const done = db.transaction(() => {
    const info = db.prepare(`UPDATE reports SET status = 'onway', assigned_to = ?, responder_type = 'admin', accepted_at = ?, updated_at = ?
      WHERE id = ? AND status = 'reported'`).run(unit, ts, ts, req.params.id);
    if (!info.changes) return false;
    addEvent(req.params.id, 'Force Dispatched', `Admin overrode system & assigned ${unit}`, ts);
    return true;
  })();
  if (!done) throw new HttpError(409, 'Only open cases can be force-dispatched');
  res.json({ report: present(getRow(req.params.id), { events: true }) });
}));

router.delete('/reports/:id', (req, res) => {
  const info = db.prepare('DELETE FROM reports WHERE id = ?').run(req.params.id);
  if (!info.changes) throw new HttpError(404, 'Report not found');
  res.json({ deleted: true });
});

// ---- Donation verification ----
router.get('/donations', (req, res) => {
  const unverifiedOnly = req.query.status === 'unverified';
  const rows = db.prepare(`SELECT * FROM donations ${unverifiedOnly ? 'WHERE verified = 0' : ''} ORDER BY id DESC`).all();
  res.json({ donations: rows.map(donationPresent) });
});

router.patch('/donations/:id/verify', (req, res) => {
  const result = verifyDonation(db, req.params.id, req.user.id, { evidenceReviewed: req.body && req.body.evidenceReviewed === true });
  if (result.status === 'evidence_required') throw new HttpError(400, 'Confirm that external payment evidence was reviewed before marking this claim verified');
  if (result.status === 'not_found') throw new HttpError(404, 'Donation claim not found');
  if (result.status === 'already_verified') throw new HttpError(409, 'Donation claim has already been verified');
  res.json({ verified: true, verifiedAt: result.verifiedAt });
});

// ---- Access control ----
const userOut = u => ({ id: u.id, username: u.username, name: u.name, role: u.role, status: u.status, responderType: u.responder_type });

router.get('/users', (req, res) => {
  const rows = db.prepare("SELECT * FROM users WHERE role IN ('responder','admin') ORDER BY id DESC").all();
  res.json({ users: rows.map(userOut) });
});

router.patch('/users/:id/approve', (req, res) => {
  const info = db.prepare("UPDATE users SET status = 'active' WHERE id = ? AND role IN ('responder','admin')").run(req.params.id);
  if (!info.changes) throw new HttpError(404, 'User not found');
  res.json({ status: 'active' });
});

router.patch('/users/:id/ban', (req, res) => {
  if (Number(req.params.id) === req.user.id) throw new HttpError(400, 'You cannot revoke your own access');
  const targetId = Number(req.params.id);
  const updated = db.transaction(() => {
    const target = db.prepare("SELECT role FROM users WHERE id = ? AND role IN ('responder','admin')").get(targetId);
    if (!target) return false;
    db.prepare("UPDATE users SET status = 'banned' WHERE id = ?").run(targetId);
    if (target.role === 'responder') recoverResponderCases(db, targetId);
    return true;
  })();
  if (!updated) throw new HttpError(404, 'User not found');
  res.json({ status: 'banned' });
});

router.delete('/users/:id', (req, res) => {
  if (Number(req.params.id) === req.user.id) throw new HttpError(400, 'You cannot delete your own account');
  const targetId = Number(req.params.id);
  const deleted = db.transaction(() => {
    const target = db.prepare("SELECT role FROM users WHERE id = ? AND role IN ('responder','admin')").get(targetId);
    if (!target) return false;
    if (target.role === 'responder') recoverResponderCases(db, targetId);
    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    return true;
  })();
  if (!deleted) throw new HttpError(404, 'User not found');
  res.json({ deleted: true });
});

// ---- Export center ----
router.get('/export', (req, res) => res.json({ categories: Object.entries(exp.CATEGORIES).map(([id, c]) => ({ id, ...c, formats: exp.FORMATS[id] })) }));

router.get('/export/:category', (req, res) => {
  const cat = req.params.category;
  if (!exp.CATEGORIES[cat]) throw new HttpError(404, 'Unknown export category');
  const format = req.query.format || 'preview';
  const stamp = new Date().toISOString().slice(0, 10);
  const file = (type, ext, body) => {
    res.set('Content-Type', type);
    if (req.query.download !== '0') res.set('Content-Disposition', `attachment; filename="straycare_${cat}_${stamp}.${ext}"`);
    res.send(body);
  };
  if (format === 'preview') return res.json(exp.preview(cat));
  if (!exp.FORMATS[cat].includes(format)) throw new HttpError(400, `Format ${format} is not available for this category`);
  if (format === 'csv') return file('text/csv; charset=utf-8', 'csv', exp.toCsvFile(cat));
  if (format === 'json') return file('application/json', 'json', exp.toJsonFile(cat));
  if (format === 'ai') return file('text/plain; charset=utf-8', 'txt', exp.toAiPrompt(cat));
  if (format === 'pdf') { res.set('Content-Type', 'text/html; charset=utf-8'); return res.send(exp.toPrintHtml(cat)); }
  throw new HttpError(400, 'Unknown format');
});

module.exports = router;
