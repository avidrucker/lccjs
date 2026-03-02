const Assembler = require('../../src/core/assembler');
const { AssemblerError } = require('../../src/utils/errors');

describe('Assembler Unit Tests', () => {
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

  test('assembleSource() should assemble a simple .a program entirely in memory', () => {
    const source = `
      ; demoA.a: simple test
      mov r0, 5
      dout r0
      nl
      halt
    `;

    const assembler = new Assembler();
    const result = assembler.assembleSource(source, { inputFileName: 'demoA.a' });

    expect(assembler.errorFlag).toBe(false);
    expect(assembler.outputFileName).toBe('demoA.e');
    expect(assembler.outputBuffer.length).toBeGreaterThan(0);
    expect(assembler.outputBuffer[0]).toBe(0xd005);
    expect(result.inputFileName).toBe('demoA.a');
    expect(result.outputFileName).toBe('demoA.e');
    expect(result.isObjectModule).toBe(false);
    expect(result.outputBuffer[0]).toBe(0xd005);
    expect(Buffer.isBuffer(result.outputBytes)).toBe(true);
    expect(result.startAddress).toBe(0);
    expect(result.reports).toEqual({ lst: null, bst: null });
  });

  test('toOutputBuffer() should return a serialized executable buffer entirely in memory', () => {
    const source = `
      mov r0, 5
      dout r0
      nl
      halt
    `;

    const assembler = new Assembler();
    assembler.assembleSource(source, { inputFileName: 'demoA.a' });
    const bytes = assembler.toOutputBuffer();

    expect(Buffer.isBuffer(bytes)).toBe(true);
    expect(bytes[0]).toBe('o'.charCodeAt(0));
    expect(bytes.includes('C'.charCodeAt(0))).toBe(true);
    expect(bytes.length).toBeGreaterThan(4);
  });

  test('buildReportArtifacts() should return .lst and .bst report text without writing files', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));

    const source = `
      mov r0, 5
      dout r0
      nl
      halt
    `;

    const assembler = new Assembler();
    assembler.assembleSource(source, { inputFileName: 'demoA.a' });
    const { lstContent, bstContent } = assembler.buildReportArtifacts('Cheese');

    expect(typeof lstContent).toBe('string');
    expect(typeof bstContent).toBe('string');
    expect(lstContent).toContain('Cheese');
    expect(lstContent).toContain('Header');
    expect(lstContent).toContain('mov r0, 5');
    expect(bstContent).toContain('Cheese');
    expect(bstContent).toContain('0000');
  });

  test('assembleSource() should optionally return in-memory .lst and .bst reports in its result shape', () => {
    const source = `
      mov r0, 5
      dout r0
      nl
      halt
    `;

    const assembler = new Assembler();
    const result = assembler.assembleSource(source, {
      inputFileName: 'demoA.a',
      buildReports: true,
      userName: 'Cheese',
      now: new Date('2024-01-01T00:00:00Z'),
    });

    expect(result.reports.lst).toContain('Cheese');
    expect(result.reports.lst).toContain('Header');
    expect(result.reports.lst).toContain('mov r0, 5');
    expect(result.reports.bst).toContain('Cheese');
  });

  test('assembleSource() should require userName when buildReports is true', () => {
    const source = `
      mov r0, 5
      halt
    `;

    const assembler = new Assembler();

    expect(() => {
      assembler.assembleSource(source, {
        inputFileName: 'demoA.a',
        buildReports: true,
      });
    }).toThrow(AssemblerError);
  });

  test('assembleSource() should reject non-.a source filenames even when given valid assembly text', () => {
    const source = `
      mov r0, 5
      halt
    `;

    const assembler = new Assembler();

    expect(() => {
      assembler.assembleSource(source, { inputFileName: 'demoA.txt' });
    }).toThrow('Unsupported file type');
  });

  test('assembleSource() should reject .ap files with the assemblerPlus guidance message', () => {
    const source = `
      mov r0, 5
      halt
    `;

    const assembler = new Assembler();

    expect(() => {
      assembler.assembleSource(source, { inputFileName: 'demoA.ap' });
    }).toThrow('Error: .ap files are not supported by assembler.js - Did you mean to use assemblerPlus.js?');
  });

  test('assembleSource() should throw a typed assembler error for an undefined label', () => {
    const source = `
      br missingLabel
      halt
    `;

    const assembler = new Assembler();

    expect(() => {
      assembler.assembleSource(source, { inputFileName: 'undefinedLabel.a' });
    }).toThrow(AssemblerError);
  });
});
