'use strict';
// Shared DB path resolver for all scripts that open ~/.lccjs/lccjs.db.
// Centralises the VELOCITY_DB env-var override and the one-time migration
// from the old velocity.db filename.
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const LCCJS_DIR = path.join(os.homedir(), '.lccjs');
const DB_PATH   = process.env.VELOCITY_DB || path.join(LCCJS_DIR, 'lccjs.db');

if (!process.env.VELOCITY_DB) {
  const oldPath = path.join(LCCJS_DIR, 'velocity.db');
  if (!fs.existsSync(DB_PATH) && fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, DB_PATH);
    // Clean up orphaned WAL journal files from the old filename.
    for (const suffix of ['-shm', '-wal']) {
      const w = oldPath + suffix;
      if (fs.existsSync(w)) fs.unlinkSync(w);
    }
    process.stderr.write('db: migrated ~/.lccjs/velocity.db → ~/.lccjs/lccjs.db\n');
  }
}

module.exports = { DB_PATH };
