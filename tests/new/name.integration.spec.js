const fs = require('fs');
const path = require('path');
const Interpreter = require('../../src/core/interpreter');

jest.mock('fs');

describe('Name Wrapper Integration Tests', () => {
  let virtualFs;

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

  beforeEach(() => {
    jest.clearAllMocks();
    virtualFs = {};

    fs.existsSync.mockImplementation((filePath) => {
      return Object.prototype.hasOwnProperty.call(virtualFs, filePath);
    });

    fs.readFileSync.mockImplementation((filePath, encoding) => {
      if (!Object.prototype.hasOwnProperty.call(virtualFs, filePath)) {
        throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      }

      const content = virtualFs[filePath];
      if (typeof content === 'string') {
        if (encoding === 'utf8' || encoding === 'utf-8') {
          return content;
        }
        return Buffer.from(content, 'utf8');
      }

      if (Buffer.isBuffer(content)) {
        return content;
      }

      throw new Error(`Unexpected content type for '${filePath}'`);
    });

    fs.writeFileSync.mockImplementation((filePath, data, options) => {
      if (Buffer.isBuffer(data)) {
        virtualFs[filePath] = data;
        return;
      }

      if (typeof data === 'string') {
        if (options && options.encoding === 'utf8') {
          virtualFs[filePath] = data;
        } else {
          virtualFs[filePath] = Buffer.from(data, 'utf8');
        }
        return;
      }

      throw new Error(`Invalid data type in writeFileSync for '${filePath}'`);
    });

    fs.readSync.mockReset();
  });

  test('interpreter wrapper uses pre-set userName when stats are enabled — does not access name.nnn', () => {
    const interpreter = new Interpreter();
    const eFilePath = 'promptForName.e';

    virtualFs[eFilePath] = Buffer.from([0x6F, 0x43, 0x00, 0xF0]);
    delete virtualFs['name.nnn'];

    interpreter.generateStats = true;
    interpreter.userName = 'MilkyWay';

    expect(() => {
      interpreter.main([eFilePath]);
    }).not.toThrow();

    // name.nnn is not touched — userName comes from the pre-set property
    expect(virtualFs['name.nnn']).toBeUndefined();
    expect(virtualFs['promptForName.lst']).toBeDefined();
    expect(virtualFs['promptForName.bst']).toBeDefined();
  });

  test('createNameFile exits non-zero with a diagnostic when name.nnn is absent and stdin is not a TTY', () => {
    delete virtualFs['name.nnn'];
    const origIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = false;

    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => {});

    try {
      const { createNameFile } = require('../../src/utils/name.js');
      expect(() => createNameFile('any.e')).toThrow('name.nnn not found');
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('name.nnn not found'));
    } finally {
      process.stdin.isTTY = origIsTTY;
      stderrSpy.mockRestore();
    }
  });

  test('interpreter wrapper should not require or create name.nnn when -nostats is used', () => {
    const interpreter = new Interpreter();
    const eFilePath = 'noStats.e';

    virtualFs[eFilePath] = Buffer.from([0x6F, 0x43, 0x00, 0xF0]);
    delete virtualFs['name.nnn'];

    expect(() => {
      interpreter.main([eFilePath, '-nostats']);
    }).not.toThrow();

    expect(virtualFs['name.nnn']).toBeUndefined();
    expect(virtualFs['noStats.lst']).toBeUndefined();
    expect(virtualFs['noStats.bst']).toBeUndefined();
  });

  test('interpreter wrapper does not read name.nnn — userName must be pre-set by caller', () => {
    const interpreter = new Interpreter();
    const eFilePath = path.join('subdir', 'nested.e');

    virtualFs[eFilePath] = Buffer.from([0x6F, 0x43, 0x00, 0xF0]);
    interpreter.generateStats = true;
    interpreter.userName = 'RootName';

    expect(() => {
      interpreter.main([eFilePath]);
    }).not.toThrow();

    // name.nnn is not read from any directory — resolution belongs in lcc.js (#880)
    expect(fs.readFileSync).not.toHaveBeenCalledWith('name.nnn', 'utf8');
    expect(fs.readFileSync).not.toHaveBeenCalledWith(path.join('subdir', 'name.nnn'), 'utf8');
  });
});
