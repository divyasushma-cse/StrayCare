const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

async function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'straycare-test-'));
  const previous = {};
  const testEnv = {
    NODE_ENV: 'test',
    STRAYCARE_SKIP_DOTENV: '1',
    DB_PATH: path.join(tempDir, 'straycare-test.db'),
    UPLOAD_DIR: path.join(tempDir, 'uploads'),
    JWT_SECRET: 'straycare-isolated-test-secret-with-enough-length',
    ADMIN_USERNAME: 'isolated_test_admin',
    ADMIN_PASSWORD: 'isolated-test-admin-password'
  };
  for (const [key, value] of Object.entries(testEnv)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }

  let server, exitCode = 1;
  try {
    execFileSync(process.execPath, ['scripts/seed.js'], { cwd: path.join(__dirname, '..'), env: process.env, stdio: 'ignore' });
    const { startServer } = require('../src/server');
    const scheduler = require('../src/services/scheduler');
    const db = require('../src/db/database');
    server = startServer(0);
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    process.env.BASE = `http://127.0.0.1:${server.address().port}`;
    process.env.ADMIN_USERNAME = testEnv.ADMIN_USERNAME;
    process.env.ADMIN_PASSWORD = testEnv.ADMIN_PASSWORD;
    exitCode = await require('./smoke-test').runSmokeTest();
    scheduler.stop();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    server = null;
    db.close();
  } finally {
    if (server) {
      require('../src/services/scheduler').stop();
      await new Promise(resolve => server.close(resolve));
      require('../src/db/database').close();
    }
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (path.basename(tempDir).startsWith('straycare-test-')) fs.rmSync(tempDir, { recursive: true, force: true });
  }
  return exitCode;
}

run().then(code => process.exit(code)).catch(error => {
  console.error(error);
  process.exit(1);
});
