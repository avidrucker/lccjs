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
});
