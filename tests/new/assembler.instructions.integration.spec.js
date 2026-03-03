/**
 * @file assembler.instructions.integration.spec.js
 * Integration tests for assembler.js instruction handling.
 */

const fs = require('fs');
const Assembler = require('../../src/core/assembler');
const { setupAssemblerIntegrationHarness } = require('../helpers/assemblerIntegrationHarness');

jest.mock('fs');

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
    const source = `
      mov r0, 5
      ; sub immediate takes a 5-bit imm, i.e. -16..15
      sub r0, r0, 100 ; out of range
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('imm5 out of range');
  });

  test('15. should throw an error when passing a non-ascii, non-numeric, non-literal (i.e. a label) to mov instruction', () => {
    const aFilePath = 'badMov.a';
    const source = `
      mov r0, notAValidCharOrNumber
      halt
      notAValidCharOrNumber: .string "hello"
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('20. should throw an error when not passing a 2nd operand to mov', () => {
    const aFilePath = 'noSecondOperand.a';
    const source = `
      mov r0
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing number');
  });

  test('21. should throw an error when not passing anything to mov', () => {
    const aFilePath = 'noOperands.a';
    const source = `
      mov
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  test('22. should throw an error when passing a label (instead of a literal) to mov', () => {
    const aFilePath = 'labelToMov.a';
    const source = `
      mov r0, myLabel
      halt
    myLabel: .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('23. should not throw an error when passing extra arguments to mov', () => {
    const aFilePath = 'extraArgsToMov.a';
    const source = `
      mov r0, 5, 10
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('24. should throw an error when passing a label instead of a register to mov', () => {
    const aFilePath = 'labelToMov2.a';
    const source = `
      mov myLabel, 5
      halt
    myLabel: .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  test('25. should throw an error when passing an invalid register to mvi', () => {
    const aFilePath = 'invalidRegisterToMvi.a';
    const source = `
      mvi r8, 5
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  test('26. should throw an error when passing a register instead of a literal to mvi', () => {
    const aFilePath = 'registerToMvi.a';
    const source = `
      mvi r0, r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('29. should not throw an error when passing a literal to a ld instruction', () => {
    const aFilePath = 'literalToLd.a';
    const source = `
      ld r0, 5
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('30. should not throw an error when adding two registers', () => {
    const aFilePath = 'addRegisters.a';
    const source = `
      add r0, r1, r2
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('31. should not throw an error when adding a register and a literal', () => {
    const aFilePath = 'addRegisterLiteral.a';
    const source = `
      add r0, r1, 5
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('32. should throw an error when adding a literal and a register', () => {
    const aFilePath = 'addLiteralRegister.a';
    const source = `
      add r0, 5, r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  test('33. should throw an error when adding a register and a label', () => {
    const aFilePath = 'addRegisterLabel.a';
    const source = `
      add r0, r1, myLabel
      halt
    myLabel: .word 5
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('34. should throw an error when adding a number that is out of range', () => {
    const aFilePath = 'addOutOfRange.a';
    const source = `
      add r0, r1, 300
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('imm5 out of range');
  });

  test('35. should assemble brz instruction with valid label', () => {
    const aFilePath = 'brzValid.a';
    const source = `
      brz end
      halt
    end:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('36. should throw error for brz instruction missing label operand', () => {
    const aFilePath = 'brzMissingLabel.a';
    const source = `
      brz
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  test('37. should throw error for brz instruction with invalid condition code', () => {
    const aFilePath = 'brzInvalidCC.a';
    const source = `
      brz123 end
      halt
    end:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Invalid operation');
  });

  test('39. should assemble brz instruction with extra operands without throwing error', () => {
    const aFilePath = 'brzExtraOperands.a';
    const source = `
      brz end extra
      halt
    end:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('42. should throw error for brz instruction with label and invalid offset', () => {
    const aFilePath = 'brzInvalidOffset.a';
    const source = `
      brz end + label
      halt
    end:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('44. should assemble ld instruction with valid label', () => {
    const aFilePath = 'ldValid.a';
    const source = `
      ld r1, data
      halt
    data:
      .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('45. should throw error for ld instruction missing operand', () => {
    const aFilePath = 'ldMissingOperand.a';
    const source = `
      ld r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  test('47. should assemble ld instruction with extra operands without throwing error', () => {
    const aFilePath = 'ldExtraOperands.a';
    const source = `
      ld r1, data, extra
      halt
data: .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('50. should throw error for ld instruction with label and invalid offset', () => {
    const aFilePath = 'ldInvalidOffset.a';
    const source = `
      ld r1, data + label
      halt
    data:
      .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('51. should assemble st instruction with valid register and label', () => {
    const aFilePath = 'stValid.a';
    const source = `
      st r2, data
      halt
    data:
      .word 20
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('52. should throw error for st instruction missing operand', () => {
    const aFilePath = 'stMissingOperand.a';
    const source = `
      st r2
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  test('54. should assemble st instruction with extra operands without throwing error', () => {
    const aFilePath = 'stExtraOperands.a';
    const source = `
      st r2, data, extra
      halt
    data:
      .word 20
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('57. should throw error for st instruction with label and invalid offset', () => {
    const aFilePath = 'stInvalidOffset.a';
    const source = `
      st r2, data + offset
      halt
    data:
      .word 20
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('59. should assemble mul instruction with valid registers', () => {
    const aFilePath = 'mulValid.a';
    const source = `
      mul r3, r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('60. should throw error for mul instruction missing operands', () => {
    const aFilePath = 'mulMissingOperands.a';
    const source = `
      mul r3
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  test('61. should throw error for mul instruction with invalid operand types', () => {
    const aFilePath = 'mulInvalidOperands.a';
    const source = `
      mul r3, 5
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  test('62. should assemble mul instruction with extra operands without throwing error', () => {
    const aFilePath = 'mulExtraOperands.a';
    const source = `
      mul r3, r1, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('63. should assemble div instruction with valid registers', () => {
    const aFilePath = 'divValid.a';
    const source = `
      div r3, r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('64. should throw error for div instruction with immediate instead of register', () => {
    const aFilePath = 'divInvalidOperands.a';
    const source = `
      div r3, 5
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  test('65. should throw error for div instruction missing operands', () => {
    const aFilePath = 'divMissingOperands.a';
    const source = `
      div r3
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  test('66. should assemble div instruction with extra operands without throwing error', () => {
    const aFilePath = 'divExtraOperands.a';
    const source = `
      div r3, r1, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('67. should throw error for sub instruction with label instead of register', () => {
    const aFilePath = 'subInvalidOperands.a';
    const source = `
      sub r0, label, r1
      halt
    label: .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  test('68. should assemble jmp instruction with valid base register', () => {
    const aFilePath = 'jmpValid.a';
    const source = `
      jmp r3
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('69. should throw error for jmp instruction with invalid base register', () => {
    const aFilePath = 'jmpInvalidBaseRegister.a';
    const source = `
      jmp r8
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  test('70. should throw error for jmp instruction missing operands', () => {
    const aFilePath = 'jmpMissingOperands.a';
    const source = `
      jmp
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  test('71. should assemble jmp instruction with extra operands without throwing error', () => {
    const aFilePath = 'jmpExtraOperands.a';
    const source = `
      jmp r3, 5, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('72. should assemble ret instruction with no operands', () => {
    const aFilePath = 'retValid.a';
    const source = `
      ret
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('73. should assemble ret instruction with extra operands without throwing error', () => {
    const aFilePath = 'retExtraOperands.a';
    const source = `
      halt
      ret 10, extra
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('74. should throw error for ret instruction with invalid operand', () => {
    const aFilePath = 'retInvalidOperand.a';
    const source = `
      ret label
      halt
    label:
      .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('75. should assemble mvi instruction with valid immediate', () => {
    const aFilePath = 'mviValid.a';
    const source = `
      mvi r1, 123
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('76. should throw error for mvi instruction with immediate out of bounds', () => {
    const aFilePath = 'mviOutOfBounds.a';
    const source = `
      mvi r1, 70000
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('mvi immediate out of range');
  });

  test('77. should throw error for mvi instruction missing operands', () => {
    const aFilePath = 'mviMissingOperands.a';
    const source = `
      mvi r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing number');
  });

  test('78. should throw error for mvi instruction with invalid operand types', () => {
    const aFilePath = 'mviInvalidOperands.a';
    const source = `
      mvi 5, r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  test('79. should assemble mvi instruction with extra operands without throwing error', () => {
    const aFilePath = 'mviExtraOperands.a';
    const source = `
      mvi r1, 123, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('80. should assemble lea instruction with valid label', () => {
    const aFilePath = 'leaValid.a';
    const source = `
      lea r1, data
      halt
    data:
      .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('81. should throw error for lea instruction missing operand', () => {
    const aFilePath = 'leaMissingOperand.a';
    const source = `
      lea r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  test('82. should throw error for lea instruction with invalid operand type', () => {
    const aFilePath = 'leaInvalidOperand.a';
    const source = `
      lea r3, "cheese"
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad label');
  });

  test('83. should assemble lea instruction with extra operands without throwing error', () => {
    const aFilePath = 'leaExtraOperands.a';
    const source = `
      lea r1, data, extra
      halt
    data:
      .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('84. should assemble blr instruction with valid base register', () => {
    const aFilePath = 'blrValid.a';
    const source = `
      blr r3
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('85. should throw error for blr instruction with invalid base register', () => {
    const aFilePath = 'blrInvalidBaseRegister.a';
    const source = `
      blr r8
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  test('86. should throw error for blr instruction missing operands', () => {
    const aFilePath = 'blrMissingOperands.a';
    const source = `
      blr
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  test('87. should assemble blr instruction with extra operands without throwing error', () => {
    const aFilePath = 'blrExtraOperands.a';
    const source = `
      blr r4, 5, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('88. should assemble cmp instruction with valid registers', () => {
    const aFilePath = 'cmpValid.a';
    const source = `
      cmp r1, r2
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('89. should throw error for cmp instruction with immediate out of bounds', () => {
    const aFilePath = 'cmpImmediateOutOfBounds.a';
    const source = `
      cmp r1, 20
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('imm5 out of range');
  });

  test('90. should throw error for cmp instruction with invalid operand types', () => {
    const aFilePath = 'cmpInvalidOperands.a';
    const source = `
      cmp r1, label
      halt
    label: .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('91. should assemble and instruction with valid registers', () => {
    const aFilePath = 'andValid.a';
    const source = `
      and r1, r2, r3
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('92. should throw error for and instruction with immediate out of bounds', () => {
    const aFilePath = 'andImmediateOutOfBounds.a';
    const source = `
      and r1, r2, 20
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('imm5 out of range');
  });

  test('93. should throw error for and instruction with invalid 1st operand', () => {
    const aFilePath = 'andInvalidOperands.a';
    const source = `
      and r1, label, r3
      halt
label: .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  test('94. should assemble and instruction with extra operands without throwing error', () => {
    const aFilePath = 'andExtraOperands.a';
    const source = `
      and r1, r2, r3, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });
});
