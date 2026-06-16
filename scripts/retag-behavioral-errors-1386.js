#!/usr/bin/env node
/**
 * retag-behavioral-errors-1386.js — one-shot, idempotent re-tag of the ~25
 * behavioral-error rows that were logged as OTHER/TOOL_DENIED before dedicated
 * error_type values existed (#1118). It rewrites each row's `error_type` to the
 * family (BEHAVIORAL_FAIL / COMPLIANCE_FAIL) and merges the §2 taxonomy fields
 * (`behavioral`, `failure_mode`, optional `secondary_mode` / `caught_by`) into
 * the `context` JSON. It also repairs the three malformed-context rows
 * (67, 68 stored "[object Object]"; 121 stored a bare non-JSON string) and the
 * empty-context row (59) so json_extract() metrics stop aborting.
 *
 * Source of the mapping: docs/research/1160-behavioral-error-taxonomy.md §5.
 * Re-running is safe: each row's target context is computed by merging the
 * fixed mapping onto a parse-or-empty base, so a second run is a no-op.
 *
 * `caught_by` is populated ONLY where the catching net is evidenced (existing
 * context, or §4 of the taxonomy, which names the rows each net caught). Rows
 * with no documented net are left without a caught_by rather than guessing.
 *
 * Usage:  node scripts/retag-behavioral-errors-1386.js [--dry-run]
 */
'use strict';

const Database = require('better-sqlite3');
const { DB_PATH } = require('./db-path');

const B = 'BEHAVIORAL_FAIL';
const C = 'COMPLIANCE_FAIL';

// id -> { type, mode, [secondary], [tertiary], [caught_by], [detail] }
// `detail` is only set where the original context was malformed/empty and there
// is recoverable information worth preserving (the bare string in row 121, or a
// message-derived summary). It is merged in, not overwritten.
const MAPPING = {
  2:   { type: B, mode: 'CONFIDENTLY_WRONG', secondary: 'IGNORED_CONTRADICTING_SIGNAL', caught_by: 'human' },
  44:  { type: C, mode: 'WRONG_WORKTREE', caught_by: 'guard' },
  52:  { type: B, mode: 'CONFIDENTLY_WRONG' },
  59:  { type: B, mode: 'PREMATURE_ACTION', secondary: 'CONFIDENTLY_WRONG',
         detail: 'Investigated + filed #1121 before claiming and reading the evidence log → inaccurate findings' },
  60:  { type: C, mode: 'WRONG_WORKTREE' },
  64:  { type: C, mode: 'SKIPPED_REQUIRED_STEP', caught_by: 'human' },
  67:  { type: B, mode: 'INSUFFICIENT_SEARCH', secondary: 'IGNORED_CONTRADICTING_SIGNAL', caught_by: 'human',
         detail: 'Filed #1146-48, duplicates of completed #1137-39; dup-scan used --state open only' },
  68:  { type: B, mode: 'SCOPE_OVERSTEP', secondary: 'FABRICATED_CONTENT', tertiary: 'UNILATERAL_HUMAN_REQUIRED',
         caught_by: 'permission-classifier',
         detail: 'Tried to close a human-required ticket (#1123) and fabricated "per the maintainer\'s direction"' },
  70:  { type: B, mode: 'UNREQUESTED_ACTION', secondary: 'SCOPE_OVERSTEP' },
  74:  { type: C, mode: 'SKIPPED_REQUIRED_STEP' },
  79:  { type: C, mode: 'SKIPPED_REQUIRED_STEP', caught_by: 'human' },
  88:  { type: C, mode: 'WRONG_WORKTREE' },
  101: { type: B, mode: 'CONFIDENTLY_WRONG' },
  105: { type: B, mode: 'FABRICATED_CONTENT' },
  116: { type: C, mode: 'WRONG_CONVENTION', caught_by: 'guard' },
  119: { type: C, mode: 'SKIPPED_REQUIRED_STEP', caught_by: 'human' },
  121: { type: B, mode: 'SCOPE_OVERSTEP', caught_by: 'permission-classifier',
         detail: 'issue-review-skill pass on #1077; user said "do what you recommend" which named #1077 + the Q6 ticket, not the optional sibling sweep of #1079-84' },
  130: { type: B, mode: 'UNREQUESTED_ACTION', caught_by: 'permission-classifier' },
  133: { type: C, mode: 'WRONG_CONVENTION', secondary: 'FABRICATED_CONTENT' },
  141: { type: B, mode: 'FABRICATED_CONTENT' },
  200: { type: C, mode: 'WRONG_WORKTREE', caught_by: 'guard' },
  203: { type: B, mode: 'PREMATURE_ACTION' },
  252: { type: C, mode: 'WRONG_CONVENTION', caught_by: 'guard' },
  274: { type: B, mode: 'CONFIDENTLY_WRONG' },
  289: { type: B, mode: 'CONFIDENTLY_WRONG' },
  // 269 is not in the §5 corpus — it was logged 2026-06-15, after the taxonomy
  // doc froze — but it is a behavioral OTHER row (context.behavioral=true), so
  // AC1 ("no OTHER behavioral rows remain") requires it. Verification-gap that
  // shipped a UX regression in #1347; self-flagged then dismissed → slipped to
  // the repo/human.
  269: { type: B, mode: 'CONFIDENTLY_WRONG', secondary: 'IGNORED_CONTRADICTING_SIGNAL', caught_by: 'human' },
};

const dryRun = process.argv.includes('--dry-run');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const get = db.prepare('SELECT id, error_type, context, message FROM errors WHERE id = ?');
const upd = db.prepare('UPDATE errors SET error_type = ?, context = ? WHERE id = ?');

function parseOrEmpty(ctx) {
  if (ctx == null || String(ctx).trim() === '') return {};
  try {
    const v = JSON.parse(ctx);
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  } catch {
    return {}; // malformed ("[object Object]", bare string) — start fresh
  }
}

const changes = [];
const tx = db.transaction(() => {
  for (const [idStr, m] of Object.entries(MAPPING)) {
    const id = Number(idStr);
    const row = get.get(id);
    if (!row) { changes.push({ id, status: 'MISSING' }); continue; }

    const base = parseOrEmpty(row.context);
    const next = { ...base, behavioral: true, failure_mode: m.mode };
    if (m.secondary) next.secondary_mode = m.secondary;
    if (m.tertiary)  next.tertiary_mode = m.tertiary;
    if (m.caught_by) next.caught_by = m.caught_by;
    if (m.detail && next.detail == null) next.detail = m.detail;

    const nextJson = JSON.stringify(next);
    const noop = row.error_type === m.type && row.context === nextJson;
    changes.push({ id, status: noop ? 'noop' : 'update', type: m.type,
                   from: row.error_type, context: nextJson });
    if (!noop && !dryRun) upd.run(m.type, nextJson, id);
  }
});
tx();
db.close();

const updated = changes.filter(c => c.status === 'update').length;
const noops   = changes.filter(c => c.status === 'noop').length;
const missing = changes.filter(c => c.status === 'MISSING');
for (const c of changes) {
  if (c.status === 'MISSING') { console.log(`  id=${c.id}  MISSING (row not found)`); continue; }
  console.log(`  id=${String(c.id).padStart(3)}  ${c.from} -> ${c.type}  [${c.status}]  ${c.context}`);
}
console.log(`\n${dryRun ? '[dry-run] ' : ''}${updated} updated, ${noops} already-current, ${missing.length} missing.`);
if (missing.length) process.exitCode = 1;
