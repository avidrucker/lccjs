'use strict';
// Shared DB path resolver for all scripts that open ~/.lccjs/lccjs.db.
// Centralises the DB-path override and the one-time migration from the old
// velocity.db filename. The override env var is LCCJS_DB; VELOCITY_DB is kept
// as a legacy alias so older configs/tests keep working (#984).
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const LCCJS_DIR = path.join(os.homedir(), '.lccjs');
const OVERRIDE  = process.env.LCCJS_DB || process.env.VELOCITY_DB || null;
const DB_PATH   = OVERRIDE || path.join(LCCJS_DIR, 'lccjs.db');

// Only auto-migrate when no explicit override is set — otherwise a test pointing
// LCCJS_DB/VELOCITY_DB at a temp path could rename the real ~/.lccjs/velocity.db
// out from under a concurrent process.
if (!OVERRIDE) {
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
