#!/usr/bin/env node
/**
 * RETIRED (#997) — RICE was superseded by ICE in #956. Use `npm run ice:score`
 * (scripts/ice-score.js) instead. This file is kept here as a historical reference
 * only; its npm script (`rice:log`) was removed from package.json.
 *
 * rice-log.js — insert or update a rice row in ~/.lccjs/lccjs.db.
 *
 * Accepts a JSON object as a positional argument. Required field: `issue`.
 * All other fields are optional (NULL if omitted).
 * When a row for the same `issue` already exists, it is replaced (upsert on issue).
 *
 * Usage:
 *   node scripts/rice-log.js '{"issue":123,"title":"...","r":3,"i":1,"c_pct":70,...}'
 *   npm run rice:log -- '{"issue":123,...}'
 *
 * Exit codes:
 *   0  success (prints inserted/replaced row id)
 *   1  missing arg / invalid JSON / validation failure / DB error
 */
'use strict';

const Database = require('better-sqlite3');
const { DB_PATH } = require('./db-path');
const { exportCSV } = require('./rice-export');

const REQUIRED = ['issue'];

function die(msg) {
  console.error(`rice-log: ${msg}`);
  process.exit(1);
}

const raw = process.argv[2];
if (!raw) die('pass a JSON object as the first argument');

let row;
try { row = JSON.parse(raw); } catch (e) { die(`invalid JSON: ${e.message}`); }

for (const f of REQUIRED) {
  if (row[f] == null) die(`missing required field: ${f}`);
}

if (!Number.isInteger(row.issue)) die('issue must be an integer');

if (row.actionable != null && !['Y', 'N'].includes(row.actionable)) {
  die(`actionable must be 'Y' or 'N', got: ${row.actionable}`);
}

if (!require('fs').existsSync(DB_PATH)) die(`DB not found at ${DB_PATH} — run npm run rice:seed first`);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const tableExists = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='rice'"
).get();
if (!tableExists) die('rice table not found — run npm run rice:seed first');

const insert = db.prepare(`
  INSERT OR REPLACE INTO rice
    (issue, title, type, r, i, c_pct, e_hrs, rice_score, rice_rank,
     yegor_priority, actionable, labels, notes, scored_iso, scored_by, repo)
  VALUES
    (@issue, @title, @type, @r, @i, @c_pct, @e_hrs, @rice_score, @rice_rank,
     @yegor_priority, @actionable, @labels, @notes, @scored_iso, @scored_by, @repo)
`);

function nullable(v) { return v == null ? null : v; }

const result = insert.run({
  issue:          row.issue,
  title:          nullable(row.title),
  type:           nullable(row.type),
  r:              nullable(row.r),
  i:              nullable(row.i),
  c_pct:          nullable(row.c_pct),
  e_hrs:          nullable(row.e_hrs),
  rice_score:     nullable(row.rice_score),
  rice_rank:      nullable(row.rice_rank),
  yegor_priority: nullable(row.yegor_priority),
  actionable:     nullable(row.actionable),
  labels:         nullable(row.labels),
  notes:          nullable(row.notes),
  scored_iso:     nullable(row.scored_iso),
  scored_by:      nullable(row.scored_by),
  repo:           row.repo || 'lccjs',
});

db.close();
console.log(`Upserted row id=${result.lastInsertRowid} (issue #${row.issue})`);

exportCSV({ force: true });
