const path = require('path');
if (process.env.STRAYCARE_SKIP_DOTENV !== '1') {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
}
const { assertProductionConfig } = require('./security');

const num = (v, d) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);

const env = {
  nodeEnv: (process.env.NODE_ENV || 'development').trim().toLowerCase(),
  port: num(process.env.PORT, 5000),
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpires: process.env.JWT_EXPIRES || '7d',
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', '..', '..', 'database', 'straycare.db'),
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads'),
  frontendDir: path.join(__dirname, '..', '..', '..', 'frontend'),
  // Seconds between radius expansions (original prototype demo timings: 7 / 11 / 17).
  expansionSeconds: {
    critical: num(process.env.EXPAND_CRITICAL_SECONDS, 7),
    moderate: num(process.env.EXPAND_MODERATE_SECONDS, 11),
    mild: num(process.env.EXPAND_MILD_SECONDS, 17)
  },
  admin: {
    username: process.env.ADMIN_USERNAME || 'superadmin',
    password: process.env.ADMIN_PASSWORD || 'StrayCareAdmin$2026',
    name: process.env.ADMIN_NAME || 'Chief Admin'
  }
};

if (env.nodeEnv === 'production') {
  assertProductionConfig({
    jwtSecret: process.env.JWT_SECRET,
    adminUsername: process.env.ADMIN_USERNAME,
    adminPassword: process.env.ADMIN_PASSWORD
  });
}

module.exports = env;
