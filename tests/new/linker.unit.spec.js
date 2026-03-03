const fs = require('fs');
const Linker = require('../../src/core/linker');
const { LinkerError } = require('../../src/utils/errors');
const { installMockFileSystem } = require('../helpers/virtualFs');

jest.mock('fs');

describe('Linker Unit Tests', () => {
  let state;

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterAll(() => {
    console.log.mockRestore();
    console.warn.mockRestore();
    console.error.mockRestore();
    console.info.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    state = installMockFileSystem(fs);
  });

  test('readObjectModule() should parse valid headers and code from an object module', () => {
    const linker = new Linker();
    state.files['module.o'] = Buffer.from([
      0x6f,
      0x53, 0x02, 0x00,
      0x47, 0x01, 0x00, 0x6d, 0x61, 0x69, 0x6e, 0x00,
      0x43,
      0x34, 0x12, 0x78, 0x56,
    ]);

    linker.readObjectModule('module.o');

    expect(linker.errorFlag).toBe(false);
    expect(linker.objectModules).toHaveLength(1);
    expect(linker.objectModules[0]).toEqual({
      headers: [
        { type: 'S', address: 2 },
        { type: 'G', address: 1, label: 'main' },
      ],
      code: [0x1234, 0x5678],
    });
  });

  test('parseObjectModuleBuffer() should throw a typed linker error for invalid file signatures', () => {
    const linker = new Linker();

    expect(() => {
      linker.parseObjectModuleBuffer(Buffer.from([0x00, 0x43]), 'bad.o');
    }).toThrow(LinkerError);

    expect(() => {
      linker.parseObjectModuleBuffer(Buffer.from([0x00, 0x43]), 'bad.o');
    }).toThrow('bad.o not a linkable file');
  });

  test('processModule() should report duplicate global symbols', () => {
    const linker = new Linker();
    linker.GTable.main = 3;

    linker.processModule({
      headers: [{ type: 'G', address: 0, label: 'main' }],
      code: [],
    });

    expect(linker.errorFlag).toBe(true);
    expect(console.error).toHaveBeenCalledWith('Multiple definitions of global symbol main');
  });

  test('adjustExternalReferences() should report undefined external symbols', () => {
    const linker = new Linker();
    linker.mca = [0];
    linker.ETable = [{ address: 0, label: 'missing' }];

    linker.adjustExternalReferences();

    expect(linker.errorFlag).toBe(true);
    expect(console.error).toHaveBeenCalledWith('missing is an undefined external reference');
  });

  test('link() should default to link.e when no output file name is provided', () => {
    const linker = new Linker();
    jest.spyOn(linker, 'readObjectModule').mockImplementation(() => {
      linker.objectModules.push({
        headers: [{ type: 'S', address: 0 }],
        code: [0xf000],
      });
    });
    jest.spyOn(linker, 'createExecutable').mockImplementation(() => {});

    linker.link(['module.o']);

    expect(linker.outputFileName).toBe('link.e');
    expect(linker.createExecutable).toHaveBeenCalledTimes(1);
  });

  test('main() should reject missing input object modules after parsing flags', () => {
    const linker = new Linker();

    expect(() => {
      linker.main(['-o', 'custom.e']);
    }).toThrow('Error: No input object modules specified');
  });
});
