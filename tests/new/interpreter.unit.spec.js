const Assembler = require('../../src/core/assembler');
const Interpreter = require('../../src/core/interpreter');
const { InvalidExecutableFormatError, InterpreterRuntimeError } = require('../../src/utils/errors');

describe('Interpreter Unit Tests', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
  });

  afterAll(() => {
    console.log.mockRestore();
    console.warn.mockRestore();
    console.error.mockRestore();
    console.info.mockRestore();
    process.stdout.write.mockRestore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('executeBuffer() should run a valid executable entirely in memory', () => {
    const executable = Buffer.from([0x6f, 0x43, 0x05, 0xd0, 0x02, 0xf0, 0x01, 0xf0, 0x00, 0xf0]);
    const interpreter = new Interpreter();

    const result = interpreter.executeBuffer(executable, { inputFileName: 'demoA.e' });

    expect(result.inputFileName).toBe('demoA.e');
    expect(result.output).toBe('5\n');
    expect(result.registers[0]).toBe(5);
    expect(result.instructionsExecuted).toBe(4);
    expect(result.pc).toBeGreaterThan(0);
    expect(result.headerLines).toEqual([]);
    expect(result.reports).toEqual({ lst: null, bst: null });
  });

  test('executeBuffer() should reject an invalid executable signature', () => {
    const executable = Buffer.from([0x41, 0x43, 0x00, 0xf0]);
    const interpreter = new Interpreter();

    expect(() => {
      interpreter.executeBuffer(executable, { inputFileName: 'badSignature.e' });
    }).toThrow(InvalidExecutableFormatError);
  });

  test('executeBuffer() should throw a typed runtime error on division by zero', () => {
    const executable = Buffer.from([0x6f, 0x43, 0x00, 0xd0, 0x01, 0xd2, 0x28, 0xa0, 0x00, 0xf0]);
    const interpreter = new Interpreter();

    expect(() => {
      interpreter.executeBuffer(executable, { inputFileName: 'divzero.e' });
    }).toThrow(InterpreterRuntimeError);
  });

  test('executeBuffer() should throw a typed runtime error for an unsupported trap vector', () => {
    const executable = Buffer.from([0x6f, 0x43, 0x0f, 0xf0]);
    const interpreter = new Interpreter();

    expect(() => {
      interpreter.executeBuffer(executable, { inputFileName: 'badTrap.e' });
    }).toThrow(InterpreterRuntimeError);
  });

  test('executeBuffer() should throw a typed runtime error for bp instead of entering debugger mode', () => {
    const executable = Buffer.from([0x6f, 0x43, 0x0e, 0xf0, 0x00, 0xf0]);
    const interpreter = new Interpreter();

    expect(() => {
      interpreter.executeBuffer(executable, { inputFileName: 'bpTrap.e' });
    }).toThrow('software breakpoint');

    expect(interpreter.debugMode).toBe(false);
  });

  test('executeBuffer() should throw a typed runtime error for a possible infinite loop without entering debug mode', () => {
    const executable = Buffer.from([0x6f, 0x43, 0xff, 0x0f, 0x00, 0xf0]);
    const interpreter = new Interpreter();
    interpreter.instructionsCap = 3;
    const isTTYDescriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');

    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: true,
    });

    try {
      expect(() => {
        interpreter.executeBuffer(executable, { inputFileName: 'infiniteLoop.e' });
      }).toThrow('Possible infinite loop');

      expect(interpreter.debugMode).toBe(false);
    } finally {
      if (isTTYDescriptor) {
        Object.defineProperty(process.stdin, 'isTTY', isTTYDescriptor);
      } else {
        delete process.stdin.isTTY;
      }
    }
  });

  test('buildReportArtifacts() should return .lst and .bst report text without writing files', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));

    const executable = Buffer.from([0x6f, 0x43, 0x05, 0xd0, 0x02, 0xf0, 0x01, 0xf0, 0x00, 0xf0]);
    const interpreter = new Interpreter();

    interpreter.executeBuffer(executable, { inputFileName: 'demoA.e' });
    const { lstContent, bstContent } = interpreter.buildReportArtifacts('Cheese', 'demoA.e');

    expect(typeof lstContent).toBe('string');
    expect(typeof bstContent).toBe('string');
    expect(lstContent).toContain('Cheese');
    expect(lstContent).toContain('Input file name');
    expect(lstContent).toContain('demoA.e');
    expect(lstContent).toContain('5\n');
    expect(bstContent).toContain('Cheese');
    expect(bstContent).toContain('0101');
  });

  test('executeBuffer() should optionally return in-memory .lst and .bst reports in its result shape', () => {
    const executable = Buffer.from([0x6f, 0x43, 0x05, 0xd0, 0x02, 0xf0, 0x01, 0xf0, 0x00, 0xf0]);
    const interpreter = new Interpreter();

    const result = interpreter.executeBuffer(executable, {
      inputFileName: 'demoA.e',
      buildReports: true,
      userName: 'Cheese',
      now: new Date('2024-01-01T00:00:00Z'),
    });

    expect(result.reports.lst).toContain('Cheese');
    expect(result.reports.lst).toContain('demoA.e');
    expect(result.reports.bst).toContain('Cheese');
  });

  test('executeBuffer() should require userName when buildReports is true', () => {
    const executable = Buffer.from([0x6f, 0x43, 0x05, 0xd0, 0x02, 0xf0, 0x01, 0xf0, 0x00, 0xf0]);
    const interpreter = new Interpreter();

    expect(() => {
      interpreter.executeBuffer(executable, {
        inputFileName: 'demoA.e',
        buildReports: true,
      });
    }).toThrow(InterpreterRuntimeError);
  });

  test('executeBuffer() should honor loadPoint when loading executable bytes into memory', () => {
    const executable = Buffer.from([0x6f, 0x53, 0x00, 0x00, 0x43, 0x00, 0xf0]);
    const interpreter = new Interpreter();

    const result = interpreter.executeBuffer(executable, {
      inputFileName: 'loadPoint.e',
      loadPoint: 0x20,
    });

    expect(result.loadPoint).toBe(0x20);
    expect(result.pc).toBe(0x21);
    expect(result.mem[0x20]).toBe(0xf000);
  });

  test('executeBuffer() should support simulated SIN input through inputBuffer in the pure API', () => {
    const source = `
      lea r0, buffer
      sin r0
      sout r0
      halt
      buffer: .zero 8
    `;

    const assembler = new Assembler();
    const assembly = assembler.assembleSource(source, { inputFileName: 'sinProgram.a' });
    const interpreter = new Interpreter();

    const result = interpreter.executeBuffer(assembly.outputBytes, {
      inputFileName: 'sinProgram.e',
      inputBuffer: 'hi\n',
    });

    const bufferAddress = assembly.symbolTable.buffer;
    expect(String.fromCharCode(result.mem[bufferAddress])).toBe('h');
    expect(String.fromCharCode(result.mem[bufferAddress + 1])).toBe('i');
    expect(result.output).toContain('hi');
  });

  test('executeBuffer() din throws InterpreterRuntimeError on EOF instead of spinning', () => {
    const source = `
      din r0
      halt
    `;
    const assembler = new Assembler();
    const assembly = assembler.assembleSource(source, { inputFileName: 'dinEof.a' });
    const interpreter = new Interpreter();

    jest.spyOn(interpreter, 'readLineFromStdin').mockReturnValue(
      { inputLine: '', isSimulated: false, isEOF: true }
    );

    expect(() => {
      interpreter.executeBuffer(assembly.outputBytes, { inputFileName: 'dinEof.e' });
    }).toThrow(InterpreterRuntimeError);
  });

  test('executeBuffer() hin throws InterpreterRuntimeError on EOF instead of spinning', () => {
    const source = `
      hin r0
      halt
    `;
    const assembler = new Assembler();
    const assembly = assembler.assembleSource(source, { inputFileName: 'hinEof.a' });
    const interpreter = new Interpreter();

    jest.spyOn(interpreter, 'readLineFromStdin').mockReturnValue(
      { inputLine: '', isSimulated: false, isEOF: true }
    );

    expect(() => {
      interpreter.executeBuffer(assembly.outputBytes, { inputFileName: 'hinEof.e' });
    }).toThrow(InterpreterRuntimeError);
  });

  test('executeBuffer() ain throws InterpreterRuntimeError on EOF instead of spinning', () => {
    const source = `
      ain r0
      halt
    `;
    const assembler = new Assembler();
    const assembly = assembler.assembleSource(source, { inputFileName: 'ainEof.a' });
    const interpreter = new Interpreter();

    jest.spyOn(interpreter, 'readCharFromStdin').mockReturnValue(
      { char: '', isSimulated: false, isEOF: true }
    );

    expect(() => {
      interpreter.executeBuffer(assembly.outputBytes, { inputFileName: 'ainEof.e' });
    }).toThrow(InterpreterRuntimeError);
  });

  test('executeBuffer() should reject incomplete S header entries', () => {
    const executable = Buffer.from([0x6f, 0x53, 0x00]);
    const interpreter = new Interpreter();

    expect(() => {
      interpreter.executeBuffer(executable, { inputFileName: 'badS.e' });
    }).toThrow(InvalidExecutableFormatError);
  });

  test('executeBuffer() should reject incomplete G header entries', () => {
    const executable = Buffer.from([0x6f, 0x47, 0x01]);
    const interpreter = new Interpreter();

    expect(() => {
      interpreter.executeBuffer(executable, { inputFileName: 'badG.e' });
    }).toThrow(InvalidExecutableFormatError);
  });

  test('executeBuffer() should reject incomplete A header entries', () => {
    const executable = Buffer.from([0x6f, 0x41, 0x01]);
    const interpreter = new Interpreter();

    expect(() => {
      interpreter.executeBuffer(executable, { inputFileName: 'badA.e' });
    }).toThrow(InvalidExecutableFormatError);
  });

  test('executeBuffer() should reject unknown header entries', () => {
    const executable = Buffer.from([0x6f, 0x58, 0x43, 0x00, 0xf0]);
    const interpreter = new Interpreter();

    expect(() => {
      interpreter.executeBuffer(executable, { inputFileName: 'badHeader.e' });
    }).toThrow(InvalidExecutableFormatError);
  });

  test('executeBuffer() should match oracle demoU sext behavior for representative field values', () => {
    const source = `
      mov r0, 0xFF
      mov r1, 3
      sext r0, r1
      hout r0
      nl

      mov r0, 0x11
      mov r1, 5
      sext r0, r1
      hout r0
      nl

      ld r0, x
      mov r1, 15
      sext r0, r1
      hout r0
      nl

      ld r0, x
      mov r1, 11
      sext r0, r1
      hout r0
      nl

      ld r0, x
      mov r1, 8
      sext r0, r1
      hout r0
      nl
      halt

      x: .word 0x1234
    `;

    const assembler = new Assembler();
    const { outputBytes } = assembler.assembleSource(source, { inputFileName: 'demoUSext.a' });
    const interpreter = new Interpreter();

    const result = interpreter.executeBuffer(outputBytes, { inputFileName: 'demoUSext.e' });

    expect(result.output).toBe('ffff\nfffb\n4\nfff4\nfff7\n');
  });

  test('executeBuffer() should match oracle sext behavior for the experiment sweep cases', () => {
    const source = `
      mov r0, 0x34
      mov r1, 3
      sext r0, r1
      hout r0
      nl

      mov r0, 0x34
      mov r1, 7
      sext r0, r1
      hout r0
      nl

      mov r0, 0x34
      mov r1, 11
      sext r0, r1
      hout r0
      nl

      mov r0, 0x34
      mov r1, 15
      sext r0, r1
      hout r0
      nl
      halt
    `;

    const assembler = new Assembler();
    const { outputBytes } = assembler.assembleSource(source, { inputFileName: 'sextSweep.a' });
    const interpreter = new Interpreter();

    const result = interpreter.executeBuffer(outputBytes, { inputFileName: 'sextSweep.e' });

    expect(result.output).toBe('0\nfffc\nfff4\n4\n');
  });

  // OB-034: -m flag post-run memory display
  describe('-m flag (post-run memory display)', () => {
    // demoA: mvi r0, 5 / dout / nl / halt — 4 words at 0000-0003
    const demoA = Buffer.from([0x6f, 0x43, 0x05, 0xd0, 0x02, 0xf0, 0x01, 0xf0, 0x00, 0xf0]);

    test('executeBuffer() without memDisplay: no memory display block in output', () => {
      const interpreter = new Interpreter();
      const result = interpreter.executeBuffer(demoA, { inputFileName: 'demoA.e' });
      expect(result.output).not.toContain('Memory display');
    });

    test('executeBuffer() with memDisplay: output contains memory display banners', () => {
      const interpreter = new Interpreter();
      const result = interpreter.executeBuffer(demoA, {
        inputFileName: 'demoA.e',
        runtimeOptions: { memDisplay: true },
      });
      expect(result.output).toContain('Memory display');
      expect(result.output).toContain('End of memory display');
    });

    test('executeBuffer() with memDisplay: shows loaded words at correct hex addresses', () => {
      const interpreter = new Interpreter();
      const result = interpreter.executeBuffer(demoA, {
        inputFileName: 'demoA.e',
        runtimeOptions: { memDisplay: true },
      });
      // 4 instructions: mvi r0,5 (d005) / dout (f002) / nl (f001) / halt (f000)
      expect(result.output).toContain('0000: d005');
      expect(result.output).toContain('0001: f002');
      expect(result.output).toContain('0002: f001');
      expect(result.output).toContain('0003: f000');
    });

    test('executeBuffer() with memDisplay and loadPoint: memory addresses offset by loadPoint', () => {
      const interpreter = new Interpreter();
      const result = interpreter.executeBuffer(demoA, {
        inputFileName: 'demoA.e',
        loadPoint: 0x10,
        runtimeOptions: { memDisplay: true },
      });
      expect(result.output).toContain('0010: d005');
      expect(result.output).toContain('0013: f000');
      expect(result.output).not.toContain('0000: d005');
    });
  });

  // OB-035: -r flag post-run register display
  describe('-r flag (post-run register display)', () => {
    // demoA: mvi r0, 5 / dout / nl / halt
    const demoA = Buffer.from([0x6f, 0x43, 0x05, 0xd0, 0x02, 0xf0, 0x01, 0xf0, 0x00, 0xf0]);

    test('executeBuffer() without regDisplay: no register display block in output', () => {
      const interpreter = new Interpreter();
      const result = interpreter.executeBuffer(demoA, { inputFileName: 'demoA.e' });
      expect(result.output).not.toContain('Register display');
    });

    test('executeBuffer() with regDisplay: output contains register display banners', () => {
      const interpreter = new Interpreter();
      const result = interpreter.executeBuffer(demoA, {
        inputFileName: 'demoA.e',
        runtimeOptions: { regDisplay: true },
      });
      expect(result.output).toContain('Register display');
      expect(result.output).toContain('End of register display');
    });

    test('executeBuffer() with regDisplay: shows all register names', () => {
      const interpreter = new Interpreter();
      const result = interpreter.executeBuffer(demoA, {
        inputFileName: 'demoA.e',
        runtimeOptions: { regDisplay: true },
      });
      expect(result.output).toContain('pc =');
      expect(result.output).toContain('ir =');
      expect(result.output).toContain('NZCV =');
      expect(result.output).toContain('r0 =');
      expect(result.output).toContain('r4 =');
      expect(result.output).toContain('fp =');
      expect(result.output).toContain('sp =');
      expect(result.output).toContain('lr =');
    });

    test('executeBuffer() with regDisplay: r0 shows 5 after mvi r0, 5', () => {
      const interpreter = new Interpreter();
      const result = interpreter.executeBuffer(demoA, {
        inputFileName: 'demoA.e',
        runtimeOptions: { regDisplay: true },
      });
      // r0 should be 0x0005 after mvi r0, 5
      expect(result.output).toContain('r0 = 0005');
    });
  });

  // OB-036: -x flag hout 4-digit hex output
  describe('-x flag (hout 4-digit hex)', () => {
    // mvi r0, 255 / hout / nl / halt
    const hout255 = Buffer.from([0x6F, 0x43, 0xFF, 0xD0, 0x04, 0xF0, 0x01, 0xF0, 0x00, 0xF0]);
    // mvi r0, 16 / hout / nl / halt
    const hout16  = Buffer.from([0x6F, 0x43, 0x10, 0xD0, 0x04, 0xF0, 0x01, 0xF0, 0x00, 0xF0]);

    test('hout without -x: prints 2-digit hex (no leading zeros)', () => {
      const interpreter = new Interpreter();
      const result = interpreter.executeBuffer(hout255, { inputFileName: 'hout.e' });
      expect(result.output).toBe('ff\n');
    });

    test('hout with -x: prints 4-digit hex (leading zeros)', () => {
      const interpreter = new Interpreter();
      const result = interpreter.executeBuffer(hout255, {
        inputFileName: 'hout.e',
        runtimeOptions: { hexOutput: true },
      });
      expect(result.output).toBe('00ff\n');
    });

    test('hout with -x: 16 (0x10) prints as 0010', () => {
      const interpreter = new Interpreter();
      const result = interpreter.executeBuffer(hout16, {
        inputFileName: 'hout.e',
        runtimeOptions: { hexOutput: true },
      });
      expect(result.output).toBe('0010\n');
    });

    test('hout without -x: 16 (0x10) prints as 10', () => {
      const interpreter = new Interpreter();
      const result = interpreter.executeBuffer(hout16, { inputFileName: 'hout.e' });
      expect(result.output).toBe('10\n');
    });
  });

  // ---------------------------------------------------------------------------
  // Debugger Phase 2 parity (#103): breakpoint b set/cancel
  // ---------------------------------------------------------------------------

  describe('-d flag debugger Phase 2 — breakpoints (#103)', () => {
    // demoA: mvi r0, 5 / dout / nl / halt  (4 words at 0x0000..0x0003)
    const demoA = Buffer.from([0x6f, 0x43, 0x05, 0xd0, 0x02, 0xf0, 0x01, 0xf0, 0x00, 0xf0]);

    function captureStdout(fn) {
      const parts = [];
      process.stdout.write.mockImplementation((msg) => parts.push(msg));
      try { fn(); } finally {
        process.stdout.write.mockImplementation(() => {});
      }
      return parts.join('');
    }

    test('debugBreakpoint defaults to null', () => {
      const interpreter = new Interpreter();
      expect(interpreter.debugBreakpoint).toBeNull();
    });

    test('b {addr} in debug session sets breakpoint; shows Breakpoint-at banner when hit', () => {
      // Set breakpoint at 3 (halt), then g to continue; halt should trigger banner
      const interpreter = new Interpreter();
      interpreter.debugMode = true;
      interpreter.allowRuntimeDebugging = false;
      interpreter.inputBuffer = 'b 3\ng\n';
      const out = captureStdout(() => {
        interpreter.executeBuffer(demoA, { inputFileName: 'demoA.e' });
      });
      expect(out).toContain('Breakpoint at');
    });

    test('Breakpoint-at banner shows source text when sourceMap present', () => {
      const source = '  mvi r0, 5\n  dout\n  nl\n  halt\n';
      const assembler = new Assembler();
      const assembly  = assembler.assembleSource(source, { inputFileName: 'demoA.a' });
      const interpreter = new Interpreter();
      interpreter.debugMode = true;
      interpreter.allowRuntimeDebugging = false;
      interpreter.sourceMap = assembler.sourceMap;
      interpreter.inputBuffer = 'b 3\ng\nq\n';
      const out = captureStdout(() => {
        interpreter.executeBuffer(assembly.outputBytes, { inputFileName: 'demoA.e' });
      });
      expect(out).toContain('Breakpoint at');
      expect(out).toContain('halt');
    });

    test('b (no arg) cancels active breakpoint', () => {
      // Set breakpoint at 3, cancel it, then g; no banner should appear
      const interpreter = new Interpreter();
      interpreter.debugMode = true;
      interpreter.allowRuntimeDebugging = false;
      interpreter.inputBuffer = 'b 3\nb\ng\n';
      const out = captureStdout(() => {
        interpreter.executeBuffer(demoA, { inputFileName: 'demoA.e' });
      });
      expect(out).not.toContain('Breakpoint at');
    });

    test('breakpoint fires during g continue and re-enters debugger', () => {
      // After g, at halt (addr 3), debug prompt should re-appear
      const interpreter = new Interpreter();
      interpreter.debugMode = true;
      interpreter.allowRuntimeDebugging = false;
      interpreter.inputBuffer = 'b 3\ng\nq\n';
      const out = captureStdout(() => {
        interpreter.executeBuffer(demoA, { inputFileName: 'demoA.e' });
      });
      // halt>>> prompt appears after breakpoint fires and user types q
      expect(out).toContain('halt>>>');
    });
  });

  // ---------------------------------------------------------------------------
  // Debugger Phase 1 parity (#102): debug() oracle format + g/r/m commands
  // ---------------------------------------------------------------------------

  describe('-d flag debugger (Phase 1 oracle parity)', () => {
    // demoA: mvi r0, 5 / dout / nl / halt
    const demoA = Buffer.from([0x6f, 0x43, 0x05, 0xd0, 0x02, 0xf0, 0x01, 0xf0, 0x00, 0xf0]);

    // Capture stdout.write during fn(); restore silent mock after.
    function captureStdout(fn) {
      const parts = [];
      process.stdout.write.mockImplementation((msg) => parts.push(msg));
      try { fn(); } finally {
        process.stdout.write.mockImplementation(() => {});
      }
      return parts.join('');
    }

    function runDebug(inputBuffer) {
      const interpreter = new Interpreter();
      interpreter.debugMode = true;
      interpreter.allowRuntimeDebugging = false; // keep test-safe
      interpreter.inputBuffer = inputBuffer;
      return captureStdout(() => {
        interpreter.executeBuffer(demoA, { inputFileName: 'demoA.e' });
      });
    }

    test('Empty Enter steps and shows source-text state format', () => {
      const source = '  mvi r0, 5\n  dout\n  nl\n  halt\n';
      const assembler = new Assembler();
      const assembly  = assembler.assembleSource(source, { inputFileName: 'demoA.a' });
      const interpreter = new Interpreter();
      interpreter.debugMode = true;
      interpreter.allowRuntimeDebugging = false;
      interpreter.sourceMap = assembler.sourceMap;
      interpreter.inputBuffer = '\nq\n';
      const out = captureStdout(() => {
        interpreter.executeBuffer(assembly.outputBytes, { inputFileName: 'demoA.e' });
      });
      // After Enter, state line should contain the raw source text, not hex
      expect(out).toContain('mvi r0, 5');
      expect(out).not.toContain('; mvi'); // old format
    });

    test('State format without sourceMap falls back to hex machine word', () => {
      const out = runDebug('\nq\n');
      // demoA first instruction = 0xd005 (mvi r0, 5)
      expect(out).toContain('d005');
    });

    test('State address field is 2-char right-justified hex', () => {
      const out = runDebug('\nq\n');
      // addr=0 → " 0:     " (space-0-colon-5spaces)
      expect(out).toMatch(/ 0:     /);
    });

    test('q quits without stepping', () => {
      const out = runDebug('q\n');
      // After q, no state line should appear
      expect(out).not.toContain(':     ');
    });

    test('g disables debugMode and lets execution continue', () => {
      // After g at mvi, execution continues to dout → output includes '5'
      const out = runDebug('g\n');
      expect(out).toContain('5');
    });

    test('r shows register display without stepping', () => {
      // r at mvi>>> should show regs, then re-prompt;
      // we follow with q to quit.
      const out = runDebug('r\nq\n');
      expect(out).toContain('pc = ');
      expect(out).toContain('r0 = ');
      expect(out).toContain('NZCV = ');
    });

    test('m shows all used memory without stepping', () => {
      const out = runDebug('m\nq\n');
      // demoA loads at 0x0000; 4 words (d005, f002, f001, f000)
      expect(out).toContain('0000: d005');
      expect(out).toContain('0003: f000');
    });

    test('m addr shows single word at that address', () => {
      const out = runDebug('m 1\nq\n');
      // addr 1 = f002 (dout)
      expect(out).toContain('0001: f002');
    });

    test('i shows next instruction source without stepping (hex fallback)', () => {
      const out = runDebug('i\nq\n');
      // Without sourceMap, shows hex machine word indented 4 spaces
      expect(out).toMatch(/    d005/);
    });
  });

  // ---------------------------------------------------------------------------
  // -t flag: per-step trace output (#77)
  // ---------------------------------------------------------------------------

  describe('-t flag (trace mode)', () => {
    // demoA: mvi r0, 5 / dout / nl / halt
    const demoA = Buffer.from([0x6f, 0x43, 0x05, 0xd0, 0x02, 0xf0, 0x01, 0xf0, 0x00, 0xf0]);

    // Temporarily redirect stdout.write into a buffer; restore silent mock afterward.
    function captureStdout(fn) {
      const written = [];
      process.stdout.write.mockImplementation((msg) => written.push(msg));
      try { fn(); } finally {
        process.stdout.write.mockImplementation(() => {});
      }
      return written.join('');
    }

    test('traceMode defaults to false', () => {
      const interpreter = new Interpreter();
      expect(interpreter.traceMode).toBe(false);
    });

    test('sourceMap defaults to null on a new Interpreter', () => {
      const interpreter = new Interpreter();
      expect(interpreter.sourceMap).toBeNull();
    });

    test('traceMode=false produces no trace lines', () => {
      const interpreter = new Interpreter();
      const out = captureStdout(() => {
        interpreter.executeBuffer(demoA, { inputFileName: 'demoA.e' });
      });
      // No trace-style address:source lines
      expect(out).not.toMatch(/^\s+\w+:/m);
    });

    test('pre-instruction line without sourceMap uses (unknown) fallback', () => {
      const interpreter = new Interpreter();
      interpreter.traceMode = true;
      const out = captureStdout(() => {
        interpreter.executeBuffer(demoA, { inputFileName: 'demoA.e' });
      });
      // First instruction is at address 0x000 → "  0:   (unknown)"
      expect(out).toContain('  0:   (unknown)');
    });

    test('pre-instruction line with sourceMap shows raw source text', () => {
      const source = '  mvi r0, 5\n  dout\n  nl\n  halt\n';
      const assembler = new Assembler();
      const assembly = assembler.assembleSource(source, { inputFileName: 'trace.a' });
      const interpreter = new Interpreter();
      interpreter.traceMode = true;
      interpreter.sourceMap = assembler.sourceMap;
      const out = captureStdout(() => {
        interpreter.executeBuffer(assembly.outputBytes, { inputFileName: 'trace.e' });
      });
      // First instruction line: address 0 + raw source text
      expect(out).toContain('  0:   ');
      expect(out).toContain('mvi r0, 5');
    });

    test('register diff line has correct <rN = old/new> format', () => {
      const source = '  mvi r0, 5\n  halt\n';
      const assembler = new Assembler();
      const assembly = assembler.assembleSource(source, { inputFileName: 'trace.a' });
      const interpreter = new Interpreter();
      interpreter.traceMode = true;
      const out = captureStdout(() => {
        interpreter.executeBuffer(assembly.outputBytes, { inputFileName: 'trace.e' });
      });
      // r0 changes from 0 to 5 (0 → 5 in hex: "0/5")
      expect(out).toContain('<r0 = 0/5>');
    });

    test('flag diff line has correct <NZCV = nzcv> format', () => {
      const source = '  mvi r0, 1\n  cmp r0, r0\n  halt\n';
      const assembler = new Assembler();
      const assembly = assembler.assembleSource(source, { inputFileName: 'trace.a' });
      const interpreter = new Interpreter();
      interpreter.traceMode = true;
      const out = captureStdout(() => {
        interpreter.executeBuffer(assembly.outputBytes, { inputFileName: 'trace.e' });
      });
      // cmp r0, r0 → 1-1=0 → N=0 Z=1 C=1 V=0 → <NZCV = 0110>
      // (C=1 because 1 + (-1) has a borrow-complement carry in this ISA)
      expect(out).toContain('<NZCV = 0110>');
    });

    test('branch-taken shows <pc = old/new> diff', () => {
      // A minimal program: brz to halt so branch fires on first cmp
      // mvi r0, 0  → r0=0, zero flag might not be set yet (mvi sets flags?)
      // Actually: cmp r0, r0 → Z=1; brz label → taken
      const source = '  mvi r0, 0\n  cmp r0, r0\n  brz end\n  halt\nend: halt\n';
      const assembler = new Assembler();
      const assembly = assembler.assembleSource(source, { inputFileName: 'trace.a' });
      const interpreter = new Interpreter();
      interpreter.traceMode = true;
      const out = captureStdout(() => {
        interpreter.executeBuffer(assembly.outputBytes, { inputFileName: 'trace.e' });
      });
      // brz is at address 2, end: halt is at address 4 (0-based)
      // pc before brz = 3 (incremented past brz fetch); pc after = 4 (end)
      expect(out).toMatch(/<pc = \w+\/\w+>/);
    });

    test('branch not taken produces no <pc = ...> diff', () => {
      // brz fires only when Z=1; if Z=0, no branch
      // mvi r0, 1 → r0=1; cmp r0, r0 → Z=1, brz fires... use brnz instead
      // brnz fires when N|Z != 1 (i.e. result non-zero). cmp 1,1 = 0 so Z=1 → brnz not taken
      const source = '  mvi r0, 1\n  cmp r0, r0\n  brnz skip\n  halt\nskip: halt\n';
      const assembler = new Assembler();
      const assembly = assembler.assembleSource(source, { inputFileName: 'trace.a' });
      const interpreter = new Interpreter();
      interpreter.traceMode = true;
      const out = captureStdout(() => {
        interpreter.executeBuffer(assembly.outputBytes, { inputFileName: 'trace.e' });
      });
      expect(out).not.toMatch(/<pc = /);
    });

    test('halt produces no register/flag diff line', () => {
      const source = '  halt\n';
      const assembler = new Assembler();
      const assembly = assembler.assembleSource(source, { inputFileName: 'trace.a' });
      const interpreter = new Interpreter();
      interpreter.traceMode = true;
      const out = captureStdout(() => {
        interpreter.executeBuffer(assembly.outputBytes, { inputFileName: 'trace.e' });
      });
      // Only trace header line; no diff output after halt
      expect(out).not.toContain('<r');
      expect(out).not.toContain('<NZCV');
      expect(out).not.toContain('<pc');
    });

    test('program output (dout) is interspersed between trace lines naturally', () => {
      const source = '  mvi r0, 7\n  dout\n  halt\n';
      const assembler = new Assembler();
      const assembly = assembler.assembleSource(source, { inputFileName: 'trace.a' });
      const interpreter = new Interpreter();
      interpreter.traceMode = true;
      const out = captureStdout(() => {
        interpreter.executeBuffer(assembly.outputBytes, { inputFileName: 'trace.e' });
      });
      // dout line should appear after the mvi trace + diff, before halt trace
      const mviPos = out.indexOf('<r0 = 0/7>');
      const doutPos = out.indexOf('7');
      const haltPos = out.lastIndexOf('  1:');
      expect(mviPos).toBeGreaterThanOrEqual(0);
      expect(doutPos).toBeGreaterThan(mviPos);
      // The dout value appears before the next (dout) trace line
      expect(doutPos).toBeLessThanOrEqual(haltPos);
    });
  });
});
