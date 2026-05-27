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
});
