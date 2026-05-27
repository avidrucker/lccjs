// interactive.unit.spec.js — Unit tests for IInterpreter (interactive stepping debugger)
//
// @todo #91:45m/DEV Write tests for IInterpreter backward stepping correctness (OB-046):
//   - After 3 forward steps: currentIteration === 3, snapshot.length === 4
//   - After 3 forward + 2 backward: currentIteration === 1, registers match snapshot[1]
//   - After 3 forward + 5 backward: clamps at 0
//   - ST instruction + backward step: memory correctly restored
//   - Efficient mode: backward step throws or is ignored
//
// @todo #94:45m/DEV Write tests for IInterpreter display pane format correctness (OB-047):
//   - displayRegisters(): output contains 'r0:', 'fp:', 'sp:', 'lr:', 'NZCV:'
//   - displayRegisters(): changed register is visually marked differently
//   - displayMemory(0, 1): output contains '0000:' and 8 hex words
//   - displayMemory(0x10, 1): output starts with '0010:'
//   - displayStack(): output contains the word at the SP address

'use strict';

const IInterpreter = require('../../src/interactive/iinterpreter');

// Minimal .e executable: mvi r0, 5  →  dout  →  nl  →  halt
// Same buffer used in interpreter.unit.spec.js; verified to run correctly.
const MIN_EXE = Buffer.from([0x6f, 0x43, 0x05, 0xd0, 0x02, 0xf0, 0x01, 0xf0, 0x00, 0xf0]);

/** Load MIN_EXE into a fresh IInterpreter without running it. */
function loadedInterp() {
  const interp = new IInterpreter();
  interp.loadExecutableBuffer(MIN_EXE);
  interp.initialMem = interp.mem.slice();
  return interp;
}

describe('IInterpreter constructor', () => {
  let interp;
  beforeEach(() => { interp = new IInterpreter(); });

  test('snapshot starts as empty array', () => {
    expect(interp.snapshot).toEqual([]);
  });

  test('currentIteration starts at 0', () => {
    expect(interp.currentIteration).toBe(0);
  });

  test('memoryChange starts as null', () => {
    expect(interp.memoryChange).toBeNull();
  });

  test('efficientMode defaults to false', () => {
    expect(interp.efficientMode).toBe(false);
  });

  test('colorblindMode defaults to false', () => {
    expect(interp.colorblindMode).toBe(false);
  });

  test('display config fields default to expected values', () => {
    expect(interp.memDisplayBase).toBe(0);
    expect(interp.memDisplayRows).toBe(2);
    expect(interp.stackAnchor).toBe('sp');
  });
});

describe('IInterpreter.initSnapshot()', () => {
  test('pushes exactly one entry to snapshot', () => {
    const interp = loadedInterp();
    interp.initSnapshot();
    expect(interp.snapshot).toHaveLength(1);
  });

  test('snapshot[0].registers is all zeros', () => {
    const interp = loadedInterp();
    interp.initSnapshot();
    expect(interp.snapshot[0].registers).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  test('snapshot[0].flags are all 0', () => {
    const interp = loadedInterp();
    interp.initSnapshot();
    expect(interp.snapshot[0].flags).toEqual({ c: 0, v: 0, n: 0, z: 0 });
  });

  test('snapshot[0].memory.hasChanged is false', () => {
    const interp = loadedInterp();
    interp.initSnapshot();
    expect(interp.snapshot[0].memory.hasChanged).toBe(false);
  });

  test('snapshot[0].memory.new matches initial memory range', () => {
    const interp = loadedInterp();
    interp.initSnapshot();
    const { address, new: newMem } = interp.snapshot[0].memory;
    // The memory region should be non-empty and match initialMem at those addresses
    expect(newMem.length).toBeGreaterThan(0);
    for (let i = 0; i < newMem.length; i++) {
      expect(newMem[i]).toBe(interp.initialMem[address + i]);
    }
  });

  test('currentIteration remains 0 after initSnapshot()', () => {
    const interp = loadedInterp();
    interp.initSnapshot();
    expect(interp.currentIteration).toBe(0);
  });

  test('calling initSnapshot() twice resets snapshot to length 1', () => {
    const interp = loadedInterp();
    interp.initSnapshot();
    interp.initSnapshot();
    expect(interp.snapshot).toHaveLength(1);
  });
});

describe('IInterpreter unimplemented stubs', () => {
  // OB-046 (#91): backward stepping correctness
  // OB-047 (#94): display pane format correctness
  test.todo('OB-046: backward stepping — resolve #93/#96 first');
  test.todo('OB-047: display format — resolve #98/#89/#92 first');
});
