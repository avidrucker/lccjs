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

  test('processModule() should throw LinkerError on duplicate global symbols', () => {
    const linker = new Linker();
    linker.GTable.main = 3;

    expect(() => {
      linker.processModule({
        headers: [{ type: 'G', address: 0, label: 'main' }],
        code: [],
      });
    }).toThrow(LinkerError);

    expect(() => {
      linker.GTable.main = 3;
      linker.processModule({
        headers: [{ type: 'G', address: 0, label: 'main' }],
        code: [],
      });
    }).toThrow('More than one global declaration for main');

    expect(console.error).toHaveBeenCalledWith('More than one global declaration for main');
  });

  test('adjustExternalReferences() should throw LinkerError on undefined external symbols', () => {
    const linker = new Linker();
    linker.mca = [0];
    linker.ETable = [{ address: 0, label: 'missing' }];

    expect(() => {
      linker.adjustExternalReferences();
    }).toThrow(LinkerError);

    expect(() => {
      linker.mca = [0];
      linker.ETable = [{ address: 0, label: 'missing' }];
      linker.adjustExternalReferences();
    }).toThrow('missing is an undefined external reference');

    expect(console.error).toHaveBeenCalledWith('missing is an undefined external reference');
  });

  // #171 spike: the relocation MATH (not just the undefined-symbol throw) was
  // entirely unasserted. These hand-build GTable/ETable/eTable/VTable + mca so
  // each calculation is verified in isolation, including the easily-missed fact
  // that the formula folds the pre-existing operand word into the offset.
  describe('adjustExternalReferences() relocation math (#181)', () => {
    test('ETable 11-bit: encodes (Gaddr - addr - 1) into low 11 bits, preserving the opcode bits', () => {
      const linker = new Linker();
      linker.mca = [];
      linker.mca[100] = 0xe000; // opcode bits set, pcoffset11 field = 0
      linker.GTable = { foo: 200 };
      linker.ETable = [{ address: 100, label: 'foo' }];

      linker.adjustExternalReferences();

      // offset = (200 - 100 - 1) & 0x7ff = 99; high 5 bits (0xe000) untouched
      expect(linker.mca[100]).toBe(0xe063);
      expect(linker.mca[100] & 0xf800).toBe(0xe000);
    });

    test('ETable 11-bit: the pre-existing operand word is ADDED into the offset', () => {
      const linker = new Linker();
      linker.mca = [];
      linker.mca[100] = 0xe005; // low field already holds 5
      linker.GTable = { foo: 200 };
      linker.ETable = [{ address: 100, label: 'foo' }];

      linker.adjustExternalReferences();

      // offset = (5 + 200 - 100 - 1) & 0x7ff = 104  (= 99 + the pre-existing 5)
      expect(linker.mca[100]).toBe(0xe068);
    });

    test('ETable 11-bit: result masks to 11 bits (wraparound)', () => {
      const linker = new Linker();
      linker.mca = [0];
      linker.GTable = { far: 5000 };
      linker.ETable = [{ address: 0, label: 'far' }];

      linker.adjustExternalReferences();

      // (5000 - 0 - 1) & 0x7ff = 4999 & 2047 = 903
      expect(linker.mca[0]).toBe(903);
    });

    test('eTable 9-bit: encodes into low 9 bits, preserving the high 7 bits', () => {
      const linker = new Linker();
      linker.mca = [];
      linker.mca[20] = 0x0e00; // high 7 bits set, pcoffset9 field = 0
      linker.GTable = { bar: 50 };
      linker.eTable = [{ address: 20, label: 'bar' }];

      linker.adjustExternalReferences();

      // offset = (50 - 20 - 1) & 0x1ff = 29; high bits (0x0e00) preserved
      expect(linker.mca[20]).toBe(0x0e1d);
      expect(linker.mca[20] & 0xfe00).toBe(0x0e00);
    });

    test('eTable 9-bit: result masks to 9 bits (wraparound)', () => {
      const linker = new Linker();
      linker.mca = [0];
      linker.GTable = { baz: 600 };
      linker.eTable = [{ address: 0, label: 'baz' }];

      linker.adjustExternalReferences();

      // (600 - 0 - 1) & 0x1ff = 599 & 511 = 87
      expect(linker.mca[0]).toBe(87);
    });

    test('VTable full-address: adds Gaddr to the whole word (no mask)', () => {
      const linker = new Linker();
      linker.mca = [];
      linker.mca[5] = 16;
      linker.GTable = { qux: 1234 };
      linker.VTable = [{ address: 5, label: 'qux' }];

      linker.adjustExternalReferences();

      expect(linker.mca[5]).toBe(1250); // 16 + 1234, full 16-bit add
    });

    test('all three tables in one pass update independently without interference', () => {
      const linker = new Linker();
      linker.mca = [0x0000, 0x0000, 0x0005];
      linker.GTable = { a: 300, b: 60, c: 1000 };
      linker.ETable = [{ address: 0, label: 'a' }];
      linker.eTable = [{ address: 1, label: 'b' }];
      linker.VTable = [{ address: 2, label: 'c' }];

      linker.adjustExternalReferences();

      // E: (300-0-1)&0x7ff=299 | e: (60-1-1)&0x1ff=58 | V: 5+1000=1005
      expect(linker.mca).toEqual([299, 58, 1005]);
    });
  });

  // #171 spike: adjustLocalReferences() (A-table relocation) was never called by
  // a unit test. It relocates a module-local reference to its global position by
  // adding the module's start offset: mca[addr] += moduleStart.
  describe('adjustLocalReferences() ATable relocation (#182)', () => {
    test('adds moduleStart to the referenced word in place', () => {
      const linker = new Linker();
      linker.mca = [];
      linker.mca[10] = 5; // module-local address 5
      linker.ATable = [{ address: 10, moduleStart: 100 }];

      linker.adjustLocalReferences();

      expect(linker.mca[10]).toBe(105); // 5 + moduleStart(100)
    });

    test('relocates multiple entries by their own moduleStart in one pass', () => {
      // Three modules concatenated at offsets 0 / 10 / 30.
      const linker = new Linker();
      linker.mca = [2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 1];
      linker.ATable = [
        { address: 0, moduleStart: 0 },
        { address: 5, moduleStart: 10 },
        { address: 12, moduleStart: 30 },
      ];

      linker.adjustLocalReferences();

      expect(linker.mca[0]).toBe(2);   // 2 + 0
      expect(linker.mca[5]).toBe(13);  // 3 + 10
      expect(linker.mca[12]).toBe(31); // 1 + 30
      expect(linker.mca[3]).toBe(0);   // untouched index unchanged
    });

    test('moduleStart of 0 (first module) leaves the word unchanged', () => {
      const linker = new Linker();
      linker.mca = [];
      linker.mca[3] = 7;
      linker.ATable = [{ address: 3, moduleStart: 0 }];

      linker.adjustLocalReferences();

      expect(linker.mca[3]).toBe(7);
    });

    test('empty ATable is a no-op', () => {
      const linker = new Linker();
      linker.mca = [11, 22, 33];
      linker.ATable = [];

      linker.adjustLocalReferences();

      expect(linker.mca).toEqual([11, 22, 33]);
    });
  });

  // #171 spike: multi-module mcaIndex/GTable threading was only checked
  // indirectly via the 3-demo oracle e2e (which detects but can't localize a
  // wrong relocation). processModule() appends each module's code at the running
  // mcaIndex and records every symbol/reference at (local address + mcaIndex),
  // so addresses reflect the concatenation order.
  describe('multi-module address threading via processModule() (#183)', () => {
    const mod = (headers, size, fillFirst) => {
      const code = new Array(size).fill(0);
      if (fillFirst !== undefined) code[0] = fillFirst;
      return { headers, code };
    };

    test('GTable global addresses reflect code concatenation (sizes 10/20/15)', () => {
      const linker = new Linker();
      linker.processModule(mod([{ type: 'G', address: 0, label: 'foo' }], 10));
      linker.processModule(mod([{ type: 'G', address: 5, label: 'bar' }], 20));
      linker.processModule(mod([{ type: 'G', address: 3, label: 'baz' }], 15));

      // foo: 0+0 | bar: 5+10 | baz: 3+(10+20)
      expect(linker.GTable).toEqual({ foo: 0, bar: 15, baz: 33 });
      expect(linker.mcaIndex).toBe(45);
      expect(linker.mca).toHaveLength(45);
    });

    test('each module code lands at its concatenated offset', () => {
      const linker = new Linker();
      linker.processModule(mod([], 10, 0x1111));
      linker.processModule(mod([], 20, 0x2222));
      linker.processModule(mod([], 15, 0x3333));

      expect(linker.mca[0]).toBe(0x1111);  // module A @ 0
      expect(linker.mca[10]).toBe(0x2222); // module B @ 10
      expect(linker.mca[30]).toBe(0x3333); // module C @ 30
    });

    test('S start address is threaded by the owning module offset', () => {
      const linker = new Linker();
      linker.processModule(mod([], 10));                              // no start
      linker.processModule(mod([{ type: 'S', address: 2 }], 5));      // start in module B

      expect(linker.start).toBe(12); // 2 + moduleStart(10)
      expect(linker.gotStart).toBe(true);
    });

    test('E (11-bit) and A (local) reference addresses are threaded by module offset', () => {
      const linker = new Linker();
      linker.processModule(mod([], 10));
      linker.processModule(
        mod([{ type: 'E', address: 3, label: 'x' }, { type: 'A', address: 7 }], 5),
      );

      expect(linker.ETable).toEqual([{ address: 13, label: 'x' }]); // 3 + 10
      // A entries also record the module start for the later local relocation
      expect(linker.ATable).toEqual([{ address: 17, moduleStart: 10 }]); // 7 + 10
    });
  });

  test('link() should default to linktest.e when no output file name is provided', () => {
    const linker = new Linker();
    jest.spyOn(linker, 'readObjectModule').mockImplementation(() => {
      linker.objectModules.push({
        headers: [{ type: 'S', address: 0 }],
        code: [0xf000],
      });
    });
    jest.spyOn(linker, 'createExecutable').mockImplementation(() => {});

    linker.link(['module.o']);

    expect(linker.outputFileName).toBe('linktest.e'); // OB-033: standalone fallback matches oracle standalone linker
    expect(linker.createExecutable).toHaveBeenCalledTimes(1);
  });

  test('main() should reject missing input object modules after parsing flags', () => {
    const linker = new Linker();

    expect(() => {
      linker.main(['-o', 'custom.e']);
    }).toThrow('Error: No input object modules specified');
  });
});
