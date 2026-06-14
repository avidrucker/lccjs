#!/usr/bin/env node
/**
 * file-issue.js — dedup guard run BEFORE filing a new GitHub issue.
 *
 * Residual of #1134 facet 2 (closes #1253): an agent who discovers a defect
 * mid-session files a fresh ticket without checking whether it is already
 * tracked. In the #1104/#1128 case three actors converged on one defect and
 * one duplicate ticket was filed. This guard cross-checks the open/closed issue
 * queue by title-term overlap and BLOCKS creation when a likely duplicate
 * exists, so the filer comments on the existing ticket instead.
 *
 * Two seams (mirrors the project's pure-logic + CLI split):
 *   - Pure:  extractTerms(title), findDuplicates(title, issues, opts)
 *            — no I/O, exported, unit-tested offline.
 *   - CLI:   searches via `gh` (or `--issues-file` for offline/test), prints
 *            candidate duplicates, blocks unless --force, optionally --create.
 *
 * Usage:
 *   node scripts/file-issue.js --title "bug: preflight bypasses db-path resolver"
 *   npm run file-issue -- --title "..." --create --body-file body.md --label bug
 *   npm run file-issue -- --title "..." --issues-file candidates.json   # offline check
 *
 * Exit codes:
 *   0  clear to file (no likely duplicate), --force given, or issue created
 *   1  usage / validation error (missing --title, unreadable --issues-file)
 *   2  likely duplicate(s) found and neither --force nor an override given
 */
'use strict';

// ---------------------------------------------------------------------------
// Pure seams (no I/O) — exported for unit tests.
// ---------------------------------------------------------------------------

// Common English filler + project-specific noise that carries no dedup signal.
const STOPWORDS = new Set([
  'the', 'and', 'for', 'not', 'with', 'that', 'this', 'from', 'into', 'are',
  'was', 'were', 'has', 'have', 'had', 'but', 'still', 'when', 'then', 'than',
  'should', 'would', 'could', 'will', 'via', 'per', 'its', 'our', 'your', 'you',
  'they', 'them', 'their', 'out', 'off', 'over', 'under', 'before', 'after',
  'while', 'each', 'any', 'all', 'some', 'new', 'old', 'now', 'use', 'used',
  'using', 'add', 'adds', 'added', 'fix', 'fixes', 'fixed', 'make', 'makes',
  'get', 'gets', 'set', 'sets', 'run', 'runs', 'does', 'doesn', 'don',
]);

/**
 * Reduce an issue title to its significant terms.
 * Strips a leading conventional-commit prefix (`type(scope):`), `#123` refs,
 * punctuation, stopwords, and tokens shorter than 3 chars.
 * @param {string} title
 * @returns {Set<string>}
 */
function extractTerms(title) {
  if (!title || typeof title !== 'string') return new Set();
  const stripped = title
    .toLowerCase()
    .replace(/^\s*[a-z]+(\([^)]*\))?:\s*/, '') // conventional-commit prefix
    .replace(/#\d+/g, ' ')                     // issue refs carry no term signal
    .replace(/[^a-z0-9]+/g, ' ');              // punctuation → space
  const terms = new Set();
  for (const tok of stripped.split(/\s+/)) {
    if (tok.length >= 3 && !STOPWORDS.has(tok)) terms.add(tok);
  }
  return terms;
}

/**
 * Rank existing issues by title-term overlap with a candidate title.
 * Overlap coefficient = |shared| / min(|a|, |b|) — robust to one title being
 * much longer than the other (a short new title vs. a verbose existing one).
 * @param {string} title              candidate issue title
 * @param {Array<{number:number,title:string,state?:string}>} issues
 * @param {{threshold?:number, minShared?:number}} [opts]
 * @returns {Array<{number:number,title:string,state:string,shared:string[],overlap:number}>}
 *          candidates above the threshold, most-similar first.
 */
function findDuplicates(title, issues, opts = {}) {
  const threshold = opts.threshold ?? 0.5;
  const minShared = opts.minShared ?? 2;
  const terms = extractTerms(title);
  if (terms.size === 0 || !Array.isArray(issues)) return [];

  const hits = [];
  for (const issue of issues) {
    if (!issue || typeof issue.title !== 'string') continue;
    const iTerms = extractTerms(issue.title);
    if (iTerms.size === 0) continue;
    const shared = [...terms].filter(t => iTerms.has(t));
    if (shared.length < minShared) continue;
    const overlap = shared.length / Math.min(terms.size, iTerms.size);
    if (overlap >= threshold) {
      hits.push({
        number: issue.number,
        title: issue.title,
        state: issue.state || 'UNKNOWN',
        shared,
        overlap: Number(overlap.toFixed(3)),
      });
    }
  }
  hits.sort((a, b) => b.overlap - a.overlap || a.number - b.number);
  return hits;
}

module.exports = { extractTerms, findDuplicates, STOPWORDS };

// ---------------------------------------------------------------------------
// CLI (only when run directly, so `require()` in tests stays side-effect free).
// ---------------------------------------------------------------------------

if (require.main === module) {
  const { spawnSync } = require('child_process');
  const fs = require('fs');

  const die = (msg, code = 1) => {
    process.stderr.write(`file-issue: ✗ ${msg}\n`);
    process.exit(code);
  };

  // --- parse argv ---
  const argv = process.argv.slice(2);
  const opts = { labels: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--title':        opts.title = argv[++i]; break;
      case '--body':         opts.body = argv[++i]; break;
      case '--body-file':    opts.bodyFile = argv[++i]; break;
      case '--label':        opts.labels.push(argv[++i]); break;
      case '--issues-file':  opts.issuesFile = argv[++i]; break;
      case '--threshold':    opts.threshold = Number(argv[++i]); break;
      case '--min-shared':   opts.minShared = Number(argv[++i]); break;
      case '--force':        opts.force = true; break;
      case '--create':       opts.create = true; break;
      case '--json':         opts.json = true; break;
      case '-h': case '--help':
        process.stdout.write('Usage: npm run file-issue -- --title "..." [--create] [--body-file f] [--label L] [--force] [--issues-file f]\n');
        process.exit(0);
        break;
      default:
        die(`unknown argument: ${a}`);
    }
  }

  if (!opts.title || !opts.title.trim()) {
    die('missing required --title');
  }

  // --- gather existing issues (offline file, or live `gh`) ---
  let issues;
  if (opts.issuesFile) {
    let raw;
    try {
      raw = fs.readFileSync(opts.issuesFile, 'utf8');
    } catch (e) {
      die(`cannot read --issues-file ${opts.issuesFile}: ${e.message}`);
    }
    try {
      issues = JSON.parse(raw);
    } catch (e) {
      die(`--issues-file is not valid JSON: ${e.message}`);
    }
  } else {
    const r = spawnSync('gh', [
      'issue', 'list', '--state', 'all', '--limit', '300',
      '--json', 'number,title,state',
    ], { encoding: 'utf8' });
    if (r.status !== 0) {
      die(`gh issue list failed: ${(r.stderr || '').trim() || 'unknown error'}`);
    }
    try {
      issues = JSON.parse(r.stdout);
    } catch (e) {
      die(`could not parse gh output: ${e.message}`);
    }
  }

  const dups = findDuplicates(opts.title, issues, {
    threshold: opts.threshold,
    minShared: opts.minShared,
  });

  if (opts.json) {
    process.stdout.write(JSON.stringify({ title: opts.title, duplicates: dups }, null, 2) + '\n');
  } else if (dups.length === 0) {
    process.stdout.write(`file-issue: ✓ no likely duplicate of "${opts.title}" — clear to file\n`);
  } else {
    const SHOWN = 10;
    process.stdout.write(`file-issue: ⚠ ${dups.length} likely duplicate(s) of "${opts.title}":\n`);
    for (const d of dups.slice(0, SHOWN)) {
      process.stdout.write(`  [${d.state}] #${d.number} (overlap ${d.overlap}, shared: ${d.shared.join(', ')})\n    ${d.title}\n`);
    }
    if (dups.length > SHOWN) {
      process.stdout.write(`  …and ${dups.length - SHOWN} more (re-run with --json for the full list)\n`);
    }
  }

  // --- decide ---
  if (dups.length > 0 && !opts.force) {
    process.stderr.write('file-issue: blocked — comment on the existing ticket above, or re-run with --force to file anyway.\n');
    process.exit(2);
  }

  if (!opts.create) {
    process.exit(0); // check-only mode: clear (or --force-acknowledged)
  }

  // --- create (clear, or --force given) ---
  const ghArgs = ['issue', 'create', '--title', opts.title];
  if (opts.bodyFile) ghArgs.push('--body-file', opts.bodyFile);
  else if (opts.body) ghArgs.push('--body', opts.body);
  if (opts.labels.length) ghArgs.push('--label', opts.labels.join(','));

  const c = spawnSync('gh', ghArgs, { encoding: 'utf8', stdio: 'inherit' });
  process.exit(c.status ?? 1);
}
