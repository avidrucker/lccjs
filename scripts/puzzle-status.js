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
const fs = require('fs');
const path = require('path');

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
    // Skip files that .pddignore excludes from the pdd gem scan — spec files can
    // contain fixture strings that look like markers but are not real puzzles (#370).
    if (file.startsWith('tests/') && file.endsWith('.spec.js')) continue;
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
      // br-prefix tolerant (#1460/#1464): strip the optional `br-` so the agent is
      // the bare fruit for both `<fruit>/issue-N` and `br-<fruit>/<proj>-<lang>-issue-N`.
      if (cur.branch.includes('/')) cur.agent = cur.branch.split('/')[0].replace(/^br-/, '');
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

// Parse "owner/repo" from the origin remote URL (handles HTTPS and SSH forms).
function getOwnerRepo() {
  const url = sh('git remote get-url origin', true);
  if (!url) return null;
  const m = url.trim().match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\s*$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

// 3. Issue state from gh — fetches only the specific issue numbers that appear
//    as markers, via a single GraphQL batch query. ~800 ms vs ~5.4 s for the
//    old `gh issue list --limit 1000` approach (#817).
//
// Returns:
//   Map          — success; issue numbers → {state, title, blocked}
//   null         — gh not installed / not authed / no remote
//   {gqlErrors}  — gh ran but the query was rejected; caller should surface the errors
function findIssueStates(issueNumbers) {
  if (!issueNumbers || !issueNumbers.length) return new Map();

  const ownerRepo = getOwnerRepo();
  if (!ownerRepo) return null;
  const { owner, repo } = ownerRepo;

  // Deduplicate — multiple markers can reference the same issue.
  const nums = [...new Set(issueNumbers)];
  const fields = nums
    .map((n) => `i${n}: issue(number:${n}) { number state title labels(first:10) { nodes { name } } }`)
    .join(' ');
  const query = `{ repo: repository(owner:"${owner}", name:"${repo}") { ${fields} } }`;

  // Use execSync directly (not sh()) so we can inspect stdout on failure.
  // gh api graphql exits 1 and writes the GraphQL error JSON to stdout when the
  // query is rejected — swallowing that error (as sh(…,true) does) causes the
  // misleading "gh unavailable" message (#830).
  let out;
  try {
    out = execSync(`gh api graphql -f query='${query}'`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    // e.stdout contains the GraphQL response JSON even on non-zero exit.
    const gqlErrors = _parseGqlErrors(e.stdout);
    if (gqlErrors) return { gqlErrors }; // query syntax/validation error, not a gh auth problem
    return null; // gh not installed / not authed
  }
  if (!out) return null;

  const map = new Map();
  try {
    const data = JSON.parse(out);
    // GraphQL can also return errors with HTTP 200 (exit 0) — detect those too.
    if (data && Array.isArray(data.errors) && data.errors.length && !(data.data && data.data.repo)) {
      return { gqlErrors: data.errors };
    }
    const repoData = data && data.data && data.data.repo;
    if (!repoData) return null;
    for (const val of Object.values(repoData)) {
      if (!val || typeof val !== 'object') continue;
      const labels = ((val.labels && val.labels.nodes) || []).map((l) => l.name);
      map.set(val.number, { state: val.state, title: val.title, blocked: labels.includes('blocked') });
    }
  } catch {
    return null;
  }
  return map;
}

function _parseGqlErrors(stdout) {
  if (!stdout) return null;
  try {
    const parsed = JSON.parse(stdout.trim());
    if (Array.isArray(parsed.errors) && parsed.errors.length) return parsed.errors;
  } catch { /* not JSON — gh missing or auth error */ }
  return null;
}

// 4. Cluster manifest (derived-cluster availability, #222/#237). Optional file:
//    structure is logged locally so reading it costs ZERO network. Membership lives
//    in docs/puzzle-clusters.csv (`cluster,issue,blocked_by`); absent file => no locks,
//    so puzzle-status stays backward-compatible on a repo without a manifest.
function loadClusters(file) {
  const f = file || path.join(__dirname, '..', 'docs', 'puzzle-clusters.csv');
  let txt;
  try { txt = fs.readFileSync(f, 'utf8'); } catch { return { clusterOf: new Map(), members: new Map(), blockedBy: new Map() }; }
  const clusterOf = new Map(); // issue -> cluster name
  const members = new Map();   // cluster name -> Set(issue)
  const blockedBy = new Map(); // issue -> blocking issue number (#358)
  for (const line of txt.trim().split('\n').slice(1)) { // slice(1) drops the header
    if (!line.trim()) continue;
    const [cluster, issue, blocked] = line.split(',').map((s) => (s || '').trim());
    if (!cluster || !/^\d+$/.test(issue)) continue;
    const n = Number(issue);
    clusterOf.set(n, cluster);
    if (!members.has(cluster)) members.set(cluster, new Set());
    members.get(cluster).add(n);
    if (blocked && /^\d+$/.test(blocked)) blockedBy.set(n, Number(blocked));
  }
  return { clusterOf, members, blockedBy };
}

// Derived soft-lock: a marker's issue is "locked" iff a *different* member of its
// cluster is in progress right now (holds a live worktree). The lock is derived from
// that live worktree, so it cannot outlive the work — no stored label, no reconciler.
function clusterLockers(issue, clusters, inProgress) {
  const cluster = clusters.clusterOf.get(issue);
  if (!cluster) return null;
  const mates = [...(clusters.members.get(cluster) || [])]
    .filter((i) => i !== issue && inProgress.has(i))
    .sort((a, b) => a - b);
  return mates.length ? { cluster, mates } : null;
}

function classify(marker, byIssue, issues, clusters, inProgress) {
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
  // CSV blocked_by edge (#358): hard dependency on another issue.
  // Open blocker → BLOCKED (can't start). Closed blocker → informational note appended
  // to the LOCKED detail if a clustermate is also in progress (the #222 mockup case).
  let blockedByNote = '';
  const blocker = clusters && clusters.blockedBy && clusters.blockedBy.get(marker.issue);
  if (blocker) {
    const blockerIssue = issues ? issues.get(blocker) : undefined;
    const blockerOpen = !blockerIssue || blockerIssue.state !== 'CLOSED';
    if (blockerOpen) {
      return { status: 'BLOCKED', stale: false, detail: `blocked-by #${blocker} (CSV edge)` };
    }
    blockedByNote = ` · blocked-by #${blocker} (closed ✓)`;
  }
  // Derived-cluster soft-lock (#222): grabbable on its own, but a clustermate is being
  // worked right now, so its code-area is hands-off. Distinct from BLOCKED (a label).
  const lock = clusters && inProgress && clusterLockers(marker.issue, clusters, inProgress);
  if (lock) {
    return { status: 'LOCKED', stale: false, detail: `cluster \`${lock.cluster}\` — clustermate ${lock.mates.map((i) => '#' + i).join(' ')} in progress${blockedByNote}` };
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
  LOCKED: '🔒',
  BLOCKED: '⚪',
  STALE: '🔴',
};

function main() {
  const markers = findMarkers();
  const { byIssue } = findWorktrees();
  const issuesResult = findIssueStates(markers.map((m) => m.issue));

  // Normalize the discriminated return: Map → use as-is; {gqlErrors} → null for classify()
  // but surface the real error instead of the misleading "gh unavailable" message.
  const issues = issuesResult instanceof Map ? issuesResult : null;
  const gqlErrors = (issuesResult && !(issuesResult instanceof Map) && issuesResult.gqlErrors) || null;

  const clusters = loadClusters();
  const inProgress = new Set(byIssue.keys()); // issues with a live worktree = in progress

  const rows = markers.map((m) => ({ ...m, ...classify(m, byIssue, issues, clusters, inProgress) }));

  if (AS_JSON) {
    process.stdout.write(JSON.stringify({ ghAvailable: !!issues, gqlErrors: gqlErrors || undefined, rows }, null, 2) + '\n');
    if (STRICT && rows.some((r) => r.stale)) process.exit(1);
    return;
  }

  if (gqlErrors) {
    const msgs = gqlErrors.map((e) => e.message).join('; ');
    console.log(`[puzzle-status] GraphQL query error — ${msgs}`);
    console.log('[puzzle-status] Hint: every connection field needs first: or last: (e.g. labels(first:10))\n');
  } else if (!issues) {
    console.log('[puzzle-status] gh unavailable — issue state shown as UNKNOWN; staleness limited to worktree checks.\n');
  }

  const order = ['STALE', 'IN-PROGRESS', 'CLAIMED', 'LOCKED', 'AVAILABLE', 'BLOCKED'];
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

module.exports = { findMarkers, findWorktrees, findIssueStates, classify, loadClusters, clusterLockers, _parseGqlErrors };
