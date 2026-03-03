/**
 * @file assembler.directives.integration.spec.js
 * Integration tests for assembler.js directive handling.
 */

const fs = require('fs');
const Assembler = require('../../src/core/assembler');
const { setupAssemblerIntegrationHarness } = require('../helpers/assemblerIntegrationHarness');

jest.mock('fs');

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
    const source = `
      ld r0, x
      add r0, r0, 2
      dout r0
      halt
ask:  .string "What's your first name? "
buffer1: .zero 10
x: .word 5
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
    expect(assembler.outputBuffer.length).toBeGreaterThan(0);
  });

  test('27. should throw an error when referencing a label that is not declared', () => {
    const aFilePath = 'undeclaredLabel.a';
    const source = `l
      halt
x: .word y
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Undefined label');
  });

  test('28. should not throw an error when passing multiple arguments to a .word directive', () => {
    const aFilePath = 'multipleArgsToWord.a';
    const source = `
    halt
x: .word 5, 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('95. should assemble .string directive with valid string', () => {
    const aFilePath = 'stringValid.a';
    const source = `
      .string "Hello, World!"
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('96. should throw error for .string directive with missing closing quote', () => {
    const aFilePath = 'stringMissingQuote.a';
    const source = `
    halt
    .string "Hello, World!
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing terminating quote');
  });

  test('97. should throw error for .string directive with invalid escape sequence', () => {
    const aFilePath = 'stringInvalidEscape.a';
    const source = `
    halt
    .string "Hello World!\\"
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing terminating quote');
  });

  test('98. should assemble .string directive with extra operands without throwing error', () => {
    const aFilePath = 'stringExtraOperands.a';
    const source = `
      .string "Hello, World!", extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('99. should assemble .word directive with valid number', () => {
    const aFilePath = 'wordValid.a';
    const source = `
      .word 100
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('100. should throw error for .word directive with invalid number format', () => {
    const aFilePath = 'wordInvalidNumber.a';
    const source = `
      .word 0xGHI
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('101. should throw error for .word directive missing operand', () => {
    const aFilePath = 'wordMissingOperand.a';
    const source = `
      .word
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  test('104. should assemble .zero directive with valid size', () => {
    const aFilePath = 'zeroValid.a';
    const source = `
      .zero 10
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('105. should throw error for .zero directive with non-numeric size', () => {
    const aFilePath = 'zeroNonNumeric.a';
    const source = `
      .zero ten
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('106. should throw error for .zero directive missing operand', () => {
    const aFilePath = 'zeroMissingOperand.a';
    const source = `
      .zero
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  test('107. should throw error for .zero directive with negative size', () => {
    const aFilePath = 'zeroNegativeSize.a';
    const source = `
      .zero -5
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('117. should assemble .org directive with valid address by padding the gap with zero words', () => {
    const aFilePath = 'orgValid.a';
    const source = `
      .word 1
      .org 4
      mov r0, 5
      halt
    `;
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
    const source = `
      .org address
      mov r0, 5
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Invalid number for .org directive');
  });

  test('119. should throw error for .org directive missing operand', () => {
    const aFilePath = 'orgMissingOperand.a';
    const source = `
      .org
      mov r0, 5
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  test('120. should throw error for .org directive with address out of bounds', () => {
    const aFilePath = 'orgOutOfBounds.a';
    const source = `
      .org 70000
      mov r0, 5
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('121. should throw error for undefined directive', () => {
    const aFilePath = 'undefinedDirective.a';
    const source = `
      .undefinedDirective
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Invalid operation');
  });

  test('130. should throw error for .string directive with multi-character literal', () => {
    const aFilePath = 'stringMultiChar.a';
    const source = `
      .string 'ab'
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('String constant missing leading quote');
  });

  test('203. should throw error for .string directive with no arguments', () => {
    const aFilePath = 'stringNoArgs.a';
    const source = `
      .string
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  test('209. should assemble .string directive with escaped newline char', () => {
    const aFilePath = 'stringEscapedNewline.a';
    const source = `
      halt
x: .string "Hello,\\nworld!"
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('212. should throw error for .word with operator but no operand', () => {
    const aFilePath = 'wordOperatorNoOperand.a';
    const source = `
    halt
x: .word +
`;

    virtualFs[aFilePath] = source;
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  test('213. should throw error for .zero with invalid argument', () => {
    const aFilePath = 'zeroInvalidArg.a';
    const source = `
    halt
x: .zero +
`;

    virtualFs[aFilePath] = source;
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('214. should allow repeated forward .org directives within address bounds', () => {
    const aFilePath = 'orgOutOfBounds.a';
    const source = `
      .org 30000
      .org 40000
      mov r0, 5
      halt
    `;
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
