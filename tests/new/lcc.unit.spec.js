const Assembler = require('../../src/core/assembler');
const Interpreter = require('../../src/core/interpreter');
const LCC = require('../../src/core/lcc');

describe('LCC Unit Tests', () => {
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

  test('handleSingleFile() should route .hex input through assembly and execution', () => {
    const lcc = new LCC();
    jest.spyOn(lcc, 'assembleFile').mockImplementation(() => {});
    jest.spyOn(lcc, 'executeFile').mockImplementation(() => {});

    lcc.handleSingleFile('demo.hex');

    expect(lcc.assembleFile).toHaveBeenCalledTimes(1);
    expect(lcc.executeFile).toHaveBeenCalledWith(false, true);
  });

  test('handleSingleFile() should route .e input directly to execution', () => {
    const lcc = new LCC();
    jest.spyOn(lcc, 'executeFile').mockImplementation(() => {});

    lcc.handleSingleFile('demo.e');

    expect(lcc.outputFileName).toBe('demo.e');
    expect(lcc.executeFile).toHaveBeenCalledWith(false);
  });

  test('handleSingleFile() should route .o input through assembly/link handling path', () => {
    const lcc = new LCC();
    jest.spyOn(lcc, 'assembleFile').mockImplementation(() => {});

    lcc.handleSingleFile('module.o');

    expect(lcc.assembleFile).toHaveBeenCalledTimes(1);
  });

  test('handleSingleFile() should execute assembled textual source when it does not produce an object module', () => {
    const lcc = new LCC();
    jest.spyOn(lcc, 'assembleFile').mockImplementation(() => {
      lcc.assembler = { isObjectModule: false };
    });
    jest.spyOn(lcc, 'executeFile').mockImplementation(() => {});

    lcc.handleSingleFile('demoA.a');

    expect(lcc.assembleFile).toHaveBeenCalledTimes(1);
    expect(lcc.executeFile).toHaveBeenCalledWith(true);
  });

  test('handleSingleFile() should not execute textual source when assembly produces an object module', () => {
    const lcc = new LCC();
    jest.spyOn(lcc, 'assembleFile').mockImplementation(() => {
      lcc.assembler = { isObjectModule: true };
    });
    jest.spyOn(lcc, 'executeFile').mockImplementation(() => {});

    lcc.handleSingleFile('module.a');

    expect(lcc.executeFile).not.toHaveBeenCalled();
  });

  test('main() should route first-argument object files to linking behavior', () => {
    const lcc = new LCC();
    jest.spyOn(lcc, 'parseArguments').mockImplementation((args) => {
      lcc.args = [...args];
    });
    jest.spyOn(lcc, 'linkObjectFiles').mockImplementation(() => {});
    jest.spyOn(lcc, 'handleSingleFile').mockImplementation(() => {});

    lcc.main(['module1.o', 'module2.a']);

    expect(lcc.linkObjectFiles).toHaveBeenCalledWith(['module1.o', 'module2.a']);
    expect(lcc.handleSingleFile).not.toHaveBeenCalled();
  });

  test('buildReportArtifacts() should resolve the user name only when reports are being built', () => {
    const lcc = new LCC();
    const assembler = new Assembler();
    const assembly = assembler.assembleSource(
      `
        ; demoA.a: simple test
        mov r0, 5
        dout r0
        nl
        halt
      `,
      { inputFileName: 'demoA.a' }
    );
    const interpreter = new Interpreter();

    interpreter.executeBuffer(assembly.outputBytes, { inputFileName: 'demoA.e' });

    lcc.assembler = assembler;
    lcc.interpreter = interpreter;
    lcc.inputFileName = 'demoA.a';
    jest.spyOn(lcc, 'resolveUserName').mockReturnValue('Cheese');

    const { lstContent, bstContent } = lcc.buildReportArtifacts(true, false, new Date('2024-01-01T00:00:00Z'));

    expect(lcc.resolveUserName).toHaveBeenCalledTimes(1);
    expect(lstContent).toContain('Cheese');
    expect(bstContent).toContain('Cheese');
  });

  test('parseArguments() should capture custom output file names', () => {
    const lcc = new LCC();

    lcc.parseArguments(['-o', 'custom.e', 'demoA.a']);

    expect(lcc.outputFileName).toBe('custom.e');
    expect(lcc.args).toEqual(['demoA.a']);
  });

  test('parseArguments() should reject missing output file names after -o', () => {
    const lcc = new LCC();

    expect(() => {
      lcc.parseArguments(['-o']);
    }).toThrow('Missing output file name after -o flag');
  });

  test('executeFile() should enable CLI-only runtime debugging on the wrapped interpreter', () => {
    const lcc = new LCC();
    lcc.outputFileName = 'demo.e';
    lcc.generateStats = false;

    const loadSpy = jest.spyOn(Interpreter.prototype, 'loadExecutableFile').mockImplementation(() => {});
    const runSpy = jest.spyOn(Interpreter.prototype, 'run').mockImplementation(function () {
      expect(this.allowRuntimeDebugging).toBe(true);
      this.running = false;
    });

    try {
      expect(() => {
        lcc.executeFile(false, false);
      }).not.toThrow();
    } finally {
      loadSpy.mockRestore();
      runSpy.mockRestore();
    }
  });
});
