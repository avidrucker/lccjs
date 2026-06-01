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
 *   --from-main   bypass the CWD guard when logging from the main checkout is
 *                 intentional (e.g. a PM row while another agent holds a worktree)
 *
 * Exit codes:
 *   0  success (prints inserted row id)
 *   1  missing arg / invalid JSON / validation failure / DB error / CWD guard
 */
'use strict';

const { execSync } = require('child_process');
const os   = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const { exportCSV } = require('./velocity-export');

const DB_PATH  = path.join(os.homedir(), '.lccjs', 'velocity.db');
const REQUIRED = ['role', 'agent'];

const VALID_ROLES = new Set([
  'DEV', 'TEST', 'WRITER', 'RESEARCH', 'SPIKE', 'ARC', 'PM', 'COMBO', 'DATA', 'CHORE',
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

// --- CWD guard (#312) ---
// Exporting from the main checkout while a worktree is active writes the CSV
// to the wrong docs/ and causes a rebase conflict on the next concurrent push.
// Die loudly BEFORE any DB insert so no partial state is left behind.
// --from-main escapes the guard for legitimate cases: a PM/RESEARCH row when
// the task has no worktree of its own but another agent's worktree is active.
// #319 (research) closed: option (a) — die before insert + --from-main escape — is the chosen approach.
const fromMain = process.argv.includes('--from-main');
if (!fromMain && !process.cwd().includes('.claude/worktrees')) {
  let activeWorktrees = [];
  try {
    const wtOut = execSync('git worktree list', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    // First line is always the main checkout — drop it; rest are active worktrees.
    activeWorktrees = wtOut.trim().split('\n').slice(1).filter(l => l.trim().length > 0);
  } catch (_) { /* git unavailable or not in a repo — skip the guard */ }
  if (activeWorktrees.length > 0) {
    const csvPath = path.join(__dirname, '..', 'docs', 'puzzle-velocity.csv');
    console.error('velocity-log: ✗ logging from main checkout while active worktrees exist.');
    console.error(`  CSV would export to: ${csvPath}`);
    console.error('  Run this from inside the worktree instead.');
    console.error('  Pass --from-main to override (e.g. a PM row with no worktree of your own).');
    process.exit(1);
  }
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
exportCSV();
