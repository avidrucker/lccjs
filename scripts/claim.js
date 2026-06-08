#!/usr/bin/env node
/*
 * claim.js — claim a puzzle into a worktree under a self-assigned agent identity.
 *
 * Parallel Claude agents work lccjs at once (see docs/claude_workflow.md). This
 * helper gives each one a human-readable fruit name (apple, banana, cherry, …)
 * carried in its worktree branch, so `git worktree list` answers *who* is
 * working *what* and since *when* — and so puzzle:status can attribute active
 * work to an agent.
 *
 * Convention (see docs/design-agent-worktree-identity.md):
 *   branch  = <fruit>/issue-<N>-<slug>      e.g. apple/issue-179-agent-identity
 *   worktree= .claude/worktrees/<fruit>-issue-<N>
 *
 * Both still contain `issue-<N>`, so the issue join in puzzle-status.js keeps
 * working; the fruit prefix is additive.
 *
 * Identity precedence (highest first): --as <fruit> > CLAUDE_AGENT_NAME > branch-inferred > auto.
 * Full contract and race-safety model: docs/design-agent-worktree-identity.md
 *
 * A fruit is "taken" iff any `<fruit>/*` local branch exists — either a live
 * worktree branch or the `<fruit>/session` session-sentinel (#194). Git's branch
 * namespace is the single source of truth; no registry file.
 *
 * Usage:
 *   node scripts/claim.js <issue> [slug] --as apple        # reuse a known identity
 *   node scripts/claim.js <issue> --as custard --custom     # non-list name, explicit opt-in
 *   CLAUDE_AGENT_NAME=apple node scripts/claim.js <issue>  # human-directed default
 *   node scripts/claim.js <issue> --base origin/main
 *   node scripts/claim.js <issue> --dry-run                # show the plan, stake nothing
 *
 * Agent identity is REQUIRED. Omitting both --as and CLAUDE_AGENT_NAME causes an
 * immediate exit-nonzero — auto-naming is disabled (#386).
 *
 * If no slug is given, claim.js tries to derive one from the issue title via gh
 * (best-effort; falls back to no slug if gh is unavailable).
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Lowest-index-first. Common, unambiguous, easy to say aloud over a call.
const FRUITS = [
  'apple', 'banana', 'cherry', 'date', 'dragonfruit', 'elderberry', 'fig', 'grape',
  'honeydew', 'incaberry', 'jackfruit', 'kiwi', 'lemon', 'mango', 'nectarine', 'olive', 'peach',
  'quince', 'raspberry', 'strawberry', 'tangerine', 'ugli', 'vanilla',
  'watermelon', 'ximenia', 'yuzu', 'zucchini',
];

function sh(cmd, allowFail = false) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    if (allowFail) return null;
    throw e;
  }
}

function die(msg) {
  console.error(`[claim] ✗ ${msg}`);
  process.exit(1);
}

// The main checkout's root, NOT the current directory. An agent reusing its
// identity (`--as`) runs this from inside its existing worktree, but the new
// worktree must still land under the main repo's .claude/worktrees/ — never
// nested inside the caller's worktree.
function mainRoot() {
  let dir = sh('git rev-parse --path-format=absolute --git-common-dir', true);
  if (!dir) {
    const rel = sh('git rev-parse --git-common-dir', true); // older git fallback
    if (!rel) die('not inside a git repository.');
    dir = path.resolve(process.cwd(), rel.trim());
  }
  return path.dirname(dir.trim());
}

// Slugify an issue title into a short branch-safe tail.
function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, ' ')      // drop [OB-008]-style prefixes
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .slice(0, 5)                       // keep it short
    .join('-');
}

// All branches currently checked out into a worktree, with their fruit prefix.
function listWorktreeBranches() {
  const out = sh('git worktree list --porcelain', true) || '';
  const branches = [];
  for (const line of out.split('\n')) {
    if (line.startsWith('branch ')) {
      const branch = line.slice('branch '.length).replace('refs/heads/', '');
      const fruit = branch.includes('/') ? branch.split('/')[0] : null;
      branches.push({ branch, fruit });
    }
  }
  return branches;
}

// Pure: filter worktree branch entries to those with a parseable /issue-<N>
// pattern. Returns {branch, fruit, issue}[] — the main checkout (branch 'main')
// and session sentinels (<fruit>/session) are excluded because they carry no
// issue number. Exported for unit testing without git I/O. (#665)
function worktreesWithIssue(branches) {
  const result = [];
  for (const { branch, fruit } of (branches || [])) {
    const m = branch && branch.match(/\/issue-(\d+)/);
    if (m) result.push({ branch, fruit, issue: Number(m[1]) });
  }
  return result;
}

// Session sentinel: a <fruit>/session branch (no worktree) that keeps a fruit
// marked "taken" across individual worktree teardowns — closing a puzzle removes
// both the worktree and the issue branch, but the sentinel survives until the
// session ends or the stale-sweep reclaims it (#194).
const SESSION_SENTINEL_MAX_AGE_S = 7 * 24 * 60 * 60; // 7 days

// TTL after which an OPEN issue's cross-clone claim ref (#1038) is treated as
// abandoned by the stale-ref sweep (#1040). Tasks are ≤60m (yegor-microtasks), so
// a claim that has sat for days almost certainly belongs to a dead session that
// never ran `npm run close` (which deletes the ref, #1039). Shorter than the
// session-sentinel TTL because a claim is a far more transient thing than a session.
const CLAIM_REF_MAX_AGE_S = 2 * 24 * 60 * 60; // 2 days

function sentinelBranch(fruit) {
  return `${fruit}/session`;
}

// Pure: given a commit timestamp and current time (both unix seconds), is the
// sentinel stale? Exported for unit testing without git I/O.
function isSentinelStaleByAge(commitTs, nowS, maxAgeS = SESSION_SENTINEL_MAX_AGE_S) {
  if (!Number.isFinite(commitTs)) return true;
  return (nowS - commitTs) > maxAgeS;
}

// Returns true when the <fruit>/session branch's tip commit is older than
// SESSION_SENTINEL_MAX_AGE_S, indicating the session that created it has died.
// Returns false when fresh or when the age cannot be read (conservative: keep taken).
function isSentinelStale(fruit) {
  const raw = sh(`git log -1 --format="%ct" refs/heads/${sentinelBranch(fruit)}`, true);
  if (!raw || !raw.trim()) return false;
  const ts = parseInt(raw.trim(), 10);
  return isSentinelStaleByAge(ts, Math.floor(Date.now() / 1000));
}

// Creates the <fruit>/session sentinel if it doesn't exist yet. Idempotent —
// safe to call on every auto-claim; re-claims within the same session are no-ops.
function createSessionSentinel(fruit) {
  const b = sentinelBranch(fruit);
  if (branchExists(b)) return;
  sh(`git branch "${b}" HEAD`, true);
}

function takenFruits() {
  // Start from live worktrees (the fast path, also the former sole source).
  const taken = new Set(listWorktreeBranches().map((b) => b.fruit).filter(Boolean));
  // Also scan all local <fruit>/* branches to catch session sentinels.
  // A sentinel keeps a fruit taken across the gap between an agent's worktrees.
  const allBranches = sh('git branch --list', true) || '';
  for (const line of allBranches.split('\n')) {
    const branch = line.trim().replace(/^\*\s+/, '');
    if (!branch) continue;
    const slash = branch.indexOf('/');
    if (slash < 0) continue;
    const fruit = branch.slice(0, slash);
    const rest = branch.slice(slash + 1);
    // Skip stale sentinels so crashed/ended sessions eventually free their fruit.
    if (rest === 'session' && isSentinelStale(fruit)) continue;
    if (fruit) taken.add(fruit);
  }
  return taken;
}

function branchExists(branch) {
  return sh(`git show-ref --verify --quiet refs/heads/${branch} && echo yes`, true);
}

function parseArgs(argv) {
  const opts = { issue: null, slug: null, as: null, base: 'main', dryRun: false, allowStaleMain: false, force: false, custom: false, allowUncategorized: false };
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--as') opts.as = argv[++i];
    else if (a === '--base') opts.base = argv[++i];
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--allow-stale-main') opts.allowStaleMain = true;
    else if (a === '--allow-uncategorized' || a === '--no-lane-check') opts.allowUncategorized = true;
    else if (a === '--custom') opts.custom = true;
    else if (a.startsWith('--')) die(`unknown flag: ${a}`);
    else positionals.push(a);
  }
  opts.issue = positionals[0];
  opts.slug = positionals[1] || null;
  return opts;
}

// Normalize a human-supplied identity to a branch-safe fruit token. Env vars are
// conventionally uppercase (CLAUDE_AGENT_NAME=DRAGONFRUIT) but the branch/path
// component is lowercase, so we lowercase + trim. (--as is passed lowercase by
// convention, so this only matters for the env path.)
function normalizeIdentity(s) {
  return String(s).trim().toLowerCase();
}

// Extract a fruit identity from a branch name of the form <fruit>/issue-N[...].
// Returns the lowercased fruit string, or null if the branch doesn't match.
// Kept pure (no git I/O) so it's directly unit-testable.
function inferFruitFromBranch(branch) {
  if (!branch) return null;
  const m = branch.match(/^([a-z]+)\/issue-\d+/);
  return m ? m[1] : null;
}

function currentBranch() {
  const b = sh('git rev-parse --abbrev-ref HEAD', true);
  return b ? b.trim() : null;
}

// Resolve the agent identity from flags + environment, in precedence order:
//   --as <fruit>  >  CLAUDE_AGENT_NAME  >  branch-inferred  >  auto (no forced identity).
// `branch` is the caller's current HEAD branch name (passed in from main() so this
// function stays pure — no git I/O here). Returns { name, source, modeLabel }.
// name === null means "auto-pick a fresh fruit"; a non-null name is a *forced*
// identity (single candidate, never silently swapped).
function resolveIdentity(opts, env, branch = null) {
  if (opts.as) {
    return { name: normalizeIdentity(opts.as), source: 'as', modeLabel: 'reuse (--as)' };
  }
  const envName = normalizeIdentity(env.CLAUDE_AGENT_NAME || '');
  if (envName) {
    return { name: envName, source: 'env', modeLabel: 'human-directed (env)' };
  }
  const inferredFruit = inferFruitFromBranch(branch);
  if (inferredFruit) {
    return { name: inferredFruit, source: 'branch', modeLabel: 'branch-inferred' };
  }
  return { name: null, source: 'auto', modeLabel: 'auto' };
}

// Pure decision seam for the stale-base guard (#228). `behind` = commits in
// origin/main not in local main (0 when not applicable or un-knowable). Only the
// default local `main` base can be stale relative to its remote; an explicit
// origin/* base is already remote-fresh and is never flagged. Kept pure (no git
// calls) so it is unit-testable without a repo; main() does the git I/O.
function assessBaseStaleness(base, behind) {
  const checksRemote = base === 'main' || base === 'refs/heads/main';
  const n = Number(behind) || 0;
  return { checksRemote, behind: n, stale: checksRemote && n > 0 };
}

// Marker keyword strings split to avoid tripping the PDD substring scanner,
// which flags the at_todo keyword (any case) as a substring in scanned source files.
const todoKw = '@' + 'todo';
const inprogressKw = '@' + 'inprogress';

// Pure: find the first LIVE at_todo #N marker in `content` and flip it to
// at_inprogress #N. A live marker is the canonical PDD shape
// `at_todo #N:<est>/<ROLE>` (e.g. #134:60m/ARC) — the SAME shape
// scripts/puzzle-status.js recognizes. Requiring the `:<est>/<ROLE>` tail is
// what keeps the flip from rewriting an incidental *mention* of the string —
// a velocity-CSV note ("...at_todo #1028 placed"), a TIL, or a "(see at_todo #88)"
// cross-reference comment — none of which is a puzzle and none of which must be
// touched (#1116). The required colon after the number also subsumes the old
// #42-in-#420 guard (#420: cannot match the pattern #42:).
// Returns { updated, flipped, line } where `line` is the 1-indexed line number (0 if
// none found) and `updated` is the modified string. No file I/O — unit-testable.
function applyMarkerFlip(content, issue) {
  const re = new RegExp(`${todoKw}(\\s+#${issue}:\\s*\\d+\\w*\\/[A-Z]+)`);
  const match = content.match(re);
  if (!match) return { updated: content, flipped: false, line: 0 };
  const updated = content.replace(re, `${inprogressKw}$1`);
  const line = content.slice(0, content.indexOf(match[0])).split('\n').length;
  return { updated, flipped: true, line };
}

// Side-effectful: search the worktree for an at_todo #N marker and flip it in-place.
// Prints a one-liner on success, skip, double-flip guard, or write failure.
// The modified file is left unstaged — the agent commits it in their own commit.
function flipMarker(issue, wtPath) {
  // Both greps match only the canonical marker shape (at_todo #N:<est>/<ROLE>),
  // mirroring scripts/puzzle-status.js, so a bare mention of the string in a
  // record/doc file (e.g. a velocity-CSV note) is never the double-flip guard
  // nor the flip target (#1116). `-I` skips binary files.
  const inprogress = sh(`git -C "${wtPath}" grep -lE "${inprogressKw} #${issue}:[0-9]"`, true);
  if (inprogress && inprogress.trim()) {
    console.log(`[claim] ${inprogressKw} #${issue} already present — skipping flip`);
    return;
  }
  const grep = sh(`git -C "${wtPath}" grep -nIE "${todoKw} #${issue}:[0-9]"`, true);
  if (!grep || !grep.trim()) {
    console.log(`[claim] no ${todoKw} #${issue} marker found — skipping flip`);
    return;
  }
  const firstLine = grep.trim().split('\n')[0];
  const relFile = firstLine.split(':')[0];
  const absFile = path.join(wtPath, relFile);
  let content;
  try { content = fs.readFileSync(absFile, 'utf8'); } catch (e) {
    console.error(`[claim] warn: could not read ${relFile}: ${e.message}`);
    return;
  }
  const { updated, flipped, line } = applyMarkerFlip(content, issue);
  if (!flipped) {
    console.log(`[claim] no ${todoKw} #${issue} marker found — skipping flip`);
    return;
  }
  try { fs.writeFileSync(absFile, updated, 'utf8'); } catch (e) {
    console.error(`[claim] warn: could not write ${relFile}: ${e.message}`);
    return;
  }
  console.log(`[claim] flipped ${todoKw} #${issue} → ${inprogressKw} in ${relFile}:${line}`);
}

// Read an issue's title, state, and comment count in one best-effort gh round-trip
// (#227, #661, #1013). Returns { title, state, commentCount, labels } with state
// upper-cased and labels as a name array, or null when gh is unavailable / the
// issue is unknown -- callers MUST treat null as "proceed", never as a block.
function readIssue(issue) {
  const out = sh(`gh issue view ${issue} --json title,state,comments,labels`, true);
  if (!out) return null;
  try {
    const j = JSON.parse(out);
    return {
      title: j.title || null,
      state: String(j.state || '').toUpperCase(),
      commentCount: Array.isArray(j.comments) ? j.comments.length : 0,
      labels: Array.isArray(j.labels) ? j.labels.map((l) => l && l.name).filter(Boolean) : [],
    };
  } catch {
    return null;
  }
}

// Pure decision seam (#227): block a claim ONLY on a *definitive* CLOSED state.
// A missing/unknown issue or an unavailable gh (info === null) is NOT a block --
// the workflow stays offline-first. --force bypasses entirely. Kept pure (no I/O)
// so it is unit-testable without shelling out, like assessBaseStaleness (#228).
function shouldBlockClaim(info, force) {
  if (force) return false;
  return !!(info && info.state === 'CLOSED');
}

// Pure decision seam (#1013, child of #1004): given an issue's label-name array,
// return true when the agent should be nudged to assign a real area before work —
// i.e. the issue has NO `area:*` label, or still carries the auto-applied
// `area:uncategorized` placeholder (even alongside a real one). Warn-only, never a
// block: a null/absent label set (gh offline) returns false so the offline-first
// workflow proceeds unprompted. Kept pure (no I/O) so it is unit-testable, like
// shouldBlockClaim / assessBaseStaleness.
function needsAreaLabel(labels) {
  if (!Array.isArray(labels)) return false;
  const areas = labels.filter((l) => typeof l === 'string' && l.startsWith('area:'));
  if (areas.length === 0) return true;
  return areas.includes('area:uncategorized');
}

// Pure decision seam (#1151, revisits the #1013 warn-only choice): given an
// issue's resolved info and the human bypass flag, return true when the claim
// should be HARD-BLOCKED for lacking a real lane. Threads the bypass exactly
// like shouldBlockClaim(info, force): `allow` short-circuits, and offline
// (info === null) returns false so an offline claim is never blocked on a label
// it cannot read. Kept pure (no I/O) for unit testing.
function shouldBlockUncategorized(info, allow) {
  if (allow) return false;
  return !!(info && needsAreaLabel(info.labels));
}

// Validate the resolved identity name against the known fruit list (#366 Option C,
// relaxed to notice-not-prevent in #1184).
// Returns null when the name is a known fruit or absent.
// Returns { warn } for any unrecognised name: it is USED anyway, with a one-line
// notice. An unrecognised agent name is never a hard error — agent identities are
// an open-growth list, so we notice new ones, we don't block them. --custom
// remains the documented opt-in for deliberately non-list names, but it no longer
// changes behaviour here: with or without it, an unknown name warns and proceeds.
function checkIdentityName(identity, opts) { // eslint-disable-line no-unused-vars
  if (!identity.name || FRUITS.includes(identity.name.toLowerCase())) return null;
  return { warn: `"${identity.name}" is not in the known fruit list — using it anyway.` };
}

// Pure: given a worktreesWithIssue() result and a target issue number, returns the
// first live-worktree entry whose issue matches, or null. Used by the live-worktree
// guard in main() to block double-claims. Exported for unit testing. (#629)
function findLiveWorktreeForIssue(entries, issueNum) {
  return entries.find((w) => w.issue === issueNum) || null;
}

// Pure: given a post-`worktree add` list (worktreesWithIssue() result), the target
// issue number, and the branch THIS process just created, return the FIRST entry
// that carries the same issue under a DIFFERENT branch — i.e. a same-issue
// collision — or null. Unlike findLiveWorktreeForIssue (which returns the first
// match and could hand back our own just-created branch), this excludes ownBranch,
// so it fires whether our branch sorts before or after the racing one. Backs the
// identity-agnostic same-issue rollback that closes the single-clone TOCTOU the
// :453 guard / `worktree add` gap leaves open for forced --as (#1017, #1010, #629).
function findSameIssueCollision(entries, issueNum, ownBranch) {
  return (entries || []).find((w) => w.issue === issueNum && w.branch !== ownBranch) || null;
}

// Pure decision seam for the live-worktree guard (#629, #796). Returns true when
// the guard should block (die), false when it should warn-and-continue or skip.
// --force or --dry-run both bypass the hard block, mirroring shouldBlockClaim().
// Exported for unit testing without git I/O.
function shouldBlockWorktreeGuard(existingWt, opts) {
  if (!existingWt) return false;
  return !opts.force && !opts.dryRun;
}

// Pure decision seam (#1037, spike #1018): classify the combined stdout+stderr of a
// `git push <sha>:refs/claims/issue-<N>` into the cross-clone claim decision. Mirrors
// close.js:classifyPushError but with claim-side semantics — the claim path needs to
// tell a *conflict reject* (another clone already staked the ref → block) apart from a
// *transient/offline* failure (no remote, auth, timeout → best-effort proceed). Pure:
// takes a string, returns one of 'CONFLICT' / 'TRANSIENT' / 'OK'. No git I/O.
//
//   'CONFLICT'  — the push was rejected because the ref already points elsewhere: the
//                 non-fast-forward / ref-lock family. Another clone holds the claim →
//                 the caller blocks (unless --force). These are the same git reject
//                 signatures close.js treats as a retryable 'race'; here a reject is
//                 authoritative, not retryable — it means we lost the claim.
//   'TRANSIENT' — offline / unreachable / auth: no remote, DNS failure, refused/timed-out
//                 connection, permission denied. The guard is best-effort, so the caller
//                 warns and proceeds (consistent with readIssue/warnOrphanedWorktrees).
//   'OK'        — the ref was created or already matches ours: '[new reference]', a clean
//                 exit, or the empirically observed 'Everything up-to-date' (#1018 — a
//                 same-sha re-push reports up-to-date at exit 0; treat as success, NOT a
//                 conflict, since the unique-object push in #1038 makes a real collision
//                 surface as a non-fast-forward reject instead).
//
// Order matters: success markers are checked FIRST so a benign '[new reference]' /
// 'Everything up-to-date' is never mis-read by a stray substring; then the conflict
// reject family; then transient signals. An UNRECOGNISED failure defaults to 'TRANSIENT'
// (warn + proceed), not 'CONFLICT' — the git reject family below is well-known and
// exhaustive, so an unfamiliar string is far likelier offline/auth noise than a novel
// conflict phrasing, and a false block (which --force must then override) is worse for
// the offline-first workflow than a rare missed cross-clone race the local guard still
// partly covers.
function classifyClaimPushResult(output) {
  const s = String(output || '');
  // Success first — these can co-occur with banner noise but are definitive wins.
  if (/\[new reference\]|Everything up-to-date|\bnew branch\b/i.test(s)) return 'OK';
  // Conflict reject family (mirrors close.js classifyPushError RACE list): the ref
  // moved under us → another clone owns the claim.
  const CONFLICT = [
    /\[rejected\]/i,
    /non-fast-forward/i,
    /\bfetch first\b/i,
    /cannot lock ref/i,
    /failed to push some refs/i,
    /tip of your current branch is behind/i,
  ];
  if (CONFLICT.some((re) => re.test(s))) return 'CONFLICT';
  // Transient / offline / auth — best-effort proceed.
  const TRANSIENT = [
    /could not resolve host/i,
    /couldn't resolve host/i,
    /connection refused/i,
    /connection timed out/i,
    /operation timed out/i,
    /\btimed out\b/i,
    /network is unreachable/i,
    /unable to access/i,
    /could not read from remote/i,
    /permission denied/i,
    /authentication failed/i,
    /\b403\b/,
    /no such remote|does not appear to be a git repository|no configured push destination/i,
  ];
  if (TRANSIENT.some((re) => re.test(s))) return 'TRANSIENT';
  // Empty / clean output with no failure markers → the push succeeded silently.
  if (s.trim() === '') return 'OK';
  // Unrecognised failure → best-effort proceed (see header rationale).
  return 'TRANSIENT';
}

// Pure (#1038): build the message for the standalone claim commit-tree object.
// The object must be PER-AGENT-UNIQUE so two clones racing the same issue push
// DIFFERENT shas — a same-base same-sha push reports "Everything up-to-date" at
// exit 0 and lets both win (#1018); distinct shas make the second push reject
// non-fast-forward. `pid` distinguishes two processes; `stamp` (an ISO time with
// a high-resolution nanos suffix) distinguishes two same-fruit agents in the same
// second within one process tree. Exported so a test can assert two calls with
// different (pid, stamp) yield distinct messages.
function buildClaimMessage(issue, branch, pid, stamp) {
  return `claim issue-${issue} ${branch} pid=${pid} ${stamp}`;
}

// Pure (#1038): map a classifyClaimPushResult verdict + the --force flag to the
// claim action. Exported so the decision wiring is unit-tested without git I/O.
//   'ROLLBACK_DIE' — another clone holds the ref → tear down our worktree+branch, die.
//   'WARN_PROCEED' — offline/best-effort → warn, keep the worktree.
//   'PROCEED'      — claim is ours (OK), or --force overrides the block.
function claimPushAction(verdict, force) {
  if (force) return 'PROCEED';          // --force bypasses the cross-clone block (mirrors :453)
  if (verdict === 'CONFLICT') return 'ROLLBACK_DIE';
  if (verdict === 'TRANSIENT') return 'WARN_PROCEED';
  return 'PROCEED';                     // 'OK'
}

// Pure (#1040): is a remote claim ref (refs/claims/issue-N, #1038) stale and worth
// sweeping/warning? Mirrors the warnOrphanedWorktrees CLOSED-issue test and reuses
// the isSentinelStaleByAge TTL shape. Takes resolved inputs (no git/gh I/O) so it is
// unit-testable.
//   - issue CLOSED/MERGED      → stale (the claim outlived its issue; #1039 deletes
//                                 on close, but a crashed/pre-#1039 close leaves it).
//   - issue OPEN, claim past ttl → stale (the claiming session is almost certainly
//                                 dead — tasks are ≤60m, so a days-old claim is abandoned).
//   - issue OPEN, within ttl    → NOT stale (a live claim).
//   - unknown state (gh offline / issue missing) → NOT stale (best-effort: never
//                                 sweep what we can't verify — matches readIssue/
//                                 warnOrphanedWorktrees).
function claimRefIsStale({ issueState, claimCommitTs, nowS, ttl = CLAIM_REF_MAX_AGE_S }) {
  const state = issueState == null ? '' : String(issueState).trim().toUpperCase();
  if (state === '') return false;                       // offline / unknown → best-effort
  if (state === 'CLOSED' || state === 'MERGED') return true;
  if (state === 'OPEN') {
    // Only the TTL can stale an OPEN claim, and only when the commit date is known.
    return Number.isFinite(claimCommitTs) ? (nowS - claimCommitTs) > ttl : false;
  }
  return false;                                         // any other state → conservative
}

// Side-effect: scan live worktrees for orphans — issue branches whose issue is
// CLOSED, meaning the deferred teardown from a prior npm run close failed (#541,
// #551). Prints a recovery hint for each stale entry; never blocks the claim.
// Degrades gracefully when gh is unavailable (state read returns null → skip). (#665)
function warnOrphanedWorktrees() {
  const entries = worktreesWithIssue(listWorktreeBranches());
  if (!entries.length) return;
  const root = mainRoot();
  for (const { branch, fruit, issue } of entries) {
    const state = sh(`gh issue view ${issue} --json state -q .state`, true);
    if (!state || !state.trim()) continue;
    if (state.trim().toUpperCase() !== 'CLOSED') continue;
    const wtPath = path.join(root, '.claude', 'worktrees', `${fruit}-issue-${issue}`);
    console.error(
      `[claim] ⚠ stale worktree: "${branch}" references CLOSED issue #${issue}.\n` +
      `         Deferred teardown may have failed. To clean up:\n` +
      `           git worktree remove "${wtPath}" --force\n` +
      `           git branch -D ${branch}`
    );
  }
}

// Side-effect (#1040): the cross-clone analogue of warnOrphanedWorktrees. A claim
// ref (refs/claims/issue-N, #1038) is normally deleted at close (#1039); a session
// that dies without closing strands it on the remote, blocking future claims of that
// issue. List the remote claim refs and warn about any that are stale per
// claimRefIsStale (CLOSED issue, or an OPEN issue whose claim commit is older than
// the TTL). Best-effort and non-destructive — offline/no-refs is a silent skip, and
// it WARNS with the manual sweep command rather than deleting (matches the
// warn-only warnOrphanedWorktrees default; an opt-in auto-sweep is a deferred follow-up).
function warnStaleClaimRefs() {
  const listing = sh(`git ls-remote origin 'refs/claims/*' 2>/dev/null`, true);
  if (!listing || !listing.trim()) return; // offline, or no claim refs staked anywhere
  const nowS = Math.floor(Date.now() / 1000);
  for (const line of listing.trim().split('\n')) {
    const [sha, ref] = line.split('\t');
    const m = /refs\/claims\/issue-(\d+)\b/.exec(ref || '');
    if (!m) continue;
    const issueNum = m[1];
    // Lightweight state read (mirrors warnOrphanedWorktrees): null/'' when gh offline.
    const stateRaw = sh(`gh issue view ${issueNum} --json state -q .state`, true);
    const issueState = stateRaw && stateRaw.trim() ? stateRaw.trim() : null;
    // The TTL test needs the claim commit's date — only relevant while the issue is
    // still OPEN (a CLOSED issue is already stale). Try the local object first (no
    // network); if it isn't local, best-effort fetch the single ref to FETCH_HEAD.
    let claimCommitTs = null;
    if (issueState && issueState.toUpperCase() === 'OPEN') {
      let ts = sh(`git log -1 --format=%ct ${sha} 2>/dev/null`, true);
      if (!ts || !/^\d+/.test(ts.trim())) {
        sh(`git fetch --quiet origin refs/claims/issue-${issueNum} 2>/dev/null`, true);
        ts = sh('git log -1 --format=%ct FETCH_HEAD 2>/dev/null', true);
      }
      if (ts && /^\d+/.test(ts.trim())) claimCommitTs = Number(ts.trim());
    }
    if (claimRefIsStale({ issueState, claimCommitTs, nowS })) {
      const up = (issueState || '').toUpperCase();
      const reason = (up === 'CLOSED' || up === 'MERGED')
        ? `issue #${issueNum} is ${up}`
        : `claim older than ${Math.round(CLAIM_REF_MAX_AGE_S / 86400)}d — likely abandoned`;
      console.error(
        `[claim] ⚠ stale claim ref refs/claims/issue-${issueNum} (${reason}).\n` +
        `         A dead session may have stranded it (#1038 stakes it; #1039 deletes it on close).\n` +
        `         To sweep:  git push origin :refs/claims/issue-${issueNum}`
      );
    }
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.issue || !/^\d+$/.test(opts.issue)) {
    die('usage: node scripts/claim.js <issue-number> [slug] [--as <fruit>] [--base <ref>] [--dry-run] [--force] [--custom] [--allow-uncategorized]');
  }
  const issue = opts.issue;

  const identity = resolveIdentity(opts, process.env, currentBranch());

  // Auto-naming is disabled (#386): agents must be explicitly named by the human
  // orchestrator. A bare `npm run claim <N>` with no --as and no CLAUDE_AGENT_NAME
  // used to silently pick a random fruit — that produced lemon/honeydew/grape
  // branches that confused worktree attribution. Fail loud instead.
  if (identity.source === 'auto') {
    die(
      'no agent identity set.\n' +
      '  Corrected command:  npm run claim -- ' + issue + ' --as <fruit>\n' +
      '  or export CLAUDE_AGENT_NAME=<fruit> before running.\n' +
      '  Auto-naming is disabled — agent names must be assigned by the human orchestrator (#386).'
    );
  }

  // #1184: an unrecognised agent name only ever produces a notice — never a die.
  const nameCheck = checkIdentityName(identity, opts);
  if (nameCheck) console.error(`[claim] note: ${nameCheck.warn}`);

  // One gh round-trip serves both the slug and the open/closed guard (#227).
  // Best-effort: gh may be absent/offline (info === null) -> proceed; only a
  // *definitive* CLOSED aborts, so a typo'd or just-closed number (cf. #223) is
  // caught before we stake a phantom worktree. --force bypasses.
  const info = readIssue(issue);
  if (shouldBlockClaim(info, opts.force)) {
    die(`#${issue} is CLOSED -- nothing to claim (raced a concurrent close? cf. #223). Pass --force to claim it anyway.`);
  }

  // Lane gate (#1151, hardens the #1013/#1004 warn-only seam per human request):
  // BLOCK the claim when the issue carries no real `area:*` label (only the
  // auto-applied `area:uncategorized` placeholder, or none). Categorization is
  // now mandatory before work begins, so the placeholder stops being decorative
  // and cross-lane collisions are prevented. Offline (info === null) stays
  // silent like shouldBlockClaim; `--allow-uncategorized` (alias --no-lane-check)
  // is the explicit, log-visible human bypass — distinct from --force, which
  // only bypasses the #227 CLOSED-state guard.
  if (shouldBlockUncategorized(info, opts.allowUncategorized)) {
    die(
      `#${issue} has no real area:* label (only area:uncategorized or none). ` +
      `Assign a lane before claiming:\n` +
      `  gh issue edit ${issue} --add-label "area:<name>" --remove-label area:uncategorized\n` +
      `then re-run the claim. To deliberately work it uncategorized, pass --allow-uncategorized.`);
  }

  // Derive a slug from the issue title if none was given (best-effort).
  let slug = opts.slug ? slugify(opts.slug) : null;
  if (!slug && info && info.title) slug = slugify(info.title);

  const base = opts.base;
  // Verify the base ref resolves before we start staking.
  if (!sh(`git rev-parse --verify --quiet ${base}^{commit} && echo ok`, true)) {
    die(`base ref "${base}" does not resolve — pass --base <ref> (e.g. origin/main).`);
  }

  // Stale-main guard (#228): refuse to stake from a local `main` that is behind
  // origin/main. A stale checkout silently runs an older claim.js (e.g. pre-#212,
  // no CLAUDE_AGENT_NAME) AND stakes the worktree from an out-of-date tree. Best-
  // effort: a single-ref fetch keeps the comparison honest; if it fails (offline)
  // or origin/main is unknown, `behind` is 0 and we proceed. --allow-stale-main
  // overrides. Caveat: only protects agents already running this guard-bearing
  // script; the complementary "sync main before claiming" process note is #195/#230.
  if (!opts.allowStaleMain) {
    sh('git fetch origin main --quiet', true);
    const behind = Number((sh('git rev-list --count main..origin/main', true) || '').trim()) || 0;
    if (assessBaseStaleness(base, behind).stale) {
      die(`local main is ${behind} commit(s) behind origin/main — run \`git pull --ff-only origin main\` first, then re-claim (stale main risks a wrong identity + an out-of-date base; pass --allow-stale-main to override). See #228.`);
    }
  }

  warnOrphanedWorktrees();
  warnStaleClaimRefs(); // #1040: cross-clone analogue — warn about stranded claim refs

  // Live-worktree guard (#629): die if another agent already has this issue checked
  // out as a worktree, unless --force (mirrors CLOSED guard). --dry-run shows the
  // warning but does not die so the full dry-run plan is still displayed.
  const existingWt = findLiveWorktreeForIssue(worktreesWithIssue(listWorktreeBranches()), Number(issue));
  if (existingWt) {
    const detail =
      `issue #${issue} is already live in worktree "${existingWt.branch}" (agent: ${existingWt.fruit || 'unknown'}).\n` +
      `  cd into the existing worktree, or pass --force to claim anyway.`;
    if (shouldBlockWorktreeGuard(existingWt, opts)) die(detail);
    console.error(`[claim] ⚠ live worktree detected: ${detail}`);
  }

  const root = mainRoot();
  const mkBranch = (fruit) => `${fruit}/issue-${issue}${slug ? '-' + slug : ''}`;
  const mkPath = (fruit) => path.join(root, '.claude', 'worktrees', `${fruit}-issue-${issue}`);

  // Pick the candidate fruit order: a forced identity (--as or CLAUDE_AGENT_NAME)
  // is a single candidate; auto walks the free fruits in index order, with a -2
  // suffix fallback if all are taken.
  let candidates;
  if (identity.name) {
    candidates = [identity.name];
  } else {
    const taken = takenFruits();
    candidates = FRUITS.filter((f) => !taken.has(f));
    if (candidates.length === 0) {
      const fallback = `${FRUITS[0]}-2`;
      console.error(`[claim] all ${FRUITS.length} fruits are checked out — falling back to "${fallback}".`);
      candidates = [fallback];
    }
  }

  if (opts.dryRun) {
    const fruit = candidates[0];
    const dryCommentCount = (info && info.commentCount) || 0;
    console.log('[claim] --dry-run — nothing staked.');
    report(fruit, mkBranch(fruit), mkPath(fruit), base, identity.modeLabel, true, dryCommentCount, issue);
    return;
  }

  for (const fruit of candidates) {
    const branch = mkBranch(fruit);
    const wtPath = mkPath(fruit);

    if (branchExists(branch)) {
      if (identity.name) {
        die(`branch ${branch} already exists — issue #${issue} is already claimed under "${fruit}". ` +
            `cd into ${wtPath}, or claim a different issue.`);
      }
      continue; // auto: lost the (fruit,issue) race, try next fruit
    }

    const ok = sh(`git worktree add ${wtPath} -b ${branch} ${base} 2>&1`, true);
    if (ok === null) {
      if (identity.name) die(`git worktree add failed for ${branch} (see git output).`);
      continue; // auto: something raced us, try next fruit
    }

    // auto mode: detect-and-rollback if another agent also grabbed this fruit in
    // the race window (a different <fruit>/* branch now exists). A forced identity
    // (--as / env) expects to share a fruit across issues, so it skips this check.
    if (!identity.name) {
      const sameFruit = listWorktreeBranches().filter((b) => b.fruit === fruit);
      if (sameFruit.length > 1) {
        console.error(`[claim] race: "${fruit}" was taken by another agent — rolling back and retrying.`);
        sh(`git worktree remove ${wtPath} --force`, true);
        sh(`git branch -D ${branch}`, true);
        continue;
      }
    }

    // Same-issue rollback (#1017, extends #629): the live-worktree guard at :453 and
    // this `git worktree add` are NOT atomic (TOCTOU, #1010). Two agents racing the
    // SAME issue in one clone both pass :453 (neither worktree existed at check time),
    // then both `worktree add` succeed. The same-fruit block above only catches a
    // shared FRUIT and only in auto mode, so two forced `--as` agents on one issue
    // slip through — the single-clone half of the #997 double-work incident.
    //
    // Re-scan the post-add worktree list for a DIFFERENT branch carrying this issue;
    // if found, the other agent won the race — roll back our worktree+branch and die.
    // This sits OUTSIDE the `!identity.name` gate above, so it applies to forced
    // `--as` too (the regression #629 left open). --force keeps its documented escape
    // hatch (mirrors shouldBlockWorktreeGuard): a deliberate override skips the check.
    // Cross-clone races (separate checkouts sharing only the remote) are out of scope
    // here — tracked by the Layer-2 atomic-signal spike (#1018).
    if (!opts.force) {
      const collision = findSameIssueCollision(
        worktreesWithIssue(listWorktreeBranches()), Number(issue), branch);
      if (collision) {
        sh(`git worktree remove ${wtPath} --force`, true);
        sh(`git branch -D ${branch}`, true);
        die(`issue #${issue} was claimed concurrently in worktree "${collision.branch}" ` +
            `(agent: ${collision.fruit || 'unknown'}) — rolled back "${branch}". ` +
            `cd into the existing worktree, or claim a different issue (pass --force to override).`);
      }
    }

    // Cross-clone claim (#1038, spike #1018): the same-issue rollback above closes
    // the single-clone race, but two agents in SEPARATE clones sharing only the
    // remote are still mutually invisible (listWorktreeBranches sees only this
    // clone). Stake a server-authoritative claim: fabricate a per-agent-unique
    // commit off the base tree with `git commit-tree` — kept OFF the working branch
    // — and push it to refs/claims/issue-<N>. A plain same-base push reports
    // "Everything up-to-date" and lets both win (#1018); the unique object makes a
    // real collision surface as a non-fast-forward reject. classifyClaimPushResult
    // (#1037) then decides: CONFLICT → roll back + die; TRANSIENT → warn + proceed
    // (offline best-effort, like readIssue/warnOrphanedWorktrees); OK → ours.
    // --force stakes the ref but never blocks (claimPushAction).
    const baseTree = (sh(`git rev-parse ${base}^{tree}`, true) || '').trim();
    if (baseTree) {
      const stamp = `${new Date().toISOString()}.${process.hrtime.bigint()}`;
      const claimMsg = buildClaimMessage(issue, branch, process.pid, stamp);
      const claimSha = (sh(`git commit-tree ${baseTree} -m ${JSON.stringify(claimMsg)}`, true) || '').trim();
      if (claimSha) {
        const pushOut = sh(`git push origin ${claimSha}:refs/claims/issue-${issue} 2>&1 || true`, true) || '';
        const action = claimPushAction(classifyClaimPushResult(pushOut), opts.force);
        if (action === 'ROLLBACK_DIE') {
          sh(`git worktree remove ${wtPath} --force`, true);
          sh(`git branch -D ${branch}`, true);
          die(`issue #${issue} is already claimed in another clone ` +
              `(cross-clone collision on refs/claims/issue-${issue}) — rolled back "${branch}". ` +
              `cd into that clone's worktree, claim a different issue, or pass --force to override.`);
        } else if (action === 'WARN_PROCEED') {
          console.error(`[claim] ⚠ could not confirm a cross-clone claim for #${issue} ` +
                        `(remote unreachable/auth — best-effort) — proceeding.`);
        }
      }
    }

    // Copy .env from repo root into the new worktree so oracle tests run without
    // a manual cp step. Silent no-op if .env doesn't exist (CI / fresh clone).
    const rootEnv = path.join(root, '.env');
    if (fs.existsSync(rootEnv)) {
      try { fs.copyFileSync(rootEnv, path.join(wtPath, '.env')); } catch (_) {}
    }

    // In auto mode, stake a session-sentinel branch so this fruit stays taken
    // across the gap between this worktree's teardown and the next auto-claim (#194).
    if (!identity.name) createSessionSentinel(fruit);

    flipMarker(issue, wtPath);
    report(fruit, branch, wtPath, base, identity.modeLabel, false, (info && info.commentCount) || 0, issue);
    return;
  }

  die('could not claim a worktree — every candidate fruit was taken or staking failed.');
}

// Pure: build the CLAIMED/WOULD CLAIM banner as an array of lines. Exported for
// unit testing — callers use report() which logs each line. (#661: commentCount
// adds a pickup prompt when prior comments exist on the issue.)
function buildBannerLines(fruit, branch, wtPath, base, mode, dry, commentCount, issue) {
  const short = wtPath.replace(process.env.HOME || '\0', '~');
  const bar = '─'.repeat(58);
  const lines = [
    bar,
    `  ${dry ? 'WOULD CLAIM' : 'CLAIMED'}  ·  agent: ${fruit}  (${mode})`,
    bar,
    `  branch    ${branch}`,
    `  worktree  ${short}`,
    `  base      ${base}`,
  ];
  if (commentCount > 0) {
    lines.push(`  comments  ${commentCount} — read them: gh issue view ${issue} --comments`);
  }
  if (!dry) {
    lines.push('');
    lines.push('  next:');
    lines.push(`    cd ${short}`);
    lines.push(`    # (claim already flipped the ${todoKw} #N marker to ${inprogressKw} #N if one was found)`);
    lines.push('    # reuse this identity for later worktrees:  npm run claim -- <issue> --as ' + fruit);
  }
  lines.push(bar);
  // Machine-readable tail for scripting/agents.
  lines.push(`CLAIM ${dry ? 'DRYRUN' : 'OK'} agent=${fruit} branch=${branch} path=${wtPath}`);
  return lines;
}

function report(fruit, branch, wtPath, base, mode, dry, commentCount, issue) {
  buildBannerLines(fruit, branch, wtPath, base, mode, dry, commentCount, issue)
    .forEach((l) => console.log(l));
}

if (require.main === module) main();

module.exports = {
  FRUITS, slugify, listWorktreeBranches, worktreesWithIssue, takenFruits,
  parseArgs, normalizeIdentity, inferFruitFromBranch, resolveIdentity, assessBaseStaleness,
  checkIdentityName, readIssue, shouldBlockClaim, needsAreaLabel, shouldBlockUncategorized,
  sentinelBranch, isSentinelStaleByAge,
  applyMarkerFlip, buildBannerLines, findLiveWorktreeForIssue, findSameIssueCollision,
  shouldBlockWorktreeGuard, classifyClaimPushResult,
  buildClaimMessage, claimPushAction, claimRefIsStale,
};
