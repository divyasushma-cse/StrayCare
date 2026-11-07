const router = require('express').Router();
const db = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { HttpError } = require('../utils/helpers');
const { NGO_UPI } = require('../utils/constants');

const present = d => ({
  id: d.id,
  ngo: d.ngo,
  amount: d.amount,
  name: d.donor_name,
  date: d.created_at.slice(0, 10),
  status: d.verified ? 'verified' : 'pending',
  verified: !!d.verified,
  verifiedAt: d.verified_at || null
});

router.get('/ngos', (req, res) => res.json({ ngos: Object.entries(NGO_UPI).map(([name, upi]) => ({ name, upi })) }));

router.use(requireAuth, requireRole('user'));

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM donations WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  res.json({ donations: rows.map(present) });
});

router.post('/', (req, res) => {
  const amount = Number(req.body.amount);
  const ngo = String(req.body.ngo || '');
  const name = String(req.body.name || '').trim().slice(0, 80) || 'Anonymous';
  if (!Number.isFinite(amount) || amount < 1) throw new HttpError(400, 'Please enter a valid amount (minimum ₹1)');
  if (amount > 100000) throw new HttpError(400, 'Maximum donation amount is ₹1,00,000');
  if (!NGO_UPI[ngo]) throw new HttpError(400, 'Unknown NGO');
  const info = db.prepare('INSERT INTO donations (user_id, ngo, amount, donor_name) VALUES (?,?,?,?)').run(req.user.id, ngo, amount, name);
  res.status(201).json({ donation: present(db.prepare('SELECT * FROM donations WHERE id = ?').get(info.lastInsertRowid)) });
});

module.exports = router;
module.exports.present = present;
