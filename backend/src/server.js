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

if (require.main === module) startServer();

module.exports = { startServer };
