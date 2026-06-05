/**
 * @file assembler.instructions.integration.spec.js
 * Integration tests for assembler.js instruction handling.
 */

const fs = require('fs');
const Assembler = require('../../src/core/assembler');
const { setupAssemblerIntegrationHarness } = require('../helpers/assemblerIntegrationHarness');

jest.mock('fs');
const path = require('path');
const realFs = jest.requireActual('fs');

describe('Assembler Instruction Integration', () => {
  let assembler;
  let virtualFs;
  const { getAssembler, getVirtualFs } = setupAssemblerIntegrationHarness(Assembler);

  beforeEach(() => {
    assembler = getAssembler();
    virtualFs = getVirtualFs();
  });

  test('11. should throw if an immediate is out of range for an instruction (e.g. sub)', () => {
    const aFilePath = 'outOfRange.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/outOfRange.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('15. should throw an error when passing a non-ascii, non-numeric, non-literal (i.e. a label) to mov instruction', () => {
    const aFilePath = 'badMov.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/badMov.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('20. should throw an error when not passing a 2nd operand to mov', () => {
    const aFilePath = 'noSecondOperand.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/noSecondOperand.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('21. should throw an error when not passing anything to mov', () => {
    const aFilePath = 'noOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/noOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('22. should throw an error when passing a label (instead of a literal) to mov', () => {
    const aFilePath = 'labelToMov.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/labelToMov.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('23. should not throw an error when passing extra arguments to mov', () => {
    const aFilePath = 'extraArgsToMov.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/extraArgsToMov.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('24. should throw an error when passing a label instead of a register to mov', () => {
    const aFilePath = 'labelToMov2.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/labelToMov2.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('25. should throw an error when passing an invalid register to mvi', () => {
    const aFilePath = 'invalidRegisterToMvi.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/invalidRegisterToMvi.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('26. should throw an error when passing a register instead of a literal to mvi', () => {
    const aFilePath = 'registerToMvi.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/registerToMvi.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('29. should not throw an error when passing a literal to a ld instruction', () => {
    const aFilePath = 'literalToLd.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/literalToLd.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('30. should not throw an error when adding two registers', () => {
    const aFilePath = 'addRegisters.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/addRegisters.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('31. should not throw an error when adding a register and a literal', () => {
    const aFilePath = 'addRegisterLiteral.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/addRegisterLiteral.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('32. should throw an error when adding a literal and a register', () => {
    const aFilePath = 'addLiteralRegister.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/addLiteralRegister.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('33. should throw an error when adding a register and a label', () => {
    const aFilePath = 'addRegisterLabel.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/addRegisterLabel.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('34. should throw an error when adding a number that is out of range', () => {
    const aFilePath = 'addOutOfRange.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/addOutOfRange.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('35. should assemble brz instruction with valid label', () => {
    const aFilePath = 'brzValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/brzValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('36. should throw error for brz instruction missing label operand', () => {
    const aFilePath = 'brzMissingLabel.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/brzMissingLabel.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('37. should throw error for brz instruction with invalid condition code', () => {
    const aFilePath = 'brzInvalidCC.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/brzInvalidCC.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('39. should assemble brz instruction with extra operands without throwing error', () => {
    const aFilePath = 'brzExtraOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/brzExtraOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('42. should throw error for brz instruction with label and invalid offset', () => {
    const aFilePath = 'brzInvalidOffset.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/brzInvalidOffset.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('44. should assemble ld instruction with valid label', () => {
    const aFilePath = 'ldValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/ldValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('45. should throw error for ld instruction missing operand', () => {
    const aFilePath = 'ldMissingOperand.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/ldMissingOperand.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('47. should assemble ld instruction with extra operands without throwing error', () => {
    const aFilePath = 'ldExtraOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/ldExtraOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('50. should throw error for ld instruction with label and invalid offset', () => {
    const aFilePath = 'ldInvalidOffset.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/ldInvalidOffset.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('51. should assemble st instruction with valid register and label', () => {
    const aFilePath = 'stValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/stValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('52. should throw error for st instruction missing operand', () => {
    const aFilePath = 'stMissingOperand.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/stMissingOperand.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('54. should assemble st instruction with extra operands without throwing error', () => {
    const aFilePath = 'stExtraOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/stExtraOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('57. should throw error for st instruction with label and invalid offset', () => {
    const aFilePath = 'stInvalidOffset.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/stInvalidOffset.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('59. should assemble mul instruction with valid registers', () => {
    const aFilePath = 'mulValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/mulValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('60. should throw error for mul instruction missing operands', () => {
    const aFilePath = 'mulMissingOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/mulMissingOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('61. should throw error for mul instruction with invalid operand types', () => {
    const aFilePath = 'mulInvalidOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/mulInvalidOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('62. should assemble mul instruction with extra operands without throwing error', () => {
    const aFilePath = 'mulExtraOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/mulExtraOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('63. should assemble div instruction with valid registers', () => {
    const aFilePath = 'divValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/divValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('64. should throw error for div instruction with immediate instead of register', () => {
    const aFilePath = 'divInvalidOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/divInvalidOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('65. should throw error for div instruction missing operands', () => {
    const aFilePath = 'divMissingOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/divMissingOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('66. should assemble div instruction with extra operands without throwing error', () => {
    const aFilePath = 'divExtraOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/divExtraOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('67. should throw error for sub instruction with label instead of register', () => {
    const aFilePath = 'subInvalidOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/subInvalidOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('68. should assemble jmp instruction with valid base register', () => {
    const aFilePath = 'jmpValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/jmpValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('69. should throw error for jmp instruction with invalid base register', () => {
    const aFilePath = 'jmpInvalidBaseRegister.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/jmpInvalidBaseRegister.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('70. should throw error for jmp instruction missing operands', () => {
    const aFilePath = 'jmpMissingOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/jmpMissingOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    // cuh63 6.3 oracle: "Missing operand" (not "Missing register")
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('71. should assemble jmp instruction with extra operands without throwing error', () => {
    const aFilePath = 'jmpExtraOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/jmpExtraOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('72. should assemble ret instruction with no operands', () => {
    const aFilePath = 'retValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/retValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('73. should assemble ret instruction with extra operands without throwing error', () => {
    const aFilePath = 'retExtraOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/retExtraOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('74. should throw error for ret instruction with invalid operand', () => {
    const aFilePath = 'retInvalidOperand.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/retInvalidOperand.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('75. should assemble mvi instruction with valid immediate', () => {
    const aFilePath = 'mviValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/mviValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('76. should throw error for mvi instruction with immediate out of bounds', () => {
    const aFilePath = 'mviOutOfBounds.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/mviOutOfBounds.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('77. should throw error for mvi instruction missing operands', () => {
    const aFilePath = 'mviMissingOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/mviMissingOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('78. should throw error for mvi instruction with invalid operand types', () => {
    const aFilePath = 'mviInvalidOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/mviInvalidOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('79. should assemble mvi instruction with extra operands without throwing error', () => {
    const aFilePath = 'mviExtraOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/mviExtraOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('80. should assemble lea instruction with valid label', () => {
    const aFilePath = 'leaValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/leaValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('81. should throw error for lea instruction missing operand', () => {
    const aFilePath = 'leaMissingOperand.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/leaMissingOperand.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('82. should throw error for lea instruction with invalid operand type', () => {
    const aFilePath = 'leaInvalidOperand.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/leaInvalidOperand.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('83. should assemble lea instruction with extra operands without throwing error', () => {
    const aFilePath = 'leaExtraOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/leaExtraOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('84. should assemble blr instruction with valid base register', () => {
    const aFilePath = 'blrValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/blrValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('85. should throw error for blr instruction with invalid base register', () => {
    const aFilePath = 'blrInvalidBaseRegister.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/blrInvalidBaseRegister.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('86. should throw error for blr instruction missing operands', () => {
    const aFilePath = 'blrMissingOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/blrMissingOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('87. should assemble blr instruction with extra operands without throwing error', () => {
    const aFilePath = 'blrExtraOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/blrExtraOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('88. should assemble cmp instruction with valid registers', () => {
    const aFilePath = 'cmpValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/cmpValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('89. should throw error for cmp instruction with immediate out of bounds', () => {
    const aFilePath = 'cmpImmediateOutOfBounds.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/cmpImmediateOutOfBounds.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('90. should throw error for cmp instruction with invalid operand types', () => {
    const aFilePath = 'cmpInvalidOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/cmpInvalidOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('91. should assemble and instruction with valid registers', () => {
    const aFilePath = 'andValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/andValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('92. should throw error for and instruction with immediate out of bounds', () => {
    const aFilePath = 'andImmediateOutOfBounds.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/andImmediateOutOfBounds.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('93. should throw error for and instruction with invalid 1st operand', () => {
    const aFilePath = 'andInvalidOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/andInvalidOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('94. should assemble and instruction with extra operands without throwing error', () => {
    const aFilePath = 'andExtraOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-instructions/andExtraOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('95. should throw error for br with bare numeric operand (LCC.js BUG §25 regression)', () => {
    const aFilePath = 'brNumericOperand.a';
    virtualFs[aFilePath] = 'br 5\nhalt\n';
    expect(() => assembler.main([aFilePath])).toThrow();
  });

  test('96. should throw error for brz with bare numeric operand (LCC.js BUG §25 regression)', () => {
    const aFilePath = 'brzNumericOperand.a';
    virtualFs[aFilePath] = `
      brz 5
      halt
    `;
    expect(() => assembler.main([aFilePath])).toThrow();
  });

  test('97. should throw error for brn with bare numeric operand (LCC.js BUG §25 regression)', () => {
    const aFilePath = 'brnNumericOperand.a';
    virtualFs[aFilePath] = `
      brn 5
      halt
    `;
    expect(() => assembler.main([aFilePath])).toThrow();
  });
});
