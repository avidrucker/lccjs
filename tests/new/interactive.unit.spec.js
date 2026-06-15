// interactive.unit.spec.js — Unit tests for IInterpreter (interactive stepping debugger)

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

// PUSH executable: mvi r0, 42  →  push r0  →  halt
// Used to test Gap A (#1085): a stack write lands ABOVE the loaded program
// region (sp starts at 0, push decrements to 0xFFFF and writes there), so the
// old loadPoint..memMax scan never saw it and could not undo it on step-back.
// Encoding:
//   0xD02A = MVI r0, 42  (opcode=13, dr=0, imm8=0x2A)
//   0xA000 = PUSH r0     (opcode=10, sr=0, eopcode=0 → mem[--sp] = r0)
//   0xF000 = HALT
const PUSH_EXE = Buffer.from([0x6f, 0x43, 0x2a, 0xd0, 0x00, 0xa0, 0x00, 0xf0]);

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

  test('snapshot[0] has no memory writes (baseline has nothing to undo)', () => {
    const interp = loadedInterp();
    interp.initSnapshot();
    expect(interp.snapshot[0].memory.writes).toEqual([]);
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

  test('after non-memory-writing step: memory.writes is empty', () => {
    const interp = snapshotInterp();
    interp.step(); // MVI r0, 5 — no memory write
    expect(interp.snapshot[1].memory.writes).toEqual([]);
  });

  test('after ST: exactly one write is recorded', () => {
    const interp = snapshotInterp(ST_EXE);
    interp.step(); // MVI r0, 99
    interp.step(); // ST r0, 3
    expect(interp.snapshot[2].memory.writes).toHaveLength(1);
  });

  test('after ST: the write points to the written location', () => {
    const interp = snapshotInterp(ST_EXE);
    interp.step(); // MVI r0, 99
    interp.step(); // ST r0, 3
    expect(interp.snapshot[2].memory.writes[0].address).toBe(3);
  });

  test('after ST: the write records old 0 and new 99', () => {
    const interp = snapshotInterp(ST_EXE);
    interp.step(); // MVI r0, 99
    interp.step(); // ST r0, 3
    expect(interp.snapshot[2].memory.writes[0].old).toBe(0);
    expect(interp.snapshot[2].memory.writes[0].new).toBe(99);
  });

  test('Gap A (#1085): a stack PUSH above memMax is captured in the undo-log', () => {
    const interp = snapshotInterp(PUSH_EXE);
    interp.step(); // MVI r0, 42
    interp.step(); // PUSH r0 → mem[0xFFFF] = 42, far above memMax
    const writes = interp.snapshot[2].memory.writes;
    expect(writes).toHaveLength(1);
    expect(writes[0].address).toBe(0xFFFF);
    expect(writes[0].old).toBe(0);
    expect(writes[0].new).toBe(42);
    // Sanity: the write really is outside the scanned program region.
    expect(writes[0].address).toBeGreaterThan(interp.memMax);
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

describe('IInterpreter.handleSteps() — forward/backward navigation', () => {
  beforeAll(() => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    process.stdout.write.mockRestore();
    console.log.mockRestore();
    console.error.mockRestore();
  });

  test('handleSteps(0) is a no-op', () => {
    const interp = snapshotInterp();
    interp.handleSteps(0);
    expect(interp.currentIteration).toBe(0);
    expect(interp.snapshot).toHaveLength(1);
  });

  test('handleSteps(3): currentIteration === 3 and snapshot.length === 4', () => {
    const interp = snapshotInterp();
    interp.handleSteps(3);
    expect(interp.currentIteration).toBe(3);
    expect(interp.snapshot).toHaveLength(4);
  });

  test('forward 3 then backward 2: currentIteration === 1', () => {
    const interp = snapshotInterp();
    interp.handleSteps(3);
    interp.handleSteps(-2);
    expect(interp.currentIteration).toBe(1);
  });

  test('forward 3 then backward 2: registers match snapshot[1]', () => {
    const interp = snapshotInterp();
    interp.handleSteps(3); // MVI r0,5 / DOUT / NL
    const savedRegs = interp.snapshot[1].registers.slice();
    interp.handleSteps(-2);
    expect(Array.from(interp.r)).toEqual(savedRegs);
  });

  test('backward 5 from iteration 3: clamps to currentIteration 0', () => {
    const interp = snapshotInterp();
    interp.handleSteps(3);
    interp.handleSteps(-5);
    expect(interp.currentIteration).toBe(0);
  });

  test('backward to 0: registers match snapshot[0] (initial state)', () => {
    const interp = snapshotInterp();
    interp.handleSteps(3);
    interp.handleSteps(-5);
    expect(Array.from(interp.r)).toEqual(interp.snapshot[0].registers);
  });

  test('ST then backward: memory correctly restored', () => {
    const interp = snapshotInterp(ST_EXE);
    interp.handleSteps(2); // MVI r0, 99  →  ST r0, 3
    expect(interp.mem[3]).toBe(99); // confirm write happened
    interp.handleSteps(-1); // undo ST
    expect(interp.mem[3]).toBe(0);  // memory restored to pre-ST value
  });

  test('Gap A (#1085): PUSH then backward restores the stack word', () => {
    const interp = snapshotInterp(PUSH_EXE);
    interp.handleSteps(2); // MVI r0, 42  →  PUSH r0
    const sp = interp.r[6] & 0xFFFF;
    expect(sp).toBe(0xFFFF);          // sp grew down off the top of memory
    expect(interp.mem[0xFFFF]).toBe(42); // confirm the stack write happened
    interp.handleSteps(-1);           // step back over the PUSH
    expect(interp.mem[0xFFFF]).toBe(0); // stack contents restored, not just sp
  });

  test('efficient mode: backward step is ignored', () => {
    const interp = snapshotInterp();
    interp.efficientMode = true;
    interp.handleSteps(3);
    const iterBefore = interp.currentIteration;
    interp.handleSteps(-1);
    expect(interp.currentIteration).toBe(iterBefore); // unchanged
  });
});

describe('IInterpreter.displayRegisters() — register pane format (OB-047)', () => {
  function mkSnapshot(regs, flags, pc = 0, ir = 0) {
    return {
      registers: regs || [0, 0, 0, 0, 0, 0, 0, 0],
      flags: flags || { n: 0, z: 0, c: 0, v: 0 },
      pc,
      ir,
    };
  }

  test('output contains r0:', () => {
    const interp = new IInterpreter();
    const s = mkSnapshot();
    expect(interp.displayRegisters(s, s)).toContain('r0:');
  });

  test('output contains fp:', () => {
    const interp = new IInterpreter();
    const s = mkSnapshot();
    expect(interp.displayRegisters(s, s)).toContain('fp:');
  });

  test('output contains sp:', () => {
    const interp = new IInterpreter();
    const s = mkSnapshot();
    expect(interp.displayRegisters(s, s)).toContain('sp:');
  });

  test('output contains lr:', () => {
    const interp = new IInterpreter();
    const s = mkSnapshot();
    expect(interp.displayRegisters(s, s)).toContain('lr:');
  });

  test('output contains NZCV:', () => {
    const interp = new IInterpreter();
    const s = mkSnapshot();
    expect(interp.displayRegisters(s, s)).toContain('NZCV:');
  });

  test('changed r0 is visually marked (colorblind mode uses * prefix)', () => {
    const interp = new IInterpreter();
    interp.colorblindMode = true;
    const prev = mkSnapshot([0, 0, 0, 0, 0, 0, 0, 0]);
    const curr = mkSnapshot([5, 0, 0, 0, 0, 0, 0, 0]);
    const out = interp.displayRegisters(prev, curr);
    expect(out).toContain('*r0:');   // marked
    expect(out).toContain('r1:');    // unchanged (no *)
    expect(out).not.toContain('*r1:');
  });

  test('unchanged registers show no * marker in colorblind mode', () => {
    const interp = new IInterpreter();
    interp.colorblindMode = true;
    const s = mkSnapshot([7, 7, 7, 7, 7, 7, 7, 7]);
    const out = interp.displayRegisters(s, s);
    expect(out).not.toContain('*');
  });
});

describe('IInterpreter.displayMemory() — memory pane format (OB-047)', () => {
  test('displayMemory(0, 1) contains "0000:"', () => {
    const interp = new IInterpreter();
    expect(interp.displayMemory(0, 1)).toContain('0000:');
  });

  test('displayMemory(0, 1) shows 8 hex words on the first row', () => {
    const interp = new IInterpreter();
    const line = interp.displayMemory(0, 1).trim();
    // format: "0000: w0 w1 w2 w3 w4 w5 w6 w7"
    const words = line.split(' ');
    // words[0] = "0000:", words[1..8] are the 8 memory values
    expect(words.length).toBe(9); // "0000:" + 8 words
  });

  test('displayMemory(0x10, 1) starts with "0010:"', () => {
    const interp = new IInterpreter();
    expect(interp.displayMemory(0x10, 1)).toMatch(/^0010:/);
  });

  test('displayMemory(0, 2) has two address rows', () => {
    const interp = new IInterpreter();
    const output = interp.displayMemory(0, 2);
    expect(output).toContain('0000:');
    expect(output).toContain('0008:');
  });
});

describe('IInterpreter.resolveMemAddress() — symbolic memory address (#1041)', () => {
  test('empty arg is a no-op (null address, no error)', () => {
    const interp = new IInterpreter();
    expect(interp.resolveMemAddress('')).toEqual({ address: null, error: null });
  });

  test('hex string resolves to its numeric value', () => {
    const interp = new IInterpreter();
    expect(interp.resolveMemAddress('0010')).toEqual({ address: 0x10, error: null });
  });

  test('known label resolves through the symbol table', () => {
    const interp = new IInterpreter();
    interp.symbolTable = { myData: 0x20 };
    expect(interp.resolveMemAddress('myData')).toEqual({ address: 0x20, error: null });
  });

  test('symbol table takes precedence over a hex interpretation of the same token', () => {
    const interp = new IInterpreter();
    interp.symbolTable = { face: 0x05 };
    // 'face' is valid hex (0xface) but is also a defined label → label wins
    expect(interp.resolveMemAddress('face')).toEqual({ address: 0x05, error: null });
  });

  test('unknown non-hex token returns a clear error', () => {
    const interp = new IInterpreter();
    interp.symbolTable = { myData: 0x20 };
    const { address, error } = interp.resolveMemAddress('zzzz');
    expect(address).toBeNull();
    expect(error).toMatch(/not a known label or hex address/i);
  });

  test('typo’d label gets a "did you mean" suggestion', () => {
    const interp = new IInterpreter();
    interp.symbolTable = { myData: 0x20 };
    const { error } = interp.resolveMemAddress('myDate'); // distance 1 from myData
    expect(error).toMatch(/did you mean 'myData'/i);
  });

  test('no symbol table: non-hex token still errors without crashing', () => {
    const interp = new IInterpreter();
    interp.symbolTable = null;
    const { address, error } = interp.resolveMemAddress('myData');
    expect(address).toBeNull();
    expect(error).toMatch(/not a known label or hex address/i);
  });
});

describe('IInterpreter.displayStack() — stack pane format (OB-047)', () => {
  test('output contains the word at the SP address', () => {
    const interp = new IInterpreter();
    // sp = 0 (default), mem[0] = 0 → should show "0000: 0000" in the output
    const out = interp.displayStack('sp');
    expect(out).toContain('0000: 0000');
  });

  test('output marks SP position with ">"', () => {
    const interp = new IInterpreter();
    expect(interp.displayStack('sp')).toContain('> 0000:');
  });

  test('output includes "-> sp" label at SP row', () => {
    const interp = new IInterpreter();
    expect(interp.displayStack('sp')).toContain('<- sp');
  });

  test('hex string anchor sets base address correctly', () => {
    const interp = new IInterpreter();
    // Passing hex address '0010' with sp=0 (not in view) → anchor shown in header
    const out = interp.displayStack('0010');
    expect(out).toContain('(0010)');
  });
});

describe('IInterpreter.runInteractive() — prompt loop (OB-044)', () => {
  let stdoutSpy;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    console.log.mockRestore();
    console.error.mockRestore();
  });

  function runWithInput(exe, inputStr) {
    const interp = loadedInterp(exe);
    interp.initialMem = interp.mem.slice();
    interp.inputBuffer = inputStr;
    interp.runInteractive(null);
    return interp;
  }

  test('q immediately quits without stepping', () => {
    const interp = runWithInput(MIN_EXE, 'q\n');
    expect(interp.currentIteration).toBe(0);
  });

  test('stepping forward: 1 step changes currentIteration to 1', () => {
    const interp = runWithInput(MIN_EXE, '1\nq\n');
    expect(interp.currentIteration).toBe(1);
  });

  test('stepping forward: after MVI r0,5, r0 === 5', () => {
    const interp = runWithInput(MIN_EXE, '1\nq\n');
    expect(interp.r[0]).toBe(5);
  });

  test('step + backward: returns to initial state', () => {
    const interp = runWithInput(MIN_EXE, '1\n-1\nq\n');
    expect(interp.currentIteration).toBe(0);
    expect(interp.r[0]).toBe(0);
  });

  test('memory command a{hex} updates memDisplayBase', () => {
    const interp = runWithInput(MIN_EXE, 'a0010\nq\n');
    expect(interp.memDisplayBase).toBe(0x10);
  });

  test('memory command a{label} resolves through the symbol table (#1041)', () => {
    const interp = loadedInterp(MIN_EXE);
    interp.initialMem = interp.mem.slice();
    interp.symbolTable = { myData: 0x20 };
    interp.inputBuffer = 'amyData\nq\n';
    interp.runInteractive(null);
    expect(interp.memDisplayBase).toBe(0x20);
  });

  test('memory command a{unknown-label} prints an error and leaves base unchanged (#1041)', () => {
    const interp = loadedInterp(MIN_EXE);
    interp.initialMem = interp.mem.slice();
    interp.symbolTable = { myData: 0x20 };
    interp.inputBuffer = 'azzzz\nq\n';
    interp.runInteractive(null);
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0]).join('');
    expect(allOutput).toContain('not a known label or hex address');
    expect(interp.memDisplayBase).toBe(0);
  });

  test('row command m{N} updates memDisplayRows', () => {
    const interp = runWithInput(MIN_EXE, 'm4\nq\n');
    expect(interp.memDisplayRows).toBe(4);
  });

  test('stack command s{anchor} updates stackAnchor', () => {
    const interp = runWithInput(MIN_EXE, 'sfp\nq\n');
    expect(interp.stackAnchor).toBe('fp');
  });

  test('h command writes help text to stdout', () => {
    runWithInput(MIN_EXE, 'h\nq\n');
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0]).join('');
    expect(allOutput).toContain('ilcc interactive commands');
  });

  test('0 command redisplays without stepping', () => {
    const interp = runWithInput(MIN_EXE, '0\nq\n');
    expect(interp.currentIteration).toBe(0);
  });

  // ── coverage for the #1343 pending(#1343) registry entries: c{N}, l{layout},
  //    <enter> (flips their COMMAND_REGISTRY test pointers from pending). #1365
  test('code command c{N} updates codeContextRows', () => {
    const interp = runWithInput(MIN_EXE, 'c3\nq\n');
    expect(interp.codeContextRows).toBe(3); // default is 5
  });

  test('code command c0 hides the code pane (codeContextRows = 0)', () => {
    const interp = runWithInput(MIN_EXE, 'c0\nq\n');
    expect(interp.codeContextRows).toBe(0);
  });

  test('code command c{non-numeric} errors and leaves codeContextRows unchanged', () => {
    const interp = runWithInput(MIN_EXE, 'cx\nq\n');
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0]).join('');
    expect(allOutput).toContain('c{N} expects a non-negative integer');
    expect(interp.codeContextRows).toBe(5); // unchanged default
  });

  test('layout command l{layout} updates paneLayout columns', () => {
    const interp = runWithInput(MIN_EXE, 'lr/c/mo\nq\n');
    expect(interp.paneLayout.column0).toBe('r');
    expect(interp.paneLayout.column1).toBe('c');
    expect(interp.paneLayout.column2).toBe('mo');
  });

  test('layout command l{invalid} errors and leaves paneLayout unchanged', () => {
    const interp = runWithInput(MIN_EXE, 'lz\nq\n');
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0]).join('');
    expect(allOutput).toContain('not a valid pane identifier');
    expect(interp.paneLayout.column0).toBe('ro'); // unchanged default
  });

  test('<enter> (empty input) repeats the last step count', () => {
    const once = runWithInput(MIN_EXE, '2\nq\n');           // step 2, no repeat
    const twice = runWithInput(MIN_EXE, '2\n\nq\n');        // step 2, then Enter repeats 2
    expect(twice.currentIteration).toBeGreaterThan(once.currentIteration);
  });

  test('output pane shows registers on each render', () => {
    runWithInput(MIN_EXE, 'q\n');
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0]).join('');
    expect(allOutput).toContain('r0:');
    expect(allOutput).toContain('NZCV:');
  });
});

// ---------------------------------------------------------------------------
// Helper: build a minimal sourceMap for use in displayCodeSnippet tests.
// ---------------------------------------------------------------------------
function makeSourceMap(lines, codeAddresses) {
  // lines: array of source line strings (0-indexed = line 1 in listing)
  // codeAddresses: array of { address, lineIndex } (lineIndex is 0-based → lineNumber = lineIndex+1)
  const addressToLine = new Map();
  for (const { address, lineIndex } of codeAddresses) {
    addressToLine.set(address, {
      lineNumber: lineIndex + 1,
      sourceLine: lines[lineIndex],
    });
  }
  return { addressToLine, allLines: lines };
}

describe('IInterpreter.displayCodeSnippet() — source pane (OB-043/#95)', () => {
  test('returns fallback when sourceMap is null', () => {
    const interp = loadedInterp();
    const out = interp.displayCodeSnippet(null);
    expect(out).toContain('no source');
    expect(out).toContain('PC:');
  });

  test('returns fallback when addressToLine has no entry for current PC', () => {
    const interp = loadedInterp();
    const sm = makeSourceMap(['mvi r0, 5', 'halt'], [{ address: 0x10, lineIndex: 0 }]);
    // interp.pc = 0 by default (not 0x10)
    const out = interp.displayCodeSnippet(sm);
    expect(out).toContain('source unknown');
  });

  test('current PC line is marked with "->"', () => {
    const interp = loadedInterp();
    // PC is 0 after load; map address 0 → line 1
    const sm = makeSourceMap(['mvi r0, 5', 'dout', 'halt'], [
      { address: 0, lineIndex: 0 },
      { address: 1, lineIndex: 1 },
      { address: 2, lineIndex: 2 },
    ]);
    const out = interp.displayCodeSnippet(sm, 1);
    expect(out).toContain('-> ');
    // The "->" line should contain "mvi r0, 5"
    const arrowLine = out.split('\n').find(l => l.startsWith('->'));
    expect(arrowLine).toContain('mvi r0, 5');
  });

  test('surrounding lines are not marked with "->"', () => {
    const interp = loadedInterp();
    const sm = makeSourceMap(['; preamble', 'mvi r0, 5', 'halt'], [
      { address: 0, lineIndex: 1 },
      { address: 1, lineIndex: 2 },
    ]);
    const out = interp.displayCodeSnippet(sm, 1);
    const lines = out.split('\n').filter(Boolean);
    const arrowLines = lines.filter(l => l.startsWith('->'));
    const nonArrowLines = lines.filter(l => !l.startsWith('->'));
    expect(arrowLines).toHaveLength(1);
    expect(nonArrowLines.length).toBeGreaterThan(0);
    nonArrowLines.forEach(l => expect(l.startsWith('  ')).toBe(true));
  });

  test('contextRows=0 shows only the current line', () => {
    const interp = loadedInterp();
    const sm = makeSourceMap(['a', 'b', 'c', 'd', 'e'], [
      { address: 0, lineIndex: 0 },
      { address: 1, lineIndex: 1 },
      { address: 2, lineIndex: 2 },
      { address: 3, lineIndex: 3 },
      { address: 4, lineIndex: 4 },
    ]);
    const out = interp.displayCodeSnippet(sm, 0);
    const lines = out.split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('->');
  });

  test('contextRows clamps at start of file (no negative indices)', () => {
    const interp = loadedInterp();
    const sm = makeSourceMap(['first', 'second', 'third'], [
      { address: 0, lineIndex: 0 },
      { address: 1, lineIndex: 1 },
      { address: 2, lineIndex: 2 },
    ]);
    // PC=0 is at line 1 — contextRows=5 asks for 5 lines before, but we're at start
    const out = interp.displayCodeSnippet(sm, 5);
    const lines = out.split('\n').filter(Boolean);
    // Should show lines 1, 2, 3 (no negative lines)
    expect(lines.length).toBeLessThanOrEqual(3 + 5); // at most 3 lines above + current + 5 below
    expect(out).not.toMatch(/undefined/);
  });

  test('line numbers are shown in the output', () => {
    const interp = loadedInterp();
    const sm = makeSourceMap(['mvi r0, 5', 'halt'], [
      { address: 0, lineIndex: 0 },
      { address: 1, lineIndex: 1 },
    ]);
    const out = interp.displayCodeSnippet(sm, 1);
    expect(out).toMatch(/\d+:/); // line number followed by colon
  });

  test('runInteractive calls displayCodeSnippet when sourceMap is provided', () => {
    const interp = loadedInterp();
    interp.initialMem = interp.mem.slice();
    interp.inputBuffer = 'q\n';
    const sm = makeSourceMap(['mvi r0, 5', 'halt'], [
      { address: 0, lineIndex: 0 },
      { address: 1, lineIndex: 1 },
    ]);
    const spy = jest.spyOn(interp, 'displayCodeSnippet');
    const stdoutMock = jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
    const logMock = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errMock = jest.spyOn(console, 'error').mockImplementation(() => {});

    interp.runInteractive(sm);

    expect(spy).toHaveBeenCalledWith(sm, interp.codeContextRows);
    spy.mockRestore();
    stdoutMock.mockRestore();
    logMock.mockRestore();
    errMock.mockRestore();
  });

  test('runInteractive does NOT call displayCodeSnippet when sourceMap is null', () => {
    const interp = loadedInterp();
    interp.initialMem = interp.mem.slice();
    interp.inputBuffer = 'q\n';
    const spy = jest.spyOn(interp, 'displayCodeSnippet');
    const stdoutMock = jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
    const logMock = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errMock = jest.spyOn(console, 'error').mockImplementation(() => {});

    interp.runInteractive(null);

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    stdoutMock.mockRestore();
    logMock.mockRestore();
    errMock.mockRestore();
  });
});
