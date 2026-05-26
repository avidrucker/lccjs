/**
 * @file assembler.immediate.bounds.spec.js
 * Parametrized boundary tests for evaluateImmediate (OB-021).
 *
 * Covers all four distinct (min, max, type) configurations used across the
 * 10 evaluateImmediate call sites in assembler.js:
 *
 *   imm5       [-16..15]    cmp/add/and/sub immediate
 *   ct         [0..15]      sra shift count (srl/rol/ror use evaluateImmediateNaive — no bounds check)
 *   offset6    [-32..31]    ldr/str/jmp/ret offset
 *   mvi imm9   [-256..255]  mvi immediate
 *
 * Each config is tested at:
 *   - one below min  → error (out of range)
 *   - min            → success (no error)
 *   - max            → success (no error)
 *   - one above max  → error (out of range)
 *
 * IMPORTANT: assembly source lines MUST begin with whitespace.
 * The assembler's isValidLabelDef() treats any token starting at column 0
 * as a label definition, so un-indented mnemonics become labels and the
 * instruction is never reached.
 */

const Assembler = require('../../src/core/assembler');
const { setupAssemblerIntegrationHarness } = require('../helpers/assemblerIntegrationHarness');

jest.mock('fs');

describe('evaluateImmediate boundary tests', () => {
  let assembler;
  let virtualFs;
  const { getAssembler, getVirtualFs } = setupAssemblerIntegrationHarness(Assembler);

  beforeEach(() => {
    assembler = getAssembler();
    virtualFs = getVirtualFs();
  });

  // ── helper ────────────────────────────────────────────────────────────────

  function asm(source) {
    const file = 'test.a';
    virtualFs[file] = source;
    assembler.main([file]);
  }

  function asmExpectError(source, message) {
    expect(() => asm(source)).toThrow(message);
  }

  // ── imm5: [-16..15] ───────────────────────────────────────────────────────

  describe('imm5 [-16..15] (cmp/add/and/sub)', () => {
    test('below min (-17) → imm5 out of range', () => {
      asmExpectError('  cmp r0, -17\n  halt', 'imm5 out of range');
    });

    test('min (-16) → no error', () => {
      asm('  cmp r0, -16\n  halt');
    });

    test('max (15) → no error', () => {
      asm('  cmp r0, 15\n  halt');
    });

    test('above max (16) → imm5 out of range', () => {
      asmExpectError('  cmp r0, 16\n  halt', 'imm5 out of range');
    });

    test('add imm5 min (-16) → no error', () => {
      asm('  add r0, r0, -16\n  halt');
    });

    test('add imm5 above max (16) → imm5 out of range', () => {
      asmExpectError('  add r0, r0, 16\n  halt', 'imm5 out of range');
    });
  });

  // ── ct: [0..15] ───────────────────────────────────────────────────────────
  // Only sra routes through evaluateImmediate for the shift count.
  // srl/rol/ror use evaluateImmediateNaive and therefore have no bounds check.

  describe('ct [0..15] (sra shift count)', () => {
    test('below min (-1) → out of range', () => {
      asmExpectError('  sra r0, -1\n  halt', 'out of range');
    });

    test('min (0) → no error', () => {
      asm('  sra r0, 0\n  halt');
    });

    test('max (15) → no error', () => {
      asm('  sra r0, 15\n  halt');
    });

    test('above max (16) → out of range', () => {
      asmExpectError('  sra r0, 16\n  halt', 'out of range');
    });
  });

  // ── offset6: [-32..31] ────────────────────────────────────────────────────

  describe('offset6 [-32..31] (ldr/str/jmp/ret)', () => {
    test('ldr: below min (-33) → offset6 out of range', () => {
      asmExpectError('  ldr r0, r1, -33\n  halt', 'offset6 out of range');
    });

    test('ldr: min (-32) → no error', () => {
      asm('  ldr r0, r1, -32\n  halt');
    });

    test('ldr: max (31) → no error', () => {
      asm('  ldr r0, r1, 31\n  halt');
    });

    test('ldr: above max (32) → offset6 out of range', () => {
      asmExpectError('  ldr r0, r1, 32\n  halt', 'offset6 out of range');
    });

    test('str: below min (-33) → offset6 out of range', () => {
      asmExpectError('  str r0, r1, -33\n  halt', 'offset6 out of range');
    });

    test('str: max (31) → no error', () => {
      asm('  str r0, r1, 31\n  halt');
    });
  });

  // ── mvi imm9: [-256..255] ─────────────────────────────────────────────────

  describe('mvi imm9 [-256..255]', () => {
    test('below min (-257) → mvi immediate out of range', () => {
      asmExpectError('  mvi r0, -257\n  halt', 'mvi immediate out of range');
    });

    test('min (-256) → no error', () => {
      asm('  mvi r0, -256\n  halt');
    });

    test('max (255) → no error', () => {
      asm('  mvi r0, 255\n  halt');
    });

    test('above max (256) → mvi immediate out of range', () => {
      asmExpectError('  mvi r0, 256\n  halt', 'mvi immediate out of range');
    });
  });
});
