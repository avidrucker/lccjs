const fs = require('fs');
const Linker = require('../../src/core/linker');
const LCC = require('../../src/core/lcc');

jest.mock('fs');
jest.mock('../../src/core/linker', () => {
  return jest.fn().mockImplementation(() => ({
    link: jest.fn(),
  }));
});

describe('LCC Integration Tests', () => {
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

    fs.writeFileSync.mockImplementation((filePath, data) => {
      virtualFs[filePath] = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    });

    fs.openSync.mockImplementation((filePath, flags) => {
      if (flags === 'w') {
        virtualFs[filePath] = Buffer.alloc(0);
      }
      return filePath;
    });

    fs.writeSync.mockImplementation((fd, chunk) => {
      if (!Object.prototype.hasOwnProperty.call(virtualFs, fd)) {
        throw new Error(`Invalid file descriptor: ${fd}`);
      }
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8');
      virtualFs[fd] = Buffer.concat([virtualFs[fd], buffer]);
    });

    fs.closeSync.mockImplementation(() => {});
  });

  test('should not require name.nnn when generateStats is false during execution', () => {
    const lcc = new LCC();
    const eFilePath = 'demoA.e';

    virtualFs[eFilePath] = Buffer.from([0x6F, 0x43, 0x05, 0xD0, 0x02, 0xF0, 0x01, 0xF0, 0x00, 0xF0]);
    lcc.generateStats = false;

    expect(() => {
      lcc.main([eFilePath]);
    }).not.toThrow();

    expect(virtualFs['name.nnn']).toBeUndefined();
    expect(virtualFs['demoA.lst']).toBeUndefined();
    expect(virtualFs['demoA.bst']).toBeUndefined();
  });

  test('should not require name.nnn when linking object files', () => {
    const lcc = new LCC();

    expect(() => {
      lcc.main(['module1.o', 'module2.o']);
    }).not.toThrow();

    expect(Linker).toHaveBeenCalledTimes(1);
    expect(virtualFs['name.nnn']).toBeUndefined();
  });

  test('should assemble and then interpret a .a file in one call', () => {
    const lcc = new LCC();
    const aFilePath = 'demoA.a';

    virtualFs[aFilePath] = [
      '; demoA.a: simple test',
      '    mov r0, 5',
      '    dout r0',
      '    nl',
      '    halt',
      '',
    ].join('\n');
    virtualFs['name.nnn'] = 'Cheese\n';

    expect(() => {
      lcc.main([aFilePath]);
    }).not.toThrow();

    expect(lcc.assembler).toBeDefined();
    expect(lcc.interpreter).toBeDefined();
    expect(lcc.assembler.outputFileName).toBe('demoA.e');
    expect(lcc.interpreter.output).toBe('5\n');
    expect(Buffer.isBuffer(virtualFs['demoA.e'])).toBe(true);
    expect(Buffer.isBuffer(virtualFs['demoA.lst'])).toBe(true);
    expect(Buffer.isBuffer(virtualFs['demoA.bst'])).toBe(true);
  });
});
