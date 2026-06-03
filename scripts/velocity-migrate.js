#!/usr/bin/env node
/**
 * velocity-migrate.js — add the unique session index to an existing ~/.lccjs/velocity.db.
 *
 * Adds a UNIQUE INDEX on (ticket, agent, started_iso) WHERE started_iso IS NOT NULL.
 * This is a one-time migration for DBs created before #536. Idempotent — safe to re-run.
 *
 * Exits 1 if duplicate rows exist that would block the index; resolve them first with
 * `--update-id` or sqlite3, then re-run.
 *
 * Usage:
 *   node scripts/velocity-migrate.js
 *   npm run velocity:migrate
 */
'use strict';

const os   = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.VELOCITY_DB || path.join(os.homedir(), '.lccjs', 'velocity.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const existing = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='index' AND name='uq_velocity_session'"
).get();

if (existing) {
  console.log('uq_velocity_session index already exists — nothing to do.');
  db.close();
  process.exit(0);
}

const dups = db.prepare(`
  SELECT ticket, agent, started_iso, COUNT(*) as n
  FROM velocity
  WHERE started_iso IS NOT NULL
  GROUP BY ticket, agent, started_iso
  HAVING n > 1
`).all();

if (dups.length > 0) {
  console.error('velocity-migrate: cannot add unique index — duplicate rows found:');
  for (const d of dups) {
    console.error(`  ticket=${d.ticket}, agent=${d.agent}, started_iso=${d.started_iso} (${d.n} rows)`);
  }
  console.error('Resolve duplicates first (use --update-id or sqlite3), then re-run.');
  db.close();
  process.exit(1);
}

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS uq_velocity_session
    ON velocity(ticket, agent, started_iso)
    WHERE started_iso IS NOT NULL
`);

console.log(`Added uq_velocity_session index to ${DB_PATH}`);
db.close();
