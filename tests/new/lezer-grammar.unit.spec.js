'use strict';

// Lezer grammar regression tests for src/lang-lcc/lcc.grammar.
// Exercises the compiled parser (src/lang-lcc/lcc.js) through a CJS-compatible
// subprocess helper so Jest's CJS environment can run ESM Lezer modules.

const { parseLines } = require('../helpers/lezerParser');

// Lines must be batched upfront so the Node subprocess starts once per suite.
const TEST_LINES = {
  dollarLabelDef:    '$cheese:',
  dollarLabelInstr:  '$cheese: halt',
  dollarIdentifier:  'ld r0, $var',
  atLabelDef:        '@loop:',
  underscoreLabelDef:'_init:',
  globalLabelDef:    'main:',
  haltInstr:         'halt',
};

const KEYS  = Object.keys(TEST_LINES);
const LINES = KEYS.map(k => TEST_LINES[k]);

let nodes; // Map<key, {name,from,to,text}[]>

beforeAll(() => {
  const results = parseLines(LINES);
  nodes = Object.fromEntries(KEYS.map((k, i) => [k, results[i]]));
}, 20_000);

function nodesNamed(key, name) {
  return (nodes[key] ?? []).filter(n => n.name === name);
}

// ── $-prefix support (regression for #874) ───────────────────────────────────

describe('$-prefixed labels (#874)', () => {
  test('$cheese: tokenises as LabelDef', () => {
    const defs = nodesNamed('dollarLabelDef', 'LabelDef');
    expect(defs.length).toBe(1);
    expect(defs[0].text).toBe('$cheese:');
  });

  test('$cheese: on a line with an instruction tokenises as LabelDef', () => {
    const defs = nodesNamed('dollarLabelInstr', 'LabelDef');
    expect(defs.length).toBe(1);
    expect(defs[0].text).toBe('$cheese:');
  });

  test('$var used as operand tokenises as Identifier', () => {
    const ids = nodesNamed('dollarIdentifier', 'Identifier');
    expect(ids.some(n => n.text === '$var')).toBe(true);
  });

  test('$-prefixed label does not produce an error node (⚠)', () => {
    const all = nodes['dollarLabelDef'] ?? [];
    expect(all.some(n => n.name === '⚠')).toBe(false);
  });
});

// ── other label prefix sanity checks ────────────────────────────────────────

describe('other label prefixes', () => {
  test('@loop: tokenises as LabelDef', () => {
    expect(nodesNamed('atLabelDef', 'LabelDef').length).toBe(1);
  });

  test('_init: tokenises as LabelDef', () => {
    expect(nodesNamed('underscoreLabelDef', 'LabelDef').length).toBe(1);
  });

  test('main: tokenises as LabelDef', () => {
    expect(nodesNamed('globalLabelDef', 'LabelDef').length).toBe(1);
  });
});

// ── basic smoke test ─────────────────────────────────────────────────────────

describe('smoke', () => {
  test('halt tokenises as MnemonicCore', () => {
    expect(nodesNamed('haltInstr', 'MnemonicCore').length).toBe(1);
  });
});
