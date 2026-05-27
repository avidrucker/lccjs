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

// ST executable: mvi r0, 99  →  st r0, val  →  halt  →  val:.fill 0
// Used to test memory-write detection in step().
// Encoding:
//   0xD063 = MVI r0, 99  (opcode=13, dr=0, imm8=0x63)
//   0x3001 = ST r0, +1   (opcode=3, sr=0, pcoffset9=1 → addr = PC_after_ST + 1 = 2+1 = 3)
//   0xF000 = HALT
//   0x0000 = val (data, initial=0)
const ST_EXE = Buffer.from([0x6f, 0x43, 0x63, 0xd0, 0x01, 0x30, 0x00, 0xf0, 0x00, 0x00]);

/** Load an executable buffer into a fresh IInterpreter without running it. */
function loadedInterp(exe = MIN_EXE) {
  const interp = new IInterpreter();
  interp.loadExecutableBuffer(exe);
  interp.initialMem = interp.mem.slice();
  return interp;
}

/** Load an executable, call initSnapshot(), and return the interpreter. */
function snapshotInterp(exe = MIN_EXE) {
  const interp = loadedInterp(exe);
  interp.initSnapshot();
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

describe('IInterpreter.step() — snapshot logging', () => {
  beforeAll(() => {
    // Suppress stdout/stderr from DOUT, NL, and internal console calls
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    process.stdout.write.mockRestore();
    console.log.mockRestore();
    console.error.mockRestore();
  });

  test('one step: currentIteration becomes 1', () => {
    const interp = snapshotInterp();
    interp.step(); // MVI r0, 5
    expect(interp.currentIteration).toBe(1);
  });

  test('one step: snapshot grows to length 2', () => {
    const interp = snapshotInterp();
    interp.step();
    expect(interp.snapshot).toHaveLength(2);
  });

  test('two steps: currentIteration becomes 2', () => {
    const interp = snapshotInterp();
    interp.step(); // MVI r0, 5
    interp.step(); // DOUT
    expect(interp.currentIteration).toBe(2);
  });

  test('after MVI r0, 5: snapshot[1].registers[0] === 5', () => {
    const interp = snapshotInterp();
    interp.step(); // MVI r0, 5
    expect(interp.snapshot[1].registers[0]).toBe(5);
  });

  test('after MVI r0, 5: snapshot[1].ir is the MVI instruction word', () => {
    const interp = snapshotInterp();
    interp.step();
    // 0xD005: opcode=13 MVI, dr=0, imm8=5
    expect(interp.snapshot[1].ir).toBe(0xD005);
  });

  test('after non-memory-writing step: memory.hasChanged is false', () => {
    const interp = snapshotInterp();
    interp.step(); // MVI r0, 5 — no memory write
    expect(interp.snapshot[1].memory.hasChanged).toBe(false);
  });

  test('after ST: memory.hasChanged is true', () => {
    const interp = snapshotInterp(ST_EXE);
    interp.step(); // MVI r0, 99
    interp.step(); // ST r0, 3
    expect(interp.snapshot[2].memory.hasChanged).toBe(true);
  });

  test('after ST: memory.address points to the written location', () => {
    const interp = snapshotInterp(ST_EXE);
    interp.step(); // MVI r0, 99
    interp.step(); // ST r0, 3
    expect(interp.snapshot[2].memory.address).toBe(3);
  });

  test('after ST: memory.old was 0, memory.new is 99', () => {
    const interp = snapshotInterp(ST_EXE);
    interp.step(); // MVI r0, 99
    interp.step(); // ST r0, 3
    expect(interp.snapshot[2].memory.old).toEqual([0]);
    expect(interp.snapshot[2].memory.new).toEqual([99]);
  });

  test('efficient mode: snapshot never exceeds length 2', () => {
    const interp = snapshotInterp();
    interp.efficientMode = true;
    interp.step(); // MVI
    interp.step(); // DOUT
    interp.step(); // NL
    expect(interp.snapshot.length).toBeLessThanOrEqual(2);
  });
});

describe('IInterpreter unimplemented stubs', () => {
  // OB-046 (#91): backward stepping correctness
  // OB-047 (#94): display pane format correctness
  test.todo('OB-046: backward stepping — resolve #93/#96 first');
  test.todo('OB-047: display format — resolve #98/#89/#92 first');
});
