const PLACEHOLDERS = new Set([
  'admin',
  'administrator',
  'change-me',
  'change-me-to-a-long-random-string',
  'changeme',
  'chief admin',
  'default',
  'dev-only-secret-change-me',
  'demo',
  'guest',
  'password',
  'root',
  'secret',
  'straycareadmin$2026',
  'superadmin',
  'test',
  'user'
]);

function isPlaceholder(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return !normalized
    || PLACEHOLDERS.has(normalized)
    || /^(change|replace|set|your|example|sample|placeholder|default|dev|test)(?:[-_\s].*)?$/.test(normalized)
    || /(change[-_\s]?me|replace[-_\s]?me|placeholder|example|sample|your[-_\s]|insert[-_\s])/.test(normalized)
    || /^(.)\1+$/.test(normalized);
}

function assertProductionConfig({ jwtSecret, adminUsername, adminPassword }) {
  if (typeof jwtSecret !== 'string' || jwtSecret.trim().length < 32 || isPlaceholder(jwtSecret)) {
    throw new Error('Production configuration error: JWT_SECRET must be a unique, non-placeholder value of at least 32 characters.');
  }
  if (isPlaceholder(adminUsername)) {
    throw new Error('Production configuration error: ADMIN_USERNAME must be set to a unique, non-placeholder username.');
  }
  if (typeof adminPassword !== 'string' || adminPassword.trim().length < 12 || isPlaceholder(adminPassword)) {
    throw new Error('Production configuration error: ADMIN_PASSWORD must be a unique, non-placeholder value of at least 12 characters.');
  }
}

function assertDemoSeedAllowed(nodeEnv) {
  if (String(nodeEnv).trim().toLowerCase() === 'production') {
    throw new Error('Demo seeding is disabled in production.');
  }
}

module.exports = { assertProductionConfig, assertDemoSeedAllowed };
