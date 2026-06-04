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
 * Usage (after committing `Closes #N`):
 *   node scripts/close.js <issue>                    # from inside the worktree
 *   node scripts/close.js <issue> --branch <name>    # from main checkout (branch must be supplied explicitly)
 *   node scripts/close.js <issue> --max 8        # more push-race retries (default 5)
 *   node scripts/close.js <issue> --dry-run      # show the plan, change nothing
 *   node scripts/close.js <issue> --keep         # land the commit but DON'T tear down
 *   node scripts/close.js <issue> --no-verify-issue  # skip the gh post-close check
 *   node scripts/close.js <issue> --skip-ticket-match  # bypass Guard 1 velocity-row ticket check (#310)
 *   node scripts/close.js <issue> --skip-keyword-check # bypass Guard 2 issue-title keyword check (#311)
 *
 * See docs/research/close-sequence-hardening.md for the full design.
 */

'use strict';

const { execSync, spawn } = require('child_process');
const os   = require('os');
const path = require('path');

const DEFAULT_MAX_RETRIES = 5;

// Files carrying `merge=union` in .gitattributes: parallel append-only logs that
// auto-resolve on rebase. A conflict touching ONLY these is a contradiction
// (union never conflicts) and signals a bug; a conflict touching anything else
// is a real, human-resolvable conflict. Keep in sync with .gitattributes.
// Note: docs/puzzle-velocity.csv was removed from this list in #290 — the CSV
// is now a full-file auto-export from SQLite; conflicts resolve via re-export.
// tryLand() handles velocity CSV conflicts automatically (see isVelocityCsvOnlyConflict).
const UNION_FILES = ['docs/puzzle-clusters.csv'];

// The velocity CSV path — a full-file SQLite export. When two agents both log a
// row and commit before either pushes, their CSV snapshots diverge and git
// cannot auto-merge the full-file rewrites. tryLand() detects this case and
// re-exports from SQLite (the source of truth) instead of aborting. (#313)
const VELOCITY_CSV = 'docs/puzzle-velocity.csv';

// Returns true when the only conflicted path is the velocity CSV, meaning
// tryLand() can auto-resolve by re-exporting from SQLite rather than aborting.
// Pure: takes an array of path strings, returns a boolean.
function isVelocityCsvOnlyConflict(paths) {
  const list = (paths || []).map((p) => String(p).trim()).filter(Boolean);
  return list.length > 0 && list.every((p) => p === VELOCITY_CSV);
}

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
    keep: false, verifyIssue: true, skipTicketMatch: false, skipKeywordCheck: false,
    skipVelocityCheck: false, skipMarkerCheck: false, branch: null,
  };
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--max') opts.max = parseInt(argv[++i], 10);
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--keep') opts.keep = true;
    else if (a === '--no-verify-issue') opts.verifyIssue = false;
    else if (a === '--skip-ticket-match') opts.skipTicketMatch = true;
    else if (a === '--skip-keyword-check') opts.skipKeywordCheck = true;
    else if (a === '--skip-velocity-check') opts.skipVelocityCheck = true;
    else if (a === '--skip-marker-check') opts.skipMarkerCheck = true;
    else if (a === '--branch') opts.branch = argv[++i];
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

// Guard 1 (#310/#301): extract the ticket number(s) from the velocity rows ADDED
// in a commit, by parsing the unified diff of `git show HEAD -- <csv>`. Catches
// the #278 failure mode — a digit transposition where `Closes #N` and the
// velocity row's `ticket` column disagree, silently misattributing the work.
//
// The CSV schema (see scripts/velocity-export.js) is `id,ticket,title,...`, so
// `ticket` is column index 1 — always BEFORE the free-text title/notes columns,
// so a plain comma-split is safe regardless of commas inside those later fields
// (the machine-generated `id` in column 0 never contains a comma).
//
// Only added data rows count: lines starting with a single `+` (not the `+++`
// file header). The two non-data `+`-lines that can appear — the `# AUTO-
// GENERATED` comment and the `id,ticket,...` header on a fresh file — both yield
// a non-numeric column 1, so filtering to integer tickets drops them for free.
// Pure: takes the diff string, returns an array of integer ticket numbers.
function extractTicketFromCsvDiff(diff) {
  const tickets = [];
  for (const line of String(diff || '').split('\n')) {
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    const fields = line.slice(1).split(',');
    const raw = (fields[1] || '').trim();
    if (/^\d+$/.test(raw)) tickets.push(Number(raw));
  }
  return tickets;
}

// Guard 1 (#346 fix): extract ticket + agent from every added velocity row in a
// diff. Returns {ticket, agent}[] so checkVelocityTicketMatch can filter to only
// the closing agent's rows and ignore concurrent agents' rows.
//
// Agent is the second-to-last column; model is last. Both are simple identifiers
// (no commas, no quotes). notes (col 12) may contain commas and be quoted, so we
// cannot use a plain split to reach col 13. Instead we extract agent+model from
// the end of the row via regex — safe because neither field ever contains a comma.
// Pure: takes the diff string, returns {ticket: number, agent: string}[].
function extractRowsFromCsvDiff(diff) {
  const rows = [];
  for (const line of String(diff || '').split('\n')) {
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    const row = line.slice(1);
    // ticket is column 1 — always before free-text fields, safe with naive split.
    const ticketRaw = (row.split(',')[1] || '').trim();
    if (!/^\d+$/.test(ticketRaw)) continue;
    // agent is second-to-last; model (possibly empty) is last. Both are word-chars.
    const m = row.match(/,([A-Za-z][A-Za-z0-9]*),([A-Za-z0-9.-]*)$/);
    rows.push({ ticket: Number(ticketRaw), agent: m ? m[1] : '' });
  }
  return rows;
}

// The Guard 1 decision (#310): which of the added rows' tickets disagree with the
// issue being closed. Empty result == the close is consistent (including the
// no-row-added case, where `tickets` is []). Pure: array + issue → array of the
// offending ticket numbers. Kept separate from the diff parsing so both halves of
// the guard are unit-testable without git I/O.
function velocityTicketMismatch(tickets, issue) {
  const n = Number(issue);
  return (tickets || []).filter((t) => t !== n);
}

// Guard 1 (#361 fix): decide whether the added rows indicate a mismatch, given
// the full row list, the issue being closed, and the closing agent identity.
//
// The #346 fix filtered by branch-prefix agent to exclude concurrent rows. That
// assumption breaks when the velocity row's `agent` field (terminal name) differs
// from the branch-prefix fruit — e.g. row says "CHERRY", branch says "banana".
// Filtering by "banana" then picks up a concurrent BANANA row for a different
// ticket and ignores CHERRY's correct row → false-positive mismatch (#361).
//
// Fix: if any added row records the correct ticket, the closer has a valid row —
// pass immediately, regardless of agent name. Only when no correct-ticket row
// exists do we fall back to agent-name filtering to catch the original #278
// digit-transposition case (closer logged a row but with the wrong ticket number).
//
// Pure: takes {ticket, agent}[], issue string|number, closingAgent string|null.
// Returns mismatch ticket numbers (empty array = pass).
function computeVelocityMismatch(allRows, issue, closingAgent) {
  const n = Number(issue);
  const rows = allRows || [];
  if (rows.some((r) => r.ticket === n)) return [];
  const myRows = closingAgent
    ? rows.filter((r) => r.agent.toLowerCase() === String(closingAgent).toLowerCase())
    : rows;
  return velocityTicketMismatch(myRows.map((r) => r.ticket), issue);
}

// Guard 2 (#311/#301): stop-set for keyword extraction — role prefixes and filler
// words that appear in titles/subjects but carry no discriminating signal.
const KEYWORD_STOP_SET = new Set([
  'this', 'that', 'with', 'from', 'have', 'been', 'will', 'into', 'onto',
  'also', 'when', 'then', 'than', 'what', 'where', 'which',
  'writer', 'research', 'architect', 'spike', 'data',
]);

// Guard 2 (#311): tokenize text into discriminating keywords for overlap checks.
// Splits on non-word chars, lowercases, keeps words ≥4 chars that are neither
// pure numbers nor in the stop-set. Pure: takes a string + optional stop-set
// (defaults to KEYWORD_STOP_SET), returns a string array.
function extractKeywords(text, stopSet = KEYWORD_STOP_SET) {
  return String(text || '')
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length >= 4 && !/^\d+$/.test(w) && !stopSet.has(w));
}

// Guard 2 (#311): returns true if ≥1 word from titleWords appears in subjectWords.
// Pure: takes two string arrays, returns a boolean. An empty array on either side
// is treated as "no signal" and returns false (don't block on untokenizable input).
function keywordsOverlap(titleWords, subjectWords) {
  const s = new Set(subjectWords || []);
  return (titleWords || []).some((w) => s.has(w));
}

// Check A (#359): does a velocity row for this ticket exist in the DB?
// Pure: takes a better-sqlite3 Database instance + integer ticket, returns boolean.
function velocityRowExists(db, ticket) {
  return db.prepare('SELECT 1 FROM velocity WHERE ticket = ? LIMIT 1').get(ticket) !== undefined;
}

// Check B (#359): does a puzzle marker (todo/inprogress) for this issue still
// appear in the grep output? Pure: takes the issue number and raw git-grep stdout,
// returns { found: bool, lines: string[] }.
function markerStillPresent(issue, grepOutput) {
  const re = new RegExp(`@(?:todo|inprogress)\\s+#${issue}\\b`, 'i');
  const lines = String(grepOutput || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const matched = lines.filter((l) => re.test(l));
  return { found: matched.length > 0, lines: matched };
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

// Returns true if the commit log text contains a closing keyword for the given
// issue. Accepts the GitHub close keywords (close/closes/closed, fix/fixes/fixed,
// resolve/resolves/resolved). Pure: takes a string and an issue number, returns
// a boolean. The string may be the body of a single commit or several concatenated.
function bodyClosesIssue(text, issue) {
  const re = new RegExp(`\\b(clos(e|es|ed)|fix(e|es|ed)?|resolv(e|es|ed))\\s+#${issue}\\b`, 'i');
  return re.test(String(text || ''));
}

// Scans the unpushed commit range (origin/main..HEAD) for a commit that references
// `Closes #<issue>`. Returns the SHA of the first matching commit, or null if none.
// Searching the full unpushed set rather than just HEAD lets agents follow the
// standard velocity protocol (fix commit → separate velocity CSV commit) without
// close.js falsely rejecting the close because the velocity commit is now HEAD.
function findClosingCommitSha(issue) {
  const out = sh('git log origin/main..HEAD --format=%H', true) || '';
  const shas = out.trim().split('\n').map((s) => s.trim()).filter(Boolean);
  for (const sha of shas) {
    const body = sh(`git show -s --format=%B ${sha}`, true) || '';
    if (bodyClosesIssue(body, issue)) return sha;
  }
  return null;
}

function treeIsClean() {
  const s = sh('git status --porcelain', true);
  return s !== null && s.trim() === '';
}

// Guard 1 I/O wrapper (#310, fixed in #346, #361): read the velocity CSV rows
// added in HEAD and verify that this agent's rows record the issue being closed.
// Skips silently when no row was added (not every close has a velocity row). Rows
// belonging to concurrent agents are ignored — a full-file CSV re-export
// legitimately includes rows from other agents active in the same window (#346).
// die()s on mismatch; the commit is still local and can be amended.
function checkVelocityTicketMatch(issue) {
  const diff = sh('git show HEAD -- docs/puzzle-velocity.csv', true) || '';
  // Prefer CLAUDE_AGENT_NAME (the terminal's declared identity, matching the
  // velocity row's `agent` field) over branch prefix (can diverge when the
  // claim fruit ≠ the terminal name — #361 false-positive root cause).
  const envAgent = process.env.CLAUDE_AGENT_NAME || null;
  const branch = currentBranch() || '';
  const branchAgent = branch.split('/')[0] || null;
  const closingAgent = envAgent || branchAgent;
  const allRows = extractRowsFromCsvDiff(diff);
  const mismatched = computeVelocityMismatch(allRows, issue, closingAgent);
  if (mismatched.length) {
    die(`velocity row ticket mismatch: the CSV row(s) added in HEAD record ` +
        `ticket #${mismatched.join(', #')}, but you are closing issue #${issue}. ` +
        'Amend the commit (or the velocity row) to align them first. ' +
        'Pass --skip-ticket-match if intentional.');
  }
}

// Guard 2 I/O wrapper (#311): fetch the issue title via gh and verify that the
// closing commit's subject shares ≥1 keyword with it. Catches gross mismatches
// (a TIL commit accidentally closing a data-migration ticket). Degrades gracefully
// when gh is unavailable — prints a warning and skips rather than blocking.
// closingCommitSha is the SHA returned by findClosingCommitSha(); when not
// supplied it falls back to HEAD (pre-#619 behaviour, single-commit workflow).
function checkKeywordMatch(issue, closingCommitSha) {
  const title = sh(`gh issue view ${issue} --json title -q .title`, true);
  if (!title || !title.trim()) {
    log('warn: could not fetch issue title (gh unavailable?) — skipping keyword check.');
    return;
  }
  const sha = closingCommitSha || 'HEAD';
  const subject = sh(`git show -s --format=%s ${sha}`, true) || '';
  const titleKws = extractKeywords(title.trim());

  // Fast path: closing commit subject overlaps directly.
  if (keywordsOverlap(titleKws, extractKeywords(subject.trim()))) return;

  // Fallback (#645): closing commit may be a content-free close marker
  // ("chore: close #N"). Scan ALL origin/main..HEAD subjects — the work
  // commit carries the vocabulary; the marker commit is administrative.
  const allSubjectsOut = sh('git log origin/main..HEAD --format=%s', true) || '';
  const allSubjects = allSubjectsOut.trim().split('\n').filter(Boolean);
  if (allSubjects.some((s) => keywordsOverlap(titleKws, extractKeywords(s)))) return;

  die(`keyword check: no word from issue #${issue} title\n` +
      `         ("${title.trim()}")\n` +
      `         appears in any unpushed commit subject\n` +
      `         ("${subject.trim()}"${allSubjects.length > 1 ? ` + ${allSubjects.length - 1} other(s)` : ''}).\n` +
      `         Is this the right issue? Pass --skip-keyword-check to override.`);
}

// Check A I/O wrapper (#359): verify a velocity row for ticket N exists in the
// SQLite DB. Lazy-requires better-sqlite3 (real startup cost; skip when
// --skip-velocity-check is passed). Degrades gracefully when the DB is absent
// (first-time setup, CI) — logs a warning instead of blocking. die()s only when
// the DB is readable but contains no row for this ticket.
function checkVelocityRowExists(issue) {
  const dbPath = path.join(os.homedir(), '.lccjs', 'velocity.db');
  let Database;
  try {
    Database = require('better-sqlite3'); // eslint-disable-line global-require
  } catch (_) {
    log('warn: better-sqlite3 unavailable — skipping velocity-row check.');
    return;
  }
  let db;
  try {
    db = new Database(dbPath, { readonly: true });
  } catch (_) {
    log(`warn: could not open velocity DB at ${dbPath} — skipping velocity-row check.`);
    return;
  }
  try {
    if (!velocityRowExists(db, Number(issue))) {
      die(`no velocity row found for ticket #${issue} in ${dbPath}.\n` +
          '  Log it via `npm run velocity:log` and amend the commit, then re-run.\n' +
          '  Pass --skip-velocity-check to bypass (PM/triage closes without a log).');
    }
  } finally {
    db.close();
  }
}

// Check B I/O wrapper (#359): verify no puzzle marker (todo/inprogress) for
// ticket N remains in tracked JS/TS files. die()s if any found; skip with
// --skip-marker-check for tickets that never had a source marker.
function checkMarkerDeleted(issue) {
  // Split marker keywords so the PDD scanner doesn't treat these grep patterns
  // as puzzle markers in the source. Two -e args → OR search.
  const tPat = '@' + `todo #${issue}`;
  const iPat = '@' + `inprogress #${issue}`;
  const result = shCapture(
    `git grep -rn -e "${tPat}" -e "${iPat}" -- "*.js" "*.ts" "*.mjs"`
  );
  // git grep exits 0 (ok=true) when matches found, 1 (ok=false) when none.
  const { found, lines } = markerStillPresent(issue, result.out);
  if (found) {
    die(`puzzle marker for #${issue} still present — delete it in the closing commit first.\n` +
        lines.map((l) => `  Found: ${l}`).join('\n') + '\n' +
        '  Pass --skip-marker-check to bypass (no source marker ever existed).');
  }
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
    const conflicted = conflictedPaths();
    if (isVelocityCsvOnlyConflict(conflicted)) {
      // Auto-resolve: two agents committed divergent CSV snapshots. Re-export
      // from SQLite (the source of truth, already has both rows) then continue.
      const exportScript = path.join(__dirname, 'velocity-export.js');
      // Pass --force so the isMainCheckout() guard in velocity-export.js is
      // bypassed: when close.js is invoked via --branch from the main checkout,
      // __dirname resolves to the main scripts/ dir, making isMainCheckout()
      // return true and silently skip the export (exit 0). --force ensures the
      // re-export always runs during conflict resolution regardless of invoke path.
      const exported = shCapture(`node "${exportScript}" --force`);
      if (!exported.ok) {
        sh('git rebase --abort', true);
        die('velocity CSV conflict: auto-resolve via velocity-export.js failed. ' +
            'Aborted the rebase; your commit is safe and local.');
      }
      const staged = shCapture(`git add "${VELOCITY_CSV}"`);
      if (!staged.ok) {
        sh('git rebase --abort', true);
        die('velocity CSV conflict: re-export succeeded but git add failed. Aborted.');
      }
      const cont = shCapture('GIT_EDITOR=true git rebase --continue');
      if (!cont.ok) {
        sh('git rebase --abort', true);
        die('velocity CSV conflict: re-export + stage succeeded but rebase ' +
            `--continue failed: ${cont.out.trim()}. Your commit is safe and local.`);
      }
      log('velocity CSV conflict auto-resolved (re-exported from SQLite).');
    } else {
      const kind = classifyRebaseConflict(conflicted);
      sh('git rebase --abort', true);
      if (kind === 'union-only') {
        die('rebase conflicted ONLY on merge=union file(s) — that should be ' +
            'impossible (union auto-resolves). Check .gitattributes is in effect. ' +
            'Aborted the rebase; your commit is safe and local.');
      }
      die('rebase hit a real conflict in non-union file(s): ' +
          `${conflicted.join(', ') || rebase.out.trim()}. ` +
          'Aborted the rebase. Resolve manually, then re-run `npm run close`. ' +
          'Your commit is safe and local.');
    }
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

function logCommentPrompt(issue, sha) {
  const s = sha ? sha.slice(0, 12) : '(sha)';
  log(`Post your closing comment:\n  gh issue comment ${issue} --body "Closed in ${s}. <your summary here>"`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.issue || !/^\d+$/.test(opts.issue)) {
    die('usage: node scripts/close.js <issue-number> [--branch <name>] [--max N] [--dry-run] [--keep] [--no-verify-issue] [--skip-ticket-match] [--skip-keyword-check] [--skip-velocity-check] [--skip-marker-check]');
  }
  const issue = opts.issue;

  // --- pre-flight: refuse to start unless the close is real and the tree sane.
  // --branch lets the caller pass the branch when invoking from the main
  // checkout (where HEAD is not the puzzle branch). (#379)
  const branch = opts.branch || currentBranch();
  if (!branch || !/\/issue-\d+/.test(branch)) {
    die(`current branch "${branch || '?'}" is not a <fruit>/issue-<N> worktree branch. ` +
        'Run this from inside the puzzle\'s worktree, not the main checkout.');
  }
  if (!new RegExp(`/issue-${issue}\\b`).test(branch)) {
    die(`branch "${branch}" does not match issue #${issue}. Wrong worktree?`);
  }

  // When --branch is supplied, the caller invoked from the main checkout (not
  // the worktree), so npm's CWD survives teardown. Chdir into the worktree
  // here so all subsequent git operations run in the right context. (#379)
  const root = mainRoot();
  const wtPath = path.join(root, '.claude', 'worktrees', branch.split('/')[0] + '-issue-' + issue);
  if (opts.branch) {
    try {
      process.chdir(wtPath);
    } catch (_) {
      die(`--branch supplied but worktree not found at ${wtPath}. Is it still present?`);
    }
  }

  // Scan the full unpushed set (origin/main..HEAD) for a Closes #N reference so
  // that agents who follow the standard two-commit velocity protocol (fix commit →
  // separate velocity CSV commit) are not falsely blocked by the velocity commit
  // sitting at HEAD with no close keyword. (#619)
  const closingCommitSha = findClosingCommitSha(issue);
  if (!closingCommitSha) {
    die(`No unpushed commit references "Closes #${issue}". Commit the close ` +
        '(marker deletion + `Closes #N`) FIRST, then run close. ' +
        'This tool lands an existing close commit; it does not author one.');
  }
  // Guard 1 (#310): the velocity row in HEAD must record the issue being closed.
  if (!opts.skipTicketMatch) checkVelocityTicketMatch(issue);
  // Guard 2 (#311): the closing commit's subject must share ≥1 keyword with the
  // issue title. Using the closing commit SHA (not HEAD) so that a trailing
  // velocity CSV commit does not shadow the real close subject. (#619)
  if (!opts.skipKeywordCheck) checkKeywordMatch(issue, closingCommitSha);
  // Check A (#359): a velocity row for this ticket must exist in the DB.
  if (!opts.skipVelocityCheck) checkVelocityRowExists(issue);
  // Check B (#359): the puzzle marker must have been deleted before closing.
  if (!opts.skipMarkerCheck) checkMarkerDeleted(issue);
  if (rebaseOrMergeInProgress()) {
    die('a rebase/merge is already in progress here — finish or abort it first.');
  }
  if (!treeIsClean()) {
    die('working tree is not clean. Commit or stash everything into the close ' +
        'commit first (this tool only pushes what is already committed).');
  }

  const sha = headSha();

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

  // Re-read HEAD after the push loop: tryLand() may have rebased (e.g. the
  // velocity CSV auto-resolve path calls `git rebase --continue`), rewriting
  // the SHA captured above. The gate must check the SHA that actually landed
  // on origin/main, not the pre-rebase value. (#354)
  const landedSha = headSha();

  // --- the gate: verify on origin/main before ANY teardown.
  sh('git fetch origin main', true);
  if (!shouldCleanup({ onOriginMain: onOriginMain(landedSha) })) {
    die(`push reported success but ${landedSha && landedSha.slice(0, 12)} is NOT on ` +
        'origin/main — refusing to remove the worktree. Investigate before ' +
        'cleaning up; your work is intact.');
  }
  log(`commit ${landedSha.slice(0, 12)} confirmed on origin/main.`);

  // --- best-effort: confirm the issue actually closed (the keyword can lag).
  if (opts.verifyIssue) {
    const st = sh(`gh issue view ${issue} --json state -q .state`, true);
    if (st && st.trim().toUpperCase() === 'OPEN') {
      log(`#${issue} still shows OPEN — closing it explicitly.`);
      sh(`gh issue close ${issue} -c "Closed via npm run close (commit ${landedSha.slice(0, 12)} on main)."`, true);
    } else if (st) {
      log(`#${issue} is ${st.trim()}.`);
    }
  }

  if (opts.keep) {
    report({ issue, branch, wtPath, sha: landedSha, kept: true, dry: false });
    logCommentPrompt(issue, landedSha);
    return;
  }

  // --- teardown: only reachable past the gate. Run from main root.
  process.chdir(root);

  // Pull main first — doesn't depend on the worktree and runs from root. (#352)
  const pullResult = shCapture('git pull --ff-only origin main');
  if (pullResult.ok) {
    log('main checkout synced.');
  } else {
    log(`warn: ff pull of main skipped (${pullResult.out.trim().split('\n')[0].slice(0, 80)}). ` +
        `Sync manually: git -C "${root}" pull --ff-only origin main`);
  }

  report({ issue, branch, wtPath, sha: landedSha, kept: false, dry: false });
  log(`Shell re-root: cd "${root}"`);
  logCommentPrompt(issue, landedSha);

  // Defer the filesystem teardown to a detached subprocess so that npm and
  // any shell it spawns for post-run lifecycle checks can exit while the
  // worktree directory still exists — prevents getcwd failures on npm exit
  // (#533, #541). The closing commit is already on origin/main at this point.
  spawn('bash', ['-c',
    `git worktree remove "${wtPath}" && git branch -D ${branch} && git worktree prune` +
    " || echo '[close] warning: deferred teardown may have failed — check: git worktree list' >&2"
  ], { detached: true, stdio: ['ignore', 'inherit', 'inherit'], cwd: root }).unref();
}

if (require.main === module) main();

module.exports = {
  DEFAULT_MAX_RETRIES, UNION_FILES, VELOCITY_CSV, KEYWORD_STOP_SET,
  parseArgs, classifyPushError, shouldCleanup, classifyRebaseConflict,
  isVelocityCsvOnlyConflict,
  extractTicketFromCsvDiff, extractRowsFromCsvDiff, velocityTicketMismatch,
  computeVelocityMismatch,
  extractKeywords, keywordsOverlap,
  velocityRowExists, markerStillPresent,
  bodyClosesIssue,
  logCommentPrompt,
};
