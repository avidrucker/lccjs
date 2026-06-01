#!/usr/bin/env node
/**
 * velocity-log.js — insert a velocity row into ~/.lccjs/velocity.db.
 *
 * Accepts a JSON object as a positional argument, validates required fields,
 * INSERTs into the velocity table, then auto-exports docs/puzzle-velocity.csv.
 *
 * Required fields: role, agent (ticket is nullable — valid to omit for issueless PM/triage rows)
 * All other fields are optional (NULL if omitted).
 *
 * Usage:
 *   node scripts/velocity-log.js '{"ticket":276,"role":"DEV","agent":"BANANA","h_min":20,...}'
 *   npm run velocity:log -- '{"ticket":276,...}'
 *
 * Exit codes:
 *   0  success (prints inserted row id)
 *   1  missing arg / invalid JSON / validation failure / DB error
 */
'use strict';

const os   = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const { exportCSV } = require('./velocity-export');

const DB_PATH  = path.join(os.homedir(), '.lccjs', 'velocity.db');
const REQUIRED = ['role', 'agent'];

const VALID_ROLES = new Set([
  'DEV', 'TEST', 'WRITER', 'RESEARCH', 'SPIKE', 'ARC', 'PM', 'COMBO', 'DATA',
]);

function die(msg) {
  console.error(`velocity-log: ${msg}`);
  process.exit(1);
}

// --- Parse arg ---
const rawArg = process.argv[2];
if (!rawArg) {
  die('Usage: velocity-log.js \'{"ticket":N,"role":"DEV","agent":"BANANA",...}\'');
}

let input;
try {
  input = JSON.parse(rawArg);
} catch (e) {
  die(`Invalid JSON: ${e.message}`);
}

// --- Validate ---
for (const f of REQUIRED) {
  if (input[f] == null || input[f] === '') die(`Missing required field: "${f}"`);
}
if (input.ticket != null && (typeof input.ticket !== 'number' || !Number.isInteger(input.ticket) || input.ticket <= 0)) {
  die('"ticket" must be a positive integer when provided');
}
if (VALID_ROLES.size > 0 && !VALID_ROLES.has(input.role)) {
  // Warn but don't block — role taxonomy may expand (#284 Q3)
  console.warn(`velocity-log: unknown role "${input.role}" (valid: ${[...VALID_ROLES].join(', ')})`);
}

// --- Insert ---
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const insert = db.prepare(`
  INSERT INTO velocity
    (ticket, title, role, h_min, c_min, actual_min, delta_h_min, delta_c_min,
     started_iso, finished_iso, closed_commit, notes, agent, model)
  VALUES
    (@ticket, @title, @role, @h_min, @c_min, @actual_min, @delta_h_min, @delta_c_min,
     @started_iso, @finished_iso, @closed_commit, @notes, @agent, @model)
`);

const toNum = v => (v == null || v === '') ? null : Number(v);
const toStr = v => (v == null || v === '') ? null : String(v);

let result;
try {
  result = insert.run({
    ticket:        input.ticket,
    title:         toStr(input.title),
    role:          input.role,
    h_min:         toNum(input.h_min),
    c_min:         toNum(input.c_min),
    actual_min:    toNum(input.actual_min),
    delta_h_min:   toNum(input.delta_h_min),
    delta_c_min:   toNum(input.delta_c_min),
    started_iso:   toStr(input.started_iso),
    finished_iso:  toStr(input.finished_iso),
    closed_commit: toStr(input.closed_commit),
    notes:         toStr(input.notes),
    agent:         input.agent,
    model:         toStr(input.model),
  });
} catch (e) {
  die(`DB insert failed: ${e.message}`);
} finally {
  db.close();
}

const ticketLabel = input.ticket != null ? `ticket #${input.ticket}` : 'no ticket';
console.log(`Inserted row id=${result.lastInsertRowid} (${ticketLabel})`);

// --- Auto-export CSV ---
// @inprogress #319:30m/RESEARCH guard this export — unconditional export from main checkout causes rebase conflicts; see also #320 (DEV fix) and #312/#313
exportCSV();
