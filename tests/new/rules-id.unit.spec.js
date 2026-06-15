'use strict';
// Unit tests for scripts/rules-id.js — the animal-color identity + version helpers
// backing the Option-B RULES.json schema (#1185). Covers the contract the render
// pipeline and migration depend on: collision-free minting, content-addressed
// hashing, and display-id rendering.

const {
  COLORS,
  ANIMALS,
  STEM_RE,
  RulesIdError,
  assertUniqueId,
  mintId,
  textSha,
  displayId,
  rulesetSha,
} = require('../../scripts/rules-id');

describe('mintId()', () => {
  test('mints a syntactically valid color-animal stem', () => {
    const id = mintId(new Set());
    expect(id).toMatch(STEM_RE);
    const [color, animal] = id.split('-');
    expect(COLORS).toContain(color);
    expect(ANIMALS).toContain(animal);
  });

  test('never returns a stem already present (refuses collisions)', () => {
    const taken = new Set();
    // Mint a large batch; every result must be fresh and unique.
    for (let i = 0; i < 200; i++) {
      const id = mintId(taken);
      expect(taken.has(id)).toBe(false);
      taken.add(id);
    }
    expect(taken.size).toBe(200);
  });

  test('accepts an array of existing ids, not just a Set', () => {
    const existing = ['crimson-otter', 'azure-lynx'];
    const id = mintId(existing);
    expect(existing).not.toContain(id);
  });

  test('is deterministic given an injected rng', () => {
    const seq = [0, 0]; // first color, first animal
    const rng = () => seq.shift();
    const id = mintId(new Set(), rng);
    expect(id).toBe(`${COLORS[0]}-${ANIMALS[0]}`);
  });

  test('skips a colliding draw and returns the next free stem', () => {
    const first = `${COLORS[0]}-${ANIMALS[0]}`;
    const second = `${COLORS[1]}-${ANIMALS[0]}`;
    // rng yields the (already-taken) first combo, then the free second combo.
    const draws = [0, 0, 1 / COLORS.length, 0];
    const rng = () => draws.shift();
    const id = mintId(new Set([first]), rng);
    expect(id).toBe(second);
  });

  test('throws RulesIdError when the namespace is exhausted', () => {
    const all = new Set();
    for (const c of COLORS) for (const a of ANIMALS) all.add(`${c}-${a}`);
    expect(() => mintId(all)).toThrow(RulesIdError);
    expect(() => mintId(all)).toThrow(/exhausted/);
  });
});

describe('assertUniqueId()', () => {
  test('returns the id when it is free', () => {
    expect(assertUniqueId('crimson-otter', ['azure-lynx'])).toBe('crimson-otter');
  });

  test('throws on collision with an existing id', () => {
    expect(() => assertUniqueId('crimson-otter', ['crimson-otter']))
      .toThrow(/collision/);
  });

  test('throws on a malformed stem', () => {
    expect(() => assertUniqueId('R001', [])).toThrow(RulesIdError);
  });
});

describe('textSha()', () => {
  test('is a 6-char lowercase hex digest', () => {
    expect(textSha('hello')).toMatch(/^[0-9a-f]{6}$/);
  });

  test('is deterministic for identical text', () => {
    expect(textSha('I will not run `rm` on main.')).toBe(textSha('I will not run `rm` on main.'));
  });

  test('changes when the text changes', () => {
    expect(textSha('alpha')).not.toBe(textSha('alpha.'));
  });
});

describe('displayId()', () => {
  test('renders stem + zero-padded NNN version', () => {
    expect(displayId({ id: 'crimson-otter', version: 1 })).toBe('crimson-otter-001');
    expect(displayId({ id: 'crimson-otter', version: 23 })).toBe('crimson-otter-023');
    expect(displayId({ id: 'crimson-otter', version: 100 })).toBe('crimson-otter-100');
  });
});

describe('rulesetSha()', () => {
  const base = [
    { id: 'crimson-otter', version: 1, text_sha: 'aaaaaa' },
    { id: 'azure-lynx', version: 2, text_sha: 'bbbbbb' },
  ];

  test('is a 6-char lowercase hex digest, deterministic', () => {
    expect(rulesetSha(base)).toMatch(/^[0-9a-f]{6}$/);
    expect(rulesetSha(base)).toBe(rulesetSha(base.map((r) => ({ ...r }))));
  });

  test('changes when a rule text_sha changes', () => {
    const edited = [{ ...base[0], text_sha: 'cccccc' }, base[1]];
    expect(rulesetSha(edited)).not.toBe(rulesetSha(base));
  });

  test('changes when a rule version bumps', () => {
    const bumped = [{ ...base[0], version: 2 }, base[1]];
    expect(rulesetSha(bumped)).not.toBe(rulesetSha(base));
  });

  test('changes when rules are reordered', () => {
    expect(rulesetSha([base[1], base[0]])).not.toBe(rulesetSha(base));
  });
});
