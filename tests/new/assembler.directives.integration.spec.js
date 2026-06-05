/**
 * @file assembler.directives.integration.spec.js
 * Integration tests for assembler.js directive handling.
 */

const fs = require('fs');
const Assembler = require('../../src/core/assembler');
const { setupAssemblerIntegrationHarness } = require('../helpers/assemblerIntegrationHarness');

jest.mock('fs');
const path = require('path');
const realFs = jest.requireActual('fs');

describe('Assembler Directive Integration', () => {
  let assembler;
  let virtualFs;
  const { getAssembler, getVirtualFs } = setupAssemblerIntegrationHarness(Assembler);

  beforeEach(() => {
    assembler = getAssembler();
    virtualFs = getVirtualFs();
  });

  test('7. should handle directives such as .word, .string, .zero without errors', () => {
    const aFilePath = 'demoB.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/demoB.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
    expect(assembler.outputBuffer.length).toBeGreaterThan(0);
  });

  test('27. should throw an error when referencing a label that is not declared', () => {
    const aFilePath = 'undeclaredLabel.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/undeclaredLabel.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('28. should not throw an error when passing multiple arguments to a .word directive', () => {
    const aFilePath = 'multipleArgsToWord.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/multipleArgsToWord.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('95. should assemble .string directive with valid string', () => {
    const aFilePath = 'stringValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/stringValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('96. should throw error for .string directive with missing closing quote', () => {
    const aFilePath = 'stringMissingQuote.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/stringMissingQuote.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('97. should throw error for .string directive with invalid escape sequence', () => {
    const aFilePath = 'stringInvalidEscape.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/stringInvalidEscape.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('98. should assemble .string directive with extra operands without throwing error', () => {
    const aFilePath = 'stringExtraOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/stringExtraOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('99. should assemble .word directive with valid number', () => {
    const aFilePath = 'wordValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/wordValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('100. should throw error for .word directive with invalid number format', () => {
    const aFilePath = 'wordInvalidNumber.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/wordInvalidNumber.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('101. should throw error for .word directive missing operand', () => {
    const aFilePath = 'wordMissingOperand.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/wordMissingOperand.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('104. should assemble .zero directive with valid size', () => {
    const aFilePath = 'zeroValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/zeroValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('105. should throw error for .zero directive with non-numeric size', () => {
    const aFilePath = 'zeroNonNumeric.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/zeroNonNumeric.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('106. should throw error for .zero directive missing operand', () => {
    const aFilePath = 'zeroMissingOperand.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/zeroMissingOperand.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('107. should throw error for .zero directive with negative size', () => {
    const aFilePath = 'zeroNegativeSize.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/zeroNegativeSize.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('117. should assemble .org directive with valid address by padding the gap with zero words', () => {
    const aFilePath = 'orgValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/orgValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.outputBuffer[0]).toBe(0x0001);
    expect(assembler.outputBuffer[1]).toBe(0x0000);
    expect(assembler.outputBuffer[2]).toBe(0x0000);
    expect(assembler.outputBuffer[3]).toBe(0x0000);
    expect(assembler.outputBuffer[4]).toBe(0xd005);
    expect(assembler.outputBuffer[5]).toBe(0xf000);
    expect(assembler.locCtr).toBe(6);
    expect(assembler.errorFlag).toBe(false);
  });

  test('118. should throw error for .org directive with non-numeric address', () => {
    const aFilePath = 'orgNonNumeric.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/orgNonNumeric.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('119. should throw error for .org directive missing operand', () => {
    const aFilePath = 'orgMissingOperand.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/orgMissingOperand.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('120. should throw error for .org directive with address out of bounds', () => {
    const aFilePath = 'orgOutOfBounds.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/orgOutOfBounds.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('121. should throw error for undefined directive', () => {
    const aFilePath = 'undefinedDirective.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/undefinedDirective.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('130. should throw error for .string directive with multi-character literal', () => {
    const aFilePath = 'stringMultiChar.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/stringMultiChar.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('203. should throw error for .string directive with no arguments', () => {
    const aFilePath = 'stringNoArgs.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/stringNoArgs.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('209. should assemble .string directive with escaped newline char', () => {
    const aFilePath = 'stringEscapedNewline.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/stringEscapedNewline.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('212. should throw error for .word with operator but no operand', () => {
    const aFilePath = 'wordOperatorNoOperand.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/wordOperatorNoOperand.a'), 'utf8');

    virtualFs[aFilePath] = source;
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('213. should throw error for .zero with invalid argument', () => {
    const aFilePath = 'zeroInvalidArg.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/zeroInvalidArg.a'), 'utf8');

    virtualFs[aFilePath] = source;
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('214. should allow repeated forward .org directives within address bounds', () => {
    const aFilePath = 'orgOutOfBounds.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-directives/orgOutOfBounds-2.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.outputBuffer[30000]).toBe(0x0000);
    expect(assembler.outputBuffer[39999]).toBe(0x0000);
    expect(assembler.outputBuffer[40000]).toBe(0xd005);
    expect(assembler.outputBuffer[40001]).toBe(0xf000);
    expect(assembler.locCtr).toBe(40002);
    expect(assembler.errorFlag).toBe(false);
  });
});

// Regression for #157: the issue's headline claim — that `.string` rejects a `\n`
// escape with "Missing terminating quote" — does NOT reproduce. lccjs accepts the
// escape set `\n \t \r \\ \"`, matching the oracle byte-for-byte (probe in
// docs/research/string-escape-parity.md). Shipped demos (demoP.a, happy-path.a)
// already rely on `\n` in `.string`. The genuine lccjs↔oracle divergence is the
// OPPOSITE: lccjs rejects UNKNOWN escapes with a clear "Unknown escape sequence"
// error, while the oracle silently drops the backslash. These tests pin both.
describe('Assembler .string escape sequences (#157)', () => {
  let assembler;
  const { getAssembler, getVirtualFs } = setupAssemblerIntegrationHarness(Assembler);
  let virtualFs;
  beforeEach(() => { assembler = getAssembler(); virtualFs = getVirtualFs(); });

  const assemble = (src) => {
    virtualFs['esc.a'] = src;
    assembler.main(['esc.a']);
  };

  test('a `\\n` escape in .string assembles and emits a 0x0a byte (the #157 headline is non-reproducible)', () => {
    expect(() => assemble(`      .string "A\\nB"\n      halt\n`)).not.toThrow();
    expect(assembler.errorFlag).toBe(false);
    // 'A', '\n', 'B', NUL  → 0x41, 0x0a, 0x42, 0x00
    expect(assembler.outputBuffer.slice(0, 4)).toEqual([0x41, 0x0a, 0x42, 0x00]);
  });

  test('the full supported escape set (\\n \\t \\r \\\\ \\") maps to the expected bytes', () => {
    expect(() => assemble(`      .string "\\n\\t\\r\\\\\\""\n      halt\n`)).not.toThrow();
    expect(assembler.errorFlag).toBe(false);
    // \n \t \r \\ \"  → 0x0a 0x09 0x0d 0x5c 0x22, then NUL
    expect(assembler.outputBuffer.slice(0, 6)).toEqual([0x0a, 0x09, 0x0d, 0x5c, 0x22, 0x00]);
  });

  test('an UNKNOWN escape raises a clear "Unknown escape sequence" error (not "Missing terminating quote")', () => {
    // This is the real lccjs↔oracle divergence: lccjs is stricter (fails loud),
    // the oracle silently drops the backslash. Pin lccjs\'s clear diagnostic.
    expect(() => assemble(`      .string "A\\qB"\n      halt\n`)).toThrow(/Unknown escape sequence/);
  });
});
