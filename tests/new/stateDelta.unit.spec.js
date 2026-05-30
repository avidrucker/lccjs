// Unit tests for src/core/debug/stateDelta.js — the pure machine-state diff helpers.
//
// Red-green per #169 (follow-up to #164). The module exports three pure functions —
// diffRegisters / diffFlags / pcChanged — not a single diffState(). These tests pin
// each of them directly, where the oracle e2e only exercises them transitively through
// rendered debugger output. The "fire-once" flags/pc semantics noted in stateDelta.js
// live in the *callers* (interpreter.js / iinterpreter.js), not in these value-based
// helpers, so they are not modeled here; see the file header comment.

const { diffRegisters, diffFlags, pcChanged } = require('../../src/core/debug/stateDelta');

describe('stateDelta — diffRegisters', () => {
  test('no change → empty array', () => {
    const regs = [0, 1, 2, 3, 4, 5, 6, 7];
    expect(diffRegisters(regs, regs.slice())).toEqual([]);
  });

  test('single register change → one {i, oldVal, newVal} entry', () => {
    const prev = [0, 0, 0, 0, 0, 0, 0, 0];
    const curr = [0, 0, 42, 0, 0, 0, 0, 0];
    expect(diffRegisters(prev, curr)).toEqual([{ i: 2, oldVal: 0, newVal: 42 }]);
  });

  test('multiple register changes → all indices captured, in index order', () => {
    const prev = [0, 10, 0, 0, 0, 0, 99, 0];
    const curr = [5, 10, 0, 7, 0, 0, 11, 0];
    expect(diffRegisters(prev, curr)).toEqual([
      { i: 0, oldVal: 0, newVal: 5 },
      { i: 3, oldVal: 0, newVal: 7 },
      { i: 6, oldVal: 99, newVal: 11 },
    ]);
  });

  test('only compares the first 8 registers (ignores trailing elements)', () => {
    const prev = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const curr = [0, 0, 0, 0, 0, 0, 0, 0, 123];
    expect(diffRegisters(prev, curr)).toEqual([]);
  });

  test('reports the change even when old and new differ only in sign', () => {
    const prev = [0, 0, 0, 0, 0, 0, 0, 1];
    const curr = [0, 0, 0, 0, 0, 0, 0, -1];
    expect(diffRegisters(prev, curr)).toEqual([{ i: 7, oldVal: 1, newVal: -1 }]);
  });
});

describe('stateDelta — diffFlags', () => {
  test('no flag change → all false', () => {
    const flags = { n: true, z: false, c: true, v: false };
    expect(diffFlags(flags, { ...flags })).toEqual({ n: false, z: false, c: false, v: false });
  });

  test('single flag change → only that flag true', () => {
    const prev = { n: false, z: false, c: false, v: false };
    const curr = { n: false, z: true, c: false, v: false };
    expect(diffFlags(prev, curr)).toEqual({ n: false, z: true, c: false, v: false });
  });

  test('multiple flag changes → each changed flag true', () => {
    const prev = { n: false, z: false, c: false, v: false };
    const curr = { n: true, z: false, c: true, v: true };
    expect(diffFlags(prev, curr)).toEqual({ n: true, z: false, c: true, v: true });
  });
});

describe('stateDelta — pcChanged', () => {
  test('same pc → false', () => {
    expect(pcChanged(0x3000, 0x3000)).toBe(false);
  });

  test('different pc → true', () => {
    expect(pcChanged(0x3000, 0x3001)).toBe(true);
  });
});
