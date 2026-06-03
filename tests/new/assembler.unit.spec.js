const Assembler = require('../../src/core/assembler');
const { AssemblerError } = require('../../src/utils/errors');

describe('Assembler Unit Tests', () => {
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

  afterEach(() => {
    jest.useRealTimers();
  });

  test('assembleSource() should assemble a simple .a program entirely in memory', () => {
    const source = `
      ; demoA.a: simple test
      mov r0, 5
      dout r0
      nl
      halt
    `;

    const assembler = new Assembler();
    const result = assembler.assembleSource(source, { inputFileName: 'demoA.a' });

    expect(assembler.errorFlag).toBe(false);
    expect(assembler.outputFileName).toBe('demoA.e');
    expect(assembler.outputBuffer.length).toBeGreaterThan(0);
    expect(assembler.outputBuffer[0]).toBe(0xd005);
    expect(result.inputFileName).toBe('demoA.a');
    expect(result.outputFileName).toBe('demoA.e');
    expect(result.isObjectModule).toBe(false);
    expect(result.outputBuffer[0]).toBe(0xd005);
    expect(Buffer.isBuffer(result.outputBytes)).toBe(true);
    expect(result.startAddress).toBe(0);
    expect(result.reports).toEqual({ lst: null, bst: null });
  });

  test('toOutputBuffer() should return a serialized executable buffer entirely in memory', () => {
    const source = `
      mov r0, 5
      dout r0
      nl
      halt
    `;

    const assembler = new Assembler();
    assembler.assembleSource(source, { inputFileName: 'demoA.a' });
    const bytes = assembler.toOutputBuffer();

    expect(Buffer.isBuffer(bytes)).toBe(true);
    expect(bytes[0]).toBe('o'.charCodeAt(0));
    expect(bytes.includes('C'.charCodeAt(0))).toBe(true);
    expect(bytes.length).toBeGreaterThan(4);
  });

  test('buildReportArtifacts() should return .lst and .bst report text without writing files', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));

    const source = `
      mov r0, 5
      dout r0
      nl
      halt
    `;

    const assembler = new Assembler();
    assembler.assembleSource(source, { inputFileName: 'demoA.a' });
    const { lstContent, bstContent } = assembler.buildReportArtifacts('Cheese');

    expect(typeof lstContent).toBe('string');
    expect(typeof bstContent).toBe('string');
    expect(lstContent).toContain('Cheese');
    expect(lstContent).toContain('Header');
    expect(lstContent).toContain('mov r0, 5');
    expect(bstContent).toContain('Cheese');
    expect(bstContent).toContain('0000');
  });

  test('assembleSource() should optionally return in-memory .lst and .bst reports in its result shape', () => {
    const source = `
      mov r0, 5
      dout r0
      nl
      halt
    `;

    const assembler = new Assembler();
    const result = assembler.assembleSource(source, {
      inputFileName: 'demoA.a',
      buildReports: true,
      userName: 'Cheese',
      now: new Date('2024-01-01T00:00:00Z'),
    });

    expect(result.reports.lst).toContain('Cheese');
    expect(result.reports.lst).toContain('Header');
    expect(result.reports.lst).toContain('mov r0, 5');
    expect(result.reports.bst).toContain('Cheese');
  });

  test('assembleSource() should require userName when buildReports is true', () => {
    const source = `
      mov r0, 5
      halt
    `;

    const assembler = new Assembler();

    expect(() => {
      assembler.assembleSource(source, {
        inputFileName: 'demoA.a',
        buildReports: true,
      });
    }).toThrow(AssemblerError);
  });

  test('assembleSource() should reject non-.a source filenames even when given valid assembly text', () => {
    const source = `
      mov r0, 5
      halt
    `;

    const assembler = new Assembler();

    expect(() => {
      assembler.assembleSource(source, { inputFileName: 'demoA.txt' });
    }).toThrow(AssemblerError);
  });

  test('assembleSource() should reject .ap files with the assemblerPlus guidance message', () => {
    const source = `
      mov r0, 5
      halt
    `;

    const assembler = new Assembler();

    expect(() => {
      assembler.assembleSource(source, { inputFileName: 'demoA.ap' });
    }).toThrow('Error: .ap files are not supported by assembler.js - Did you mean to use assemblerPlus.js?');
  });

  test('assembleSource() should throw a typed assembler error for an undefined label', () => {
    const source = `
      br missingLabel
      halt
    `;

    const assembler = new Assembler();

    expect(() => {
      assembler.assembleSource(source, { inputFileName: 'undefinedLabel.a' });
    }).toThrow(AssemblerError);
  });

  test('assembleSource() should treat duplicate .start directives by preserving the last declared start label', () => {
    const source = `
      .start alpha
      .start beta
      alpha: halt
      beta: halt
    `;

    const assembler = new Assembler();
    const result = assembler.assembleSource(source, { inputFileName: 'duplicateStart.a' });

    expect(assembler.startLabel).toBe('beta');
    expect(result.startAddress).toBe(1);
  });

  test('assembleSource() should treat whitespace-only source as an empty file error', () => {
    const assembler = new Assembler();

    expect(() => {
      assembler.assembleSource('   \n\t\n', { inputFileName: 'whitespaceOnly.a' });
    }).toThrow(AssemblerError);
  });

  test('assembleSource() should allow the same label to appear in both .global and .extern declarations', () => {
    const source = `
      .global shared
      .extern shared
      halt
    `;

    const assembler = new Assembler();
    const result = assembler.assembleSource(source, { inputFileName: 'sharedLabel.a' });

    expect(result.isObjectModule).toBe(true);
    expect(assembler.globalLabels.has('shared')).toBe(true);
    expect(assembler.externLabels.has('shared')).toBe(true);
  });

  test('assembleSource() should support escaped backslash and escaped quote in .string directives', () => {
    const source = `
      msg: .string "a\\\\\\\"b"
      halt
    `;

    const assembler = new Assembler();

    expect(() => {
      assembler.assembleSource(source, { inputFileName: 'escapedString.a' });
    }).not.toThrow();

    expect(assembler.outputBuffer[0]).toBe('a'.charCodeAt(0));
    expect(assembler.outputBuffer[1]).toBe('\\'.charCodeAt(0));
    expect(assembler.outputBuffer[2]).toBe('"'.charCodeAt(0));
    expect(assembler.outputBuffer[3]).toBe('b'.charCodeAt(0));
  });

  test('assembleSource() should reject multiple labels on the same line under the current LCC.js contract', () => {
    const source = `
      first: second: halt
    `;

    const assembler = new Assembler();

    expect(() => {
      assembler.assembleSource(source, { inputFileName: 'multipleLabels.a' });
    }).toThrow(AssemblerError);
  });

  test('assembleSource() should throw a typed assembler error for a line exceeding 300 characters', () => {
    const assembler = new Assembler();
    const source = `${'a'.repeat(301)}\nhalt\n`;

    expect(() => {
      assembler.assembleSource(source, { inputFileName: 'longLine.a' });
    }).toThrow(AssemblerError);
  });

  // --- determineOperandType() ---
  // Classifies the raw syntactic type of a token without evaluating it.
  // This is the foundation for future per-mnemonic operand-type schemas.
  // See docs/core-behavior-matrix.md → "Operand type checking" for Research status.

  describe('determineOperandType()', () => {
    let a;
    beforeEach(() => { a = new Assembler(); });

    test('classifies a decimal number as num', () => {
      expect(a.determineOperandType('42')).toBe('num');
    });

    test('classifies a negative decimal number as num', () => {
      expect(a.determineOperandType('-3')).toBe('num');
    });

    test('classifies a positive-prefixed number as num', () => {
      expect(a.determineOperandType('+5')).toBe('num');
    });

    test('classifies a hex literal as num', () => {
      expect(a.determineOperandType('0xFF')).toBe('num');
    });

    test('classifies a zero as num', () => {
      expect(a.determineOperandType('0')).toBe('num');
    });

    test("classifies a char literal as char", () => {
      expect(a.determineOperandType("'a'")).toBe('char');
    });

    test("classifies a newline escape char literal as char", () => {
      expect(a.determineOperandType("'\\n'")).toBe('char');
    });

    test('classifies a bare symbol name as label', () => {
      expect(a.determineOperandType('foo')).toBe('label');
    });

    test('classifies a symbol+offset as label', () => {
      expect(a.determineOperandType('foo+3')).toBe('label');
    });

    test('classifies a symbol-offset as label', () => {
      expect(a.determineOperandType('foo-1')).toBe('label');
    });

    test('classifies * as star', () => {
      expect(a.determineOperandType('*')).toBe('star');
    });

    test('classifies *+N as star', () => {
      expect(a.determineOperandType('*+2')).toBe('star');
    });

    test('classifies *-N as star', () => {
      expect(a.determineOperandType('*-1')).toBe('star');
    });
  });

  describe('shift count 4-bit masking — all five shift instructions (#512)', () => {
    // Oracle: any shift count is silently accepted; only the low 4 bits encode
    // into the ct field (bits 8-5). ct=16 → ct & 0xF = 0, same as "sXX r0" default.
    // ct=15 is the max in-range value; verifying it encodes correctly guards
    // against off-by-one in the mask.
    //
    // .e layout: 'o' 'C' [word0-lo] [word0-hi] ... (little-endian)
    // → first instruction word = outputBytes.readUInt16LE(2)

    function firstWord(source) {
      const asm = new Assembler();
      const result = asm.assembleSource(source, { inputFileName: 'test.a' });
      return result.outputBytes.readUInt16LE(2);
    }

    const CASES = [
      { instr: 'srl', eopcode: 0x02 },
      { instr: 'sra', eopcode: 0x03 },
      { instr: 'sll', eopcode: 0x04 },
      { instr: 'rol', eopcode: 0x05 },
      { instr: 'ror', eopcode: 0x06 },
    ];

    CASES.forEach(({ instr, eopcode }) => {
      test(`${instr} r0, 15 — ct=15 encodes correctly (no mask boundary issue)`, () => {
        // OP_EXT=0xA000 | sr=0 | ct=15 shifted to bits 8-5 | eopcode
        const expected = 0xA000 | (15 << 5) | eopcode; // 0xA1E0 | eopcode
        expect(firstWord(`  ${instr} r0, 15\n  halt\n`)).toBe(expected);
      });

      test(`${instr} r0, 16 — ct=16 wraps to ct=0, no sr-field corruption (#512)`, () => {
        // Before fix: ct=16 unmasked → (16<<5)=0x200 set bit 9 (sr field), corrupt
        // After fix: (16 & 0xF)=0 → ct=0, matching oracle a002/a003/etc.
        const expected = 0xA000 | (0 << 5) | eopcode;
        expect(firstWord(`  ${instr} r0, 16\n  halt\n`)).toBe(expected);
      });
    });
  });

  // -v / --verbose mode (#15)
  describe('formatAssemblerError() and verboseModeOn', () => {
    test('verboseModeOn defaults to false', () => {
      const asm = new Assembler();
      expect(asm.verboseModeOn).toBe(false);
    });

    test('compact format (verboseModeOn=false): line N + message, no source line', () => {
      const asm = new Assembler();
      asm.lineNum = 5;
      asm.inputFileName = 'test.a';
      asm.currentLine = '  ld r0, foo';
      asm.verboseModeOn = false;
      const msg = asm.formatAssemblerError('Undefined label');
      expect(msg).toContain('line 5');
      expect(msg).toContain('Undefined label');
      expect(msg).not.toContain('ld r0, foo');
    });

    test('verbose format (verboseModeOn=true): includes source line', () => {
      const asm = new Assembler();
      asm.lineNum = 5;
      asm.inputFileName = 'test.a';
      asm.currentLine = '  ld r0, foo';
      asm.verboseModeOn = true;
      const msg = asm.formatAssemblerError('Undefined label');
      expect(msg).toContain('line 5');
      expect(msg).toContain('Undefined label');
      expect(msg).toContain('ld r0, foo');
    });
  });
});
