const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const AssemblerPlus = require('../../src/plus/assemblerplus');

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
});
