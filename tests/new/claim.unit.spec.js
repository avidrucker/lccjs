const {
  parseArgs,
  normalizeIdentity,
  inferFruitFromBranch,
  resolveIdentity,
  checkIdentityName,
  assessBaseStaleness,
  sentinelBranch,
  isSentinelStaleByAge,
  applyMarkerFlip,
  buildBannerLines,
  worktreesWithIssue,
} = require('../../scripts/claim');

// Pure identity-resolution seam from scripts/claim.js. These tests exercise the
// precedence contract (#212: --as > CLAUDE_AGENT_NAME > auto) without shelling
// out to git — the worktree-staking path in main() is not under test here.
describe('claim.js identity resolution', () => {
  describe('normalizeIdentity()', () => {
    test('lowercases and trims (env names are conventionally uppercase)', () => {
      expect(normalizeIdentity('  DRAGONFRUIT  ')).toBe('dragonfruit');
    });

    test('leaves an already-lowercase fruit unchanged', () => {
      expect(normalizeIdentity('banana')).toBe('banana');
    });
  });

  describe('resolveIdentity() precedence', () => {
    test('--as is the explicit override and wins over the env var', () => {
      const id = resolveIdentity({ as: 'cherry' }, { CLAUDE_AGENT_NAME: 'dragonfruit' });
      expect(id).toMatchObject({ name: 'cherry', source: 'as' });
      expect(id.modeLabel).toMatch(/--as/);
    });

    test('CLAUDE_AGENT_NAME is the human-directed default when --as is absent', () => {
      const id = resolveIdentity({ as: null }, { CLAUDE_AGENT_NAME: 'DRAGONFRUIT' });
      // Forced (non-null) identity, normalized to a branch-safe lowercase token.
      expect(id).toMatchObject({ name: 'dragonfruit', source: 'env' });
      expect(id.modeLabel).toMatch(/env/);
    });

    test('no --as and no env var falls back to auto (name === null)', () => {
      const id = resolveIdentity({ as: null }, {});
      expect(id).toMatchObject({ name: null, source: 'auto' });
    });

    test('a whitespace-only env var is treated as unset (auto fallback)', () => {
      const id = resolveIdentity({ as: null }, { CLAUDE_AGENT_NAME: '   ' });
      expect(id.name).toBeNull();
      expect(id.source).toBe('auto');
    });

    test('a non-fruit human name is honored verbatim (only normalized, not rejected)', () => {
      const id = resolveIdentity({ as: null }, { CLAUDE_AGENT_NAME: 'Pineapple' });
      expect(id.name).toBe('pineapple');
    });
  });

  describe('parseArgs()', () => {
    test('parses the issue number and an explicit --as override', () => {
      const opts = parseArgs(['212', 'some-slug', '--as', 'banana']);
      expect(opts).toMatchObject({ issue: '212', slug: 'some-slug', as: 'banana' });
    });

    test('leaves as null when --as is omitted', () => {
      const opts = parseArgs(['212']);
      expect(opts.as).toBeNull();
    });

    test('--allow-stale-main sets the bypass flag (default false)', () => {
      expect(parseArgs(['228']).allowStaleMain).toBe(false);
      expect(parseArgs(['228', '--allow-stale-main']).allowStaleMain).toBe(true);
    });
  });

  // #315: branch-inference tier — pure helper + resolveIdentity precedence
  describe('inferFruitFromBranch()', () => {
    test('extracts fruit from a canonical worktree branch', () => {
      expect(inferFruitFromBranch('cherry/issue-180-some-slug')).toBe('cherry');
    });

    test('extracts fruit when branch has no slug tail', () => {
      expect(inferFruitFromBranch('apple/issue-99')).toBe('apple');
    });

    test('returns null for main', () => {
      expect(inferFruitFromBranch('main')).toBeNull();
    });

    test('returns null for a feature branch without issue-N', () => {
      expect(inferFruitFromBranch('feature/some-thing')).toBeNull();
    });

    test('returns null for null / undefined', () => {
      expect(inferFruitFromBranch(null)).toBeNull();
      expect(inferFruitFromBranch(undefined)).toBeNull();
    });
  });

  describe('resolveIdentity() branch-inference precedence (#315)', () => {
    test('branch-inferred fires when --as and env are both absent', () => {
      const id = resolveIdentity({ as: null }, {}, 'cherry/issue-180-slug');
      expect(id).toMatchObject({ name: 'cherry', source: 'branch' });
      expect(id.modeLabel).toMatch(/branch/);
    });

    test('--as wins over branch-inferred', () => {
      const id = resolveIdentity({ as: 'apple' }, {}, 'cherry/issue-180-slug');
      expect(id).toMatchObject({ name: 'apple', source: 'as' });
    });

    test('CLAUDE_AGENT_NAME wins over branch-inferred', () => {
      const id = resolveIdentity({ as: null }, { CLAUDE_AGENT_NAME: 'dragonfruit' }, 'cherry/issue-180-slug');
      expect(id).toMatchObject({ name: 'dragonfruit', source: 'env' });
    });

    test('non-fruit-issue branch falls through to auto', () => {
      const id = resolveIdentity({ as: null }, {}, 'main');
      expect(id).toMatchObject({ name: null, source: 'auto' });
    });

    test('null branch falls through to auto', () => {
      const id = resolveIdentity({ as: null }, {}, null);
      expect(id).toMatchObject({ name: null, source: 'auto' });
    });

    test('existing auto test still passes with explicit null branch arg', () => {
      const id = resolveIdentity({ as: null }, {});
      expect(id).toMatchObject({ name: null, source: 'auto' });
    });
  });

  // #366: Option C — checkIdentityName() and parseArgs --custom
  describe('parseArgs() --custom flag', () => {
    test('defaults to false when --custom is absent', () => {
      expect(parseArgs(['212']).custom).toBe(false);
    });

    test('sets custom=true when --custom is present', () => {
      expect(parseArgs(['212', '--as', 'dragonfruit', '--custom']).custom).toBe(true);
    });
  });

  describe('checkIdentityName() — Option C validation (#366)', () => {
    test('known fruit via --as → null (no action)', () => {
      expect(checkIdentityName({ name: 'apple', source: 'as' }, { custom: false })).toBeNull();
    });

    test('unknown name via --as without --custom → error with valid-names list', () => {
      const result = checkIdentityName({ name: 'durian', source: 'as' }, { custom: false });
      expect(result).toHaveProperty('error');
      expect(result.error).toMatch(/not a recognised agent name/);
      expect(result.error).toMatch(/apple.*banana.*cherry/);
      expect(result.error).toMatch(/--custom/);
      expect(result.error).not.toHaveProperty('warn');
    });

    test('unknown name via --as with --custom → warn (proceed)', () => {
      const result = checkIdentityName({ name: 'dragonfruit', source: 'as' }, { custom: true });
      expect(result).toHaveProperty('warn');
      expect(result.error).toBeUndefined();
    });

    test('unknown name via env → warn regardless of --custom (env is not --as)', () => {
      const result = checkIdentityName({ name: 'dragonfruit', source: 'env' }, { custom: false });
      expect(result).toHaveProperty('warn');
      expect(result.error).toBeUndefined();
    });

    test('unknown name via branch-inference → warn (already existed from prior claim)', () => {
      const result = checkIdentityName({ name: 'dragonfruit', source: 'branch' }, { custom: false });
      expect(result).toHaveProperty('warn');
      expect(result.error).toBeUndefined();
    });

    test('auto source (name null) → null', () => {
      expect(checkIdentityName({ name: null, source: 'auto' }, { custom: false })).toBeNull();
    });

    test('known fruit via env → null', () => {
      expect(checkIdentityName({ name: 'cherry', source: 'env' }, { custom: false })).toBeNull();
    });
  });

  // #228: the stale-main guard's decision logic, exercised without shelling out to
  // git. main() does the fetch + rev-list; this pure seam decides on the count.
  describe('assessBaseStaleness() — #228 stale-main guard', () => {
    test('a local main base behind origin/main is flagged stale', () => {
      expect(assessBaseStaleness('main', 3)).toMatchObject({ checksRemote: true, behind: 3, stale: true });
    });

    test('a local main base level with origin/main is fresh', () => {
      expect(assessBaseStaleness('main', 0).stale).toBe(false);
    });

    test('an explicit origin/* base is never flagged (already remote-fresh)', () => {
      expect(assessBaseStaleness('origin/main', 5)).toMatchObject({ checksRemote: false, stale: false });
    });

    test('a non-main base is not checked', () => {
      expect(assessBaseStaleness('some-tag', 2).stale).toBe(false);
    });

    test('an un-knowable (non-numeric) behind count is treated as 0 → proceed', () => {
      expect(assessBaseStaleness('main', NaN).stale).toBe(false);
    });
  });

  // #194: session-sentinel helpers — pure seams only (git I/O paths not tested here)
  describe('sentinelBranch()', () => {
    test('returns <fruit>/session', () => {
      expect(sentinelBranch('apple')).toBe('apple/session');
      expect(sentinelBranch('dragonfruit')).toBe('dragonfruit/session');
    });
  });

  describe('isSentinelStaleByAge()', () => {
    const WEEK_S = 7 * 24 * 60 * 60;
    const now = 1_700_000_000;

    test('fresh sentinel (1 hour old) → not stale', () => {
      expect(isSentinelStaleByAge(now - 3_600, now, WEEK_S)).toBe(false);
    });

    test('stale sentinel (one second past max age) → stale', () => {
      expect(isSentinelStaleByAge(now - WEEK_S - 1, now, WEEK_S)).toBe(true);
    });

    test('sentinel exactly at max age → not stale', () => {
      expect(isSentinelStaleByAge(now - WEEK_S, now, WEEK_S)).toBe(false);
    });

    test('NaN timestamp → stale (non-finite = unreadable, free the fruit)', () => {
      expect(isSentinelStaleByAge(NaN, now, WEEK_S)).toBe(true);
    });

    test('Infinity timestamp → stale (non-finite = unreadable, free the fruit)', () => {
      expect(isSentinelStaleByAge(Infinity, now, WEEK_S)).toBe(true);
    });

    test('uses SESSION_SENTINEL_MAX_AGE_S as default when maxAgeS omitted', () => {
      // 6 days old → not stale under the 7-day default
      expect(isSentinelStaleByAge(now - 6 * 24 * 3600, now)).toBe(false);
      // 8 days old → stale under the 7-day default
      expect(isSentinelStaleByAge(now - 8 * 24 * 3600, now)).toBe(true);
    });
  });
});

// #565: applyMarkerFlip() — pure seam for @todo→@inprogress rewrite.
// flipMarker() (the I/O wrapper) is not tested here; git/fs calls keep it integration-only.
describe('applyMarkerFlip()', () => {
  test('flips @todo to @inprogress, preserving the :Est/ROLE remainder', () => {
    const content = '// @todo #42:30m/DEV fix the thing\n';
    const { updated, flipped, line } = applyMarkerFlip(content, '42');
    expect(flipped).toBe(true);
    expect(line).toBe(1);
    expect(updated).toBe('// @inprogress #42:30m/DEV fix the thing\n');
  });

  test('does not match a larger issue number (@todo #420 must not match issue 42)', () => {
    const { flipped } = applyMarkerFlip('// @todo #420:30m/DEV\n', '42');
    expect(flipped).toBe(false);
  });

  test('matches when marker is at end of line with no trailing character', () => {
    const { flipped, updated } = applyMarkerFlip('// @todo #99\n', '99');
    expect(flipped).toBe(true);
    expect(updated).toBe('// @inprogress #99\n');
  });

  test('returns content unchanged and flipped=false when no marker present', () => {
    const content = 'no markers here\n';
    const { updated, flipped } = applyMarkerFlip(content, '42');
    expect(flipped).toBe(false);
    expect(updated).toBe(content);
  });

  test('reports the correct 1-indexed line number for multi-line content', () => {
    const content = 'line one\nline two\n// @todo #7:15m/DEV something\nline four\n';
    const { line } = applyMarkerFlip(content, '7');
    expect(line).toBe(3);
  });

  test('does not match @inprogress — already-flipped content returns flipped=false', () => {
    const { flipped } = applyMarkerFlip('// @inprogress #42:30m/DEV fix the thing\n', '42');
    expect(flipped).toBe(false);
  });

  test('only flips the first occurrence when multiple @todo #N lines exist', () => {
    const content = '// @todo #5:10m/DEV first\n// @todo #5:10m/DEV second\n';
    const { updated } = applyMarkerFlip(content, '5');
    expect(updated).toBe('// @inprogress #5:10m/DEV first\n// @todo #5:10m/DEV second\n');
  });
});

// #661: CLAIMED banner comment-count pickup prompt
describe('buildBannerLines() — comment hint (#661)', () => {
  const BASE_ARGS = ['apple', 'apple/issue-42', '/home/user/.claude/worktrees/apple-issue-42', 'main', 'reuse (--as)', false];

  test('includes comments line when commentCount > 0', () => {
    const lines = buildBannerLines(...BASE_ARGS, 3, '42');
    expect(lines.some((l) => l.includes('comments  3'))).toBe(true);
    expect(lines.some((l) => l.includes('gh issue view 42 --comments'))).toBe(true);
  });

  test('omits comments line when commentCount is 0', () => {
    const lines = buildBannerLines(...BASE_ARGS, 0, '42');
    expect(lines.some((l) => /comments/.test(l))).toBe(false);
  });

  test('omits comments line when commentCount is absent (undefined)', () => {
    const lines = buildBannerLines(...BASE_ARGS, undefined, '42');
    expect(lines.some((l) => /comments/.test(l))).toBe(false);
  });

  test('comments line references the correct issue number', () => {
    const lines = buildBannerLines(...BASE_ARGS, 5, '99');
    const commentLine = lines.find((l) => l.includes('comments'));
    expect(commentLine).toMatch(/gh issue view 99 --comments/);
  });
});

// #665: orphan worktree detection — pure seam for the warnOrphanedWorktrees() I/O
// wrapper. Tests confirm branch-filtering without any gh or git I/O.
describe('worktreesWithIssue() — orphan detection seam (#665)', () => {
  test('extracts issue from a canonical worktree branch', () => {
    const input = [{ branch: 'apple/issue-637-closing-comment', fruit: 'apple' }];
    expect(worktreesWithIssue(input)).toEqual([
      { branch: 'apple/issue-637-closing-comment', fruit: 'apple', issue: 637 },
    ]);
  });

  test('skips main branch (no /issue-N pattern)', () => {
    expect(worktreesWithIssue([{ branch: 'main', fruit: null }])).toEqual([]);
  });

  test('skips session sentinel branches (<fruit>/session)', () => {
    expect(worktreesWithIssue([{ branch: 'apple/session', fruit: 'apple' }])).toEqual([]);
  });

  test('handles mixed entries — returns only those with issue patterns', () => {
    const input = [
      { branch: 'main', fruit: null },
      { branch: 'banana/issue-123-some-work', fruit: 'banana' },
      { branch: 'cherry/session', fruit: 'cherry' },
      { branch: 'apple/issue-42-fix-thing', fruit: 'apple' },
    ];
    expect(worktreesWithIssue(input)).toEqual([
      { branch: 'banana/issue-123-some-work', fruit: 'banana', issue: 123 },
      { branch: 'apple/issue-42-fix-thing', fruit: 'apple', issue: 42 },
    ]);
  });

  test('returns empty array for empty input', () => {
    expect(worktreesWithIssue([])).toEqual([]);
  });

  test('returns empty array for null/undefined input', () => {
    expect(worktreesWithIssue(null)).toEqual([]);
    expect(worktreesWithIssue(undefined)).toEqual([]);
  });
});
