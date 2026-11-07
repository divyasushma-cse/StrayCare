const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../db/database');
const { HttpError } = require('../utils/helpers');

const sign = user => jwt.sign({ id: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpires });

// Verifies the token AND re-checks the user row, so banned/deleted accounts lose access immediately.
function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Authentication required'));
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = db.prepare('SELECT id, username, name, role, status, responder_type, points FROM users WHERE id = ?').get(payload.id);
    if (!user) return next(new HttpError(401, 'Account no longer exists'));
    if (user.status !== 'active') return next(new HttpError(403, 'Account is not active'));
    req.user = user;
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired session'));
  }
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role)
    ? next()
    : next(new HttpError(403, `Access denied. You are logged in as ${req.user.role}.`));

module.exports = { sign, requireAuth, requireRole };
