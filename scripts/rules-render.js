#!/usr/bin/env node
'use strict';
// scripts/rules-render.js — render RULES.json (the source of truth) → RULES.md (#1318).
//
// Option B (ruling #845): RULES.json is authoritative; RULES.md is a generated,
// committed artifact — like dist/. This script is the generator. Wired as
// `npm run rules:render`.
//
// Lean Hybrid layout (chosen 2026-06-14):
//   1. A do-not-edit banner (HTML comment — invisible on the Pages render, glaring
//      in the raw file). Folds in #1203.
//   2. The verbatim `preamble` blob (intro + inclusion criterion).
//   3. A GENERATED numbered list of the ACTIVE rules — rule `text` only. The "why",
//      citations, and history stay in each rule's `comment` (the #842-spike text/
//      comment split) so the constantly-re-read file stays "lean on purpose".
//      Relocated rules appear only in the footer table, never in this list.
//   4. The verbatim `footer` blob (relocation note + table + numbering history).
//
// It also maintains version metadata: when a rule's `text` changes, its recorded
// `text_sha` no longer matches sha256(text)[:6], so this pass recomputes the sha,
// increments that rule's `version`, refreshes the top-level `ruleset_sha`, and
// writes RULES.json back BEFORE rendering. Editing only `comment`/`category`/
// metadata changes no sha and bumps nothing.
//
// Usage:
//   node scripts/rules-render.js          # sync versions + (re)write RULES.md
//   node scripts/rules-render.js --check   # write nothing; exit 1 if RULES.md or the
//                                          # version metadata is out of date (CI/hook use)

const fs = require('fs');
const path = require('path');
const { textSha, rulesetSha } = require('./rules-id');

const ROOT = path.join(__dirname, '..');
const RULES_JSON = path.join(ROOT, 'RULES.json');
const RULES_MD = path.join(ROOT, 'RULES.md');

// Banner wording is fixed by #1203: the loud line is verbatim and first; the second
// line gives the how-to. HTML comments so both are invisible in any rendered Markdown
// view but glaring in the raw file an editor opens.
const BANNER =
  "<!-- AUTOGEN'D FILE, DO NOT EDIT MANUALLY/DIRECTLY -->\n" +
  '<!-- Generated from RULES.json by `npm run rules:render`. Edit RULES.json, then re-render. -->';

function loadDoc() {
  return JSON.parse(fs.readFileSync(RULES_JSON, 'utf8'));
}

function serializeDoc(doc) {
  return JSON.stringify(doc, null, 2) + '\n';
}

// Reconcile per-rule version metadata with the current `text`. Mutates `doc`.
// Returns true if any sha / version / ruleset_sha changed.
function syncVersions(doc) {
  let changed = false;
  for (const r of doc.rules) {
    const sha = textSha(r.text);
    if (r.text_sha !== sha) {
      r.text_sha = sha;
      r.version = (typeof r.version === 'number' ? r.version : 0) + 1;
      changed = true;
    }
  }
  const rs = rulesetSha(doc.rules);
  if (rs !== doc.ruleset_sha) {
    doc.ruleset_sha = rs;
    changed = true;
  }
  return changed;
}

// Render the Markdown. `active` rules are numbered 1..N in document order; relocated
// rules are intentionally omitted from the numbered list (they live in the footer).
function renderMd(doc) {
  const active = doc.rules.filter((r) => r.status === 'active');
  const list = active.map((r, i) => `${i + 1}. ${r.text}`).join('\n');
  return [BANNER, doc.preamble, list, doc.footer].join('\n\n') + '\n';
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const doc = loadDoc();
  const versionsStale = syncVersions(doc);
  const md = renderMd(doc);
  const curMd = fs.existsSync(RULES_MD) ? fs.readFileSync(RULES_MD, 'utf8') : null;
  const mdStale = curMd !== md;

  if (checkOnly) {
    if (versionsStale) {
      console.error('rules-render: version metadata in RULES.json is stale (a `text` edit was not rendered) — run `npm run rules:render`.');
      process.exit(1);
    }
    if (mdStale) {
      console.error('rules-render: RULES.md is out of date with RULES.json — run `npm run rules:render`.');
      process.exit(1);
    }
    console.log('rules-render: RULES.md is up to date.');
    return;
  }

  if (versionsStale) {
    fs.writeFileSync(RULES_JSON, serializeDoc(doc));
    console.log(`rules-render: version metadata updated (ruleset_sha=${doc.ruleset_sha}).`);
  }
  if (mdStale) {
    fs.writeFileSync(RULES_MD, md);
    const n = doc.rules.filter((r) => r.status === 'active').length;
    console.log(`rules-render: wrote RULES.md (${n} active rules).`);
  } else {
    console.log('rules-render: RULES.md already up to date.');
  }
}

if (require.main === module) main();

module.exports = { syncVersions, renderMd, BANNER };
