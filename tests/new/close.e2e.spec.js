'use strict';

// E2e tests for scripts/close.js — require a real git repo (temp bare remote +
// working checkout + puzzle worktree). Serial-safe; each test gets its own tmpdir.
// Run via:  npm test -- --runTestsByPath tests/new/close.e2e.spec.js

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Absolute path so the abs-path invocation test is genuine (same CLOSE_JS
// variable used for all tests, always absolute).
const CLOSE_JS = path.resolve(__dirname, '../../scripts/close.js');

function sh(cwd, cmd, opts = {}) {
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: 'pipe', ...opts });
}

function shCapture(cwd, cmd) {
  try {
    const out = execSync(cmd, { cwd, encoding: 'utf8', stdio: 'pipe' });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') };
  }
}

// Like makeRepo but includes a committed package.json with a "close" script so
// `npm run close` can be invoked from the worktree (used by the #434 regression).
function makeRepoWithPkg(issue = '9999') {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-close-e2e-'));
  const remotePath = path.join(tmpDir, 'remote.git');
  const mainPath = path.join(tmpDir, 'main');

  fs.mkdirSync(remotePath);
  sh(tmpDir, `git init --bare "${remotePath}"`);
  sh(remotePath, 'git symbolic-ref HEAD refs/heads/main');
  fs.mkdirSync(mainPath);
  sh(tmpDir, `git clone "${remotePath}" main`);
  sh(mainPath, 'git config user.email "test@example.com"');
  sh(mainPath, 'git config user.name "Test"');
  sh(mainPath, 'git config commit.gpgsign false');

  // Initial commit: include a package.json so `npm run close` works in the worktree.
  // The script must point to CLOSE_JS (absolute) so npm can find it without node_modules.
  const pkg = JSON.stringify({ name: 'test', version: '1.0.0', scripts: { close: `node "${CLOSE_JS}"` } });
  fs.writeFileSync(path.join(mainPath, 'README.md'), 'init\n');
  fs.writeFileSync(path.join(mainPath, 'package.json'), pkg);
  sh(mainPath, 'git add README.md package.json');
  sh(mainPath, 'git commit -m "init"');
  const br = sh(mainPath, 'git rev-parse --abbrev-ref HEAD').trim();
  if (br !== 'main') sh(mainPath, 'git checkout -b main');
  sh(mainPath, 'git push -u origin main');

  const wtPath = path.join(mainPath, '.claude', 'worktrees', `dragonfruit-issue-${issue}`);
  const wtBranch = `dragonfruit/issue-${issue}-test`;
  fs.mkdirSync(path.dirname(wtPath), { recursive: true });
  sh(mainPath, `git worktree add "${wtPath}" -b "${wtBranch}"`);
  sh(wtPath, 'git config user.email "test@example.com"');
  sh(wtPath, 'git config user.name "Test"');
  sh(wtPath, 'git config commit.gpgsign false');

  fs.writeFileSync(path.join(wtPath, 'work.txt'), `puzzle ${issue}\n`);
  sh(wtPath, 'git add work.txt');
  sh(wtPath, `git commit -m "fix: thing\n\nCloses #${issue}"`);

  return { tmpDir, remotePath, mainPath, wtPath, wtBranch };
}

// Build a temp bare remote + working checkout + a puzzle worktree whose HEAD is
// a valid "Closes #<issue>" commit. Returns paths for assertions and cleanup.
function makeRepo(issue = '9999') {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-close-e2e-'));
  const remotePath = path.join(tmpDir, 'remote.git');
  const mainPath = path.join(tmpDir, 'main');

  // Bare remote with main as default branch
  fs.mkdirSync(remotePath);
  sh(tmpDir, `git init --bare "${remotePath}"`);
  sh(remotePath, 'git symbolic-ref HEAD refs/heads/main');

  // Working checkout
  fs.mkdirSync(mainPath);
  sh(tmpDir, `git clone "${remotePath}" main`);
  sh(mainPath, 'git config user.email "test@example.com"');
  sh(mainPath, 'git config user.name "Test"');
  sh(mainPath, 'git config commit.gpgsign false');

  // Initial commit + push to establish origin/main
  fs.writeFileSync(path.join(mainPath, 'README.md'), 'init\n');
  sh(mainPath, 'git add README.md');
  sh(mainPath, 'git commit -m "init"');
  // Ensure the branch is named 'main' (older git may default to master)
  const br = sh(mainPath, 'git rev-parse --abbrev-ref HEAD').trim();
  if (br !== 'main') sh(mainPath, 'git checkout -b main');
  sh(mainPath, 'git push -u origin main');

  // Puzzle worktree — path must match close.js's internal derivation:
  //   path.join(root, '.claude', 'worktrees', fruit + '-issue-' + N)
  const wtPath = path.join(mainPath, '.claude', 'worktrees', `dragonfruit-issue-${issue}`);
  const wtBranch = `dragonfruit/issue-${issue}-test`;
  fs.mkdirSync(path.dirname(wtPath), { recursive: true });
  sh(mainPath, `git worktree add "${wtPath}" -b "${wtBranch}"`);
  sh(wtPath, 'git config user.email "test@example.com"');
  sh(wtPath, 'git config user.name "Test"');
  sh(wtPath, 'git config commit.gpgsign false');

  // Closing commit (the tool's pre-flight requires this on HEAD)
  fs.writeFileSync(path.join(wtPath, 'work.txt'), `puzzle ${issue}\n`);
  sh(wtPath, 'git add work.txt');
  sh(wtPath, `git commit -m "fix: thing\n\nCloses #${issue}"`);

  return { tmpDir, remotePath, mainPath, wtPath, wtBranch };
}

function rmrf(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

// ─── Happy path ──────────────────────────────────────────────────────────────

describe('close.js e2e — happy path', () => {
  test('clean close: commit lands on origin/main and worktree + branch are removed', () => {
    const { tmpDir, mainPath, wtPath, wtBranch } = makeRepo('9001');
    try {
      const { ok, out } = shCapture(wtPath, `node "${CLOSE_JS}" 9001 --no-verify-issue --skip-velocity-check --skip-marker-check`);
      expect(ok).toBe(true);
      expect(out).toMatch(/CLOSED/);

      // Commit is on origin/main (check full message — Closes is in the body)
      sh(mainPath, 'git fetch origin main');
      const log = sh(mainPath, 'git log origin/main --format=%B');
      expect(log).toMatch(/Closes #9001/);

      // Worktree directory removed
      expect(fs.existsSync(wtPath)).toBe(false);

      // Branch deleted
      const branches = sh(mainPath, 'git branch -a');
      expect(branches).not.toMatch(wtBranch);
    } finally {
      rmrf(tmpDir);
    }
  }, 30_000);

  test('--keep: commit lands on origin/main, worktree survives', () => {
    const { tmpDir, mainPath, wtPath } = makeRepo('9002');
    try {
      const { ok, out } = shCapture(wtPath, `node "${CLOSE_JS}" 9002 --keep --no-verify-issue --skip-velocity-check --skip-marker-check`);
      expect(ok).toBe(true);
      expect(out).toMatch(/LANDED \(kept worktree\)/);
      expect(fs.existsSync(wtPath)).toBe(true);

      sh(mainPath, 'git fetch origin main');
      const log = sh(mainPath, 'git log origin/main --format=%B');
      expect(log).toMatch(/Closes #9002/);
    } finally {
      rmrf(tmpDir);
    }
  }, 30_000);
});

// ─── Lost-race retry ─────────────────────────────────────────────────────────

describe('close.js e2e — lost-race retry', () => {
  test('retries after a rejected push; eventually lands and tears down', () => {
    const { tmpDir, remotePath, mainPath, wtPath } = makeRepo('9003');
    try {
      // pre-receive hook that rejects exactly the first push then stands aside
      const hookPath = path.join(remotePath, 'hooks', 'pre-receive');
      const counterPath = path.join(remotePath, 'hooks', '.push-count');
      // The hook output must match a RACE pattern so classifyPushError retries.
      fs.writeFileSync(
        hookPath,
        [
          '#!/bin/sh',
          `if [ ! -f "${counterPath}" ]; then`,
          `  echo 1 > "${counterPath}"`,
          "  printf \"! [remote rejected] HEAD -> main (cannot lock ref 'refs/heads/main': simulated race)\\n\" >&2",
          '  exit 1',
          'fi',
          'exit 0',
        ].join('\n') + '\n'
      );
      fs.chmodSync(hookPath, 0o755);

      const { ok, out } = shCapture(wtPath, `node "${CLOSE_JS}" 9003 --no-verify-issue --skip-velocity-check --skip-marker-check`);
      expect(ok).toBe(true);
      expect(out).toMatch(/CLOSED/);

      // Commit landed after the retry
      sh(mainPath, 'git fetch origin main');
      const log = sh(mainPath, 'git log origin/main --format=%B');
      expect(log).toMatch(/Closes #9003/);

      // Worktree cleaned up
      expect(fs.existsSync(wtPath)).toBe(false);
    } finally {
      rmrf(tmpDir);
    }
  }, 30_000);
});

// ─── Stale-SHA gate fix (#354) ───────────────────────────────────────────────
//
// Regression: tryLand() may rebase, rewriting the SHA captured before the loop.
// The gate must check the post-rebase HEAD, not the stale pre-loop value.
// Repro: push a concurrent commit to the remote BEFORE close.js runs, so
// tryLand()'s first rebase rewrites this agent's commit SHA.

describe('close.js e2e — stale-SHA gate fix (#354)', () => {
  test('closes cleanly when a concurrent push forces a rebase that rewrites the SHA', () => {
    const { tmpDir, mainPath, wtPath } = makeRepo('9010');
    try {
      // Simulate a concurrent agent: push an extra commit directly to the remote
      // so tryLand()'s rebase rebases this agent's commit onto it, rewriting the SHA.
      fs.writeFileSync(path.join(mainPath, 'concurrent.txt'), 'concurrent agent work\n');
      sh(mainPath, 'git add concurrent.txt');
      sh(mainPath, 'git commit -m "feat: concurrent agent commit"');
      sh(mainPath, 'git push origin main');
      // Reset main checkout so it doesn't interfere with close.js's internal pull
      sh(mainPath, 'git reset --hard origin/main');

      const preLandSha = sh(wtPath, 'git rev-parse HEAD').trim();
      const { ok, out } = shCapture(wtPath, `node "${CLOSE_JS}" 9010 --no-verify-issue --skip-velocity-check --skip-marker-check`);
      expect(ok).toBe(true);
      expect(out).toMatch(/CLOSED/);

      // The landed SHA on origin/main must be the post-rebase one (different from pre-loop SHA)
      sh(mainPath, 'git fetch origin main');
      const landedSha = sh(mainPath, 'git rev-parse origin/main').trim();
      expect(landedSha).not.toBe(preLandSha);

      // The close content is on origin/main
      const log = sh(mainPath, 'git log origin/main --format=%B');
      expect(log).toMatch(/Closes #9010/);

      // Worktree was removed (gate passed with the post-rebase SHA)
      expect(fs.existsSync(wtPath)).toBe(false);
    } finally {
      rmrf(tmpDir);
    }
  }, 30_000);
});

// ─── headClosesIssue via absolute path (dogfooding finding — #267 comment) ───

describe('close.js e2e — pre-flight accepts valid Closes #N via abs-path invocation', () => {
  // The dogfooding agent (#266) got a false negative from headClosesIssue when
  // invoking `node /abs/path/scripts/close.js 239` from inside a worktree.
  // CLOSE_JS is always absolute, so every test in this file exercises that path —
  // this test isolates just the --dry-run pre-flight so the failure mode is clear.
  test('--dry-run succeeds (pre-flight passes) when cwd is the worktree', () => {
    const { tmpDir, wtPath } = makeRepo('9004');
    try {
      const { ok, out } = shCapture(wtPath, `node "${CLOSE_JS}" 9004 --dry-run --skip-velocity-check --skip-marker-check`);
      expect(ok).toBe(true);
      expect(out).toMatch(/DRYRUN/);
    } finally {
      rmrf(tmpDir);
    }
  }, 15_000);
});

// ─── Pre-flight rejections ────────────────────────────────────────────────────

describe('close.js e2e — pre-flight rejections', () => {
  test('dies when HEAD lacks a Closes #N message', () => {
    const { tmpDir, wtPath } = makeRepo('9005');
    try {
      sh(wtPath, 'git commit --amend -m "fix: the thing (no closes)" --no-edit --allow-empty');
      // Override -m to drop the Closes line
      sh(wtPath, 'git commit --amend -m "fix: the thing (no closes keyword here)"');
      const { ok, out } = shCapture(wtPath, `node "${CLOSE_JS}" 9005 --dry-run`);
      expect(ok).toBe(false);
      expect(out).toMatch(/does not reference/i);
    } finally {
      rmrf(tmpDir);
    }
  }, 15_000);

  test('dies when run from the main checkout (not a worktree branch)', () => {
    const { tmpDir, mainPath } = makeRepo('9006');
    try {
      const { ok, out } = shCapture(mainPath, `node "${CLOSE_JS}" 9006 --dry-run`);
      expect(ok).toBe(false);
      expect(out).toMatch(/not a.*worktree.*branch/i);
    } finally {
      rmrf(tmpDir);
    }
  }, 15_000);

  test('dies when issue number does not match the worktree branch', () => {
    const { tmpDir, wtPath } = makeRepo('9007');
    try {
      // Pass a different issue number than the branch's issue-9007
      const { ok, out } = shCapture(wtPath, `node "${CLOSE_JS}" 1234 --dry-run`);
      expect(ok).toBe(false);
      expect(out).toMatch(/does not match issue/i);
    } finally {
      rmrf(tmpDir);
    }
  }, 15_000);

  test('--dry-run prints the plan without any git mutations', () => {
    const { tmpDir, mainPath, wtPath } = makeRepo('9008');
    try {
      const headBefore = sh(wtPath, 'git rev-parse HEAD').trim();
      const { ok, out } = shCapture(wtPath, `node "${CLOSE_JS}" 9008 --dry-run --skip-velocity-check --skip-marker-check`);
      expect(ok).toBe(true);
      expect(out).toMatch(/WOULD CLOSE/);
      expect(out).toMatch(/DRYRUN/);
      // No push happened — origin/main doesn't have this commit
      sh(mainPath, 'git fetch origin main');
      const log = shCapture(mainPath, 'git log origin/main --format=%B');
      expect(log.out).not.toMatch(/Closes #9008/);
      // HEAD unchanged in the worktree
      expect(sh(wtPath, 'git rev-parse HEAD').trim()).toBe(headBefore);
    } finally {
      rmrf(tmpDir);
    }
  }, 15_000);
});

// ─── Check A: velocity row required (#359) ───────────────────────────────────

describe('close.js e2e — Check A: velocity row required (#359)', () => {
  test('dies pre-flight when velocity DB has no row for the ticket', () => {
    // Use a high fake issue number that will never be in the real DB.
    const { tmpDir, wtPath } = makeRepo('99991');
    try {
      const { ok, out } = shCapture(wtPath, `node "${CLOSE_JS}" 99991 --no-verify-issue --skip-marker-check`);
      expect(ok).toBe(false);
      expect(out).toMatch(/no velocity row found/i);
      // #804: error must include a pre-filled skeleton with the ticket number
      expect(out).toMatch(/npm run velocity:log/);
      expect(out).toMatch(/"ticket":99991/);
      expect(out).toMatch(/npm run close 99991/);
    } finally {
      rmrf(tmpDir);
    }
  }, 15_000);

  test('--skip-velocity-check bypasses the check and allows the close to proceed', () => {
    const { tmpDir, wtPath } = makeRepo('99992');
    try {
      const { ok, out } = shCapture(
        wtPath,
        `node "${CLOSE_JS}" 99992 --no-verify-issue --skip-velocity-check --skip-marker-check`
      );
      expect(ok).toBe(true);
      expect(out).toMatch(/CLOSED/);
    } finally {
      rmrf(tmpDir);
    }
  }, 30_000);
});

// ─── Check B: marker must be deleted (#359) ──────────────────────────────────

describe('close.js e2e — Check B: marker must be deleted (#359)', () => {
  test('dies pre-flight when a @todo marker for the ticket still exists in a JS file', () => {
    const { tmpDir, wtPath } = makeRepo('99993');
    try {
      // Plant a @todo marker in a tracked JS file inside the temp worktree.
      fs.writeFileSync(
        path.join(wtPath, 'marker.js'),
        '// @todo #99993:10/DEV fix this\n'
      );
      sh(wtPath, 'git add marker.js');
      sh(wtPath, 'git commit --amend --no-edit');

      const { ok, out } = shCapture(
        wtPath,
        `node "${CLOSE_JS}" 99993 --no-verify-issue --skip-velocity-check`
      );
      expect(ok).toBe(false);
      expect(out).toMatch(/puzzle marker.*still present/i);
      expect(out).toMatch(/marker\.js/);
    } finally {
      rmrf(tmpDir);
    }
  }, 15_000);

  test('--skip-marker-check bypasses the check and allows the close to proceed', () => {
    const { tmpDir, wtPath } = makeRepo('99994');
    try {
      // Plant a @todo marker that would normally block the close.
      fs.writeFileSync(path.join(wtPath, 'marker.js'), '// @todo #99994:10/DEV\n');
      sh(wtPath, 'git add marker.js');
      sh(wtPath, 'git commit --amend --no-edit');

      const { ok, out } = shCapture(
        wtPath,
        `node "${CLOSE_JS}" 99994 --no-verify-issue --skip-velocity-check --skip-marker-check`
      );
      expect(ok).toBe(true);
      expect(out).toMatch(/CLOSED/);
    } finally {
      rmrf(tmpDir);
    }
  }, 30_000);

  test('passes when no marker file exists (docs-only close has no marker)', () => {
    const { tmpDir, wtPath } = makeRepo('99995');
    try {
      // The default makeRepo has no JS marker file — grep returns no matches.
      const { ok, out } = shCapture(
        wtPath,
        `node "${CLOSE_JS}" 99995 --no-verify-issue --skip-velocity-check`
      );
      expect(ok).toBe(true);
      expect(out).toMatch(/CLOSED/);
    } finally {
      rmrf(tmpDir);
    }
  }, 30_000);
});

// ─── npm run close exit-code regression (#434) ───────────────────────────────

describe('close.js e2e — npm wrapper exit code (#434)', () => {
  test('npm run close exits 0 after successful close (worktree CWD deleted)', () => {
    // Regression: before #434, `npm run close N` exited 1 even when CLOSE OK
    // was printed, because npm's process had CWD = worktree and called getcwd()
    // after the worktree was deleted. Fix: package.json "close" entry now invokes
    // `node scripts/close.js` directly, so no bash/sh intermediate layer holds
    // a stale CWD reference.
    // makeRepoWithPkg includes a committed package.json in the initial commit so the
    // working tree is clean and `npm run close` works inside the worktree.
    const { tmpDir, wtPath } = makeRepoWithPkg('9012');
    try {
      const { ok, out } = shCapture(
        wtPath,
        'npm run close -- 9012 --no-verify-issue --skip-velocity-check --skip-marker-check'
      );
      expect(ok).toBe(true);
      expect(out).toMatch(/CLOSE OK/);
      expect(fs.existsSync(wtPath)).toBe(false);
    } finally {
      rmrf(tmpDir);
    }
  }, 30_000);
});
