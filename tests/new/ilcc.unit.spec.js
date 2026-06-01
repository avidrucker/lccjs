// ilcc.unit.spec.js — Unit tests for ILCC (interactive LCC CLI driver)

'use strict';

const path = require('path');
const ILCC = require('../../src/interactive/ilcc');
const IInterpreter = require('../../src/interactive/iinterpreter');

const DEMOS_DIR = path.join(__dirname, '..', '..', 'demos');
const DEMO_A = path.join(DEMOS_DIR, 'demoA.a');

describe('ILCC Unit Tests', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
  });

  afterAll(() => {
    console.log.mockRestore();
    console.warn.mockRestore();
    console.error.mockRestore();
    process.stdout.write.mockRestore();
  });

  describe('parseArguments()', () => {
    test('-e sets efficientMode option', () => {
      const ilcc = new ILCC();
      ilcc.parseArguments(['-e', 'demo.a']);
      expect(ilcc.options.efficientMode).toBe(true);
    });

    test('-c sets colorblindMode option', () => {
      const ilcc = new ILCC();
      ilcc.parseArguments(['-c', 'demo.a']);
      expect(ilcc.options.colorblindMode).toBe(true);
    });

    test('-e and -c can be combined', () => {
      const ilcc = new ILCC();
      ilcc.parseArguments(['-e', '-c', 'demo.a']);
      expect(ilcc.options.efficientMode).toBe(true);
      expect(ilcc.options.colorblindMode).toBe(true);
    });

    test('non-flag arg is pushed to this.args', () => {
      const ilcc = new ILCC();
      ilcc.parseArguments(['demo.a']);
      expect(ilcc.args).toEqual(['demo.a']);
    });
  });

  describe('main() routing', () => {
    test('.a input: assembleFile() then runInteractiveFile() called', () => {
      const ilcc = new ILCC();
      const mockAssemble = jest.spyOn(ilcc, 'assembleFile').mockImplementation(() => {
        ilcc.outputFileName = 'demo.e';
      });
      const mockRun = jest.spyOn(ilcc, 'runInteractiveFile').mockImplementation(() => {});

      ilcc.main(['demo.a']);

      expect(mockAssemble).toHaveBeenCalledTimes(1);
      expect(mockRun).toHaveBeenCalledTimes(1);
    });

    test('.e input: assembleFile() NOT called, runInteractiveFile() called', () => {
      const ilcc = new ILCC();
      const mockAssemble = jest.spyOn(ilcc, 'assembleFile').mockImplementation(() => {});
      const mockRun = jest.spyOn(ilcc, 'runInteractiveFile').mockImplementation(() => {});

      ilcc.main(['demo.e']);

      expect(mockAssemble).not.toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(ilcc.outputFileName).toBe('demo.e');
    });

    test('.bin input: assembleFile() then runInteractiveFile() called', () => {
      const ilcc = new ILCC();
      const mockAssemble = jest.spyOn(ilcc, 'assembleFile').mockImplementation(() => {
        ilcc.outputFileName = 'demo.e';
      });
      const mockRun = jest.spyOn(ilcc, 'runInteractiveFile').mockImplementation(() => {});

      ilcc.main(['demo.bin']);

      expect(mockAssemble).toHaveBeenCalledTimes(1);
      expect(mockRun).toHaveBeenCalledTimes(1);
    });

    test('.hex input: assembleFile() then runInteractiveFile() called', () => {
      const ilcc = new ILCC();
      const mockAssemble = jest.spyOn(ilcc, 'assembleFile').mockImplementation(() => {
        ilcc.outputFileName = 'demo.e';
      });
      const mockRun = jest.spyOn(ilcc, 'runInteractiveFile').mockImplementation(() => {});

      ilcc.main(['demo.hex']);

      expect(mockAssemble).toHaveBeenCalledTimes(1);
      expect(mockRun).toHaveBeenCalledTimes(1);
    });
  });

  describe('runInteractiveFile()', () => {
    test('creates IInterpreter and sets efficientMode from options', () => {
      const ilcc = new ILCC();
      ilcc.options.efficientMode = true;
      ilcc.outputFileName = 'demo.e';

      // Mock out loadExecutableFile and runInteractive so we don't need a real file
      jest.spyOn(IInterpreter.prototype, 'loadExecutableFile').mockImplementation(() => {
        // simulate that initialMem would be set by loadExecutableFile
      });
      jest.spyOn(IInterpreter.prototype, 'runInteractive').mockImplementation(() => {});

      ilcc.runInteractiveFile();

      expect(ilcc.interpreter).toBeInstanceOf(IInterpreter);
      expect(ilcc.interpreter.efficientMode).toBe(true);

      IInterpreter.prototype.loadExecutableFile.mockRestore();
      IInterpreter.prototype.runInteractive.mockRestore();
    });

    test('sets colorblindMode on interpreter from options', () => {
      const ilcc = new ILCC();
      ilcc.options.colorblindMode = true;
      ilcc.outputFileName = 'demo.e';

      jest.spyOn(IInterpreter.prototype, 'loadExecutableFile').mockImplementation(() => {});
      jest.spyOn(IInterpreter.prototype, 'runInteractive').mockImplementation(() => {});

      ilcc.runInteractiveFile();
      expect(ilcc.interpreter.colorblindMode).toBe(true);

      IInterpreter.prototype.loadExecutableFile.mockRestore();
      IInterpreter.prototype.runInteractive.mockRestore();
    });
  });

  describe('integration: assemble demoA.a and run interactively', () => {
    test('q immediately quits; currentIteration stays at 0', () => {
      const ilcc = new ILCC();
      ilcc.inputBuffer = 'q\n';

      // main() assembles demoA.a → demoA.e in demos/, then runs interactively
      ilcc.main([DEMO_A]);

      expect(ilcc.interpreter).toBeInstanceOf(IInterpreter);
      expect(ilcc.interpreter.currentIteration).toBe(0);
    });

    test('1 step then q: r0 === 5 after MVI r0, 5', () => {
      const ilcc = new ILCC();
      ilcc.inputBuffer = '1\nq\n';

      ilcc.main([DEMO_A]);

      expect(ilcc.interpreter.r[0]).toBe(5);
      expect(ilcc.interpreter.currentIteration).toBe(1);
    });

    test('-e flag: efficientMode is set on interpreter', () => {
      const ilcc = new ILCC();
      ilcc.inputBuffer = 'q\n';

      ilcc.main(['-e', DEMO_A]);

      expect(ilcc.interpreter.efficientMode).toBe(true);
    });
  });
});
