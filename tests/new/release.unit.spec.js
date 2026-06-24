'use strict';

// Unit tests for scripts/release.js pure seams (#1437). The e2e teardown behavior
// (worktree removal, claim-ref push, data-loss guard) is exercised manually and
// shares close.js's battle-tested machinery; these specs lock down the parsing
// logic where boundary bugs hide — especially the issue-number matching that must
// not let `issue-9` match `issue-99` or `issue-143` match `issue-1437`.

const {
  parseArgs, listWorktrees, findWorktreeForIssue, mainRoot,
} = require('../../scripts/release');

describe('release.js parseArgs()', () => {
  test('bare issue number', () => {
    expect(parseArgs(['1437'])).toEqual({ issue: 1437, force: false });
  });
  test('issue + --force, either order', () => {
    expect(parseArgs(['1437', '--force'])).toEqual({ issue: 1437, force: true });
    expect(parseArgs(['--force', '1437'])).toEqual({ issue: 1437, force: true });
  });
  test('a lone -- separator is ignored', () => {
    expect(parseArgs(['--', '1437', '--force'])).toEqual({ issue: 1437, force: true });
  });

  describe('rejects bad input (exit 1)', () => {
    let exitSpy;
    let errSpy;
    beforeEach(() => {
      errSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => { throw new Error(`exit:${code}`); });
    });
    afterEach(() => { exitSpy.mockRestore(); errSpy.mockRestore(); });

    test('no issue number', () => { expect(() => parseArgs([])).toThrow('exit:1'); });
    test('unknown flag', () => { expect(() => parseArgs(['1437', '--nope'])).toThrow('exit:1'); });
    test('two issue numbers', () => { expect(() => parseArgs(['1', '2'])).toThrow('exit:1'); });
  });
});

describe('release.js listWorktrees()', () => {
  const PORCELAIN = [
    'worktree /repo', 'HEAD abc', 'branch refs/heads/main', '',
    'worktree /repo/.claude/worktrees/apple-issue-1437',
    'HEAD def', 'branch refs/heads/apple/issue-1437-add-release', '',
    'worktree /repo/.claude/worktrees/detached', 'HEAD 999', 'detached', '',
  ].join('\n');

  test('parses path + short branch; a detached entry has null branch', () => {
    expect(listWorktrees(PORCELAIN)).toEqual([
      { path: '/repo', branch: 'main' },
      { path: '/repo/.claude/worktrees/apple-issue-1437', branch: 'apple/issue-1437-add-release' },
      { path: '/repo/.claude/worktrees/detached', branch: null },
    ]);
  });
});

describe('release.js findWorktreeForIssue()', () => {
  const rows = [
    { path: '/repo', branch: 'main' }, // main entry — must never be matched
    { path: '/r/.claude/worktrees/apple-issue-1437', branch: 'apple/issue-1437-add-release' },
    { path: '/r/.claude/worktrees/banana-issue-99', branch: 'banana/issue-99' },
  ];

  test('matches by branch <agent>/issue-<N> with a trailing slug', () => {
    expect(findWorktreeForIssue(rows, 1437)).toBe(rows[1]);
  });
  test('matches an exact issue-<N> with no slug', () => {
    expect(findWorktreeForIssue(rows, 99)).toBe(rows[2]);
  });
  test('does NOT match a numeric prefix: issue-9 must not hit issue-99', () => {
    expect(findWorktreeForIssue(rows, 9)).toBeNull();
  });
  test('does NOT match issue-143 against issue-1437 (digit boundary)', () => {
    expect(findWorktreeForIssue(rows, 143)).toBeNull();
  });
  test('falls back to the path basename -issue-<N> when the branch is absent', () => {
    const r = [{ path: '/repo', branch: 'main' }, { path: '/x/cherry-issue-50', branch: null }];
    expect(findWorktreeForIssue(r, 50)).toBe(r[1]);
  });
  test('skips the main entry (rows[0]) even if it would otherwise match', () => {
    const r = [{ path: '/x/apple-issue-7', branch: 'apple/issue-7' }];
    expect(findWorktreeForIssue(r, 7)).toBeNull();
  });
  test('returns null when no worktree matches the issue', () => {
    expect(findWorktreeForIssue(rows, 12345)).toBeNull();
  });
  test('resolves the new self-describing scheme (#1460/#1464): br-/wt- forms', () => {
    const r = [
      { path: '/repo', branch: 'main' },
      { path: '/r/.claude/worktrees/wt-apple-lccjs-js-issue-1464', branch: 'br-apple/lccjs-js-issue-1464' },
    ];
    expect(findWorktreeForIssue(r, 1464)).toBe(r[1]);
    // boundary still holds against the longer new form
    expect(findWorktreeForIssue(r, 146)).toBeNull();
  });
});

describe('release.js mainRoot()', () => {
  test('returns the first worktree entry path (git lists main first)', () => {
    expect(mainRoot([{ path: '/repo', branch: 'main' }, { path: '/x', branch: 'y' }])).toBe('/repo');
  });
});
