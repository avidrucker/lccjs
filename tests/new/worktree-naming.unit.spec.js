'use strict';

// Unit tests for scripts/worktree-naming.js (#1464, tracker #1461). Locks the
// back-compat invariant: legacy `<agent>/issue-<N>` + `<agent>-issue-<N>` AND the
// new `br-<agent>/<project>-<lang>-issue-<N>` + `wt-<agent>-<project>-<lang>-issue-<N>`
// forms parse to the same {agent, issue}. Regexes must stay identical to pmtools.

const {
  parseBranch, parseWorktreeDir, agentFromBranch,
  mkBranch, mkWorktreeDirName, worktreeDirForBranch,
  langToken, projectLang,
} = require('../../scripts/worktree-naming');

describe('parseBranch()', () => {
  test('legacy <fruit>/issue-N', () => {
    expect(parseBranch('apple/issue-1464')).toEqual({ agent: 'apple', project: null, lang: null, issue: 1464, theme: null });
  });
  test('legacy with theme slug', () => {
    expect(parseBranch('apple/issue-1464-foo-bar')).toEqual({ agent: 'apple', project: null, lang: null, issue: 1464, theme: 'foo-bar' });
  });
  test('new br-<agent>/<project>-<lang>-issue-N', () => {
    expect(parseBranch('br-banana/lccjs-js-issue-1461')).toEqual({ agent: 'banana', project: 'lccjs', lang: 'js', issue: 1461, theme: null });
  });
  test('new form with theme', () => {
    expect(parseBranch('br-banana/lccjs-js-issue-1461-foo')).toEqual({ agent: 'banana', project: 'lccjs', lang: 'js', issue: 1461, theme: 'foo' });
  });
  test('non-issue branches do not parse', () => {
    expect(parseBranch('main')).toBeNull();
    expect(parseBranch('apple/session')).toBeNull();
    expect(parseBranch('')).toBeNull();
    expect(parseBranch(null)).toBeNull();
  });
});

describe('parseWorktreeDir()', () => {
  test('legacy <agent>-issue-N', () => {
    expect(parseWorktreeDir('apple-issue-1464')).toEqual({ agent: 'apple', project: null, lang: null, issue: 1464 });
  });
  test('new wt-<agent>-<project>-<lang>-issue-N', () => {
    expect(parseWorktreeDir('wt-banana-lccjs-js-issue-1461')).toEqual({ agent: 'banana', project: 'lccjs', lang: 'js', issue: 1461 });
  });
  test('does not misparse legacy digits as lang', () => {
    // `issue`/`1464` must NOT be captured as project/lang (no trailing `-`).
    expect(parseWorktreeDir('apple-issue-1464').project).toBeNull();
  });
});

describe('back-compat invariant — legacy and new resolve to the same {agent, issue}', () => {
  const cases = [
    ['apple/issue-1464', 'br-apple/lccjs-js-issue-1464'],
    ['apple-issue-1464', 'wt-apple-lccjs-js-issue-1464'],
  ];
  test.each(cases)('%s ≡ %s', (legacy, modern) => {
    const a = legacy.includes('/') ? parseBranch(legacy) : parseWorktreeDir(legacy);
    const b = modern.includes('/') ? parseBranch(modern) : parseWorktreeDir(modern);
    expect({ agent: a.agent, issue: a.issue }).toEqual({ agent: 'apple', issue: 1464 });
    expect({ agent: b.agent, issue: b.issue }).toEqual({ agent: 'apple', issue: 1464 });
  });
});

describe('agentFromBranch()', () => {
  test('strips the br- prefix; works on both forms', () => {
    expect(agentFromBranch('apple/issue-1464')).toBe('apple');
    expect(agentFromBranch('br-apple/lccjs-js-issue-1464')).toBe('apple');
  });
  test('null for non-issue branches', () => {
    expect(agentFromBranch('main')).toBeNull();
    expect(agentFromBranch('apple/session')).toBeNull();
  });
});

describe('langToken() / projectLang()', () => {
  test('known + unknown + empty tags', () => {
    expect(langToken('javascript')).toBe('js');
    expect(langToken('Python')).toBe('py');
    expect(langToken('elixir')).toBe('elixir'); // unknown → lowercased passthrough
    expect(langToken(null)).toBe('x');
  });
  test('explicit project key wins; else repo-basename fallback', () => {
    expect(projectLang({ project: 'lccjs', languages: ['javascript'] }, 'whatever')).toEqual({ project: 'lccjs', lang: 'js' });
    expect(projectLang({ languages: ['javascript'] }, 'lccjs')).toEqual({ project: 'lccjs', lang: 'js' });
    expect(projectLang({}, 'lccjs')).toEqual({ project: 'lccjs', lang: 'x' });
  });
});

describe('construction (consumed by #1465)', () => {
  test('mkBranch / mkWorktreeDirName produce the new forms', () => {
    const fields = { agent: 'apple', project: 'lccjs', lang: 'js', issue: 1465 };
    expect(mkBranch(fields)).toBe('br-apple/lccjs-js-issue-1465');
    expect(mkBranch({ ...fields, theme: 'foo' })).toBe('br-apple/lccjs-js-issue-1465-foo');
    expect(mkWorktreeDirName(fields)).toBe('wt-apple-lccjs-js-issue-1465');
  });
  test('mkBranch then parseBranch round-trips', () => {
    const b = mkBranch({ agent: 'fig', project: 'lccjs', lang: 'js', issue: 7, theme: 'x' });
    expect(parseBranch(b)).toEqual({ agent: 'fig', project: 'lccjs', lang: 'js', issue: 7, theme: 'x' });
  });
});

describe('worktreeDirForBranch() — reconstruct the dir that mirrors a branch', () => {
  test('new br- branch → wt- dir', () => {
    expect(worktreeDirForBranch('br-apple/lccjs-js-issue-1464')).toBe('wt-apple-lccjs-js-issue-1464');
  });
  test('legacy branch → <agent>-issue-N dir', () => {
    expect(worktreeDirForBranch('apple/issue-1464')).toBe('apple-issue-1464');
    expect(worktreeDirForBranch('apple/issue-1464-some-theme')).toBe('apple-issue-1464');
  });
  test('null for an unparseable branch', () => {
    expect(worktreeDirForBranch('main')).toBeNull();
  });
});
