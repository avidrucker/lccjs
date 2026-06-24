#!/usr/bin/env node
/**
 * release.js — abandon a claim + tear down its worktree WITHOUT closing the issue (#1437).
 * (a.k.a. "unclaim".) The cleanup half of close.js, minus the land-on-main + gh-close half.
 *
 *   1. Delete the cross-clone claim ref so the issue is immediately re-claimable
 *      (reuses close.js's refspec + classifier; best-effort + idempotent, #1038/#1039).
 *   2. Remove the worktree + delete the branch + prune (close.js's detached-teardown
 *      pattern, #533/#541 — defer so npm/shell can exit before the dir vanishes).
 *   3. Leave the GitHub issue OPEN — no commit, no push to main, no `gh issue close`.
 *   4. No explicit PDD-marker revert is needed: claim's `flipMarker` writes
 *      `at_inprogress #N` UNcommitted *inside the worktree* (never to main), so the
 *      teardown in step 2 discards the flip for free and main keeps its `at_todo #N`.
 *   5. Data-loss guard: refuse if the branch has commits not on origin/main, OR if the
 *      worktree has uncommitted changes — unless --force — and print what would be lost,
 *      so an intended deferral is explicit, not an accident.
 *   6. Re-root hint to the main checkout afterward (the post-removal getcwd footgun).
 *
 * Usage:  npm run release <N> [--force]
 * Exit:   0 on success / nothing-to-do; 1 on bad args or a guard refusal.
 */
'use strict';

const { execSync, spawn } = require('child_process');
const path = require('path');
// Reuse close.js's battle-tested claim-ref refspec + output classifier (exported).
// Requiring close.js does NOT run it (its main() is guarded by require.main).
const { claimRefDeleteCommand, classifyClaimRefDelete } = require('./close');

function sh(cmd, allowFail = false) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { if (allowFail) return null; throw e; }
}
function shCapture(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch { return ''; }
}
function log(m) { process.stdout.write(`[release] ${m}\n`); }
function die(m) { process.stderr.write(`[release] ✗ ${m}\n`); process.exit(1); }

function parseArgs(argv) {
  const a = { issue: null, force: false };
  for (const t of argv) {
    if (t === '--force') a.force = true;
    else if (t === '--') continue;
    else if (/^\d+$/.test(t)) {
      if (a.issue !== null) die(`unexpected extra arg: ${t}  (usage: npm run release <N> [--force])`);
      a.issue = parseInt(t, 10);
    } else die(`unknown arg: ${t}  (usage: npm run release <N> [--force])`);
  }
  if (a.issue === null) die('usage: npm run release <N> [--force]');
  return a;
}

// Parse `git worktree list --porcelain` into [{path, branch}] (branch short name,
// refs/heads/ stripped; detached entries keep branch === null).
function listWorktrees(porcelain) {
  const out = porcelain != null ? porcelain : shCapture('git worktree list --porcelain');
  const rows = [];
  let cur = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) { cur = { path: line.slice(9).trim(), branch: null }; rows.push(cur); }
    else if (line.startsWith('branch ') && cur) { cur.branch = line.slice(7).trim().replace('refs/heads/', ''); }
  }
  return rows;
}

// The main checkout is git's FIRST worktree entry.
function mainRoot(rows) { return rows.length ? rows[0].path : shCapture('git rev-parse --show-toplevel'); }

// The worktree staked for issue N: branch `<agent>/issue-<N>` (optional trailing
// slug) or path basename ending `-issue-<N>`. Skips the main entry (rows[0]).
function findWorktreeForIssue(rows, issue) {
  const reBranch = new RegExp(`/issue-${issue}(?:[^0-9]|$)`);
  const rePath = new RegExp(`-issue-${issue}$`);
  for (const r of rows.slice(1)) {
    if ((r.branch && reBranch.test(r.branch)) || rePath.test(path.basename(r.path))) return r;
  }
  return null;
}

// 1. Delete the cross-clone claim ref. Abandon-path: --no-verify so the (possibly
// messy) worktree being torn down can't block its OWN claim-ref cleanup via the
// pre-push PDD/conflict hooks; `2>&1 || true` folds git's stderr ([deleted] / error)
// into stdout so the classifier reads the real result and the delete can never throw
// (mirrors close.js deleteClaimRef).
function releaseClaimRef(issue) {
  const out = sh(`${claimRefDeleteCommand(issue)} --no-verify 2>&1 || true`, true) || '';
  const verdict = classifyClaimRefDelete(out);
  if (verdict === 'DELETED') log(`claim ref refs/claims/issue-${issue} deleted.`);
  else if (verdict === 'ABSENT') log(`claim ref refs/claims/issue-${issue} already absent — no-op.`);
  else log(`warn: could not delete claim ref refs/claims/issue-${issue} (best-effort; continuing).`);
}

function main() {
  const { issue, force } = parseArgs(process.argv.slice(2));
  const rows = listWorktrees();
  const root = mainRoot(rows);
  const wt = findWorktreeForIssue(rows, issue);

  if (!wt) {
    // Orphan claim ref (no worktree — e.g. a dead session that stranded it): just
    // free the ref so the issue is re-claimable. Nothing to guard or tear down.
    releaseClaimRef(issue);
    log(`no worktree found for #${issue} — nothing to tear down.`);
    log(`#${issue} left as-is (OPEN unless already closed elsewhere).`);
    return;
  }
  const { path: wtPath, branch } = wt;

  // --- 5. data-loss guard FIRST — refuse BEFORE touching the claim ref or worktree,
  //     so a refused release leaves the claim held + worktree fully intact. ---
  if (!force) {
    sh('git fetch origin -q', true);
    const ahead = parseInt(shCapture(`git rev-list --count origin/main..${branch}`), 10) || 0;
    if (ahead > 0) {
      die(`#${issue} branch ${branch} has ${ahead} commit(s) NOT on origin/main — release would discard them:\n`
        + shCapture(`git log origin/main..${branch} --oneline`)
        + `\n  Land them on the right ticket first (e.g. cherry-pick), or re-run with --force to discard.`);
    }
    const dirty = shCapture(`git -C "${wtPath}" status --porcelain`);
    if (dirty) {
      die(`worktree ${wtPath} has uncommitted changes — release would discard them:\n`
        + dirty + `\n  Commit/stash what you want to keep, or re-run with --force to discard.`);
    }
  }

  // --- 1. claim ref (only now that the guard has passed / --force) ---
  releaseClaimRef(issue);

  // --- 2 + 4 + 6. detached teardown; reverts any uncommitted at_inprogress flip for
  //     free; leaves the GitHub issue OPEN. Deferred + cwd=root so npm/shell can exit
  //     before the directory disappears (close.js #533/#541 getcwd footgun). ---
  log(`releasing #${issue}: worktree ${wtPath} + branch ${branch} — issue stays OPEN.`);
  log(`Shell re-root: cd "${root}"`);
  spawn('bash', ['-c',
    `git worktree remove --force "${wtPath}" && git branch -D ${branch} && git worktree prune`
    + ` || echo '[release] warning: deferred teardown may have failed — check: git worktree list' >&2`,
  ], { detached: true, stdio: ['ignore', 'inherit', 'inherit'], cwd: root }).unref();
}

if (require.main === module) main();

module.exports = { parseArgs, listWorktrees, findWorktreeForIssue, mainRoot };
