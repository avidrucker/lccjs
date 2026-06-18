'use strict';

// Regression guard for #1111: a worktree's `node_modules` SYMLINK must be
// ignored by the project .gitignore. Worktrees get no node_modules (it's
// gitignored, not copied), so agents symlink it to run builds/tests:
//   ln -s <main>/node_modules node_modules
// A trailing-slash pattern (`node_modules/`) matches only a *directory*, so the
// symlink slipped past it — showing as `?? node_modules`, getting staged by
// `git add -A`, and tripping `npm run close`'s clean-tree gate (`working tree is
// not clean`). Bare `node_modules` (no slash) ignores the symlink too.
//
// This test stands up a throwaway git repo seeded with the REAL project
// .gitignore, drops a `node_modules` symlink, and asserts `git status` stays
// clean — so re-adding the trailing slash regresses loudly. Serial-safe; own
// tmpdir. Run:  npm test -- --runTestsByPath tests/new/gitignore.node-modules-symlink.e2e.spec.js

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT_GITIGNORE = path.resolve(__dirname, '../../.gitignore');

function sh(cwd, cmd) {
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: 'pipe' });
}

describe('#1111 node_modules symlink is gitignored', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-gitignore-nm-'));
    sh(tmpDir, 'git init -q');
    sh(tmpDir, 'git config user.email "test@example.com"');
    sh(tmpDir, 'git config user.name "Test"');
    // Seed with the actual project .gitignore so the test tracks reality.
    fs.copyFileSync(PROJECT_GITIGNORE, path.join(tmpDir, '.gitignore'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('a `node_modules` SYMLINK does not show up in git status', () => {
    // Symlink target need not exist for git's ignore matching; point it at a
    // sibling dir to mirror the real `ln -s <main>/node_modules` usage.
    const target = path.join(tmpDir, 'real-node-modules');
    fs.mkdirSync(target);
    fs.symlinkSync(target, path.join(tmpDir, 'node_modules'));

    const status = sh(tmpDir, 'git status --porcelain');
    expect(status).not.toMatch(/node_modules/);
  });

  test('git add -A does not stage the `node_modules` symlink', () => {
    fs.symlinkSync(path.join(tmpDir, 'real-node-modules'), path.join(tmpDir, 'node_modules'));
    sh(tmpDir, 'git add -A');
    const staged = sh(tmpDir, 'git diff --cached --name-only');
    expect(staged).not.toMatch(/node_modules/);
  });

  test('a real `node_modules` DIRECTORY is still ignored (no regression)', () => {
    fs.mkdirSync(path.join(tmpDir, 'node_modules'));
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'pkg.js'), '// dep\n');
    const status = sh(tmpDir, 'git status --porcelain');
    expect(status).not.toMatch(/node_modules/);
  });
});
