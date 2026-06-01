const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const LinkerStepsPrinter = require('../../src/extra/linkerStepsPrinter');

// First coverage for src/extra/linkerStepsPrinter.js (709 LOC, was 0% — child of
// #166). The verbose step-printing linker. The end-to-end smoke links two real
// cross-referencing object modules; the V-table tests drive adjustExternalReferences
// directly to pin the OB-017 overflow guard.
const REPO = path.join(__dirname, '..', '..');
const ASM = path.join(REPO, 'src', 'core', 'assembler.js');

describe('linkerStepsPrinter — first coverage (#200)', () => {
  let dir;
  let m1o;
  let m2o;
  let outE;

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    // m1.a (.extern sub; .global i,j,main) and m2.a (.extern i,j; .global sub)
    // are the classic cross-referencing pair — assemble each to a .o fixture.
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-'));
    const m1 = path.join(dir, 'm1.a');
    const m2 = path.join(dir, 'm2.a');
    fs.copyFileSync(path.join(REPO, 'demos', 'm1.a'), m1);
    fs.copyFileSync(path.join(REPO, 'demos', 'm2.a'), m2);
    // Pre-create name.nnn in dir so the assembler does not block on stdin
    // in this non-interactive context.
    fs.writeFileSync(path.join(dir, 'name.nnn'), 'Tester, Auto\n');
    execFileSync('node', [ASM, m1], { cwd: dir });
    execFileSync('node', [ASM, m2], { cwd: dir });
    m1o = path.join(dir, 'm1.o');
    m2o = path.join(dir, 'm2.o');
    outE = path.join(dir, 'link.e');
  });

  afterAll(() => {
    jest.restoreAllMocks();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* best effort */ }
  });

  test('links two cross-referencing object modules into an executable', () => {
    const linker = new LinkerStepsPrinter();
    linker.link([m1o, m2o], outE);
    expect(linker.errorFlag).toBe(false);
    expect(fs.existsSync(outE)).toBe(true);
    expect(fs.statSync(outE).size).toBeGreaterThan(0);
  });

  // OB-017 (linkerStepsPrinter.js:501): a V-table (full 16-bit) adjustment whose
  // preAdjustmentWord + globalAddr exceeds 0xFFFF must be reported as an overflow
  // and must NOT silently wrap the word in the Uint16Array mca.
  describe('OB-017 — V-table overflow is caught, not silently wrapped', () => {
    test('sum > 0xFFFF sets the error flag and leaves the word unchanged', () => {
      const linker = new LinkerStepsPrinter();
      linker.VTable = [{ address: 0x10, label: 'big' }];
      linker.GMap = { big: 0x9000 };
      linker.mca[0x10] = 0x8000; // 0x8000 + 0x9000 = 0x11000 > 0xFFFF
      linker.adjustExternalReferences();
      expect(linker.errorFlag).toBe(true);
      expect(linker.mca[0x10]).toBe(0x8000); // untouched — a wrap would write 0x1000
    });

    test('an in-range V adjustment writes the summed word', () => {
      const linker = new LinkerStepsPrinter();
      linker.VTable = [{ address: 0x05, label: 'sym' }];
      linker.GMap = { sym: 0x0020 };
      linker.mca[0x05] = 0x0100;
      linker.adjustExternalReferences();
      expect(linker.errorFlag).toBe(false);
      expect(linker.mca[0x05]).toBe(0x0120);
    });

    test('an undefined V reference is reported as an error', () => {
      const linker = new LinkerStepsPrinter();
      linker.VTable = [{ address: 0x02, label: 'missing' }];
      linker.GMap = {};
      linker.adjustExternalReferences();
      expect(linker.errorFlag).toBe(true);
    });
  });
});
