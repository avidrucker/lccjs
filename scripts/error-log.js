#!/usr/bin/env node
/**
 * error-log.js — insert an error row into ~/.lccjs/lccjs.db.
 *
 * Accepts a JSON object as a positional argument. `occurred_iso` (NOT NULL in
 * the schema) and a non-empty `message` are required; all other fields are
 * optional. A row with no message carries only a timestamp and error_type and
 * is analytically useless — it cannot be classified or acted on (#1022).
 *
 * Usage:
 *   node scripts/error-log.js '{"occurred_iso":"2026-06-05T10:00:00-1000","agent":"GRAPE",...}'
 *   npm run error:log -- '{"occurred_iso":"...","error_type":"CLAIM_FAIL","message":"..."}'
 *
 * Exit codes:
 *   0  success (prints inserted row id)
 *   1  missing arg / invalid JSON / validation failure / DB error
 */
'use strict';

const path = require('path');
const Database = require('better-sqlite3');
const { DB_PATH } = require('./db-path');

const VALID_ERROR_TYPES = new Set([
  'TOOL_DENIED', 'HOOK_BLOCK', 'CLAIM_FAIL', 'BASH_FAIL', 'GIT_FAIL',
  'GIT_STATE', 'GH_FAIL', 'GH_INFO', 'DB_FAIL', 'FILE_FAIL', 'EDIT_PRECOND',
  'SKILL_FAIL', 'NETWORK_FAIL', 'VALIDATION_FAIL', 'OTHER',
]);

const CANONICAL_MODEL = /^[a-z]+-[a-z0-9.]+$/;

function die(msg) {
  console.error(`error-log: ${msg}`);
  process.exit(1);
}

// --- Parse args ---
const rawArg = process.argv.slice(2).find(a => !a.startsWith('--'));
if (!rawArg) {
  die('Usage: error-log.js \'{"occurred_iso":"<ISO8601>","agent":"GRAPE",...}\'');
}

let input;
try {
  input = JSON.parse(rawArg);
} catch (e) {
  die(`Invalid JSON: ${e.message}`);
}

// --- Validate ---
if (!input.occurred_iso || typeof input.occurred_iso !== 'string') {
  die('Missing required field: "occurred_iso"');
}
if (input.message == null || String(input.message).trim() === '') {
  die('Missing required field: "message" — a row with only a timestamp and ' +
      'error_type cannot be classified or acted on (analytically useless, #1022). ' +
      'Provide a short description of what failed.');
}
if (input.error_type != null && !VALID_ERROR_TYPES.has(input.error_type)) {
  die(`unknown error_type "${input.error_type}" (valid: ${[...VALID_ERROR_TYPES].join(', ')})`);
}
if (input.model != null && input.model !== '' && !CANONICAL_MODEL.test(String(input.model))) {
  die(`"model" must follow canonical format <family>-<major.minor> or <family>-<label> (e.g. sonnet-4.6 or owl-alpha) — got "${input.model}"`);
}
if (input.ticket != null && (!Number.isInteger(input.ticket) || input.ticket <= 0)) {
  die(`"ticket" must be a positive integer — got ${input.ticket}`);
}

// --- Insert ---
const toStr = v => (v == null || v === '') ? null : String(v);

const rowData = {
  occurred_iso: input.occurred_iso,
  agent:        toStr(input.agent),
  model:        toStr(input.model),
  ticket:       input.ticket ?? null,
  repo:         toStr(input.repo) ?? 'lccjs',
  error_type:   toStr(input.error_type),
  message:      toStr(input.message),
  context:      toStr(input.context),
  notes:        toStr(input.notes),
};

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

let result;
try {
  result = db.prepare(`
    INSERT INTO errors
      (occurred_iso, agent, model, ticket, repo, error_type, message, context, notes)
    VALUES
      (@occurred_iso, @agent, @model, @ticket, @repo, @error_type, @message, @context, @notes)
  `).run(rowData);
} catch (e) {
  db.close();
  die(`DB insert failed: ${e.message}`);
}
db.close();

const ticketLabel = input.ticket != null ? ` (ticket #${input.ticket})` : '';
console.log(`Inserted error row id=${result.lastInsertRowid}${ticketLabel}`);
