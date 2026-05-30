const fs = require('fs');
const os = require('os');
const path = require('path');
const LCCPlus = require('../../src/plus/lccplus');
const InterpreterPlus = require('../../src/plus/interpreterplus');

// First coverage for src/plus/lccplus.js (64 LOC, was 0% — child of #166).
// LCCPlus orchestrates assemble (.ap -> .ep) then run. The run uses
// InterpreterPlus, which needs a TTY (setRawMode) and so can't execute under the
// harness; the interpret step is therefore stubbed. These tests pin the
// *orchestration wiring* — which file each stage receives — not the interpreter's
// runtime behavior (that is #198's job).
const tmp = [];
function writeAp(name, content) {
  const p = path.join(os.tmpdir(), `lccplus-${process.pid}-${name}.ap`);
  fs.writeFileSync(p, content);
  tmp.push(p);
  return p;
}

describe('lccplus orchestration (#199)', () => {
  let runSpy;

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  beforeEach(() => {
    // Stub the crashy interpret step; we only assert on how it is invoked.
    runSpy = jest.spyOn(InterpreterPlus.prototype, 'main').mockImplementation(() => {});
  });
  afterEach(() => {
    runSpy.mockRestore();
  });
  afterAll(() => {
    jest.restoreAllMocks();
    for (const p of tmp) {
      for (const f of [p, p.replace(/\.ap$/, '.ep')]) {
        try { fs.unlinkSync(f); } catch (_) { /* best effort */ }
      }
    }
  });

  test('.ap path assembles to .ep, then runs the .ep (OB-013 single arg path)', () => {
    const ap = writeAp('drive', '      .lccplus\n      mov r0, 7\n      dout r0\n      halt\n');
    const driver = new LCCPlus();
    expect(() => driver.main([ap])).not.toThrow();

    const ep = ap.replace(/\.ap$/, '.ep');
    expect(fs.existsSync(ep)).toBe(true);
    // OB-013 (fixed in fe71af7 'remove redundant inputFileName pre-set'): the
    // interpreter receives the assembler's OUTPUT (.ep), not the original input
    // — one clean arg path, no constructor/main double-passing.
    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(runSpy).toHaveBeenCalledWith([ep]);
  });

  test('.ep path routes straight to the interpreter, no assembly', () => {
    const ep = path.join(os.tmpdir(), `lccplus-${process.pid}-direct.ep`);
    const driver = new LCCPlus();
    driver.main([ep]);
    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(runSpy).toHaveBeenCalledWith([ep]);
  });

  test('no input file fails with a usage error', () => {
    const driver = new LCCPlus();
    // fatalExit throws under the harness.
    expect(() => driver.main([])).toThrow(/No input file specified/);
    expect(runSpy).not.toHaveBeenCalled();
  });

  test('an unsupported extension is rejected', () => {
    const driver = new LCCPlus();
    expect(() => driver.main(['program.txt'])).toThrow(/Unsupported file type/);
    expect(runSpy).not.toHaveBeenCalled();
  });
});
