#!/usr/bin/env node
/*
 * infer-area-label.js — pure content→lane inference for the label-area workflow.
 *
 * Why this exists (#1246): `.github/workflows/label-area.yml` (#1012) only does
 * binary logic — if an issue opens without an `area:*` label, stamp
 * `area:uncategorized`. It never INFERS the real lane, so `area:uncategorized`
 * became the default rather than the rare exception it was designed to be, and
 * (since the #1151 claim-gate) it actively blocks claims until someone hand-
 * labels (see #1244). This module turns the floor back into an exception by
 * guessing the lane from the issue's title + body + existing labels.
 *
 * Boundary: this file is PURE — no GitHub API, no I/O, no env. The workflow YAML
 * stays a thin shim that requires this and calls `inferArea(...)` (per the
 * #1246 scope note: keep the inference testable, out of the YAML).
 *
 * Conservative bias (#1246 acceptance criteria): a WRONG lane is worse than
 * uncategorized — it hides the issue from the triage sweep. So we only commit to
 * a lane when exactly one area is the strict top scorer; a tie between areas is
 * treated as low-confidence and falls back to `area:uncategorized`.
 */

'use strict';

// Distinctive patterns per area. Score = number of DISTINCT patterns an area
// matches across (title + body + label names). Short acronyms use word
// boundaries (and case-sensitivity where it disambiguates) to avoid substring
// false positives (e.g. \bISA\b must not fire inside "revisal").
const AREA_RULES = [
  ['area:lcc-non-core', [
    /lcc\+/i, /\.ap\b/i, /lccplus/i, /\bilcc\b/i, /interactive debugger/i,
    /\bfun\.js\b/i, /src\/extra\b/i,
  ]],
  ['area:web', [
    /browser/i, /playground/i, /showcase/i, /\bpages\b/i, /codemirror/i,
    /front[- ]?end/i, /\bdashboards?\b/i, /syntax[- ]highlight/i, /code-in-slides/i,
  ]],
  ['area:education', [
    /textbooks?/i, /\bdemos?\b/i, /teaching/i, /tutorials?/i, /curriculum/i,
    /\bstudents?\b/i, /\blessons?\b/i, /\bexercises?\b/i,
  ]],
  ['area:architecture', [
    /decomplect/i, /state[- ]grouping/i, /god[- ]object/i, /\bDDD\b/,
    /\bseams?\b/i, /domain language/i, /module decompos/i, /\bdecompositions?\b/i,
  ]],
  ['area:process', [
    /\bskills?\b/i, /\bRULES\b/, /velocity/i, /\bclaims?\b/i, /\bclose\.js\b/i,
    /fruit-agent-orchestrate/i, /workflows?/i, /\bPM\b/, /\bTIL\b/, /\bpuzzles?\b/i,
    /error[- ]log/i, /\btriage\b/i, /agentic/i, /\bpdd\b/i,
  ]],
  ['area:toolchain', [
    /assembler/i, /interpreter/i, /linker/i, /oracle/i, /lcc --test/i,
    /\bISA\b/, /opcode/i, /mnemonic/i, /\btrap\b/i, /parity/i,
  ]],
];

const FALLBACK = 'area:uncategorized';

function labelNames(labels) {
  return (labels || []).map((l) => (typeof l === 'string' ? l : (l && l.name) || ''));
}

/**
 * Infer a single `area:*` label for an issue.
 * @param {string} title
 * @param {string} body
 * @param {Array<string|{name:string}>} labels  existing labels (strings or {name})
 * @returns {string} an `area:*` label name; never overrides an existing one.
 */
function inferArea(title = '', body = '', labels = []) {
  const names = labelNames(labels);

  // Never touch an issue that already carries a real area:* lane.
  const existing = names.find((n) => n.startsWith('area:'));
  if (existing) return existing;

  const text = `${title || ''}\n${body || ''}\n${names.join(' ')}`;

  const scored = AREA_RULES
    .map(([area, patterns]) => ({
      area,
      hits: patterns.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0),
    }))
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  if (scored.length === 0) return FALLBACK;
  // Strict top scorer only — a tie is low-confidence, stay uncategorized.
  if (scored.length > 1 && scored[0].hits === scored[1].hits) return FALLBACK;
  return scored[0].area;
}

module.exports = { inferArea, AREA_RULES };

// CLI for manual probing / tuning:  node scripts/infer-area-label.js "<title>" ["<body>"]
if (require.main === module) {
  const [, , title = '', body = ''] = process.argv;
  process.stdout.write(`${inferArea(title, body, [])}\n`);
}
