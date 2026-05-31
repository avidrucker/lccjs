#!/usr/bin/env node
/*
 * close.js — finish a puzzle safely: land the close commit on origin/main, then
 * (and ONLY then) tear down the worktree. The symmetric mirror of claim.js.
 *
 * Why this exists (#242, the #200 incident): the close used to be a hand-typed,
 * newline-separated chain — `git push` followed by `git worktree remove` /
 * `git branch -D` on their own lines. When the push lost a parallel-agent race
 * (another agent landed on `main` between this agent's rebase and push, so the
 * non-fast-forward push was rejected), the cleanup lines ran ANYWAY — removing
 * the worktree and deleting the branch while the closing commit was still only
 * local and the issue still OPEN. The work survived only as a dangling object.
 *
 * This tool removes that footgun structurally, by fixing BOTH root causes:
 *   1. Single-shot push is racy → it LOOPS fetch/rebase/push until it lands.
 *   2. Cleanup wasn't gated on push success → cleanup runs IFF `git branch -r
 *      --contains HEAD` includes origin/main. One chokepoint (`shouldCleanup`)
 *      makes "cleanup after a failed push" impossible.
 *
 * Boundary: this tool does NOT author the closing commit. The agent writes the
 * marker deletion + CSV row + `Closes #N` message and commits FIRST; close.js
 * takes over after, owning only the racy push + the gated teardown. Keeping the
 * commit out of the tool keeps it from ever fabricating a close.
 *
 * Usage (run from inside the puzzle's worktree, after committing `Closes #N`):
 *   node scripts/close.js <issue>
 *   node scripts/close.js <issue> --max 8        # more push-race retries (default 5)
 *   node scripts/close.js <issue> --dry-run      # show the plan, change nothing
 *   node scripts/close.js <issue> --keep         # land the commit but DON'T tear down
 *   node scripts/close.js <issue> --no-verify-issue  # skip the gh post-close check
 *
 * See docs/research/close-sequence-hardening.md for the full design.
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');

const DEFAULT_MAX_RETRIES = 5;

// Files carrying `merge=union` in .gitattributes: parallel append-only logs that
// auto-resolve on rebase. A conflict touching ONLY these is a contradiction
// (union never conflicts) and signals a bug; a conflict touching anything else
// is a real, human-resolvable conflict. Keep in sync with .gitattributes.
// Note: docs/puzzle-velocity.csv was removed from this list in #290 — the CSV
// is now a full-file auto-export from SQLite; conflicts resolve via re-export.
const UNION_FILES = ['docs/puzzle-clusters.csv'];

function sh(cmd, allowFail = false) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    if (allowFail) return null;
    throw e;
  }
}

// Like sh() but always returns { ok, out } with stdout+stderr merged, never
// throws. Used for the push, whose stderr carries the race signatures we
// classify (git writes rejection text to stderr, exits non-zero).
function shCapture(cmd) {
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, out: out || '' };
  } catch (e) {
    const out = `${e.stdout || ''}${e.stderr || ''}`;
    return { ok: false, out };
  }
}

function die(msg) {
  console.error(`[close] ✗ ${msg}`);
  process.exit(1);
}

function log(msg) {
  console.log(`[close] ${msg}`);
}

// The main checkout's root, NOT the worktree we're closing — the worktree is
// about to be removed, so the removal must run from a directory that survives.
function mainRoot() {
  let dir = sh('git rev-parse --path-format=absolute --git-common-dir', true);
  if (!dir) {
    const rel = sh('git rev-parse --git-common-dir', true); // older git fallback
    if (!rel) die('not inside a git repository.');
    dir = path.resolve(process.cwd(), rel.trim());
  }
  return path.dirname(dir.trim());
}

function parseArgs(argv) {
  const opts = {
    issue: null, max: DEFAULT_MAX_RETRIES, dryRun: false,
    keep: false, verifyIssue: true,
  };
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--max') opts.max = parseInt(argv[++i], 10);
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--keep') opts.keep = true;
    else if (a === '--no-verify-issue') opts.verifyIssue = false;
    else if (a.startsWith('--')) die(`unknown flag: ${a}`);
    else positionals.push(a);
  }
  opts.issue = positionals[0];
  if (!Number.isInteger(opts.max) || opts.max < 1) opts.max = DEFAULT_MAX_RETRIES;
  return opts;
}

// ---- pure decision seams (no git I/O; unit-tested in #267) -----------------

// Classify the combined stdout+stderr of `git push` into a retry decision.
//   'ok'             — the push landed (or there was nothing to push).
//   'race'           — lost the rebase→push window; another agent landed first.
//                      Re-fetch/rebase/push will likely succeed. Retry.
//   'rejected-other' — a non-racy rejection (hook block, auth, protected branch,
//                      no upstream). Retrying won't help; abort.
// Pure: takes a string, returns a string.
//
// Order matters. The #200 incident message is
//   "! [remote rejected] HEAD -> main (cannot lock ref 'refs/heads/main': ...)"
// — note it carries the literal "[remote rejected]" prefix, yet it IS the race
// this whole tool exists to retry. So "[remote rejected]" is NOT itself a signal;
// the parenthetical *reason* is. We therefore check definitively un-retryable
// reasons FIRST, then the race reasons, and only trust success once both are
// ruled out. An unrecognized failure defaults to 'rejected-other' (don't loop
// blindly on something we don't understand).
// IMPORTANT: only call this on a FAILED push (git exited non-zero). Push
// success is decided by the exit code, NOT by this function — the pre-push hook
// prints its banner ("[pre-push] scanning…") on every push including successful
// ones, so no string can reliably distinguish success from failure. The caller
// (tryLand) returns 'ok' on exit 0 and only consults this on a real failure to
// decide race-vs-abort. Given that, this returns 'race' or 'rejected-other'.
function classifyPushError(output) {
  const s = String(output || '');
  // Retryable race: ref-lock contention (the #200 incident) + the non-ff family.
  // These clear by re-fetch/rebase, so loop. Checked FIRST because the #200
  // message literally reads "! [remote rejected] … (cannot lock ref …)" — the
  // "[remote rejected]" prefix is NOT itself a fatal signal; the reason is.
  const RACE = [
    /cannot lock ref/i,
    /non-fast-forward/i,
    /\bfetch first\b/i,
    /tip of your current branch is behind/i,
    /\[rejected\]/i,
  ];
  if (RACE.some((re) => re.test(s))) return 'race';
  // Everything else that failed is un-retryable: a local pre-push hook rejection
  // (pdd/conflict gate — "PDD scan FAILED", "[pre-push] BLOCKED"), a server-side
  // refusal (auth, protected branch, pre-receive/hook declined), or anything we
  // don't recognize. Retrying won't help; surface it. Note we key on the hook's
  // FAILURE words, never the bare "[pre-push]" banner (which prints on success).
  return 'rejected-other';
}

// The gate. Cleanup is permitted IFF the closing commit is confirmed on
// origin/main. This is the single chokepoint that makes "tear down after a
// failed push" structurally impossible — every caller routes through it.
function shouldCleanup({ onOriginMain }) {
  return onOriginMain === true;
}

// Classify a rebase's conflicted paths against the union-file set.
//   'none'       — no conflicts.
//   'union-only' — every conflicted path is a merge=union file. This should be
//                  impossible (union auto-resolves), so it signals a config/bug;
//                  the caller treats it as a hard abort, not an auto-resolve.
//   'blocking'   — at least one non-union file conflicts (a hand-edited doc or
//                  a source file). A human/agent must resolve; never auto-resolve.
function classifyRebaseConflict(paths, unionFiles = UNION_FILES) {
  const list = (paths || []).map((p) => String(p).trim()).filter(Boolean);
  if (list.length === 0) return 'none';
  const allUnion = list.every((p) => unionFiles.includes(p));
  return allUnion ? 'union-only' : 'blocking';
}

// ---- git I/O helpers (thin wrappers; the seams above stay pure) ------------

function currentBranch() {
  const b = sh('git rev-parse --abbrev-ref HEAD', true);
  return b ? b.trim() : null;
}

function headSha() {
  const s = sh('git rev-parse HEAD', true);
  return s ? s.trim() : null;
}

// Does HEAD's commit message reference `Closes #<issue>` (the agent committed
// the close)? Accepts the GitHub close keywords. The whole point of the tool is
// to land an EXISTING close commit, so refuse if there isn't one.
function headClosesIssue(issue) {
  const body = sh(`git log -1 --format=%B`, true) || '';
  const re = new RegExp(`\\b(clos(e|es|ed)|fix(e|es|ed)?|resolv(e|es|ed))\\s+#${issue}\\b`, 'i');
  return re.test(body);
}

function treeIsClean() {
  const s = sh('git status --porcelain', true);
  return s !== null && s.trim() === '';
}

function rebaseOrMergeInProgress() {
  const rm = sh('git rev-parse --git-path rebase-merge', true);
  const ra = sh('git rev-parse --git-path rebase-apply', true);
  const mh = sh('git rev-parse --git-path MERGE_HEAD', true);
  const exists = (p) => p && sh(`test -e "${p.trim()}" && echo yes`, true);
  return !!(exists(rm) || exists(ra) || exists(mh));
}

function conflictedPaths() {
  const s = sh('git diff --name-only --diff-filter=U', true) || '';
  return s.split('\n').map((x) => x.trim()).filter(Boolean);
}

function onOriginMain(sha) {
  const out = sh(`git branch -r --contains ${sha}`, true) || '';
  return out.split('\n').some((l) => l.trim() === 'origin/main');
}

// One fetch/rebase/push round. Returns 'ok' | 'race' | 'rejected-other', or
// throws via die() on a blocking rebase conflict (which is not retryable).
function tryLand() {
  sh('git fetch origin main', true);
  const rebase = shCapture('git rebase origin/main');
  if (!rebase.ok) {
    const kind = classifyRebaseConflict(conflictedPaths());
    sh('git rebase --abort', true);
    if (kind === 'union-only') {
      die('rebase conflicted ONLY on merge=union file(s) — that should be ' +
          'impossible (union auto-resolves). Check .gitattributes is in effect. ' +
          'Aborted the rebase; your commit is safe and local.');
    }
    die('rebase hit a real conflict in non-union file(s): ' +
        `${conflictedPaths().join(', ') || rebase.out.trim()}. ` +
        'Aborted the rebase. Resolve manually, then re-run `npm run close`. ' +
        'Your commit is safe and local.');
  }
  const push = shCapture('git push origin HEAD:main');
  // Exit code is the source of truth for success: a failing pre-push hook makes
  // git exit non-zero, so exit 0 unambiguously means the push landed. Only on a
  // real failure do we classify race-vs-abort.
  if (push.ok) return 'ok';
  return classifyPushError(push.out);
}

function report({ issue, branch, wtPath, sha, kept, dry }) {
  const short = wtPath ? wtPath.replace(process.env.HOME || '\0', '~') : '(unknown)';
  const bar = '─'.repeat(58);
  console.log(bar);
  console.log(`  ${dry ? 'WOULD CLOSE' : kept ? 'LANDED (kept worktree)' : 'CLOSED'}  ·  issue: #${issue}`);
  console.log(bar);
  console.log(`  branch    ${branch || '(detached)'}`);
  console.log(`  worktree  ${short}`);
  if (sha) console.log(`  commit    ${sha.slice(0, 12)}  (on origin/main)`);
  console.log(bar);
  console.log(`CLOSE ${dry ? 'DRYRUN' : 'OK'} issue=${issue} branch=${branch || ''} sha=${sha || ''}${kept ? ' kept=1' : ''}`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.issue || !/^\d+$/.test(opts.issue)) {
    die('usage: node scripts/close.js <issue-number> [--max N] [--dry-run] [--keep] [--no-verify-issue]');
  }
  const issue = opts.issue;

  // --- pre-flight: refuse to start unless the close is real and the tree sane.
  const branch = currentBranch();
  if (!branch || !/\/issue-\d+/.test(branch)) {
    die(`current branch "${branch || '?'}" is not a <fruit>/issue-<N> worktree branch. ` +
        'Run this from inside the puzzle\'s worktree, not the main checkout.');
  }
  if (!new RegExp(`/issue-${issue}\\b`).test(branch)) {
    die(`branch "${branch}" does not match issue #${issue}. Wrong worktree?`);
  }
  if (!headClosesIssue(issue)) {
    die(`HEAD commit does not reference "Closes #${issue}". Commit the close ` +
        '(marker deletion + CSV row + `Closes #N`) FIRST, then run close. ' +
        'This tool lands an existing close commit; it does not author one.');
  }
  if (rebaseOrMergeInProgress()) {
    die('a rebase/merge is already in progress here — finish or abort it first.');
  }
  if (!treeIsClean()) {
    die('working tree is not clean. Commit or stash everything into the close ' +
        'commit first (this tool only pushes what is already committed).');
  }

  const sha = headSha();
  const root = mainRoot();
  const wtPath = path.join(root, '.claude', 'worktrees', branch.split('/')[0] + '-issue-' + issue);

  if (opts.dryRun) {
    log(`would loop fetch/rebase/push (max ${opts.max}), verify ${sha && sha.slice(0, 12)} on origin/main, then ${opts.keep ? 'KEEP' : 'remove'} the worktree.`);
    report({ issue, branch, wtPath, sha: null, kept: opts.keep, dry: true });
    return;
  }

  // --- land: loop fetch/rebase/push until it sticks or we give up.
  let landed = false;
  for (let attempt = 1; attempt <= opts.max; attempt++) {
    const verdict = tryLand();
    if (verdict === 'ok') { landed = true; break; }
    if (verdict === 'rejected-other') {
      die(`push was rejected for a non-racy reason (hook, auth, or protected ` +
          `branch) on attempt ${attempt}. Your commit is SAFE and local — ` +
          'fix the cause and re-run `npm run close`. Worktree left intact.');
    }
    log(`push lost the race (attempt ${attempt}/${opts.max}) — re-fetching and retrying.`);
  }
  if (!landed) {
    die(`push lost the race ${opts.max} times — main is hot right now. Your ` +
        `commit ${sha && sha.slice(0, 12)} is SAFE and local; re-run ` +
        '`npm run close` (or raise --max). Worktree left intact, NOT removed.');
  }

  // --- the gate: verify on origin/main before ANY teardown.
  sh('git fetch origin main', true);
  if (!shouldCleanup({ onOriginMain: onOriginMain(sha) })) {
    die(`push reported success but ${sha && sha.slice(0, 12)} is NOT on ` +
        'origin/main — refusing to remove the worktree. Investigate before ' +
        'cleaning up; your work is intact.');
  }
  log(`commit ${sha.slice(0, 12)} confirmed on origin/main.`);

  // --- best-effort: confirm the issue actually closed (the keyword can lag).
  if (opts.verifyIssue) {
    const st = sh(`gh issue view ${issue} --json state -q .state`, true);
    if (st && st.trim().toUpperCase() === 'OPEN') {
      log(`#${issue} still shows OPEN — closing it explicitly.`);
      sh(`gh issue close ${issue} -c "Closed via npm run close (commit ${sha.slice(0, 12)} on main)."`, true);
    } else if (st) {
      log(`#${issue} is ${st.trim()}.`);
    }
  }

  if (opts.keep) {
    report({ issue, branch, wtPath, sha, kept: true, dry: false });
    return;
  }

  // --- teardown: only reachable past the gate. Run from main root (the
  // worktree dir is about to vanish under us).
  process.chdir(root);
  const removed = sh(`git worktree remove "${wtPath}"`, true);
  if (removed === null) {
    // Don't fail the close over a stubborn worktree — the work is safely on
    // main. Tell the human how to finish the teardown by hand.
    log(`could not auto-remove ${wtPath} (uncommitted junk? open shell?). ` +
        `Work is safe on origin/main. Remove it manually: git worktree remove --force "${wtPath}"`);
  }
  sh(`git branch -D ${branch}`, true);
  sh('git worktree prune', true);

  report({ issue, branch, wtPath, sha, kept: false, dry: false });
}

if (require.main === module) main();

module.exports = {
  DEFAULT_MAX_RETRIES, UNION_FILES,
  parseArgs, classifyPushError, shouldCleanup, classifyRebaseConflict,
};
