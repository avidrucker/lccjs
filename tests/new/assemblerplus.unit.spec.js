const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const AssemblerPlus = require('../../src/plus/assemblerplus');
const { TRAP_SOUND, TRAP_SOUND_LITERAL_FLAG } = require('../../src/plus/constants');

// First coverage for src/plus/assemblerplus.js (187 LOC, was 0% — child of #166).
// AssemblerPlus extends the core Assembler to add the LCC+ traps and the
// `.lccplus` directive; it is exported, so the override seams unit-test directly.
const tmp = [];
function writeAp(name, content) {
  const p = path.join(os.tmpdir(), `aplus-${process.pid}-${name}.ap`);
  fs.writeFileSync(p, content);
  tmp.push(p);
  return p;
}

describe('assemblerplus — first coverage (#197)', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterAll(() => {
    jest.restoreAllMocks();
    for (const p of tmp) {
      for (const f of [p, p.replace(/\.ap$/, '.ep')]) {
        try { fs.unlinkSync(f); } catch (_) { /* best effort */ }
      }
    }
  });

  describe('happy path', () => {
    test('a valid .ap (.lccplus + a plus instruction) assembles to .ep without throwing', () => {
      const ap = writeAp('ok', '      .lccplus\n      rand r0, r1\n      halt\n');
      const a = new AssemblerPlus();
      expect(() => a.main([ap])).not.toThrow();
      expect(fs.existsSync(ap.replace(/\.ap$/, '.ep'))).toBe(true);
    });
  });

  describe('the .lccplus directive gate (writeOutputFile override)', () => {
    test('a .ap missing .lccplus fails with the directive error', () => {
      const ap = writeAp('nolccplus', '      halt\n');
      const a = new AssemblerPlus();
      // fatalExit throws under Jest; the message is the writeOutputFile guard.
      expect(() => a.main([ap])).toThrow(/Missing \.lccplus directive/);
    });
  });

  // OB-009 (fixed in 4fba6ee: "remove redundant fatalExit after error() in
  // assembleRAND"). The core error() already terminates (throws under Jest, exits
  // in production), so the removed fatalExit was unreachable; the observable
  // contract is that a malformed `rand` yields exactly ONE recoverable error.
  describe('rand encoding + OB-009 single-error contract', () => {
    test('a well-formed rand encodes 1010 dr sr1 0 01110', () => {
      const a = new AssemblerPlus();
      a.pass = 2; a.lineNum = 1; a.sourceLines = ['rand r1, r2'];
      // rand r1,r2 -> 0xA000 | (1<<9) | (2<<6) | 0x0E
      expect(a.assembleRAND(['r1', 'r2'])).toBe(0xA28E);
    });

    test('a rand missing an operand raises a single "Missing register" error', () => {
      const a = new AssemblerPlus();
      a.pass = 2; a.lineNum = 1; a.sourceLines = ['rand r0'];
      expect(() => a.assembleRAND(['r0'])).toThrow();
    });

    test('OB-009 (production): a malformed rand reports its error exactly once, exits non-zero', () => {
      const ap = writeAp('badrand', '      .lccplus\n      rand r0\n      halt\n');
      const script = path.join(__dirname, '..', '..', 'src', 'plus', 'assemblerplus.js');
      let out = '';
      let code = 0;
      try {
        out = execFileSync('node', [script, ap], { encoding: 'utf8' });
      } catch (e) {
        code = e.status;
        out = `${e.stdout || ''}${e.stderr || ''}`;
      }
      expect(code).toBe(1);
      // A reintroduced double-exit/double-report would print the error twice.
      expect((out.match(/Missing register/g) || []).length).toBe(1);
    });
  });

  describe('sound encoding (#1491)', () => {
    const soundRegisterWord = (registerIndex) => 0xF000 | (registerIndex << 9) | (TRAP_SOUND & 0xFF);
    const soundLiteralWord = (slot) => soundRegisterWord(slot) | TRAP_SOUND_LITERAL_FLAG;

    test.each([
      ['r0', 0],
      ['r1', 1],
      ['r2', 2],
      ['r3', 3],
      ['r4', 4],
      ['r7', 7],
    ])('sound %s encodes the register to read at runtime', (registerName, registerIndex) => {
      const a = new AssemblerPlus();
      a.pass = 2; a.lineNum = 1; a.sourceLines = [`sound ${registerName}`];

      expect(a.assembleSound([registerName])).toBe(soundRegisterWord(registerIndex));
    });

    test.each([0, 1, 2, 3, 4, 5, 6])('sound %i encodes a literal sound slot', (slot) => {
      const a = new AssemblerPlus();
      a.pass = 2; a.lineNum = 1; a.sourceLines = [`sound ${slot}`];

      expect(a.assembleSound([String(slot)])).toBe(soundLiteralWord(slot));
    });

    test.each([
      ['ding', 0],
      ['doink', 1],
      ['beep', 2],
      ['ping', 3],
      ['popsound', 4],
      ['softbeep', 5],
      ['bop', 6],
    ])('%s aliases assemble to sound r%i', (alias, slot) => {
      const a = new AssemblerPlus();
      a.pass = 2; a.lineNum = 1; a.sourceLines = [alias];

      expect(a._instructionTable[alias].encoder([])).toBe(soundLiteralWord(slot));
    });

    test('sound 7 is rejected because only seven literal sound slots exist', () => {
      const a = new AssemblerPlus();
      a.pass = 2; a.lineNum = 1; a.sourceLines = ['sound 7'];

      expect(() => a.assembleSound(['7'])).toThrow(/sound slot out of range/);
    });
  });

  describe('.lccplus in the typo-suggestion pool (#1034)', () => {
    const { suggestClosest } = require('../../src/utils/suggest');

    test('AssemblerPlus offers .lccplus as a valid directive', () => {
      const a = new AssemblerPlus();
      expect(a._getValidDirectives()).toContain('.lccplus');
    });

    test('AssemblerPlus still includes the inherited core directives', () => {
      const a = new AssemblerPlus();
      expect(a._getValidDirectives()).toEqual(
        expect.arrayContaining(['.word', '.start', '.fill', '.stringz'])
      );
    });

    test('a near-miss on .lccplus resolves to .lccplus via suggestClosest', () => {
      const a = new AssemblerPlus();
      expect(suggestClosest('.lcplus', a._getValidDirectives())).toBe('.lccplus');
      expect(suggestClosest('.lccplu', a._getValidDirectives())).toBe('.lccplus');
    });
  });
});
