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
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/worktrees/', '<rootDir>/.claire/worktrees/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/worktrees/', '<rootDir>/.claire/worktrees/'],
};
