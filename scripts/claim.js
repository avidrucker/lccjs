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
 * Identity, in precedence order (highest first):
 *   --as <fruit>             — "reuse this identity." Explicit per-call override.
 *                              Use for every subsequent worktree in the same
 *                              session, passing the fruit you were given (or one a
 *                              human assigned). Same-fruit/different-issue is fine.
 *   CLAUDE_AGENT_NAME=<name>  — human-directed default. When the human launches an
 *                              agent under a chosen name (e.g. DRAGONFRUIT), they
 *                              export this so a bare `npm run claim -- <N>` stakes
 *                              under that name — no `--as` needed, and the script
 *                              never silently auto-picks a different fruit (#212).
 *                              Normalized to lowercase for the branch/path.
 *   auto (no --as, no env)   — "give me a brand-new fruit nobody is using." Picks
 *                              the lowest-indexed free fruit. Use ONCE, on the
 *                              first claim of a session. Race-safe via
 *                              detect-and-rollback.
 *
 * A "forced" identity (either --as or CLAUDE_AGENT_NAME) is a single candidate:
 * it is never swapped for a different fruit, and a branch-exists collision is a
 * hard error rather than a silent retry. Only auto walks the free-fruit list.
 *
 * A fruit is "taken" iff a `<fruit>/*` branch exists — git's branch namespace is
 * the single source of truth, no registry file.
 *
 * Usage:
 *   node scripts/claim.js <issue> [slug]            # auto-pick a fresh fruit
 *   node scripts/claim.js <issue> [slug] --as apple # reuse a known identity
 *   CLAUDE_AGENT_NAME=apple node scripts/claim.js <issue>   # human-directed default
 *   node scripts/claim.js <issue> --base origin/main
 *   node scripts/claim.js <issue> --dry-run         # show the plan, stake nothing
 *
 * If no slug is given, claim.js tries to derive one from the issue title via gh
 * (best-effort; falls back to no slug if gh is unavailable).
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');

// Lowest-index-first. Common, unambiguous, easy to say aloud over a call.
const FRUITS = [
  'apple', 'banana', 'cherry', 'date', 'elderberry', 'fig', 'grape',
  'honeydew', 'kiwi', 'lemon', 'mango', 'nectarine', 'olive', 'peach',
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

// @todo #194:45m/DEV takenFruits() is worktree-scoped: a fruit frees the instant
//  its last worktree is removed, even while that agent's session is still alive (the
//  #193 collision — apple reassigned mid-session). Make identity session-scoped via a
//  persistent <fruit>/session sentinel branch + scan all <fruit>/* branches + a
//  reflog-age staleness sweep. Scanning all branches alone is NOT enough (close
//  deletes the branch too). See #194 and docs/research/claim-fruit-session-scope.md.
function takenFruits() {
  return new Set(listWorktreeBranches().map((b) => b.fruit).filter(Boolean));
}

function branchExists(branch) {
  return sh(`git show-ref --verify --quiet refs/heads/${branch} && echo yes`, true);
}

function parseArgs(argv) {
  const opts = { issue: null, slug: null, as: null, base: 'main', dryRun: false, allowStaleMain: false };
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--as') opts.as = argv[++i];
    else if (a === '--base') opts.base = argv[++i];
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--allow-stale-main') opts.allowStaleMain = true;
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

// Resolve the agent identity from flags + environment, in precedence order:
//   --as <fruit>  >  CLAUDE_AGENT_NAME  >  auto (no forced identity).
// Returns { name, source, modeLabel }. name === null means "auto-pick a fresh
// fruit"; a non-null name is a *forced* identity (single candidate, never
// silently swapped). `source`/`modeLabel` only drive the human-readable report.
function resolveIdentity(opts, env) {
  if (opts.as) {
    return { name: opts.as, source: 'as', modeLabel: 'reuse (--as)' };
  }
  const envName = normalizeIdentity(env.CLAUDE_AGENT_NAME || '');
  if (envName) {
    return { name: envName, source: 'env', modeLabel: 'human-directed (env)' };
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

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.issue || !/^\d+$/.test(opts.issue)) {
    die('usage: node scripts/claim.js <issue-number> [slug] [--as <fruit>] [--base <ref>] [--dry-run]');
  }
  const issue = opts.issue;

  const identity = resolveIdentity(opts, process.env);
  if (identity.name && !FRUITS.includes(identity.name)) {
    console.error(`[claim] note: "${identity.name}" is not in the known fruit list — using it anyway.`);
  }

  // @todo #227:20m/DEV claim.js stakes a worktree without checking issue state — it
  // will happily claim an already-CLOSED issue. The slug gh call below already fetches
  // the issue JSON; extend it to `--json title,state` and, when state is CLOSED, warn
  // and abort (non-zero) unless an explicit --force is passed, so an agent racing a
  // concurrent close (cf. #223) finds out before doing redundant work. Keep best-effort
  // when gh is unavailable / the issue is unknown. See #227.

  // Derive a slug from the issue title if none was given (best-effort).
  let slug = opts.slug ? slugify(opts.slug) : null;
  if (!slug) {
    const title = sh(`gh issue view ${issue} --json title -q .title`, true);
    if (title) slug = slugify(title);
  }

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
    console.log('[claim] --dry-run — nothing staked.');
    report(fruit, mkBranch(fruit), mkPath(fruit), base, identity.modeLabel, true);
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

    report(fruit, branch, wtPath, base, identity.modeLabel, false);
    return;
  }

  die('could not claim a worktree — every candidate fruit was taken or staking failed.');
}

function report(fruit, branch, wtPath, base, mode, dry) {
  const short = wtPath.replace(process.env.HOME || '\0', '~');
  const bar = '─'.repeat(58);
  console.log(bar);
  console.log(`  ${dry ? 'WOULD CLAIM' : 'CLAIMED'}  ·  agent: ${fruit}  (${mode})`);
  console.log(bar);
  console.log(`  branch    ${branch}`);
  console.log(`  worktree  ${short}`);
  console.log(`  base      ${base}`);
  if (!dry) {
    console.log('');
    console.log('  next:');
    console.log(`    cd ${short}`);
    console.log('    # flip the puzzle marker @todo #N → @inprogress #N so it reads as claimed');
    console.log('    # reuse this identity for later worktrees:  npm run claim -- <issue> --as ' + fruit);
  }
  console.log(bar);
  // Machine-readable tail for scripting/agents.
  console.log(`CLAIM ${dry ? 'DRYRUN' : 'OK'} agent=${fruit} branch=${branch} path=${wtPath}`);
}

if (require.main === module) main();

module.exports = {
  FRUITS, slugify, listWorktreeBranches, takenFruits,
  parseArgs, normalizeIdentity, resolveIdentity, assessBaseStaleness,
};
