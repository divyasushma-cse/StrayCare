const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { sign, requireAuth, requireRole } = require('../middleware/auth');
const { HttpError, wrap } = require('../utils/helpers');

const USERNAME_RE = /^[a-zA-Z0-9_]{4,20}$/;
const publicUser = u => ({ id: u.id, username: u.username, name: u.name, role: u.role, responderType: u.responder_type, points: u.points });

router.get('/username-available', (req, res) => {
  const un = String(req.query.username || '').trim();
  if (!USERNAME_RE.test(un)) return res.json({ available: false, reason: 'invalid' });
  const taken = db.prepare('SELECT 1 FROM users WHERE username = ?').get(un);
  res.json({ available: !taken });
});

router.post('/register', wrap(async (req, res) => {
  const { name, username, password, role, responderType } = req.body || {};
  const fullname = String(name || '').trim();
  const un = String(username || '').trim();
  if (!['user', 'responder', 'admin'].includes(role)) throw new HttpError(400, 'Please select a role.');
  if (fullname.length < 2) throw new HttpError(400, 'Name must be at least 2 characters.');
  if (!USERNAME_RE.test(un)) throw new HttpError(400, 'Username must be 4–20 characters: letters, numbers, underscores only.');
  if (typeof password !== 'string' || password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(un)) throw new HttpError(409, 'That username is already taken. Choose another.');

  const pending = role === 'admin';
  const rType = role === 'responder' ? (['ngo', 'vet', 'volunteer'].includes(responderType) ? responderType : 'ngo') : null;
  const hash = await bcrypt.hash(password, 10);
  const info = db.prepare('INSERT INTO users (username, password_hash, name, role, status, responder_type) VALUES (?,?,?,?,?,?)')
    .run(un, hash, fullname, role, pending ? 'pending' : 'active', rType);

  if (pending) return res.status(202).json({ pending: true, message: 'Registration received! Admin approval is pending.' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ token: sign(user), user: publicUser(user) });
}));

router.post('/login', wrap(async (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) throw new HttpError(400, 'Please enter username and password.');
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username).trim());
  // Same generic message for unknown user / wrong password / wrong role.
  const ok = user && (!role || user.role === role) && (await bcrypt.compare(password, user.password_hash));
  if (!ok) throw new HttpError(401, 'Incorrect username or password. Try again.');
  if (user.status === 'pending') throw new HttpError(403, 'Your account is awaiting admin approval.');
  if (user.status === 'banned') throw new HttpError(403, 'This account has been revoked.');
  res.json({ token: sign(user), user: publicUser(user) });
}));

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

router.patch('/me/responder-type', requireAuth, requireRole('responder'), (req, res) => {
  const t = req.body && req.body.responderType;
  if (!['ngo', 'vet', 'volunteer'].includes(t)) throw new HttpError(400, 'Invalid responder type');
  db.prepare('UPDATE users SET responder_type = ? WHERE id = ?').run(t, req.user.id);
  res.json({ responderType: t });
});

module.exports = router;
