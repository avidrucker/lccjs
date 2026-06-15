#!/usr/bin/env node
/**
 * velocity-log.js — insert a velocity row into ~/.lccjs/lccjs.db.
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
const path = require('path');
const Database = require('better-sqlite3');
const { exportCSV } = require('./velocity-export');
const { DB_PATH } = require('./db-path');
const REQUIRED = ['role', 'agent'];

const VALID_ROLES = new Set([
  'DEV', 'TEST', 'WRITER', 'RESEARCH', 'SPIKE', 'ARC', 'PM', 'COMBO', 'DATA', 'CHORE', 'REVIEW',
]);

function die(msg) {
  console.error(`velocity-log: ${msg}`);
  process.exit(1);
}

function parseOptionalNumber(name, value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) die(`"${name}" must be a finite number`);
  return n;
}

function parseOptionalNonNegativeNumber(name, value) {
  const n = parseOptionalNumber(name, value);
  if (n == null) return null;
  if (n < 0) die(`"${name}" must be >= 0`);
  return n;
}

function deriveDelta(estimate, actual) {
  if (estimate == null || actual == null) return null;
  return estimate - actual;
}

// --- Parse args ---
// Flags: --from-main, --update-id N  (order-independent)
// Positional: first arg that doesn't start with '--' is the JSON payload.
const fromMain = process.argv.includes('--from-main');

let updateId = null;
// Track which argv positions are consumed as flag values so they aren't
// mistaken for the JSON payload below.
const flagValuePositions = new Set();
const updateIdIdx = process.argv.indexOf('--update-id');
if (updateIdIdx !== -1) {
  const idStr = process.argv[updateIdIdx + 1];
  const n = Number(idStr);
  if (!idStr || !Number.isInteger(n) || n <= 0) die('--update-id requires a positive integer row id');
  updateId = n;
  flagValuePositions.add(updateIdIdx + 1); // mark the id as consumed
}

// The JSON payload is the first non-flag, non-flag-value argument.
const rawArg = process.argv.slice(2).find((a, relIdx) => {
  const absIdx = relIdx + 2;
  return !a.startsWith('--') && !flagValuePositions.has(absIdx);
});
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
// #1184: notice-not-prevent. A new model (or a non-canonical one) is recorded,
// not rejected — models are an open-growth list, so an unrecognised value is far
// more likely a legitimately-new release than an error worth aborting on. We
// still emit a one-line notice so a human can see it and bless/normalise it.
// (Roles below stay a hard reject: they are a deliberately closed vocabulary.)
const CANONICAL_MODEL = /^[a-z]+-\d+\.\d+$/;
if (input.model != null && input.model !== '' && !CANONICAL_MODEL.test(String(input.model))) {
  console.error(
    `velocity-log: note: model "${input.model}" is new or non-canonical ` +
    `(canonical form is <family>-<major>.<minor>, e.g. opus-4.8) — recording it anyway`);
}
if (VALID_ROLES.size > 0 && !VALID_ROLES.has(input.role)) {
  die(`unknown role "${input.role}" (valid: ${[...VALID_ROLES].join(', ')})`);
}

// --- CWD guard (#312) ---
// Exporting from the main checkout while a worktree is active writes the CSV
// to the wrong docs/ and causes a rebase conflict on the next concurrent push.
// Die loudly BEFORE any DB insert so no partial state is left behind.
// --from-main escapes the guard for legitimate cases: a PM/RESEARCH row when
// the task has no worktree of its own but another agent's worktree is active.
// #319 (research) closed: option (a) — die before insert + --from-main escape — is the chosen approach.
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

// --- Auto-fetch title (#567) ---
// When title is omitted and a ticket number is present, call gh to fill it in.
// VELOCITY_LOG_GH lets tests inject a fake gh binary without touching PATH.
if ((input.title == null || input.title === '') && input.ticket != null) {
  const ghCmd = process.env.VELOCITY_LOG_GH || 'gh';
  try {
    const fetched = execSync(
      `"${ghCmd}" issue view ${input.ticket} --json title -q .title`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000 }
    ).trim();
    if (fetched) {
      input.title = fetched;
    } else {
      console.warn(`velocity-log: warn: gh returned empty title for #${input.ticket} — using fallback`);
      input.title = `#${input.ticket} (title unavailable)`;
    }
  } catch (_) {
    console.warn(`velocity-log: warn: could not fetch title for #${input.ticket} via gh — using fallback`);
    input.title = `#${input.ticket} (title unavailable)`;
  }
}

// --- Insert or Update ---
const toStr = v => (v == null || v === '') ? null : String(v);
const hMin = parseOptionalNonNegativeNumber('h_min', input.h_min);
const cMin = parseOptionalNonNegativeNumber('c_min', input.c_min);
const actualMin = parseOptionalNonNegativeNumber('actual_min', input.actual_min);
const deltaHMin = deriveDelta(hMin, actualMin);
const deltaCMin = deriveDelta(cMin, actualMin);

const rowData = {
  ticket:        input.ticket,
  title:         toStr(input.title),
  role:          input.role,
  h_min:         hMin,
  c_min:         cMin,
  actual_min:    actualMin,
  delta_h_min:   deltaHMin,
  delta_c_min:   deltaCMin,
  started_iso:   toStr(input.started_iso),
  finished_iso:  toStr(input.finished_iso),
  closed_commit: toStr(input.closed_commit),
  notes:         toStr(input.notes),
  agent:         input.agent,
  model:         toStr(input.model),
  repo:          toStr(input.repo) ?? 'lccjs',
};

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const ticketLabel = input.ticket != null ? `ticket #${input.ticket}` : 'no ticket';

if (updateId !== null) {
  // UPDATE path
  let notFound = false;
  let updateError = null;
  try {
    const existing = db.prepare('SELECT id FROM velocity WHERE id = ?').get(updateId);
    if (!existing) {
      notFound = true;
    } else {
      db.prepare(`
        UPDATE velocity SET
          ticket=@ticket, title=@title, role=@role, h_min=@h_min, c_min=@c_min,
          actual_min=@actual_min, delta_h_min=@delta_h_min, delta_c_min=@delta_c_min,
          started_iso=@started_iso, finished_iso=@finished_iso, closed_commit=@closed_commit,
          notes=@notes, agent=@agent, model=@model, repo=@repo
        WHERE id = @id
      `).run({ ...rowData, id: updateId });
    }
  } catch (e) {
    updateError = e;
  } finally {
    db.close();
  }
  if (notFound) die(`row ${updateId} not found — nothing updated`);
  if (updateError) die(`DB update failed: ${updateError.message}`);
  console.log(`Updated row id=${updateId} (${ticketLabel})`);
} else {
  // INSERT path
  const insert = db.prepare(`
    INSERT INTO velocity
      (ticket, title, role, h_min, c_min, actual_min, delta_h_min, delta_c_min,
       started_iso, finished_iso, closed_commit, notes, agent, model, repo)
    VALUES
      (@ticket, @title, @role, @h_min, @c_min, @actual_min, @delta_h_min, @delta_c_min,
       @started_iso, @finished_iso, @closed_commit, @notes, @agent, @model, @repo)
  `);
  let result;
  let insertError = null;
  try {
    result = insert.run(rowData);
  } catch (e) {
    insertError = e;
  } finally {
    db.close();
  }
  if (insertError) {
    if (insertError.message && insertError.message.includes('UNIQUE constraint failed')) {
      die(`duplicate row rejected: a velocity row already exists for this (ticket, agent, started_iso); use --update-id to correct the existing row`);
    }
    die(`DB insert failed: ${insertError.message}`);
  }
  console.log(`Inserted row id=${result.lastInsertRowid} (${ticketLabel})`);
}

// --- Auto-export CSV ---
exportCSV();
