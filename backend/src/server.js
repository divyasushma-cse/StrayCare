const env = require('./config/env');
require('./db/database');
const scheduler = require('./services/scheduler');
const { ensureAdmin } = require('./services/bootstrap');
const app = require('./app');

function startServer(port = env.port) {
  ensureAdmin();
  scheduler.start();
  const server = app.listen(port, () => {
    const address = server.address();
    console.log(`StrayCare running on http://localhost:${address.port}  (${env.nodeEnv})`);
  });
  return server;
}

if (require.main === module) {
  const server = startServer();
  const db = require('./db/database');
  let shuttingDown = false;
  const shutdown = signal => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(JSON.stringify({ level: 'info', event: 'shutdown', signal }));
    scheduler.stop();
    const timeout = setTimeout(() => {
      server.closeAllConnections?.();
      db.close();
      process.exit(1);
    }, 10000);
    timeout.unref();
    server.close(error => {
      clearTimeout(timeout);
      if (error) {
        console.error(error);
        process.exitCode = 1;
      }
      db.close();
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = { startServer };
