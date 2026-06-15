#!/usr/bin/env node
'use strict';
// scripts/rules-migrate.js — one-time, idempotent schema migration of RULES.json
// to the Option-B source-of-truth schema (#1185, ruling #845).
//
// For each rule it:
//   - keeps the former `R0NN` id as `legacy_id` (so prior citations still resolve),
//   - mints a stable animal-color `id` stem (the new citation target),
//   - records `text_sha` = sha256(text)[:6],
//   - preserves `version`, `category`, `status`, `relocated_to`, etc.
// then recomputes the top-level `ruleset_sha`, bumps `schema_version` to 2, and
// replaces the superseded #1061 same-PR sync note with the Option-B policy.
//
// Idempotent: a rule that already carries a `legacy_id` is treated as migrated —
// its stem is preserved and only its derived `text_sha` is refreshed. Re-running
// on a migrated file changes nothing (modulo a genuine `text` edit).
//
// Usage:  node scripts/rules-migrate.js [--check]
//   --check  exit 1 (without writing) if the file is not already fully migrated.

const fs = require('fs');
const path = require('path');
const { mintId, textSha, rulesetSha, STEM_RE } = require('./rules-id');

const RULES_PATH = path.join(__dirname, '..', 'RULES.json');

const OPTION_B_NOTE =
  'RULES.json is the single source of truth (Option B, ruling #845). RULES.md is a ' +
  'generated, committed render artifact — do not hand-edit it; run `npm run rules:render` ' +
  '(#1185). Each rule has a stable animal-color `id` (the citation target, assigned once and ' +
  'never reused or renumbered), a `legacy_id` (its former R0NN, so old citations still resolve), ' +
  'an integer `version` rendered as a `-NNN` display suffix, and `text_sha` = sha256(text)[:6] ' +
  'which drives the version bump and serves as the drift check. Top-level `ruleset_sha` versions ' +
  'the whole ordered set. Supersedes the #1061 same-PR sync convention.';

// Rebuild a single rule object with a stable, readable key order. `legacy` is the
// already-known legacy_id (R0NN) for an already-migrated rule, or null to derive
// it from the current `R0NN` id and mint a fresh stem.
function migrateRule(rule, takenIds) {
  const alreadyMigrated = typeof rule.legacy_id === 'string' && STEM_RE.test(rule.id || '');
  const id = alreadyMigrated ? rule.id : mintId(takenIds);
  const legacyId = alreadyMigrated ? rule.legacy_id : rule.id;
  takenIds.add(id);

  const out = {
    id,
    legacy_id: legacyId,
    version: rule.version,
    category: rule.category,
    text: rule.text,
    text_sha: textSha(rule.text),
    added: rule.added,
    added_issue: rule.added_issue,
    comment: rule.comment,
    status: rule.status,
  };
  if (rule.relocated_to !== undefined) out.relocated_to = rule.relocated_to;
  return out;
}

function migrate(doc) {
  const takenIds = new Set();
  // Seed with any stems already assigned, so a partial re-run can't re-mint a dup.
  for (const r of doc.rules) {
    if (typeof r.id === 'string' && STEM_RE.test(r.id)) takenIds.add(r.id);
  }
  const rules = doc.rules.map((r) => migrateRule(r, takenIds));
  return {
    schema_version: 2,
    generated: doc.generated,
    ruleset_sha: rulesetSha(rules),
    note: OPTION_B_NOTE,
    rules,
  };
}

function serialize(doc) {
  return JSON.stringify(doc, null, 2) + '\n';
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const before = fs.readFileSync(RULES_PATH, 'utf8');
  const doc = JSON.parse(before);
  const migrated = migrate(doc);
  const after = serialize(migrated);

  if (checkOnly) {
    if (before !== after) {
      console.error('rules-migrate: RULES.json is NOT fully migrated/normalized — run `node scripts/rules-migrate.js`.');
      process.exit(1);
    }
    console.log('rules-migrate: RULES.json is up to date.');
    return;
  }

  if (before === after) {
    console.log('rules-migrate: no change — RULES.json already migrated.');
    return;
  }
  fs.writeFileSync(RULES_PATH, after);
  console.log(`rules-migrate: migrated ${migrated.rules.length} rule(s) → animal-color ids; ruleset_sha=${migrated.ruleset_sha}`);
}

if (require.main === module) main();

module.exports = { migrate, serialize, migrateRule };
