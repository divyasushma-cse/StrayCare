const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');
const { assertProductionConfig, assertDemoSeedAllowed } = require('../src/config/security');

const validProductionConfig = {
  jwtSecret: 'a-unique-production-signing-secret-with-more-than-32-characters',
  adminUsername: 'straycare-operations-owner',
  adminPassword: 'a-unique-admin-password-long-enough'
};

test('local development admin credentials stay fixed even if .env defines overrides', () => {
  const env = { ...process.env, NODE_ENV: 'development', STRAYCARE_SKIP_DOTENV: '1' };
  env.ADMIN_USERNAME = 'another-admin';
  env.ADMIN_PASSWORD = 'another-local-password';
  const result = spawnSync(process.execPath, ['-e', "const a=require('./src/config/env').admin;process.stdout.write(JSON.stringify(a))"], {
    cwd: path.join(__dirname, '..'),
    env,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), {
    username: 'superadmin',
    password: 'StrayCareAdmin$2026',
    name: 'Chief Admin'
  });
});

test('production admin credentials come from the production environment', () => {
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    STRAYCARE_SKIP_DOTENV: '1',
    JWT_SECRET: validProductionConfig.jwtSecret,
    ADMIN_USERNAME: validProductionConfig.adminUsername,
    ADMIN_PASSWORD: validProductionConfig.adminPassword
  };
  const result = spawnSync(process.execPath, ['-e', "const a=require('./src/config/env').admin;process.stdout.write(JSON.stringify(a))"], {
    cwd: path.join(__dirname, '..'),
    env,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), {
    username: validProductionConfig.adminUsername,
    password: validProductionConfig.adminPassword,
    name: 'Chief Admin'
  });
});

test('accepts unique production credentials', () => {
  assert.doesNotThrow(() => assertProductionConfig(validProductionConfig));
});

test('rejects missing and short production credentials', () => {
  for (const patch of [
    { jwtSecret: undefined },
    { jwtSecret: 'too-short' },
    { adminUsername: undefined },
    { adminPassword: undefined },
    { adminPassword: 'short' }
  ]) {
    assert.throws(() => assertProductionConfig({ ...validProductionConfig, ...patch }), /Production configuration error/);
  }
});

test('rejects placeholder and default production credentials', () => {
  for (const patch of [
    { jwtSecret: 'change-me-to-a-long-random-string' },
    { jwtSecret: 'use-this-secret-example-for-production-1234567890' },
    { jwtSecret: 'x'.repeat(48) },
    { adminUsername: 'superadmin' },
    { adminUsername: 'admin' },
    { adminUsername: 'replace-with-a-unique-admin-username' },
    { adminPassword: 'StrayCareAdmin$2026' },
    { adminPassword: 'replace-with-a-unique-password-at-least-12-characters' }
  ]) {
    assert.throws(() => assertProductionConfig({ ...validProductionConfig, ...patch }), /Production configuration error/);
  }
});

test('refuses demo seeding in production only', () => {
  assert.throws(() => assertDemoSeedAllowed('production'), /Demo seeding is disabled in production/);
  assert.throws(() => assertDemoSeedAllowed('Production'), /Demo seeding is disabled in production/);
  assert.doesNotThrow(() => assertDemoSeedAllowed('development'));
});

test('production env config fails closed for missing credentials without loading local dotenv', () => {
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    STRAYCARE_SKIP_DOTENV: '1',
    JWT_SECRET: '',
    ADMIN_USERNAME: '',
    ADMIN_PASSWORD: ''
  };
  const result = spawnSync(process.execPath, ['-e', "require('./src/config/env')"], {
    cwd: path.join(__dirname, '..'),
    env,
    encoding: 'utf8'
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Production configuration error/);
});
