const Assembler = require('../../src/core/assembler');
const Interpreter = require('../../src/core/interpreter');
const { buildReportArtifacts } = require('../../src/utils/reportArtifacts');

describe('Report Artifacts Unit Tests', () => {
  const fixedNow = new Date('2024-01-01T00:00:00Z');

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

  test('should generate deterministic assembler-style lst and bst content in memory', () => {
    const assembler = new Assembler();
    assembler.assembleSource(
      `
        mov r0, 5
        dout r0
        nl
        halt
      `,
      { inputFileName: 'demoA.a' }
    );

    const { lstContent, bstContent } = buildReportArtifacts({
      assembler,
      userName: 'Cheese',
      inputFileName: 'demoA.a',
      now: fixedNow,
    });

    expect(lstContent).toContain('Cheese');
    expect(lstContent).toContain('Header');
    expect(lstContent).toContain('Loc   Code           Source Code');
    expect(lstContent).toContain('mov r0, 5');
    expect(bstContent).toContain('Cheese');
    expect(bstContent).toContain('1101 0000 0000 0101');
  });

  test('should generate deterministic interpreter-style lst and bst content in memory', () => {
    const interpreter = new Interpreter();
    interpreter.executeBuffer(
      Buffer.from([0x6f, 0x43, 0x05, 0xd0, 0x02, 0xf0, 0x01, 0xf0, 0x00, 0xf0]),
      { inputFileName: 'demoA.e' }
    );

    const { lstContent, bstContent } = buildReportArtifacts({
      interpreter,
      userName: 'Cheese',
      inputFileName: 'demoA.e',
      now: fixedNow,
    });

    expect(lstContent).toContain('Cheese');
    expect(lstContent).toContain('Loc   Code');
    expect(lstContent).toContain('Input file name');
    expect(lstContent).toContain('demoA.e');
    expect(lstContent).toContain('5\n');
    expect(bstContent).toContain('Cheese');
    expect(bstContent).toContain('1101 0000 0000 0101');
  });
});
