#!/usr/bin/env node
/**
 * errors-seed.js — create the errors table in ~/.lccjs/velocity.db.
 *
 * Idempotent: uses CREATE TABLE IF NOT EXISTS, safe to run multiple times.
 * Run once after the DB is first created, or after a fresh DB wipe.
 *
 * Usage:
 *   node scripts/errors-seed.js
 *   npm run error:seed
 */
'use strict';

const os   = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.VELOCITY_DB || path.join(os.homedir(), '.lccjs', 'velocity.db');

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS errors (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_iso TEXT    NOT NULL,
  agent        TEXT,
  model        TEXT,
  ticket       INTEGER,
  repo         TEXT    DEFAULT 'lccjs',
  error_type   TEXT,
  message      TEXT,
  context      TEXT,
  notes        TEXT
);
`.trim();

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS errors_agent_time ON errors (agent, occurred_iso);`,
  `CREATE INDEX IF NOT EXISTS errors_type        ON errors (error_type);`,
  `CREATE INDEX IF NOT EXISTS errors_ticket      ON errors (ticket);`,
];

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(CREATE_TABLE);
for (const idx of INDEXES) db.exec(idx);

db.close();
console.log(`errors table ready in ${DB_PATH}`);
