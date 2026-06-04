const fs = require('fs');
const Linker = require('../../src/core/linker');
const LCC = require('../../src/cli/lcc');

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

  test('-nostats flag suppresses .lst/.bst output (#737)', () => {
    const lcc = new LCC();
    const eFilePath = 'demoA.e';

    virtualFs[eFilePath] = Buffer.from([0x6F, 0x43, 0x05, 0xD0, 0x02, 0xF0, 0x01, 0xF0, 0x00, 0xF0]);
    virtualFs['name.nnn'] = 'TestUser\n';

    expect(() => {
      lcc.main(['-nostats', eFilePath]);
    }).not.toThrow();

    expect(virtualFs['demoA.lst']).toBeUndefined();
    expect(virtualFs['demoA.bst']).toBeUndefined();
  });

  test('without -nostats, .lst/.bst are written (#737)', () => {
    const lcc = new LCC();
    const eFilePath = 'demoA.e';

    virtualFs[eFilePath] = Buffer.from([0x6F, 0x43, 0x05, 0xD0, 0x02, 0xF0, 0x01, 0xF0, 0x00, 0xF0]);
    virtualFs['name.nnn'] = 'TestUser\n';

    expect(() => {
      lcc.main([eFilePath]);
    }).not.toThrow();

    expect(Buffer.isBuffer(virtualFs['demoA.lst'])).toBe(true);
    expect(Buffer.isBuffer(virtualFs['demoA.bst'])).toBe(true);
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

  // -nostats input-path coverage (#747)
  // Machine code: mvi r0 5 (D005) · dout r0 (F002) · nl (F001) · halt (F000)

  test('-nostats on .a: .lst/.bst suppressed, .e still written, output correct (#747)', () => {
    const lcc = new LCC();
    virtualFs['prog.a'] = '    mov r0, 5\n    dout r0\n    nl\n    halt\n';
    // name.nnn must NOT be needed — generateStats=false skips resolveUserName

    expect(() => {
      lcc.main(['-nostats', 'prog.a']);
    }).not.toThrow();

    expect(lcc.interpreter.output).toBe('5\n');
    expect(Buffer.isBuffer(virtualFs['prog.e'])).toBe(true);  // executable still produced
    expect(virtualFs['prog.lst']).toBeUndefined();
    expect(virtualFs['prog.bst']).toBeUndefined();
    expect(virtualFs['name.nnn']).toBeUndefined();            // not consulted
  });

  test('-nostats on .hex: .lst/.bst suppressed, output correct (#747)', () => {
    const lcc = new LCC();
    virtualFs['prog.hex'] = 'D005\nF002\nF001\nF000\n';

    expect(() => {
      lcc.main(['-nostats', 'prog.hex']);
    }).not.toThrow();

    expect(lcc.interpreter.output).toBe('5\n');
    expect(virtualFs['prog.lst']).toBeUndefined();
    expect(virtualFs['prog.bst']).toBeUndefined();
    expect(virtualFs['name.nnn']).toBeUndefined();
  });

  test('-nostats on .bin: .lst/.bst suppressed, output correct (#747)', () => {
    const lcc = new LCC();
    virtualFs['prog.bin'] = [
      '1101000000000101',  // mvi r0, 5
      '1111000000000010',  // dout r0
      '1111000000000001',  // nl
      '1111000000000000',  // halt
    ].join('\n') + '\n';

    expect(() => {
      lcc.main(['-nostats', 'prog.bin']);
    }).not.toThrow();

    expect(lcc.interpreter.output).toBe('5\n');
    expect(virtualFs['prog.lst']).toBeUndefined();
    expect(virtualFs['prog.bst']).toBeUndefined();
    expect(virtualFs['name.nnn']).toBeUndefined();
  });

  test('-nostats: interpreter output unchanged vs non-nostats run (#747)', () => {
    // oC + four LE-encoded words: mvi r0 5, dout r0, nl, halt
    const eBytes = Buffer.from([0x6F, 0x43, 0x05, 0xD0, 0x02, 0xF0, 0x01, 0xF0, 0x00, 0xF0]);

    virtualFs['prog.e'] = eBytes;
    const lcc1 = new LCC();
    lcc1.main(['-nostats', 'prog.e']);
    const outputWithNoStats = lcc1.interpreter.output;

    virtualFs['prog.e'] = eBytes;
    virtualFs['name.nnn'] = 'TestUser\n';
    const lcc2 = new LCC();
    lcc2.main(['prog.e']);
    const outputWithoutNoStats = lcc2.interpreter.output;

    expect(outputWithNoStats).toBe(outputWithoutNoStats);
  });
});
