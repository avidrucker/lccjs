/**
 * @file assembler.edge.integration.spec.js
 * Integration tests for assembler.js late-family instruction and operand edge cases.
 */

const fs = require('fs');
const Assembler = require('../../src/core/assembler');
const { setupAssemblerIntegrationHarness } = require('../helpers/assemblerIntegrationHarness');

jest.mock('fs');

describe('Assembler Edge Integration', () => {
  let assembler;
  let virtualFs;
  const { getAssembler, getVirtualFs } = setupAssemblerIntegrationHarness(Assembler);

  beforeEach(() => {
    assembler = getAssembler();
    virtualFs = getVirtualFs();
  });

  test('122. should throw error for add instruction with label instead of register', () => {
    const aFilePath = 'addLabelInsteadRegister.a';
    const source = `
      add r0, r1, label
      halt
    label:
      .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('126. should throw error for mvi instruction with string instead of literal', () => {
    const aFilePath = 'mviStringInsteadLiteral.a';
    const source = `
      mvi r1, "Hello"
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('127. should assemble add instruction with valid negative immediate', () => {
    const aFilePath = 'addNegativeImmediate.a';
    const source = `
      add r0, r1, -5
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('128. should throw error for add instruction with immediate below negative bound', () => {
    const aFilePath = 'addImmediateBelowBound.a';
    const source = `
      add r0, r1, -20
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('imm5 out of range');
  });

  test('131. should assemble pop instruction with valid destination register', () => {
    const aFilePath = 'popValid.a';
    const source = `
      pop r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('132. should throw error for pop instruction with invalid register', () => {
    const aFilePath = 'popInvalidRegister.a';
    const source = `
      pop r8
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  test('133. should throw error for pop instruction missing operand', () => {
    const aFilePath = 'popMissingOperand.a';
    const source = `
      pop
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  test('134. should assemble pop instruction with extra operands without throwing error', () => {
    const aFilePath = 'popExtraOperands.a';
    const source = `
      pop r1, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('135. should assemble push instruction with valid source register', () => {
    const aFilePath = 'pushValid.a';
    const source = `
      push r2
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('136. should throw error for push instruction with invalid register', () => {
    const aFilePath = 'pushInvalidRegister.a';
    const source = `
      push r8
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  test('137. should throw error for push instruction missing operand', () => {
    const aFilePath = 'pushMissingOperand.a';
    const source = `
      push
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  test('138. should assemble push instruction with extra operands without throwing error', () => {
    const aFilePath = 'pushExtraOperands.a';
    const source = `
      push r2, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('140. should throw no error for srl instruction with shift count that goes out of range', () => {
    const aFilePath = 'srlInvalidShiftCount.a';
    const source = `
      srl r1, 16
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('141. should throw error for invalid shift type in srl instruction', () => {
    const aFilePath = 'srlInvalidShiftType.a';
    const source = `
      srl r1, invalidShiftType
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('142. should assemble sll instruction with valid shift count', () => {
    const aFilePath = 'sllValid.a';
    const source = `
      sll r1, 5
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('143. should assemble sll instruction with missing shift count', () => {
    const aFilePath = 'sllMissingShiftCount.a';
    const source = `
      sll r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('144. should throw no error for sll instruction with shift count out of range', () => {
    const aFilePath = 'sllShiftCountOutOfRange.a';
    const source = `
      sll r1, 20
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('145. should assemble rol instruction with valid operands', () => {
    const aFilePath = 'rolValid.a';
    const source = `
      rol r2, 3
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('146. should throw no error for rol instruction with out of range shift count', () => {
    const aFilePath = 'rolInvalidShiftCount.a';
    const source = `
      rol r2, 16
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('147. should assemble ror instruction with valid operands', () => {
    const aFilePath = 'rorValid.a';
    const source = `
      ror r3, 2
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('148. should throw error for ror instruction with invalid operand types', () => {
    const aFilePath = 'rorInvalidOperands.a';
    const source = `
      ror r3, label
      halt
    label:
      .word 5
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('149. should assemble ror instruction with missing shift count', () => {
    const aFilePath = 'rorMissingShiftCount.a';
    const source = `
      ror r3
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('150. should throw error for rol instruction with invalid operand format', () => {
    const aFilePath = 'rolInvalidOperandFormat.a';
    const source = `
      rol r2, cheese
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('151. should assemble bl instruction with valid label', () => {
    const aFilePath = 'blValid.a';
    const source = `
      bl function
      halt
    function:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
    expect(assembler.isObjectModule).toBe(false);
  });

  test('153. should assemble bl instruction with extra operands without throwing error', () => {
    const aFilePath = 'blExtraOperands.a';
    const source = `
      bl function, extra
      halt
    function:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('154. should throw error for bl instruction with invalid operand type', () => {
    const aFilePath = 'blInvalidOperand.a';
    const source = `
      bl 100
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad label');
  });

  test('155. should assemble ldr instruction with valid operands', () => {
    const aFilePath = 'ldrValid.a';
    const source = `
      ldr r1, r2, 4
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('156. should throw error for ldr instruction with invalid base register', () => {
    const aFilePath = 'ldrInvalidBaseRegister.a';
    const source = `
      ldr r1, r8, 4
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  test('157. should throw error for ldr instruction with invalid offset', () => {
    const aFilePath = 'ldrInvalidOffset.a';
    const source = `
      ldr r1, r2, 100
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('offset6 out of range');
  });

  test('158. should throw error for ldr instruction missing operands', () => {
    const aFilePath = 'ldrMissingOperands.a';
    const source = `
      ldr r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  test('159. should assemble ldr instruction with extra operands without throwing error', () => {
    const aFilePath = 'ldrExtraOperands.a';
    const source = `
      ldr r1, r2, 4, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('160. should throw error for ldr instruction with label', () => {
    const aFilePath = 'ldrLabel.a';
    const source = `
      ldr r1, r2, label
      halt
    label:
      .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('162. should assemble mvr instruction with valid registers', () => {
    const aFilePath = 'mvrValid.a';
    const source = `
      mvr r1, r2
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('163. should throw error for mvr instruction with invalid operand type', () => {
    const aFilePath = 'mvrInvalidOperand.a';
    const source = `
      mvr r1, 100
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  test('164. should throw error for mvr instruction missing operands', () => {
    const aFilePath = 'mvrMissingOperands.a';
    const source = `
      mvr r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  test('165. should assemble mvr instruction with extra operands without throwing error', () => {
    const aFilePath = 'mvrExtraOperands.a';
    const source = `
      mvr r1, r2, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('166. should assemble sext instruction with valid operands', () => {
    const aFilePath = 'sextValid.a';
    const source = `
      sext r3, r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('167. should throw error for sext instruction with invalid operand type', () => {
    const aFilePath = 'sextInvalidOperand.a';
    const source = `
      sext r3, 10
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  test('168. should throw error for sext instruction missing operands', () => {
    const aFilePath = 'sextMissingOperands.a';
    const source = `
      sext r3
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  test('169. should assemble sext instruction with extra operands without throwing error', () => {
    const aFilePath = 'sextExtraOperands.a';
    const source = `
      sext r3, r1, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('170. should assemble halt instruction with extra operands without throwing error', () => {
    const aFilePath = 'haltExtraOperands.a';
    const source = `
      halt extra
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('171. should throw error for dout trap instruction with invalid register', () => {
    const aFilePath = 'doutInvalidRegister.a';
    const source = `
      dout r8
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  test('172. should assemble dout trap instruction with missing operand (defaults to r0)', () => {
    const aFilePath = 'doutMissingOperand.a';
    const source = `
      dout
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('173. should throw error for dout trap instruction with label instead of register', () => {
    const aFilePath = 'doutLabelInsteadRegister.a';
    const source = `
      dout label
      halt
    label:
      .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  test('176. should assemble jmp instruction with offset', () => {
    const aFilePath = 'jmpLabelOffsetNoSpace.a';
    const source = `
      jmp r0, 5
      dout r0
      dout r0
      dout r0
      dout r0
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('177. should assemble jmp instruction with no offset', () => {
    const aFilePath = 'jmpLabelOffsetWithSpace.a';
    const source = `
      jmp r0
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('178. should throw error for jmp instruction with label', () => {
    const aFilePath = 'jmpInvalidOffset.a';
    const source = `
      jmp loop
      halt
    loop:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  test('179. should throw error for jmp instruction with offset out of bounds', () => {
    const aFilePath = 'jmpOffsetOutOfBounds.a';
    const source = `
      jmp r0, 300
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('offset6 out of range');
  });

  test('180. should assemble br instruction with valid label', () => {
    const aFilePath = 'brValid.a';
    const source = `
      br loop
      halt
    loop:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('183. should assemble ret instruction with extra operands without throwing error', () => {
    const aFilePath = 'retExtraOperands.a';
    const source = `
      ret 10 50
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('184. should throw error for ret instruction with invalid operand type', () => {
    const aFilePath = 'retInvalidOperand.a';
    const source = `
      ret r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('186. should assemble xor instruction with valid registers', () => {
    const aFilePath = 'xorValid.a';
    const source = `
      xor r1, r2, r3
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('187. should throw error for xor instruction with non-register immediate value', () => {
    const aFilePath = 'xorImmediateOutOfBounds.a';
    const source = `
      xor r1, 20
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  test('188. should throw error for xor instruction with invalid operand types', () => {
    const aFilePath = 'xorInvalidOperands.a';
    const source = `
      xor r1, label
      halt
    label:
      .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  test('189. should assemble xor instruction with extra operands without throwing error', () => {
    const aFilePath = 'xorExtraOperands.a';
    const source = `
      xor r1, r2, r3, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('191. should assemble not instruction with valid operands', () => {
    const aFilePath = 'notValid.a';
    const source = `
      not r1, r2
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('192. should throw error for not instruction with invalid operand type', () => {
    const aFilePath = 'notInvalidOperand.a';
    const source = `
      not r1, 5
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  test('193. should throw error for not instruction missing operand', () => {
    const aFilePath = 'notMissingOperand.a';
    const source = `
      not r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  test('194. should assemble not instruction with extra operands without throwing error', () => {
    const aFilePath = 'notExtraOperands.a';
    const source = `
      not r1, r2, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('196. should assemble add instruction with maximum positive immediate', () => {
    const aFilePath = 'addMaxPositiveImmediate.a';
    const source = `
      add r0, r1, 15
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('197. should assemble add instruction with maximum negative immediate', () => {
    const aFilePath = 'addMaxNegativeImmediate.a';
    const source = `
      add r0, r1, -16
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('198. should throw error for add instruction with immediate below negative bound', () => {
    const aFilePath = 'addImmediateBelowBound.a';
    const source = `
      add r0, r1, -17
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('imm5 out of range');
  });

  test('199. should throw error for add instruction with immediate above positive bound', () => {
    const aFilePath = 'addImmediateAboveBound.a';
    const source = `
      add r0, r1, 16
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('imm5 out of range');
  });

  test('200. should throw error for add instruction with invalid hexadecimal immediate', () => {
    const aFilePath = 'addInvalidHexImmediate.a';
    const source = `
      add r0, r1, 0xG
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('201. should throw error for blr instruction with non-numeric 2nd argument', () => {
    const aFilePath = 'blrNonNumericSecondArg.a';
    const source = `
      blr r1, cheese
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('202. should throw error for blr instruction with non-register 1st argument', () => {
    const aFilePath = 'blrNonRegisterFirstArg.a';
    const source = `
      blr cheese
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  test('204. should throw no error for ldr instruction implicit operand', () => {
    const aFilePath = 'ldrImplicitOperand.a';
    const source = `
      ldr r1, r2
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('205. should throw error for ldr instruction with label and offset', () => {
    const aFilePath = 'ldrLabelOffset.a';
    const source = `
      ldr r1, r2, label + 5
      halt
    label:
      .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('206. should throw error for sext instruction missing operands', () => {
    const aFilePath = 'sextMissingOperands.a';
    const source = `
      sext
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  test('207. should throw error for mvr instruction missing operands', () => {
    const aFilePath = 'mvrMissingOperands.a';
    const source = `
      mvr
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  test('210. should throw error for offset with missing number', () => {
    const aFilePath = 'offsetMissingNumber.a';
    const source = `
    lea r0, x +
    halt
x: .word 10
    `;

    virtualFs[aFilePath] = source;
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing number');
  });

  test('211. should throw error for lea with no arguments', () => {
    const aFilePath = 'leaNoArgs.a';
    const source = `
    lea
    halt
    `;

    virtualFs[aFilePath] = source;
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });
});
