#!/usr/bin/env node
/*
 * puzzle-status.js — reconcile PDD puzzle markers against worktrees + GitHub.
 *
 * The `pdd` gem only knows the `@todo` keyword: a marker is either present
 * (open) or gone (closed). That binary loses two states we care about under
 * the parallel-worktree workflow:
 *
 *   - a puzzle that is *claimed* — checked out into a worktree right now, so
 *     its `@todo` on main is NOT idle and should not be grabbed by another
 *     agent; and
 *   - a marker that is *orphaned* — its issue is already CLOSED but the
 *     comment was never deleted (exactly what left #128–132 lingering).
 *
 * This script derives those states instead of storing them, by joining three
 * sources that can't drift:
 *
 *   1. puzzle markers in tracked files   (git grep — @todo AND @inprogress)
 *   2. active worktrees / branches       (git worktree list --porcelain)
 *   3. issue state                        (gh issue list --json)
 *
 * `@inprogress` is a human-only convention: the `pdd` gem ignores it (it
 * matches only `@todo`), so flipping a claimed puzzle's keyword to
 * `@inprogress` keeps it out of the gem's count while staying visible. This
 * script is the guard that keeps `@inprogress` honest — it flags any
 * `@inprogress` whose worktree has gone away.
 *
 * Usage:
 *   node scripts/puzzle-status.js          # report, always exit 0
 *   node scripts/puzzle-status.js --strict # exit 1 if any STALE marker found
 *   node scripts/puzzle-status.js --json    # machine-readable dump
 *
 * `gh` is optional: without it, issue state is reported as "unknown" and the
 * script still does the marker/worktree join. Never blocks on a missing gh.
 */

'use strict';

const { execSync } = require('child_process');

const STRICT = process.argv.includes('--strict');
const AS_JSON = process.argv.includes('--json');

function sh(cmd, allowFail = false) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    if (allowFail) return null;
    throw e;
  }
}

// 1. Puzzle markers in tracked files. git grep only sees the current worktree's
//    tracked files, so .claude/worktrees (untracked here) is excluded for free.
// Canonical puzzle shape: `@todo #N:<estimate>/<ROLE>` (e.g. #134:60m/ARC).
// Requiring the estimate+role tail keeps prose mentions of a puzzle out of the
// report — `@todo #88`, `@todo #32:...`, "see `@todo #134` in TODOS.md" are
// references, not live markers. Malformed puzzles missing the tail are the
// `pdd` gem's job to flag (npm run puzzles), not this coordination view.
function findMarkers() {
  const out = sh(`git grep -nI -E '@(todo|inprogress) #[0-9]+:[0-9]'`, true) || '';
  const re = /@(todo|inprogress)\s+#(\d+):\s*\d+\w*\/[A-Z]+/;
  const markers = [];
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    // git grep format: path:lineno:content
    const m = line.match(/^([^:]+):(\d+):(.*)$/);
    if (!m) continue;
    const [, file, lineno, content] = m;
    const km = content.match(re);
    if (!km) continue;
    markers.push({
      keyword: km[1],
      issue: Number(km[2]),
      file,
      line: Number(lineno),
      text: content.trim(),
    });
  }
  return markers;
}

// 2. Worktrees, mapped to the issue number they're working (branch or path).
function findWorktrees() {
  const out = sh('git worktree list --porcelain', true) || '';
  const worktrees = [];
  let cur = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) {
      cur = { path: line.slice('worktree '.length), branch: null, agent: null };
      worktrees.push(cur);
    } else if (line.startsWith('branch ') && cur) {
      cur.branch = line.slice('branch '.length).replace('refs/heads/', '');
      // Agent identity = the fruit prefix of a `<fruit>/issue-N-…` branch (see
      // docs/design-agent-worktree-identity.md). Absent on legacy/flat branches.
      if (cur.branch.includes('/')) cur.agent = cur.branch.split('/')[0];
    }
  }
  // issue N is claimed by a worktree whose branch or path mentions issue-N.
  const byIssue = new Map();
  for (const wt of worktrees) {
    const hay = `${wt.branch || ''} ${wt.path}`;
    const m = hay.match(/issue-(\d+)/);
    if (m) byIssue.set(Number(m[1]), wt);
  }
  return { worktrees, byIssue };
}

// 3. Issue state from gh, batched into one call. Optional.
function findIssueStates() {
  const out = sh('gh issue list --state all --json number,state,title,labels --limit 1000', true);
  if (!out) return null; // gh missing / not authed / no remote
  const map = new Map();
  try {
    for (const i of JSON.parse(out)) {
      const labels = (i.labels || []).map((l) => l.name);
      map.set(i.number, { state: i.state, title: i.title, blocked: labels.includes('blocked') });
    }
  } catch {
    return null;
  }
  return map;
}

function classify(marker, byIssue, issues) {
  const wt = byIssue.get(marker.issue);
  const issue = issues ? issues.get(marker.issue) : undefined;
  const state = issue ? issue.state : 'UNKNOWN';

  // Orphaned: issue is closed but the marker survived. Highest-priority cleanup.
  if (state === 'CLOSED') {
    return { status: 'STALE', stale: true, detail: 'issue CLOSED — delete this marker' };
  }
  if (issues && !issue) {
    return { status: 'STALE', stale: true, detail: 'no such issue — delete or fix the number' };
  }
  // @inprogress must have a live worktree backing it.
  if (marker.keyword === 'inprogress') {
    if (wt) return { status: 'IN-PROGRESS', stale: false, detail: `${by(wt)}claimed in ${shortPath(wt.path)} (${wt.branch})` };
    return { status: 'STALE', stale: true, detail: '@inprogress but no matching worktree — re-grab (@todo) or finish it' };
  }
  // @todo with a worktree on it: someone is (or was) working it.
  if (wt) {
    return { status: 'CLAIMED', stale: false, detail: `${by(wt)}worktree ${shortPath(wt.path)} (${wt.branch}) — consider flipping to @inprogress` };
  }
  if (issue && issue.blocked) {
    return { status: 'BLOCKED', stale: false, detail: 'open but labeled `blocked` — not grabbable yet' };
  }
  return { status: 'AVAILABLE', stale: false, detail: state === 'UNKNOWN' ? 'open (issue state unknown)' : 'open, unclaimed' };
}

function shortPath(p) {
  return p.replace(process.env.HOME || '~', '~');
}

// Attribute a claim to its agent (fruit) when the branch carries an identity.
function by(wt) {
  return wt && wt.agent ? `by ${wt.agent} · ` : '';
}

const ICON = {
  AVAILABLE: '🟢',
  CLAIMED: '🟡',
  'IN-PROGRESS': '🔵',
  BLOCKED: '⚪',
  STALE: '🔴',
};

function main() {
  const markers = findMarkers();
  const { byIssue } = findWorktrees();
  const issues = findIssueStates();

  const rows = markers.map((m) => ({ ...m, ...classify(m, byIssue, issues) }));

  if (AS_JSON) {
    process.stdout.write(JSON.stringify({ ghAvailable: !!issues, rows }, null, 2) + '\n');
    if (STRICT && rows.some((r) => r.stale)) process.exit(1);
    return;
  }

  if (!issues) {
    console.log('[puzzle-status] gh unavailable — issue state shown as UNKNOWN; staleness limited to worktree checks.\n');
  }

  const order = ['STALE', 'IN-PROGRESS', 'CLAIMED', 'AVAILABLE', 'BLOCKED'];
  rows.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.issue - b.issue);

  for (const r of rows) {
    console.log(`${ICON[r.status] || '  '} #${r.issue} [${r.status}] ${r.detail}`);
    console.log(`     ${r.file}:${r.line}`);
  }

  const counts = rows.reduce((acc, r) => ((acc[r.status] = (acc[r.status] || 0) + 1), acc), {});
  const summary = order.filter((s) => counts[s]).map((s) => `${counts[s]} ${s.toLowerCase()}`).join(' · ');
  console.log(`\n[puzzle-status] ${rows.length} marker(s): ${summary || 'none'}`);

  const stale = rows.filter((r) => r.stale);
  if (stale.length) {
    console.log(`[puzzle-status] ⚠ ${stale.length} STALE marker(s) — clean up: ${stale.map((r) => '#' + r.issue).join(', ')}`);
    if (STRICT) process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { findMarkers, findWorktrees, findIssueStates, classify };
