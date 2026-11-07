const path = require('path');
const os = require('os');
if (process.env.STRAYCARE_SKIP_DOTENV !== '1') {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
}
const { assertProductionConfig } = require('./security');

const num = (v, d) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);
const nodeEnv = (process.env.NODE_ENV || 'development').trim().toLowerCase();
const localAdmin = { username: 'superadmin', password: 'StrayCareAdmin$2026' };
const isRender = process.env.RENDER === 'true';
const renderTempDir = path.join(os.tmpdir(), 'straycare');
const dbPath = process.env.DB_PATH;
const uploadDir = process.env.UPLOAD_DIR;
const usesUnwritableRenderDiskPath = (value) => value && /^\/var\/data(?:\/|$)/.test(value);

if (isRender) {
  console.warn('Render uses ephemeral storage for StrayCare data; reports and uploaded photos may be lost on restart or redeploy.');
}

const env = {
  nodeEnv,
  port: num(process.env.PORT, 5000),
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpires: process.env.JWT_EXPIRES || '7d',
  dbPath: isRender && (!dbPath || usesUnwritableRenderDiskPath(dbPath))
    ? path.join(renderTempDir, 'straycare.db')
    : dbPath || path.join(__dirname, '..', '..', '..', 'database', 'straycare.db'),
  uploadDir: isRender && (!uploadDir || usesUnwritableRenderDiskPath(uploadDir))
    ? path.join(renderTempDir, 'uploads')
    : uploadDir || path.join(__dirname, '..', '..', 'uploads'),
  frontendDir: path.join(__dirname, '..', '..', '..', 'frontend'),
  // Seconds between radius expansions (original prototype demo timings: 7 / 11 / 17).
  expansionSeconds: {
    critical: num(process.env.EXPAND_CRITICAL_SECONDS, 7),
    moderate: num(process.env.EXPAND_MODERATE_SECONDS, 11),
    mild: num(process.env.EXPAND_MILD_SECONDS, 17)
  },
  admin: {
    username: nodeEnv === 'development' ? localAdmin.username : (process.env.ADMIN_USERNAME || localAdmin.username),
    password: nodeEnv === 'development' ? localAdmin.password : (process.env.ADMIN_PASSWORD || localAdmin.password),
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
