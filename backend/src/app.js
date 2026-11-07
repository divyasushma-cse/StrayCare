const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const { notFound, errorHandler } = require('./middleware/error');

fs.mkdirSync(env.uploadDir, { recursive: true });

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.locals.requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', res.locals.requestId);
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://api.qrserver.com'],
      connectSrc: ["'self'", 'https://nominatim.openstreetmap.org'],
      scriptSrcAttr: ["'unsafe-inline'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginResourcePolicy: { policy: 'same-site' }
}));
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : false }));
app.use(express.json({ limit: '100kb' }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: env.nodeEnv === 'production' ? 30 : 500, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts, try again later' } });

app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/donations', require('./routes/donations'));
app.use('/api/rewards', require('./routes/rewards'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/admin', require('./routes/admin'));
app.get('/api/health', (req, res) => {
  require('./db/database').prepare('SELECT 1').get();
  res.json({ ok: true });
});
app.use('/api', notFound);

app.use(express.static(env.frontendDir));

app.use(errorHandler);
module.exports = app;
