const Assembler = require('../../src/core/assembler');
const Interpreter = require('../../src/core/interpreter');
const ILCC = require('../../src/interactive/ilcc');
const LCC = require('../../src/cli/lcc');

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
    jest.spyOn(lcc, 'resolveUserName').mockReturnValue('TestUser A');
    jest.spyOn(lcc, 'linkObjectFiles').mockImplementation(() => {});
    jest.spyOn(lcc, 'handleSingleFile').mockImplementation(() => {});

    lcc.main(['module1.o', 'module2.a']);

    expect(lcc.linkObjectFiles).toHaveBeenCalledWith(['module1.o', 'module2.a']);
    expect(lcc.handleSingleFile).not.toHaveBeenCalled();
  });

  // -o in link mode (#557)
  test('main() with -o and .o input preserves the custom output name for linkObjectFiles', () => {
    const lcc = new LCC();
    jest.spyOn(lcc, 'linkObjectFiles').mockImplementation(() => {});

    lcc.main(['-o', 'custom.e', 'a.o']);

    expect(lcc.outputFileName).toBe('custom.e');
    expect(lcc.linkObjectFiles).toHaveBeenCalledWith(['a.o']);
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

  // ---------------------------------------------------------------------------
  // -i flag: interactive mode delegation (#101 / OB-048)
  // ---------------------------------------------------------------------------

  describe('parseArguments() — -i, -e, -c flags', () => {
    test('-i sets options.interactive', () => {
      const lcc = new LCC();
      lcc.parseArguments(['-i', 'demo.a']);
      expect(lcc.options.interactive).toBe(true);
    });

    test('-e sets options.efficientMode', () => {
      const lcc = new LCC();
      lcc.parseArguments(['-e', 'demo.a']);
      expect(lcc.options.efficientMode).toBe(true);
    });

    test('-c sets options.colorblindMode', () => {
      const lcc = new LCC();
      lcc.parseArguments(['-c', 'demo.a']);
      expect(lcc.options.colorblindMode).toBe(true);
    });

    test('-i -e -c can be combined', () => {
      const lcc = new LCC();
      lcc.parseArguments(['-i', '-e', '-c', 'demo.a']);
      expect(lcc.options.interactive).toBe(true);
      expect(lcc.options.efficientMode).toBe(true);
      expect(lcc.options.colorblindMode).toBe(true);
    });

    // -v / --verbose (#15)
    test('-v sets options.verbose', () => {
      const lcc = new LCC();
      lcc.parseArguments(['-v', 'demo.a']);
      expect(lcc.options.verbose).toBe(true);
    });

    test('--verbose sets options.verbose', () => {
      const lcc = new LCC();
      lcc.parseArguments(['--verbose', 'demo.a']);
      expect(lcc.options.verbose).toBe(true);
    });

    test('options.verbose is absent (falsy) without the flag', () => {
      const lcc = new LCC();
      lcc.parseArguments(['demo.a']);
      expect(lcc.options.verbose).toBeFalsy();
    });
  });

  describe('runInteractiveMode() — delegation to ILCC', () => {
    test('creates an ILCC instance and exposes it as this.ilcc', () => {
      const lcc = new LCC();
      lcc.inputFileName = 'demo.a';
      jest.spyOn(ILCC.prototype, 'main').mockImplementation(() => {});
      lcc.runInteractiveMode();
      expect(lcc.ilcc).toBeInstanceOf(ILCC);
      ILCC.prototype.main.mockRestore();
    });

    test('forwards efficientMode to ILCC', () => {
      const lcc = new LCC();
      lcc.inputFileName = 'demo.a';
      lcc.options.efficientMode = true;
      jest.spyOn(ILCC.prototype, 'main').mockImplementation(() => {});
      lcc.runInteractiveMode();
      expect(lcc.ilcc.options.efficientMode).toBe(true);
      ILCC.prototype.main.mockRestore();
    });

    test('forwards colorblindMode to ILCC', () => {
      const lcc = new LCC();
      lcc.inputFileName = 'demo.a';
      lcc.options.colorblindMode = true;
      jest.spyOn(ILCC.prototype, 'main').mockImplementation(() => {});
      lcc.runInteractiveMode();
      expect(lcc.ilcc.options.colorblindMode).toBe(true);
      ILCC.prototype.main.mockRestore();
    });

    test('forwards inputBuffer to ILCC', () => {
      const lcc = new LCC();
      lcc.inputFileName = 'demo.a';
      lcc.inputBuffer = 'q\n';
      jest.spyOn(ILCC.prototype, 'main').mockImplementation(() => {});
      lcc.runInteractiveMode();
      expect(lcc.ilcc.inputBuffer).toBe('q\n');
      ILCC.prototype.main.mockRestore();
    });

    test('calls ILCC.main with this.inputFileName', () => {
      const lcc = new LCC();
      lcc.inputFileName = 'demo.a';
      const mainSpy = jest.spyOn(ILCC.prototype, 'main').mockImplementation(() => {});
      lcc.runInteractiveMode();
      expect(mainSpy).toHaveBeenCalledWith(['demo.a']);
      mainSpy.mockRestore();
    });

    test('forwards trace (-t) to ILCC', () => {
      const lcc = new LCC();
      lcc.inputFileName = 'demo.a';
      lcc.options.trace = true;
      jest.spyOn(ILCC.prototype, 'main').mockImplementation(() => {});
      lcc.runInteractiveMode();
      expect(lcc.ilcc.options.trace).toBe(true);
      ILCC.prototype.main.mockRestore();
    });

    test('forwards hexOutput (-x) to ILCC', () => {
      const lcc = new LCC();
      lcc.inputFileName = 'demo.a';
      lcc.options.hexOutput = true;
      jest.spyOn(ILCC.prototype, 'main').mockImplementation(() => {});
      lcc.runInteractiveMode();
      expect(lcc.ilcc.options.hexOutput).toBe(true);
      ILCC.prototype.main.mockRestore();
    });

    test('forwards fullLineDisplay (-f) to ILCC', () => {
      const lcc = new LCC();
      lcc.inputFileName = 'demo.a';
      lcc.options.fullLineDisplay = true;
      jest.spyOn(ILCC.prototype, 'main').mockImplementation(() => {});
      lcc.runInteractiveMode();
      expect(lcc.ilcc.options.fullLineDisplay).toBe(true);
      ILCC.prototype.main.mockRestore();
    });
  });

  describe('main() — -i routes to runInteractiveMode()', () => {
    test('-i flag causes runInteractiveMode() to be called instead of handleSingleFile()', () => {
      const lcc = new LCC();
      const interactiveSpy = jest.spyOn(lcc, 'runInteractiveMode').mockImplementation(() => {});
      const handleSpy = jest.spyOn(lcc, 'handleSingleFile').mockImplementation(() => {});
      lcc.main(['-i', 'demo.a']);
      expect(interactiveSpy).toHaveBeenCalledTimes(1);
      expect(handleSpy).not.toHaveBeenCalled();
      interactiveSpy.mockRestore();
      handleSpy.mockRestore();
    });

    test('without -i, handleSingleFile() is called as normal', () => {
      const lcc = new LCC();
      const interactiveSpy = jest.spyOn(lcc, 'runInteractiveMode').mockImplementation(() => {});
      const handleSpy = jest.spyOn(lcc, 'handleSingleFile').mockImplementation(() => {});
      jest.spyOn(lcc, 'resolveUserName').mockReturnValue('TestUser A');
      lcc.main(['demo.a']);
      expect(interactiveSpy).not.toHaveBeenCalled();
      expect(handleSpy).toHaveBeenCalledTimes(1);
      interactiveSpy.mockRestore();
      handleSpy.mockRestore();
    });
  });

  describe('integration: lcc -i demoA.a runs interactively', () => {
    const DEMOS_DIR = require('path').join(__dirname, '..', '..', 'demos');
    const DEMO_A = require('path').join(DEMOS_DIR, 'demoA.a');

    test('q immediately: ilcc.interpreter.currentIteration === 0', () => {
      const lcc = new LCC();
      lcc.inputBuffer = 'q\n';
      lcc.main(['-i', DEMO_A]);
      expect(lcc.ilcc.interpreter.currentIteration).toBe(0);
    });

    test('1 step then q: r0 === 5 after MVI r0, 5', () => {
      const lcc = new LCC();
      lcc.inputBuffer = '1\nq\n';
      lcc.main(['-i', DEMO_A]);
      expect(lcc.ilcc.interpreter.r[0]).toBe(5);
    });

    test('-i -e: efficientMode is set on interpreter', () => {
      const lcc = new LCC();
      lcc.inputBuffer = 'q\n';
      lcc.main(['-i', '-e', DEMO_A]);
      expect(lcc.ilcc.interpreter.efficientMode).toBe(true);
    });

    test('-i -c: colorblindMode is set on interpreter', () => {
      const lcc = new LCC();
      lcc.inputBuffer = 'q\n';
      lcc.main(['-i', '-c', DEMO_A]);
      expect(lcc.ilcc.interpreter.colorblindMode).toBe(true);
    });
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

  // ---------------------------------------------------------------------------
  // -t flag wiring: lcc.js → interpreter (#77)
  // ---------------------------------------------------------------------------

  describe('executeFile() — -t flag wiring to interpreter', () => {
    // Each test manages its own spies via try/finally to avoid polluting the
    // outer beforeAll console mocks (jest.restoreAllMocks() would kill them).

    function runWithCapture(options, assembler) {
      const lcc = new LCC();
      lcc.outputFileName = 'demo.e';
      lcc.generateStats = false;
      lcc.options = options;
      if (assembler !== undefined) lcc.assembler = assembler;

      let capturedInterpreter = null;
      const loadSpy = jest.spyOn(Interpreter.prototype, 'loadExecutableFile').mockImplementation(() => {});
      const runSpy  = jest.spyOn(Interpreter.prototype, 'run').mockImplementation(function () {
        capturedInterpreter = this;
        this.running = false;
      });
      try {
        lcc.executeFile(false, false);
      } finally {
        loadSpy.mockRestore();
        runSpy.mockRestore();
      }
      return capturedInterpreter;
    }

    test('options.trace=true sets interpreter.traceMode to true', () => {
      const interpreter = runWithCapture({ trace: true });
      expect(interpreter.traceMode).toBe(true);
    });

    test('options.trace absent leaves interpreter.traceMode false', () => {
      const interpreter = runWithCapture({});
      expect(interpreter.traceMode).toBe(false);
    });

    test('assembler.sourceMap is forwarded to interpreter.sourceMap when assembler present', () => {
      const fakeSourceMap = { addressToLine: new Map(), allLines: [] };
      const interpreter = runWithCapture({ trace: true }, { sourceMap: fakeSourceMap });
      expect(interpreter.sourceMap).toBe(fakeSourceMap);
    });

    test('interpreter.sourceMap stays null when no assembler is present', () => {
      const interpreter = runWithCapture({ trace: true }, null);
      expect(interpreter.sourceMap).toBeNull();
    });

    // -v/--verbose wiring to interpreter (#15)
    test('options.verbose=true sets interpreter.verboseModeOn to true', () => {
      const interpreter = runWithCapture({ verbose: true });
      expect(interpreter.verboseModeOn).toBe(true);
    });

    test('options.verbose absent leaves interpreter.verboseModeOn false', () => {
      const interpreter = runWithCapture({});
      expect(interpreter.verboseModeOn).toBe(false);
    });
  });

  // -v/--verbose wiring to assembler (#15)
  describe('assembleFile() — -v flag wiring to assembler', () => {
    test('options.verbose=true sets assembler.verboseModeOn to true', () => {
      const lcc = new LCC();
      lcc.inputFileName = 'demo.a';
      lcc.options = { verbose: true };
      let capturedAssembler = null;
      jest.spyOn(Assembler.prototype, 'main').mockImplementation(function () {
        capturedAssembler = this;
      });
      try {
        lcc.assembleFile();
      } finally {
        Assembler.prototype.main.mockRestore();
      }
      expect(capturedAssembler.verboseModeOn).toBe(true);
    });

    test('options.verbose absent leaves assembler.verboseModeOn false', () => {
      const lcc = new LCC();
      lcc.inputFileName = 'demo.a';
      lcc.options = {};
      let capturedAssembler = null;
      jest.spyOn(Assembler.prototype, 'main').mockImplementation(function () {
        capturedAssembler = this;
      });
      try {
        lcc.assembleFile();
      } finally {
        Assembler.prototype.main.mockRestore();
      }
      expect(capturedAssembler.verboseModeOn).toBe(false);
    });
  });
});
