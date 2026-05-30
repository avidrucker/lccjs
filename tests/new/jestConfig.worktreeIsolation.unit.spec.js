// Regression guard for #247: a Jest run must only ever exercise the checkout it
// is invoked from. Sibling git worktrees live under
// <repo>/.claude/worktrees/<agent>-issue-N/ and carry their own tests/; without
// the ignore patterns in jest.config.js, `jest tests/new` from main would
// substring-match those paths and run another agent's in-progress tests.
//
// The patterns MUST be <rootDir>-anchored. A bare '/.claude/worktrees/' would
// also match a worktree's OWN test paths when Jest is run from inside that
// worktree, silently skipping every test there. These tests replicate Jest's
// actual matching (substitute <rootDir>, then RegExp.test the path) so the
// anchoring can never regress.

const path = require('path');
const config = require('../../jest.config.js');

// Mirror Jest's path-ignore semantics: a path is ignored iff some pattern,
// after <rootDir> substitution, matches it as a RegExp.
function isIgnored(patterns, rootDir, testPath) {
  return (patterns || []).some((p) => {
    const expanded = p.replace(/<rootDir>/g, rootDir);
    return new RegExp(expanded).test(testPath);
  });
}

describe('#247 jest.config.js worktree isolation', () => {
  const mainRoot = '/home/dev/lccjs';
  const worktreeRoot = `${mainRoot}/.claude/worktrees/banana-issue-227`;

  test('testPathIgnorePatterns is set and re-lists node_modules (overriding the default drops it)', () => {
    expect(Array.isArray(config.testPathIgnorePatterns)).toBe(true);
    expect(isIgnored(config.testPathIgnorePatterns, mainRoot, `${mainRoot}/node_modules/foo/bar.spec.js`)).toBe(true);
  });

  test('a run FROM MAIN ignores sibling-worktree tests', () => {
    const leaked = `${mainRoot}/.claude/worktrees/banana-issue-227/tests/new/claim.spec.js`;
    expect(isIgnored(config.testPathIgnorePatterns, mainRoot, leaked)).toBe(true);
  });

  test("a run FROM MAIN still collects main's own tests", () => {
    const own = `${mainRoot}/tests/new/assembler.unit.spec.js`;
    expect(isIgnored(config.testPathIgnorePatterns, mainRoot, own)).toBe(false);
  });

  test('a run FROM A WORKTREE does NOT self-exclude its own tests (the <rootDir>-anchoring guarantee)', () => {
    // rootDir = the worktree itself; its own test path must NOT be ignored.
    const ownInWorktree = `${worktreeRoot}/tests/new/assembler.unit.spec.js`;
    expect(isIgnored(config.testPathIgnorePatterns, worktreeRoot, ownInWorktree)).toBe(false);
  });

  test('the worktree pattern is <rootDir>-anchored, not a bare match', () => {
    const hasAnchored = (config.testPathIgnorePatterns || [])
      .some((p) => /<rootDir>[\\/]*\.claude[\\/]worktrees/.test(p));
    expect(hasAnchored).toBe(true);
    // a bare (un-anchored) .claude/worktrees pattern would be the #247 regression
    const hasBare = (config.testPathIgnorePatterns || [])
      .some((p) => !p.includes('<rootDir>') && p.includes('.claude/worktrees'));
    expect(hasBare).toBe(false);
  });

  test('modulePathIgnorePatterns also excludes worktrees (no Haste/require resolution into them)', () => {
    expect(isIgnored(config.modulePathIgnorePatterns, mainRoot,
      `${mainRoot}/.claude/worktrees/banana-issue-227/src/core/assembler.js`)).toBe(true);
    expect(isIgnored(config.modulePathIgnorePatterns, worktreeRoot,
      `${worktreeRoot}/src/core/assembler.js`)).toBe(false);
  });
});
