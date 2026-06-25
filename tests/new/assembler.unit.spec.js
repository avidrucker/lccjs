const fs = require('fs');
const path = require('path');
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
    const source = fs.readFileSync(path.join(__dirname, '../fixtures/assembler-unit/demoA.a'), 'utf8');

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

  describe('assembleSource() pass-banner progress hook (#1397, audit P2)', () => {
    // The "Starting assembly pass N" banners are oracle-parity stdout the CLI
    // must keep, but the pure seam must not emit them itself (no console.* in
    // assembleSource). They now route through the optional onProgress hook.
    const SOURCE = '  mov r0, 5\n  halt\n';

    test('pure seam stays console-silent for the pass banners when no onProgress hook is given', () => {
      console.log.mockClear();
      const assembler = new Assembler();
      assembler.assembleSource(SOURCE, { inputFileName: 'silent.a' });

      const bannerCalls = console.log.mock.calls
        .map((c) => String(c[0]))
        .filter((m) => m.includes('Starting assembly pass'));
      expect(bannerCalls).toEqual([]);
    });

    test('invokes onProgress with both pass banners in order when provided (CLI parity path)', () => {
      const seen = [];
      const assembler = new Assembler();
      assembler.assembleSource(SOURCE, {
        inputFileName: 'banners.a',
        onProgress: (msg) => seen.push(msg),
      });

      expect(seen).toEqual(['Starting assembly pass 1', 'Starting assembly pass 2']);
    });
  });

  test('toOutputBuffer() should return a serialized executable buffer entirely in memory', () => {
    const source = fs.readFileSync(path.join(__dirname, '../fixtures/assembler-unit/demoA-2.a'), 'utf8');

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

    const source = fs.readFileSync(path.join(__dirname, '../fixtures/assembler-unit/demoA-2.a'), 'utf8');

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
    const source = fs.readFileSync(path.join(__dirname, '../fixtures/assembler-unit/demoA-2.a'), 'utf8');

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

  describe('assembleSource() listingLoadPoint (-l offset) handling (#1238)', () => {
    const source = '  mov r0, 5\n  dout r0\n  halt\n';

    test('applies a per-call listingLoadPoint offset to the listing, surviving the internal reset', () => {
      const assembler = new Assembler();
      const result = assembler.assembleSource(source, {
        inputFileName: 'shifted.a',
        listingLoadPoint: 0x3000,
        buildReports: true,
        userName: 'Tester',
      });
      // -l shifts displayed Loc addresses without changing machine code.
      // Because resetAssemblyState() runs inside assembleSource(), this also
      // pins that an option-supplied offset is re-applied after the reset.
      expect(result.reports.lst).toMatch(/^3000 /m);
      expect(assembler.listingLoadPoint).toBe(0x3000);
    });

    test('does NOT leak a prior run\'s listingLoadPoint into a later reuse without -l', () => {
      const assembler = new Assembler();

      // Run 1: with -l 3000 on a reused instance.
      const r1 = assembler.assembleSource(source, {
        inputFileName: 'a.a', listingLoadPoint: 0x3000, buildReports: true, userName: 'Tester',
      });
      expect(r1.reports.lst).toMatch(/^3000 /m);

      // Run 2: same instance, no -l — must default back to 0, not inherit 0x3000.
      const r2 = assembler.assembleSource(source, {
        inputFileName: 'b.a', buildReports: true, userName: 'Tester',
      });
      expect(assembler.listingLoadPoint).toBe(0);
      expect(r2.reports.lst).toMatch(/^0000 /m);
      expect(r2.reports.lst).not.toMatch(/^3000 /m);
    });
  });

  describe('assembleSource() caller-config reuse: verbose/explain/userName (#1277)', () => {
    const source = '  mov r0, 5\n  dout r0\n  halt\n';

    test('applies per-call verboseModeOn/explainModeOn, surviving the internal reset', () => {
      const assembler = new Assembler();
      assembler.assembleSource(source, {
        inputFileName: 'a.a',
        verboseModeOn: true,
        explainModeOn: true,
      });
      // resetAssemblyState() runs inside assembleSource(); an option-supplied
      // value must be re-applied after the reset, not wiped. (same shape as #1238)
      expect(assembler.verboseModeOn).toBe(true);
      expect(assembler.explainModeOn).toBe(true);
    });

    test('does NOT leak verboseModeOn/explainModeOn into a later reuse', () => {
      const assembler = new Assembler();

      // Run 1: display flags on for a reused instance.
      assembler.assembleSource(source, {
        inputFileName: 'a.a', verboseModeOn: true, explainModeOn: true,
      });

      // Run 2: same instance, flags omitted — must default back to false,
      // not inherit run 1's flags (which would emit unrequested output).
      assembler.assembleSource(source, { inputFileName: 'b.a' });
      expect(assembler.verboseModeOn).toBe(false);
      expect(assembler.explainModeOn).toBe(false);
    });

    test('does NOT leak userName into a later reuse', () => {
      const assembler = new Assembler();

      // Run 1: caller identity supplied.
      assembler.assembleSource(source, { inputFileName: 'a.a', userName: 'Alice' });
      expect(assembler.userName).toBe('Alice');

      // Run 2: same instance, omitted — must default back to null, not 'Alice'
      // (a leak would stamp the wrong creator into a later object-module report).
      assembler.assembleSource(source, { inputFileName: 'b.a' });
      expect(assembler.userName).toBeNull();
    });
  });

  test('assembleSource() should require userName when buildReports is true', () => {
    const source = fs.readFileSync(path.join(__dirname, '../fixtures/assembler-unit/demoA-3.a'), 'utf8');

    const assembler = new Assembler();

    expect(() => {
      assembler.assembleSource(source, {
        inputFileName: 'demoA.a',
        buildReports: true,
      });
    }).toThrow(AssemblerError);
  });

  test('assembleSource() should reject non-.a source filenames even when given valid assembly text', () => {
    const source = fs.readFileSync(path.join(__dirname, '../fixtures/assembler-unit/demoA-3.a'), 'utf8');

    const assembler = new Assembler();

    expect(() => {
      assembler.assembleSource(source, { inputFileName: 'demoA.txt' });
    }).toThrow(AssemblerError);
  });

  test('assembleSource() should reject .ap files with the assemblerPlus guidance message', () => {
    const source = fs.readFileSync(path.join(__dirname, '../fixtures/assembler-unit/demoA-3.a'), 'utf8');

    const assembler = new Assembler();

    expect(() => {
      assembler.assembleSource(source, { inputFileName: 'demoA.ap' });
    }).toThrow('Error: .ap files are not supported by assembler.js - Did you mean to use assemblerPlus.js?');
  });

  test('assembleSource() should throw a typed assembler error for an undefined label', () => {
    const source = fs.readFileSync(path.join(__dirname, '../fixtures/assembler-unit/undefinedLabel.a'), 'utf8');

    const assembler = new Assembler();

    expect(() => {
      assembler.assembleSource(source, { inputFileName: 'undefinedLabel.a' });
    }).toThrow(AssemblerError);
  });

  test('assembleSource() should treat duplicate .start directives by preserving the last declared start label', () => {
    const source = fs.readFileSync(path.join(__dirname, '../fixtures/assembler-unit/duplicateStart.a'), 'utf8');

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
    const source = fs.readFileSync(path.join(__dirname, '../fixtures/assembler-unit/sharedLabel.a'), 'utf8');

    const assembler = new Assembler();
    const result = assembler.assembleSource(source, { inputFileName: 'sharedLabel.a' });

    expect(result.isObjectModule).toBe(true);
    expect(assembler.globalLabels.has('shared')).toBe(true);
    expect(assembler.externLabels.has('shared')).toBe(true);
  });

  test('assembleSource() should support escaped backslash and escaped quote in .string directives', () => {
    const source = fs.readFileSync(path.join(__dirname, '../fixtures/assembler-unit/escapedString.a'), 'utf8');

    const assembler = new Assembler();

    expect(() => {
      assembler.assembleSource(source, { inputFileName: 'escapedString.a' });
    }).not.toThrow();

    expect(assembler.outputBuffer[0]).toBe('a'.charCodeAt(0));
    expect(assembler.outputBuffer[1]).toBe('\\'.charCodeAt(0));
    expect(assembler.outputBuffer[2]).toBe('"'.charCodeAt(0));
    expect(assembler.outputBuffer[3]).toBe('b'.charCodeAt(0));
  });

  test('assembleSource() should treat a literal ; inside a .string as data, not a comment (#1473)', () => {
    // Comment-stripping must be string-aware: the oracle assembles `.string "a;b"`
    // and prints `a;b`. lccjs previously split on the first ';' before tokenizing,
    // mistaking the in-string ';' for a comment and losing the closing quote.
    const source = '        .start main\nmain:   lea r0, s\n        sout\n        halt\ns:      .string "a;b"\n';

    const assembler = new Assembler();

    expect(() => {
      assembler.assembleSource(source, { inputFileName: 'semicolonString.a' });
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
    // s: is the .string payload — 'a', ';', 'b', then the null terminator.
    const s = assembler.outputBuffer.slice(-4);
    expect(s).toEqual(['a'.charCodeAt(0), ';'.charCodeAt(0), 'b'.charCodeAt(0), 0]);
  });

  test('assembleSource() should still strip a real ; comment that follows a .string literal (#1473)', () => {
    // A ';' OUTSIDE the quotes is a genuine comment and must be removed.
    const source = '        .start main\nmain:   lea r0, s\n        halt\ns:      .string "ab"   ; trailing comment\n';

    const assembler = new Assembler();

    expect(() => {
      assembler.assembleSource(source, { inputFileName: 'stringWithComment.a' });
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
    const s = assembler.outputBuffer.slice(-3);
    expect(s).toEqual(['a'.charCodeAt(0), 'b'.charCodeAt(0), 0]);
  });

  // --- char literals: strict-by-default diagnostics (#1482) ---
  // OG LCC accepts multi-character char literals and silently uses the FIRST
  // character ('ab'->97). lccjs deliberately diverges: a char literal must hold
  // exactly one character, so a learner sees a clear error instead of silent
  // truncation. The OG first-char-wins behavior returns under the deferred
  // --oracle-compat mode (#1481). Single chars and valid escapes stay at parity.
  // Verified vs cuh63 oracle in scratch/char-parity.* .

  describe('char literals — strict-by-default diagnostics (#1482)', () => {
    const assemble = (lit) => {
      const a = new Assembler();
      a.assembleSource(`        .start main\nmain:   halt\nc:      .word ${lit}\n`, { inputFileName: 'c.a' });
      return a;
    };
    const lastWord = (a) => a.outputBuffer[a.outputBuffer.length - 1];

    // Single char + valid escapes — still evaluate to their value (parity).
    test.each([
      ["';'", ';'.charCodeAt(0)],   // 59
      ["'-'", '-'.charCodeAt(0)],   // 45 — '-' assembles fine in both
      ["'/'", '/'.charCodeAt(0)],   // 47 — '/' is not an escape
      ["'\\n'", 10],                  // valid escape
      ["'\\r'", 13],                  // valid escape
      ["'\\\\'", 92],                 // escaped backslash
    ])('.word %s evaluates to %i (parity with oracle)', (lit, expected) => {
      const a = assemble(lit);
      expect(a.errorFlag).toBe(false);
      expect(lastWord(a)).toBe(expected);
    });

    // Multi-character literals — now a hard error by default (was first-char in
    // #1475). The dropped-character value is only available under #1481.
    test.each(["'ab'", "'/;'", "'/n'", "'//'", "'/\\'"])(
      '.word %s is rejected with an "exactly one character" error', (lit) => {
        expect(() => assemble(lit)).toThrow(/exactly one character/);
      });

    test("''' reports 'malformed character literal', not the misleading 'Bad label'", () => {
      expect(() => assemble("'''")).toThrow(/malformed character literal/);
    });

    test("the empty char literal '' is rejected as malformed (oracle yields 39; see #1483)", () => {
      expect(() => assemble("''")).toThrow(/malformed character literal/);
    });

    test('the empty string .string "" assembles to a lone NUL terminator (parity, #1483)', () => {
      const a = new Assembler();
      a.assembleSource('        .start main\nmain:   lea r0, s\n        halt\ns:      .string ""\n',
        { inputFileName: 'es.a' });
      expect(a.errorFlag).toBe(false);
      // s: is the empty string payload — just the null terminator.
      expect(a.outputBuffer[a.outputBuffer.length - 1]).toBe(0);
    });

    test("isCharLiteral() still accepts multi-character literals (so parse gives the clear error)", () => {
      const a = new Assembler();
      expect(a.isCharLiteral("'ab'")).toBe(true);
      expect(a.isCharLiteral("';'")).toBe(true);
    });

    test("an unknown escape like '\\;' still fails loud (parity deviation #15)", () => {
      // OG LCC yields NUL (0) for an unknown escape; lccjs deliberately rejects.
      expect(() => assemble("'\\;'")).toThrow(/Invalid escape sequence/);
    });
  });

  test('assembleSource() should reject multiple labels on the same line under the current LCC.js contract', () => {
    const source = fs.readFileSync(path.join(__dirname, '../fixtures/assembler-unit/multipleLabels.a'), 'utf8');

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

    test('compact format (verboseModeOn=false): 3-line oracle format with source line', () => {
      const asm = new Assembler();
      asm.lineNum = 5;
      asm.inputFileName = 'test.a';
      asm.currentLine = '  ld r0, foo';
      asm.verboseModeOn = false;
      const msg = asm.formatAssemblerError('Undefined label');
      expect(msg).toContain('line 5');
      expect(msg).toContain('Undefined label');
      expect(msg).toContain('ld r0, foo');
      expect(msg).toMatch(/Error on line 5 of test\.a:\n.*ld r0, foo\nUndefined label/);
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

    // -v enrichment (#564)
    test('verbose format includes [assembler] subsystem prefix', () => {
      const asm = new Assembler();
      asm.lineNum = 3;
      asm.inputFileName = 'test.a';
      asm.currentLine = '  add r0, r1, cheese';
      asm.verboseModeOn = true;
      const msg = asm.formatAssemblerError('Bad number');
      expect(msg).toContain('[assembler]');
    });

    test('compact format does NOT include [assembler] prefix', () => {
      const asm = new Assembler();
      asm.lineNum = 3;
      asm.inputFileName = 'test.a';
      asm.currentLine = '  add r0, r1, cheese';
      asm.verboseModeOn = false;
      const msg = asm.formatAssemblerError('Bad number');
      expect(msg).not.toContain('[assembler]');
    });

    test('verbose format with verboseContext includes found/expected clause', () => {
      const asm = new Assembler();
      asm.lineNum = 2;
      asm.inputFileName = 'test.a';
      asm.currentLine = '  add r0, r1, myLabel';
      asm.verboseModeOn = true;
      const msg = asm.formatAssemblerError('Bad number', { found: 'label', expected: 'num' });
      expect(msg).toContain('found: label');
      expect(msg).toContain('expected: num');
    });

    test('compact format ignores verboseContext entirely', () => {
      const asm = new Assembler();
      asm.lineNum = 2;
      asm.inputFileName = 'test.a';
      asm.currentLine = '  add r0, r1, myLabel';
      asm.verboseModeOn = false;
      const msg = asm.formatAssemblerError('Bad number', { found: 'label', expected: 'num' });
      expect(msg).not.toContain('found:');
      expect(msg).not.toContain('expected:');
    });

    test('verbose Bad number error includes found/expected when operand is a label', () => {
      const asm = new Assembler();
      asm.verboseModeOn = true;
      asm.lineNum = 1;
      asm.inputFileName = 'test.a';
      asm.currentLine = '  add r0, r1, myLabel';
      console.error.mockClear();
      expect(() => asm.evaluateImmediate('myLabel', -16, 15, 'imm5')).toThrow();
      const errCall = console.error.mock.calls.find(c => c[0] && c[0].includes('found:'));
      expect(errCall).toBeDefined();
      expect(errCall[0]).toContain('found: label');
      expect(errCall[0]).toContain('expected: num');
    });

    test('verbose Bad number error includes found/expected when shift-count operand is a label', () => {
      const asm = new Assembler();
      asm.verboseModeOn = true;
      asm.lineNum = 1;
      asm.inputFileName = 'test.a';
      asm.currentLine = '  srl r1, myLabel';
      console.error.mockClear();
      expect(() => asm.evaluateImmediateNaive('myLabel')).toThrow();
      const errCall = console.error.mock.calls.find(c => c[0] && c[0].includes('found:'));
      expect(errCall).toBeDefined();
      expect(errCall[0]).toContain('found: label');
      expect(errCall[0]).toContain('expected: num');
    });

    test('verbose Bad register error includes found/expected when operand is a num', () => {
      const asm = new Assembler();
      asm.verboseModeOn = true;
      asm.lineNum = 1;
      asm.inputFileName = 'test.a';
      asm.currentLine = '  add r0, 5, r1';
      console.error.mockClear();
      expect(() => asm.getRegister('5')).toThrow();
      const errCall = console.error.mock.calls.find(c => c[0] && c[0].includes('found:'));
      expect(errCall).toBeDefined();
      expect(errCall[0]).toContain('found: num');
      expect(errCall[0]).toContain('expected: register');
    });

    test('verbose Bad register error suggests closest register for distance-1 typo', () => {
      const asm = new Assembler();
      asm.verboseModeOn = true;
      asm.lineNum = 1;
      asm.inputFileName = 'test.a';
      asm.currentLine = '  mov r10, r1';
      console.error.mockClear();
      expect(() => asm.getRegister('r10')).toThrow();
      const errCall = console.error.mock.calls.find(c => c[0] && c[0].includes('Bad register'));
      expect(errCall).toBeDefined();
      expect(errCall[0]).toContain("Did you mean 'r0'?");
    });

    test('non-verbose Bad register error does not include suggestion', () => {
      const asm = new Assembler();
      asm.verboseModeOn = false;
      asm.lineNum = 1;
      asm.inputFileName = 'test.a';
      asm.currentLine = '  mov r10, r1';
      console.error.mockClear();
      expect(() => asm.getRegister('r10')).toThrow();
      const errCall = console.error.mock.calls.find(c => c[0] && c[0].includes('Bad register'));
      expect(errCall).toBeDefined();
      expect(errCall[0]).not.toContain('Did you mean');
    });

    test('core Assembler does NOT offer .lccplus as a valid directive (#1034 — no leak)', () => {
      const asm = new Assembler();
      expect(asm._getValidDirectives()).not.toContain('.lccplus');
    });

    test('verbose Bad register error gives no suggestion when typo is too distant', () => {
      const asm = new Assembler();
      asm.verboseModeOn = true;
      asm.lineNum = 1;
      asm.inputFileName = 'test.a';
      asm.currentLine = '  mov rxyz, r1';
      console.error.mockClear();
      expect(() => asm.getRegister('rxyz')).toThrow();
      const errCall = console.error.mock.calls.find(c => c[0] && c[0].includes('Bad register'));
      expect(errCall).toBeDefined();
      expect(errCall[0]).not.toContain('Did you mean');
    });
  });

  describe('constructor ↔ resetAssemblyState() field-list parity (#1423)', () => {
    // The constructor and resetAssemblyState() must initialize the SAME per-run
    // field set. When they drift (a field set in one but not the other), a reused
    // Assembler leaks the prior run's value — the bug class behind #1238
    // (listingLoadPoint) and #1277 (verbose/explain/userName). These fields are
    // genuinely constant / built once and are intentionally NOT reset:
    const CONST_FIELDS = new Set(['_instructionTable', 'defaultLoadPoint']);

    test('a reused, reset Assembler is indistinguishable from a fresh one (no state leak)', () => {
      const fresh = new Assembler();

      const reused = new Assembler();
      // Simulate a prior run: clobber every per-run field with a sentinel.
      for (const key of Object.keys(reused)) {
        if (CONST_FIELDS.has(key)) continue;
        reused[key] = '__LEAK__';
      }
      reused.resetAssemblyState();

      // (a) Own-key sets match — no field is initialized in only one of the two
      //     sites (catches e.g. userName living only in resetAssemblyState()).
      expect(Object.keys(reused).sort()).toEqual(Object.keys(fresh).sort());

      // (b) Every per-run field is restored to its fresh-construct default — a
      //     field omitted from resetAssemblyState() keeps the '__LEAK__' sentinel
      //     and fails here (catches the #1238 / #1277 leak class structurally).
      for (const key of Object.keys(fresh)) {
        if (CONST_FIELDS.has(key)) continue;
        expect(reused[key]).toEqual(fresh[key]);
      }
    });
  });
});
