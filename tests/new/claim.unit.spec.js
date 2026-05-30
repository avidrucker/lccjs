const {
  parseArgs,
  normalizeIdentity,
  resolveIdentity,
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
  });
});
