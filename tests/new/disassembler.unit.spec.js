const path = require('path');
const { execFileSync } = require('child_process');
const Disassembler = require('../../src/extra/disassembler');

// First coverage for src/extra/disassembler.js (915 LOC, was 0% — child of #166).
// The per-instruction disassemble* methods and signExtend are pure (word -> text),
// so they unit-test directly via the #196 export seam. The CLI smoke exercises the
// whole read -> decode -> output pipeline end-to-end on a known-good .e.
describe('disassembler — pure decode seams', () => {
  /** @type {Disassembler} */
  let d;
  beforeEach(() => { d = new Disassembler(); });

  test('signExtend recovers sign across the 9-bit boundary', () => {
    expect(d.signExtend(0x1FF, 9)).toBe(-1);
    expect(d.signExtend(0x0FF, 9)).toBe(255);
    expect(d.signExtend(0x100, 9)).toBe(-256);
  });

  // OB-002 regression (fixed in ee54749): the mvi imm9 mask must be `word & 0x1FF`
  // (9-bit), not the old `& 0xFF` (8-bit). disassembler.js:427. A word whose imm9
  // has bit 8 set but a zero low byte is the discriminator: the 9-bit mask yields
  // -256, the old 8-bit mask would have masked bit 8 away and yielded 0.
  describe('disassembleMVI recovers the full 9-bit immediate (OB-002)', () => {
    test('bit-8-set, zero low byte -> -256 (old 8-bit mask would give 0)', () => {
      expect(d.disassembleMVI(0x100)).toEqual({ mnemonic: 'mvi', operands: 'r0, -256' });
    });
    test('all 9 bits set -> -1', () => {
      expect(d.disassembleMVI(0x1FF)).toEqual({ mnemonic: 'mvi', operands: 'r0, -1' });
    });
    test('small positive immediate is unchanged', () => {
      expect(d.disassembleMVI(0x005)).toEqual({ mnemonic: 'mvi', operands: 'r0, 5' });
    });
    test('destination register decodes from bits [11:9]', () => {
      // dr = 3 (r3), imm9 = 7
      expect(d.disassembleMVI((3 << 9) | 7)).toEqual({ mnemonic: 'mvi', operands: 'r3, 7' });
    });
  });

  test('disassembleADD decodes register mode', () => {
    // dr=r1, sr1=r2, mode=0, sr2=r3
    expect(d.disassembleADD((1 << 9) | (2 << 6) | (0 << 5) | 3))
      .toEqual({ mnemonic: 'add', operands: 'r1, r2, r3' });
  });

  test('disassembleADD decodes immediate mode with a sign-extended imm5', () => {
    // dr=r1, sr1=r2, mode=1, imm5=0x1F (-1)
    expect(d.disassembleADD((1 << 9) | (2 << 6) | (1 << 5) | 0x1F))
      .toEqual({ mnemonic: 'add', operands: 'r1, r2, -1' });
  });

  test('disassembleLDR decodes base + sign-extended offset6', () => {
    // dr=r0, baseR=fp(5), offset6=0x3F (-1)
    expect(d.disassembleLDR((0 << 9) | (5 << 6) | 0x3F))
      .toEqual({ mnemonic: 'ldr', operands: 'r0, fp, -1' });
  });
});

describe('disassembler — CLI smoke / round-trip read', () => {
  const script = path.join(__dirname, '..', '..', 'src', 'extra', 'disassembler.js');
  const golden = path.join(__dirname, '..', '..', 'tests', 'goldens', 'interpreter', 'demoB.e');

  test('disassembles a known-good .e without crashing and recovers expected mnemonics', () => {
    // execFileSync throws if the process exits non-zero, so reaching the asserts
    // already proves exit 0 (the #166 "catch crashes on known input" goal).
    const out = execFileSync('node', [script, golden], { encoding: 'utf8' });
    expect(out).toContain('Final Disassembled Code');
    // demoB is a string-I/O demo: these are the real mnemonics in its program,
    // so this also proves the disassembler reads genuine assembler output (round-trip read).
    for (const mnemonic of ['lea', 'sout', 'sin', 'nl']) {
      expect(out).toContain(mnemonic);
    }
  });
});
