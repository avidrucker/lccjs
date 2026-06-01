const {
  parseArgs,
  normalizeIdentity,
  inferFruitFromBranch,
  resolveIdentity,
  assessBaseStaleness,
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
});
