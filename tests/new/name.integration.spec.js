const fs = require('fs');
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

  test('interpreter wrapper should create name.nnn when stats are enabled and the file is missing', () => {
    const interpreter = new Interpreter();
    const eFilePath = 'promptForName.e';

    virtualFs[eFilePath] = Buffer.from([0x6F, 0x43, 0x00, 0xF0]);
    delete virtualFs['name.nnn'];

    const readBuffer = Buffer.from('MilkyWay\n', 'utf8');
    let readOffset = 0;
    fs.readSync.mockImplementation((fd, buffer) => {
      if (readOffset >= readBuffer.length) {
        return 0;
      }

      buffer[0] = readBuffer[readOffset];
      readOffset += 1;
      return 1;
    });

    interpreter.generateStats = true;

    expect(() => {
      interpreter.main([eFilePath]);
    }).not.toThrow();

    expect(virtualFs['name.nnn']).toBe('MilkyWay\n');
    expect(virtualFs['promptForName.lst']).toBeDefined();
    expect(virtualFs['promptForName.bst']).toBeDefined();
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
});
