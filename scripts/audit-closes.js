#!/usr/bin/env node
/*
 * audit-closes.js — detect closed issues whose comments lack a *timely*
 * `error self-audit:` line (RULES.md R021 / #1117).
 *
 * Why this exists (#1234): R021 requires every closing comment to carry an
 * explicit `error self-audit: …` line, so a *forgotten* audit and a *clean*
 * session stop looking identical. But nothing checked for it — `close.js`
 * audits only the diff *scope* (it deliberately can't see the transcript or the
 * comment thread), and no git hook or reconciler greps closed-issue comments.
 * So a close with no audit line was invisible until a human noticed (#1169 /
 * #1108). This is the missing post-hoc detector.
 *
 * Detection / reporting ONLY — no auto-fix, and no blocking gate in close.js
 * (which structurally can't run this). Default exit is 0; `--strict` exits 1
 * when violations are found, for opt-in CI use.
 *
 * A close is classified by joining the issue's close time with its comments:
 *
 *   ok                — a `error self-audit:` line appears in a comment posted
 *                       at/around the close (within the grace window).
 *   late              — the line appears, but ONLY in a comment posted more than
 *                       grace-minutes after closedAt (a backfill, e.g. #1169).
 *   missing           — the issue has a `Closed in <sha>` puzzle-close comment
 *                       but NO audit line anywhere.
 *   no-close-comment  — closed without a `Closed in <sha>` comment at all
 *                       (likely a duplicate / wontfix / manual gh close — not a
 *                       puzzle close, so not held to R021 by default).
 *
 * Violations (reported by default) = `missing` + `late`. `ok` and
 * `no-close-comment` are not violations. `--all` shows every scanned issue's
 * status; `--include-silent` also treats `no-close-comment` as a violation.
 *
 * Usage:
 *   node scripts/audit-closes.js                 # scan last 30 closed, list violations, exit 0
 *   npm run audit:closes -- --limit 50           # scan more
 *   npm run audit:closes -- --grace-min 30       # tighten the "timely" window (default 60)
 *   npm run audit:closes -- --all                # show ok / no-close-comment too
 *   npm run audit:closes -- --json               # machine-readable dump
 *   npm run audit:closes -- --strict             # exit 1 if any violation (CI)
 *
 * `gh` is required to FETCH (the pure classifier is gh-free and unit-tested);
 * without gh the script prints a notice and exits 0 — never blocks.
 */

'use strict';

const { execSync } = require('child_process');

// --- pure seam (no gh, no I/O) — unit-tested in tests/new/audit-closes.unit.spec.js ---

const AUDIT_RE = /error self-audit\s*[:(]/i; // the R021 line; tolerate "audit (late):" and "audit:"
// close.js convention: "Closed in <sha>". Tolerate the common backtick/quote
// wrappers agents use ("Closed in `7727ca0`") via \W* between phrase and sha.
const CLOSE_RE = /closed in\b\W*[0-9a-f]{7,40}\b/i;
const DEFAULT_GRACE_MINUTES = 60;

/**
 * Classify one closed issue.
 * @param {{number:number,title?:string,closedAt?:string,comments?:Array<{body:string,createdAt?:string}>}} issue
 * @param {{graceMinutes?:number}} [opts]
 * @returns {{number:number,title:string,status:'ok'|'late'|'missing'|'no-close-comment',auditCount:number}}
 */
function classifyClose(issue, opts = {}) {
  const graceMinutes = opts.graceMinutes == null ? DEFAULT_GRACE_MINUTES : opts.graceMinutes;
  const comments = Array.isArray(issue.comments) ? issue.comments : [];
  const out = { number: issue.number, title: issue.title || '', auditCount: 0, status: 'no-close-comment' };

  const hasCloseComment = comments.some((c) => CLOSE_RE.test(c.body || ''));
  const auditComments = comments.filter((c) => AUDIT_RE.test(c.body || ''));
  out.auditCount = auditComments.length;

  if (auditComments.length === 0) {
    // No audit line anywhere. Only a *puzzle* close (one that posted a
    // `Closed in <sha>` comment) is held to R021 by default.
    out.status = hasCloseComment ? 'missing' : 'no-close-comment';
    return out;
  }

  // An audit line exists; is at least one of them *timely* (at/around close)?
  const closedMs = Date.parse(issue.closedAt);
  const graceMs = graceMinutes * 60 * 1000;
  const timely = auditComments.some((c) => {
    const t = Date.parse(c.createdAt);
    // If either timestamp is unparseable, don't false-flag — treat as timely.
    if (!Number.isFinite(t) || !Number.isFinite(closedMs)) return true;
    return t <= closedMs + graceMs;
  });
  out.status = timely ? 'ok' : 'late';
  return out;
}

/** A status is a violation if it is `missing` or `late` (and `no-close-comment` only when includeSilent). */
function isViolation(result, includeSilent = false) {
  if (result.status === 'missing' || result.status === 'late') return true;
  if (includeSilent && result.status === 'no-close-comment') return true;
  return false;
}

// --- CLI wrapper (owns gh fetch, printing, exit code) ---

function sh(cmd, allowFail = false) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    if (allowFail) return null;
    throw e;
  }
}

function flagValue(argv, name, fallback) {
  const i = argv.indexOf(name);
  if (i === -1 || i === argv.length - 1) return fallback;
  return argv[i + 1];
}

function fetchClosedIssues(limit) {
  // One call for the issue list (number/title/closedAt), then one `gh issue
  // view --json comments` per issue (gh issue list cannot return comments).
  const listJson = sh(`gh issue list --state closed --limit ${limit} --json number,title,closedAt`, true);
  if (listJson == null) return null; // gh missing/erroring
  let list;
  try {
    list = JSON.parse(listJson);
  } catch (e) {
    return null;
  }
  return list.map((it) => {
    const cj = sh(`gh issue view ${it.number} --json comments`, true);
    let comments = [];
    if (cj != null) {
      try {
        comments = (JSON.parse(cj).comments || []).map((c) => ({ body: c.body, createdAt: c.createdAt }));
      } catch (e) {
        comments = [];
      }
    }
    return { number: it.number, title: it.title, closedAt: it.closedAt, comments };
  });
}

function main() {
  const argv = process.argv.slice(2);
  const STRICT = argv.includes('--strict');
  const AS_JSON = argv.includes('--json');
  const SHOW_ALL = argv.includes('--all') || argv.includes('--verbose');
  const INCLUDE_SILENT = argv.includes('--include-silent');
  const limit = Math.max(1, parseInt(flagValue(argv, '--limit', '30'), 10) || 30);
  const graceMinutes = Math.max(0, parseInt(flagValue(argv, '--grace-min', String(DEFAULT_GRACE_MINUTES)), 10));

  const issues = fetchClosedIssues(limit);
  if (issues == null) {
    // gh unavailable — never block.
    if (AS_JSON) {
      process.stdout.write(JSON.stringify({ error: 'gh unavailable', results: [] }) + '\n');
    } else {
      process.stderr.write('audit-closes: `gh` is required to fetch closed issues — none scanned. (non-blocking)\n');
    }
    process.exit(0);
  }

  const results = issues.map((it) => classifyClose(it, { graceMinutes }));
  const violations = results.filter((r) => isViolation(r, INCLUDE_SILENT));

  if (AS_JSON) {
    process.stdout.write(JSON.stringify({ scanned: results.length, graceMinutes, violations, results }, null, 2) + '\n');
    if (STRICT && violations.length) process.exit(1);
    return;
  }

  const label = { ok: '  ok ', late: 'LATE ', missing: 'MISS ', 'no-close-comment': ' n/a ' };
  const rows = SHOW_ALL ? results : violations;
  console.log(`audit-closes — scanned ${results.length} closed issue(s), grace ${graceMinutes}m`);
  if (!rows.length) {
    console.log(SHOW_ALL ? '(no issues)' : 'No violations — every scanned puzzle-close carries a timely `error self-audit:` line. ✓');
  } else {
    for (const r of rows.sort((a, b) => b.number - a.number)) {
      console.log(`  [${label[r.status]}] #${r.number}  ${r.title}`);
    }
  }
  if (!SHOW_ALL && violations.length) {
    const miss = violations.filter((r) => r.status === 'missing').length;
    const late = violations.filter((r) => r.status === 'late').length;
    console.log(`\n${violations.length} violation(s): ${miss} missing, ${late} late. (detection only — no auto-fix)`);
  }
  if (STRICT && violations.length) process.exit(1);
}

if (require.main === module) main();

module.exports = { classifyClose, isViolation, AUDIT_RE, CLOSE_RE, DEFAULT_GRACE_MINUTES };
