module.exports = {
  maxWorkers: 1,
  // Force jest to call process.exit() after all tests complete, regardless of
  // open handles. Prevents a deadlock when an external process (e.g. babashka)
  // spawns `npm test` with an open stdin pipe — jest finishes but never exits
  // because the event loop never drains while the pipe is held open. (#435)
  forceExit: true,
  // Only ever run/resolve tests from the checkout Jest is invoked from. Sibling
  // git worktrees live under <repo>/.claude/worktrees/<agent>-issue-N/ (or the
  // legacy <repo>/.claire/worktrees/) and carry their own copy of tests/; without
  // this, `jest tests/new` from main would substring-match those paths and run
  // another agent's in-progress (possibly failing) tests (#247, #943).
  //
  // The pattern is anchored with <rootDir> ON PURPOSE: <rootDir> resolves to the
  // invoking checkout (this config file's dir), so a run from MAIN excludes
  // <main>/.claude/worktrees/*, while a run from inside a worktree has
  // rootDir = that worktree and is NOT self-excluded (its own tests still run).
  // A bare '/.claude/worktrees/' would wrongly skip every worktree-local run.
  // Playwright-owned specs require('playwright/test'), whose test.describe() has an
  // intentional throwIfRunningInsideJest guard — they throw at load under the jest
  // runner by design (incompatible runners). They run via `npm run test:browser`
  // (playwright test tests/browser/) and `npm run test:e2e`. Excluded here so the
  // no-path `test:all` (bare jest) stays clean. NOTE: the boundary is by DIRECTORY,
  // not content — keep Playwright specs in tests/browser/ or tests/e2e/; a Playwright
  // spec dropped into tests/new/ would slip past this ignore (#1434).
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/.claude/worktrees/', '<rootDir>/.claire/worktrees/',
    '<rootDir>/tests/browser/',
    '<rootDir>/tests/e2e/',
  ],
  modulePathIgnorePatterns: ['<rootDir>/.claude/worktrees/', '<rootDir>/.claire/worktrees/'],
};
