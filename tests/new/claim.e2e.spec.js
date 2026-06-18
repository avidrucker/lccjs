'use strict';

// E2e tests for scripts/claim.js — exercise the main() orchestration end-to-end
// against a real git repo (temp bare remote + working checkout), with `gh` shadowed
// by a hermetic stub so no real GitHub round-trip happens. Serial-safe; each test
// gets its own tmpdir + its own bare remote, so claim refs never collide.
//
// Why this exists (#1196): claim.js's pure decision seams (parseArgs,
// classifyClaimPushResult, shouldBlockUncategorized, …) are already covered by
// claim.unit.spec.js + claim.issue-state.spec.js, but main() — the ~230-line
// integration point that *wires* those seams into the real claim sequence
// (worktree add, marker flip, claim-ref push, race rollback, the CLOSED/lane/
// live-worktree guards) — had zero direct coverage (lines 529-824, ~34% of the
// file). These tests drive main() as a subprocess and assert the observable
// outcomes: branch + worktree created/absent, banner text, exit code, the claim
// ref on the remote, and the in-place @todo→@inprogress flip.
//
// Run via:  npm test -- --runTestsByPath tests/new/claim.e2e.spec.js

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Absolute path so the subprocess invocation is genuine regardless of cwd.
const CLAIM_JS = path.resolve(__dirname, '../../scripts/claim.js');

function sh(cwd, cmd, opts = {}) {
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: 'pipe', ...opts });
}

function shCapture(cwd, cmd) {
  try {
    return { ok: true, out: execSync(cmd, { cwd, encoding: 'utf8', stdio: 'pipe' }) };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') };
  }
}

// A standard "ready to claim" issue: OPEN with a real area:* lane and a title that
// claim.js slugifies into the branch tail.
const OPEN_JSON = JSON.stringify({
  title: 'Test issue title goes here',
  state: 'OPEN',
  comments: [],
  labels: [{ name: 'area:process' }],
});

// Build a temp bare remote + working checkout. claim.js itself creates the puzzle
// worktree under <root>/.claude/worktrees/, so we only stand up `main`. A hermetic
// `gh` stub is dropped in <tmpDir>/bin and shadowed onto PATH by runClaim().
function makeRepo() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-claim-e2e-'));
  const remotePath = path.join(tmpDir, 'remote.git');
  const mainPath = path.join(tmpDir, 'main');
  const binDir = path.join(tmpDir, 'bin');

  fs.mkdirSync(remotePath);
  sh(tmpDir, `git init --bare "${remotePath}"`);
  sh(remotePath, 'git symbolic-ref HEAD refs/heads/main');

  fs.mkdirSync(mainPath);
  sh(tmpDir, `git clone "${remotePath}" main`);
  // user identity + no signing are set on the common dir so claim.js's worktrees
  // and its `git commit-tree` (claim-ref object) inherit them.
  sh(mainPath, 'git config user.email "test@example.com"');
  sh(mainPath, 'git config user.name "Test"');
  sh(mainPath, 'git config commit.gpgsign false');

  fs.writeFileSync(path.join(mainPath, 'README.md'), 'init\n');
  sh(mainPath, 'git add README.md');
  sh(mainPath, 'git commit -m "init"');
  const br = sh(mainPath, 'git rev-parse --abbrev-ref HEAD').trim();
  if (br !== 'main') sh(mainPath, 'git checkout -b main');
  sh(mainPath, 'git push -u origin main');

  // Hermetic gh stub. claim.js calls:
  //   gh issue view N --json title,state,comments,labels   (readIssue)
  //   gh issue view N --json state -q .state               (warnOrphaned/warnStaleClaimRefs)
  // The stub emits $GH_STUB_JSON for the first and $GH_STUB_STATE for the second.
  // An empty GH_STUB_JSON exits non-zero to simulate gh being offline/absent.
  fs.mkdirSync(binDir);
  const ghStub = path.join(binDir, 'gh');
  fs.writeFileSync(
    ghStub,
    [
      '#!/bin/sh',
      '# test stub for gh (see makeRepo in claim.e2e.spec.js)',
      'case "$*" in',
      '  *"-q .state"*) printf "%s" "$GH_STUB_STATE" ;;',
      '  *"issue view"*)',
      '    if [ -n "$GH_STUB_JSON" ]; then printf "%s" "$GH_STUB_JSON"; else exit 1; fi ;;',
      '  *) exit 0 ;;',
      'esac',
    ].join('\n') + '\n'
  );
  fs.chmodSync(ghStub, 0o755);

  return { tmpDir, remotePath, mainPath, binDir };
}

// Run claim.js as a subprocess. `args` is an argv array (no shell quoting games).
// gh is shadowed by the temp stub; CLAUDE_AGENT_NAME is stripped so identity
// resolution is fully controlled by the test (via --as or an explicit env entry).
function runClaim(mainPath, binDir, args, { json, state, extraEnv } = {}) {
  const env = { ...process.env, ...(extraEnv || {}) };
  delete env.CLAUDE_AGENT_NAME;
  env.PATH = binDir + path.delimiter + process.env.PATH;
  env.GH_STUB_JSON = json === undefined ? '' : json;
  env.GH_STUB_STATE = state === undefined ? '' : state;
  const r = spawnSync('node', [CLAIM_JS, ...args], {
    cwd: mainPath,
    encoding: 'utf8',
    env,
  });
  return { ok: r.status === 0, status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function rmrf(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

function wtDir(mainPath, fruit, issue) {
  return path.join(mainPath, '.claude', 'worktrees', `${fruit}-issue-${issue}`);
}

function branchExists(mainPath, branch) {
  return shCapture(mainPath, `git show-ref --verify --quiet refs/heads/${branch} && echo yes`).ok;
}

// ─── Argument & identity guards ───────────────────────────────────────────────

describe('claim.js e2e — argument & identity guards', () => {
  test('dies with a usage message when no issue number is given', () => {
    const { tmpDir, mainPath, binDir } = makeRepo();
    try {
      const { ok, out } = runClaim(mainPath, binDir, ['--as', 'apple']);
      expect(ok).toBe(false);
      expect(out).toMatch(/usage:/i);
    } finally {
      rmrf(tmpDir);
    }
  }, 20_000);

  test('dies on an unknown flag', () => {
    const { tmpDir, mainPath, binDir } = makeRepo();
    try {
      const { ok, out } = runClaim(mainPath, binDir, ['7001', '--as', 'apple', '--bogus']);
      expect(ok).toBe(false);
      expect(out).toMatch(/unknown flag: --bogus/);
    } finally {
      rmrf(tmpDir);
    }
  }, 20_000);

  test('dies when no identity is set (no --as, no CLAUDE_AGENT_NAME, main branch)', () => {
    const { tmpDir, mainPath, binDir } = makeRepo();
    try {
      // runClaim strips CLAUDE_AGENT_NAME and the cwd branch is "main" (no fruit to
      // infer), so identity resolves to auto → the #386 hard stop fires.
      const { ok, out } = runClaim(mainPath, binDir, ['7002']);
      expect(ok).toBe(false);
      expect(out).toMatch(/no agent identity set/i);
    } finally {
      rmrf(tmpDir);
    }
  }, 20_000);
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('claim.js e2e — happy path', () => {
  test('stakes the worktree + branch, derives a slug, and stakes the cross-clone claim ref', () => {
    const { tmpDir, mainPath, remotePath, binDir } = makeRepo();
    try {
      const { ok, out } = runClaim(mainPath, binDir, ['9101', '--as', 'apple'], {
        json: OPEN_JSON,
        state: 'OPEN',
      });
      expect(ok).toBe(true);
      expect(out).toMatch(/CLAIMED/);
      // Machine-readable tail wires fruit + branch + path together.
      expect(out).toMatch(/CLAIM OK agent=apple branch=apple\/issue-9101-test-issue-title-goes/);

      // Worktree directory + branch both exist.
      expect(fs.existsSync(wtDir(mainPath, 'apple', '9101'))).toBe(true);
      expect(branchExists(mainPath, 'apple/issue-9101-test-issue-title-goes-here')).toBe(true);

      // The cross-clone claim ref (#1038) was pushed to the remote.
      const refs = sh(mainPath, `git ls-remote "${remotePath}" "refs/claims/*"`);
      expect(refs).toMatch(/refs\/claims\/issue-9101/);
    } finally {
      rmrf(tmpDir);
    }
  }, 30_000);

  test('flips a live @todo #N marker to @inprogress #N in the worktree (in place, unstaged)', () => {
    const { tmpDir, mainPath, binDir } = makeRepo();
    try {
      // Plant a canonical PDD marker on main BEFORE the worktree is branched, so the
      // worktree inherits it and flipMarker() can find + rewrite it.
      const markerRel = 'marker.js';
      fs.writeFileSync(path.join(mainPath, markerRel), '// @todo #9102:30/DEV wire it up\n');
      sh(mainPath, `git add ${markerRel}`);
      sh(mainPath, 'git commit -m "chore: plant marker"');
      sh(mainPath, 'git push origin main');

      const { ok, out } = runClaim(mainPath, binDir, ['9102', '--as', 'apple'], {
        json: OPEN_JSON,
        state: 'OPEN',
      });
      expect(ok).toBe(true);
      expect(out).toMatch(/flipped @todo #9102 → @inprogress in marker\.js/);

      const flipped = fs.readFileSync(path.join(wtDir(mainPath, 'apple', '9102'), markerRel), 'utf8');
      expect(flipped).toMatch(/@inprogress #9102:30\/DEV/);
      expect(flipped).not.toMatch(/@todo #9102/);

      // The flip is left UNSTAGED in the worktree (the agent commits it themselves).
      const status = sh(wtDir(mainPath, 'apple', '9102'), 'git status --porcelain marker.js');
      expect(status).toMatch(/^ M marker\.js/);
    } finally {
      rmrf(tmpDir);
    }
  }, 30_000);

  test('copies .env from the repo root into the new worktree when present', () => {
    const { tmpDir, mainPath, binDir } = makeRepo();
    try {
      fs.writeFileSync(path.join(mainPath, '.env'), 'LCC_ORACLE=/somewhere/lcc\n');
      const { ok } = runClaim(mainPath, binDir, ['9103', '--as', 'apple'], { json: OPEN_JSON, state: 'OPEN' });
      expect(ok).toBe(true);
      const copied = path.join(wtDir(mainPath, 'apple', '9103'), '.env');
      expect(fs.existsSync(copied)).toBe(true);
      expect(fs.readFileSync(copied, 'utf8')).toMatch(/LCC_ORACLE=/);
    } finally {
      rmrf(tmpDir);
    }
  }, 30_000);

  test('proceeds (best-effort) when gh is offline — no slug, no CLOSED/lane block', () => {
    const { tmpDir, mainPath, binDir } = makeRepo();
    try {
      // Empty GH_STUB_JSON ⇒ stub exits non-zero ⇒ readIssue() returns null. The
      // CLOSED guard and the lane gate both treat null as "proceed".
      const { ok, out } = runClaim(mainPath, binDir, ['9104', '--as', 'apple']);
      expect(ok).toBe(true);
      // No title ⇒ no slug ⇒ branch tail is bare issue-N.
      expect(out).toMatch(/CLAIM OK agent=apple branch=apple\/issue-9104 /);
      expect(fs.existsSync(wtDir(mainPath, 'apple', '9104'))).toBe(true);
    } finally {
      rmrf(tmpDir);
    }
  }, 30_000);
});

// ─── Dry run ──────────────────────────────────────────────────────────────────

describe('claim.js e2e — dry run', () => {
  test('--dry-run prints the plan and stakes nothing (no worktree, branch, or claim ref)', () => {
    const { tmpDir, mainPath, remotePath, binDir } = makeRepo();
    try {
      const { ok, out } = runClaim(mainPath, binDir, ['9201', '--as', 'apple', '--dry-run'], {
        json: OPEN_JSON,
        state: 'OPEN',
      });
      expect(ok).toBe(true);
      expect(out).toMatch(/WOULD CLAIM/);
      expect(out).toMatch(/CLAIM DRYRUN agent=apple/);

      // Nothing was staked.
      expect(fs.existsSync(wtDir(mainPath, 'apple', '9201'))).toBe(false);
      expect(branchExists(mainPath, 'apple/issue-9201-test-issue-title-goes-here')).toBe(false);
      const refs = sh(mainPath, `git ls-remote "${remotePath}" "refs/claims/*"`);
      expect(refs).not.toMatch(/refs\/claims\/issue-9201/);
    } finally {
      rmrf(tmpDir);
    }
  }, 30_000);
});

// ─── Issue-state guard (#227) ─────────────────────────────────────────────────

describe('claim.js e2e — CLOSED-state guard (#227)', () => {
  const CLOSED_JSON = JSON.stringify({
    title: 'Already done',
    state: 'CLOSED',
    comments: [],
    labels: [{ name: 'area:process' }],
  });

  test('dies when the issue is CLOSED', () => {
    const { tmpDir, mainPath, binDir } = makeRepo();
    try {
      const { ok, out } = runClaim(mainPath, binDir, ['9301', '--as', 'apple'], {
        json: CLOSED_JSON,
        state: 'CLOSED',
      });
      expect(ok).toBe(false);
      expect(out).toMatch(/#9301 is CLOSED/);
      expect(fs.existsSync(wtDir(mainPath, 'apple', '9301'))).toBe(false);
    } finally {
      rmrf(tmpDir);
    }
  }, 20_000);

  test('--force bypasses the CLOSED guard and stakes the worktree', () => {
    const { tmpDir, mainPath, binDir } = makeRepo();
    try {
      const { ok, out } = runClaim(mainPath, binDir, ['9302', '--as', 'apple', '--force'], {
        json: CLOSED_JSON,
        state: 'CLOSED',
      });
      expect(ok).toBe(true);
      expect(out).toMatch(/CLAIM OK agent=apple/);
      expect(fs.existsSync(wtDir(mainPath, 'apple', '9302'))).toBe(true);
    } finally {
      rmrf(tmpDir);
    }
  }, 30_000);
});

// ─── Lane gate (#1151) ────────────────────────────────────────────────────────

describe('claim.js e2e — lane gate (#1151)', () => {
  const UNCATEGORIZED_JSON = JSON.stringify({
    title: 'No lane assigned',
    state: 'OPEN',
    comments: [],
    labels: [{ name: 'area:uncategorized' }],
  });

  test('dies when the issue carries only area:uncategorized', () => {
    const { tmpDir, mainPath, binDir } = makeRepo();
    try {
      const { ok, out } = runClaim(mainPath, binDir, ['9401', '--as', 'apple'], {
        json: UNCATEGORIZED_JSON,
        state: 'OPEN',
      });
      expect(ok).toBe(false);
      expect(out).toMatch(/no real area:\* label/);
      expect(fs.existsSync(wtDir(mainPath, 'apple', '9401'))).toBe(false);
    } finally {
      rmrf(tmpDir);
    }
  }, 20_000);

  test('--allow-uncategorized bypasses the lane gate and stakes the worktree', () => {
    const { tmpDir, mainPath, binDir } = makeRepo();
    try {
      const { ok, out } = runClaim(mainPath, binDir, ['9402', '--as', 'apple', '--allow-uncategorized'], {
        json: UNCATEGORIZED_JSON,
        state: 'OPEN',
      });
      expect(ok).toBe(true);
      expect(out).toMatch(/CLAIM OK agent=apple/);
      expect(fs.existsSync(wtDir(mainPath, 'apple', '9402'))).toBe(true);
    } finally {
      rmrf(tmpDir);
    }
  }, 30_000);
});

// ─── Live-worktree guard (#629) ───────────────────────────────────────────────

describe('claim.js e2e — live-worktree guard (#629)', () => {
  test('a second claim of the same issue (different fruit) is blocked', () => {
    const { tmpDir, mainPath, binDir } = makeRepo();
    try {
      const first = runClaim(mainPath, binDir, ['9501', '--as', 'apple'], { json: OPEN_JSON, state: 'OPEN' });
      expect(first.ok).toBe(true);

      const second = runClaim(mainPath, binDir, ['9501', '--as', 'banana'], { json: OPEN_JSON, state: 'OPEN' });
      expect(second.ok).toBe(false);
      expect(second.out).toMatch(/already live in worktree "apple\/issue-9501/);
      // The blocked claim staked nothing under banana.
      expect(fs.existsSync(wtDir(mainPath, 'banana', '9501'))).toBe(false);
    } finally {
      rmrf(tmpDir);
    }
  }, 40_000);

  test('--force lets a second claim through with a warning (banner still emitted)', () => {
    const { tmpDir, mainPath, binDir } = makeRepo();
    try {
      const first = runClaim(mainPath, binDir, ['9502', '--as', 'apple'], { json: OPEN_JSON, state: 'OPEN' });
      expect(first.ok).toBe(true);

      const second = runClaim(mainPath, binDir, ['9502', '--as', 'banana', '--force'], { json: OPEN_JSON, state: 'OPEN' });
      expect(second.ok).toBe(true);
      expect(second.out).toMatch(/live worktree detected/);
      expect(second.out).toMatch(/CLAIM OK agent=banana/);
      expect(fs.existsSync(wtDir(mainPath, 'banana', '9502'))).toBe(true);
    } finally {
      rmrf(tmpDir);
    }
  }, 40_000);
});

// ─── Base-ref guard ───────────────────────────────────────────────────────────

describe('claim.js e2e — base-ref guard', () => {
  test('dies when --base does not resolve to a commit', () => {
    const { tmpDir, mainPath, binDir } = makeRepo();
    try {
      const { ok, out } = runClaim(mainPath, binDir, ['9601', '--as', 'apple', '--base', 'no-such-ref'], {
        json: OPEN_JSON,
        state: 'OPEN',
      });
      expect(ok).toBe(false);
      expect(out).toMatch(/base ref "no-such-ref" does not resolve/);
    } finally {
      rmrf(tmpDir);
    }
  }, 20_000);
});

// ─── Stale-main guard (#228) ──────────────────────────────────────────────────

describe('claim.js e2e — stale-main guard (#228)', () => {
  // Push an extra commit to the remote from a throwaway clone so the main checkout's
  // local `main` is behind origin/main after claim.js's internal fetch.
  function advanceRemote(tmpDir, remotePath) {
    const otherPath = path.join(tmpDir, 'other');
    sh(tmpDir, `git clone "${remotePath}" other`);
    sh(otherPath, 'git config user.email "test@example.com"');
    sh(otherPath, 'git config user.name "Test"');
    sh(otherPath, 'git config commit.gpgsign false');
    fs.writeFileSync(path.join(otherPath, 'concurrent.txt'), 'ahead\n');
    sh(otherPath, 'git add concurrent.txt');
    sh(otherPath, 'git commit -m "feat: concurrent commit"');
    sh(otherPath, 'git push origin main');
  }

  test('dies when local main is behind origin/main', () => {
    const { tmpDir, mainPath, remotePath, binDir } = makeRepo();
    try {
      advanceRemote(tmpDir, remotePath);
      const { ok, out } = runClaim(mainPath, binDir, ['9701', '--as', 'apple'], { json: OPEN_JSON, state: 'OPEN' });
      expect(ok).toBe(false);
      expect(out).toMatch(/behind origin\/main/);
      expect(fs.existsSync(wtDir(mainPath, 'apple', '9701'))).toBe(false);
    } finally {
      rmrf(tmpDir);
    }
  }, 30_000);

  test('--allow-stale-main overrides the stale-base block', () => {
    const { tmpDir, mainPath, remotePath, binDir } = makeRepo();
    try {
      advanceRemote(tmpDir, remotePath);
      const { ok, out } = runClaim(mainPath, binDir, ['9702', '--as', 'apple', '--allow-stale-main'], {
        json: OPEN_JSON,
        state: 'OPEN',
      });
      expect(ok).toBe(true);
      expect(out).toMatch(/CLAIM OK agent=apple/);
      expect(fs.existsSync(wtDir(mainPath, 'apple', '9702'))).toBe(true);
    } finally {
      rmrf(tmpDir);
    }
  }, 30_000);
});
