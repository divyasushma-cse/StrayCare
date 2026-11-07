const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const env = require('../src/config/env');

async function backup() {
  if (!fs.existsSync(env.dbPath)) throw new Error(`Database file does not exist: ${env.dbPath}`);
  if (!fs.existsSync(env.uploadDir)) throw new Error(`Upload directory does not exist: ${env.uploadDir}`);
  const backupDir = process.env.STRAYCARE_BACKUP_DIR
    ? path.resolve(process.env.STRAYCARE_BACKUP_DIR)
    : path.resolve(__dirname, '..', '..', 'database', 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupSet = path.join(backupDir, `straycare-${timestamp}`);
  fs.mkdirSync(backupSet);
  const db = new Database(env.dbPath, { readonly: true, fileMustExist: true });
  try {
    await db.backup(path.join(backupSet, 'straycare.db'));
    fs.cpSync(env.uploadDir, path.join(backupSet, 'uploads'), { recursive: true, errorOnExist: true, force: false });
    console.log(JSON.stringify({ event: 'backup_complete', destination: backupSet }));
  } catch (error) {
    fs.rmSync(backupSet, { recursive: true, force: true });
    throw error;
  } finally {
    db.close();
  }
}

backup().catch(error => {
  console.error(JSON.stringify({ level: 'error', event: 'backup_failed', message: error.message }));
  process.exitCode = 1;
});
