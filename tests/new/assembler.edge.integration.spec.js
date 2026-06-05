/**
 * @file assembler.edge.integration.spec.js
 * Integration tests for assembler.js late-family instruction and operand edge cases.
 */

const fs = require('fs');
const Assembler = require('../../src/core/assembler');
const { setupAssemblerIntegrationHarness } = require('../helpers/assemblerIntegrationHarness');

jest.mock('fs');
const path = require('path');
const realFs = jest.requireActual('fs');

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
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/addLabelInsteadRegister.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('126. should throw error for mvi instruction with string instead of literal', () => {
    const aFilePath = 'mviStringInsteadLiteral.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/mviStringInsteadLiteral.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('127. should assemble add instruction with valid negative immediate', () => {
    const aFilePath = 'addNegativeImmediate.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/addNegativeImmediate.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('128. should throw error for add instruction with immediate below negative bound', () => {
    const aFilePath = 'addImmediateBelowBound.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/addImmediateBelowBound.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('131. should assemble pop instruction with valid destination register', () => {
    const aFilePath = 'popValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/popValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('132. should throw error for pop instruction with invalid register', () => {
    const aFilePath = 'popInvalidRegister.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/popInvalidRegister.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('133. should throw error for pop instruction missing operand', () => {
    const aFilePath = 'popMissingOperand.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/popMissingOperand.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('134. should assemble pop instruction with extra operands without throwing error', () => {
    const aFilePath = 'popExtraOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/popExtraOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('135. should assemble push instruction with valid source register', () => {
    const aFilePath = 'pushValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/pushValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('136. should throw error for push instruction with invalid register', () => {
    const aFilePath = 'pushInvalidRegister.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/pushInvalidRegister.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('137. should throw error for push instruction missing operand', () => {
    const aFilePath = 'pushMissingOperand.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/pushMissingOperand.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('138. should assemble push instruction with extra operands without throwing error', () => {
    const aFilePath = 'pushExtraOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/pushExtraOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('140. should throw no error for srl instruction with shift count that goes out of range', () => {
    const aFilePath = 'srlInvalidShiftCount.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/srlInvalidShiftCount.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('141. should throw error for invalid shift type in srl instruction', () => {
    const aFilePath = 'srlInvalidShiftType.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/srlInvalidShiftType.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('142. should assemble sll instruction with valid shift count', () => {
    const aFilePath = 'sllValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/sllValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('143. should assemble sll instruction with missing shift count', () => {
    const aFilePath = 'sllMissingShiftCount.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/sllMissingShiftCount.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('144. should throw no error for sll instruction with shift count out of range', () => {
    const aFilePath = 'sllShiftCountOutOfRange.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/sllShiftCountOutOfRange.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('145. should assemble rol instruction with valid operands', () => {
    const aFilePath = 'rolValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/rolValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('146. should throw no error for rol instruction with out of range shift count', () => {
    const aFilePath = 'rolInvalidShiftCount.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/rolInvalidShiftCount.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('147. should assemble ror instruction with valid operands', () => {
    const aFilePath = 'rorValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/rorValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('148. should throw error for ror instruction with invalid operand types', () => {
    const aFilePath = 'rorInvalidOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/rorInvalidOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('149. should assemble ror instruction with missing shift count', () => {
    const aFilePath = 'rorMissingShiftCount.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/rorMissingShiftCount.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('150. should throw error for rol instruction with invalid operand format', () => {
    const aFilePath = 'rolInvalidOperandFormat.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/rolInvalidOperandFormat.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('151. should assemble bl instruction with valid label', () => {
    const aFilePath = 'blValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/blValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
    expect(assembler.isObjectModule).toBe(false);
  });

  test('153. should assemble bl instruction with extra operands without throwing error', () => {
    const aFilePath = 'blExtraOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/blExtraOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('154. should throw error for bl instruction with invalid operand type', () => {
    const aFilePath = 'blInvalidOperand.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/blInvalidOperand.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('155. should assemble ldr instruction with valid operands', () => {
    const aFilePath = 'ldrValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/ldrValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('156. should throw error for ldr instruction with invalid base register', () => {
    const aFilePath = 'ldrInvalidBaseRegister.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/ldrInvalidBaseRegister.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('157. should throw error for ldr instruction with invalid offset', () => {
    const aFilePath = 'ldrInvalidOffset.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/ldrInvalidOffset.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('158. should throw error for ldr instruction missing operands', () => {
    const aFilePath = 'ldrMissingOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/ldrMissingOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('159. should assemble ldr instruction with extra operands without throwing error', () => {
    const aFilePath = 'ldrExtraOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/ldrExtraOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('160. should throw error for ldr instruction with label', () => {
    const aFilePath = 'ldrLabel.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/ldrLabel.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('162. should assemble mvr instruction with valid registers', () => {
    const aFilePath = 'mvrValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/mvrValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('163. should throw error for mvr instruction with invalid operand type', () => {
    const aFilePath = 'mvrInvalidOperand.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/mvrInvalidOperand.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('164. should throw error for mvr instruction missing operands', () => {
    const aFilePath = 'mvrMissingOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/mvrMissingOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('165. should assemble mvr instruction with extra operands without throwing error', () => {
    const aFilePath = 'mvrExtraOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/mvrExtraOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('166. should assemble sext instruction with valid operands', () => {
    const aFilePath = 'sextValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/sextValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('167. should throw error for sext instruction with invalid operand type', () => {
    const aFilePath = 'sextInvalidOperand.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/sextInvalidOperand.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('168. should throw error for sext instruction missing operands', () => {
    const aFilePath = 'sextMissingOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/sextMissingOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('169. should assemble sext instruction with extra operands without throwing error', () => {
    const aFilePath = 'sextExtraOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/sextExtraOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('170. should assemble halt instruction with extra operands without throwing error', () => {
    const aFilePath = 'haltExtraOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/haltExtraOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('171. should throw error for dout trap instruction with invalid register', () => {
    const aFilePath = 'doutInvalidRegister.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/doutInvalidRegister.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('172. should assemble dout trap instruction with missing operand (defaults to r0)', () => {
    const aFilePath = 'doutMissingOperand.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/doutMissingOperand.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('173. should throw error for dout trap instruction with label instead of register', () => {
    const aFilePath = 'doutLabelInsteadRegister.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/doutLabelInsteadRegister.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('176. should assemble jmp instruction with offset', () => {
    const aFilePath = 'jmpLabelOffsetNoSpace.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/jmpLabelOffsetNoSpace.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('177. should assemble jmp instruction with no offset', () => {
    const aFilePath = 'jmpLabelOffsetWithSpace.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/jmpLabelOffsetWithSpace.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('178. should throw error for jmp instruction with label', () => {
    const aFilePath = 'jmpInvalidOffset.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/jmpInvalidOffset.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('179. should throw error for jmp instruction with offset out of bounds', () => {
    const aFilePath = 'jmpOffsetOutOfBounds.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/jmpOffsetOutOfBounds.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('180. should assemble br instruction with valid label', () => {
    const aFilePath = 'brValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/brValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('183. should assemble ret instruction with extra operands without throwing error', () => {
    const aFilePath = 'retExtraOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/retExtraOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('184. should throw error for ret instruction with invalid operand type', () => {
    const aFilePath = 'retInvalidOperand.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/retInvalidOperand.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('186. should assemble xor instruction with valid registers', () => {
    const aFilePath = 'xorValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/xorValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('187. should throw error for xor instruction with non-register immediate value', () => {
    const aFilePath = 'xorImmediateOutOfBounds.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/xorImmediateOutOfBounds.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('188. should throw error for xor instruction with invalid operand types', () => {
    const aFilePath = 'xorInvalidOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/xorInvalidOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('189. should assemble xor instruction with extra operands without throwing error', () => {
    const aFilePath = 'xorExtraOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/xorExtraOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('191. should assemble not instruction with valid operands', () => {
    const aFilePath = 'notValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/notValid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('192. should throw error for not instruction with invalid operand type', () => {
    const aFilePath = 'notInvalidOperand.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/notInvalidOperand.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('193. should throw error for not instruction missing operand', () => {
    const aFilePath = 'notMissingOperand.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/notMissingOperand.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('194. should assemble not instruction with extra operands without throwing error', () => {
    const aFilePath = 'notExtraOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/notExtraOperands.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('196. should assemble add instruction with maximum positive immediate', () => {
    const aFilePath = 'addMaxPositiveImmediate.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/addMaxPositiveImmediate.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('197. should assemble add instruction with maximum negative immediate', () => {
    const aFilePath = 'addMaxNegativeImmediate.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/addMaxNegativeImmediate.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('198. should throw error for add instruction with immediate below negative bound', () => {
    const aFilePath = 'addImmediateBelowBound.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/addImmediateBelowBound-2.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('199. should throw error for add instruction with immediate above positive bound', () => {
    const aFilePath = 'addImmediateAboveBound.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/addImmediateAboveBound.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('200. should throw error for add instruction with invalid hexadecimal immediate', () => {
    const aFilePath = 'addInvalidHexImmediate.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/addInvalidHexImmediate.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('201. should throw error for blr instruction with non-numeric 2nd argument', () => {
    const aFilePath = 'blrNonNumericSecondArg.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/blrNonNumericSecondArg.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('202. should throw error for blr instruction with non-register 1st argument', () => {
    const aFilePath = 'blrNonRegisterFirstArg.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/blrNonRegisterFirstArg.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('204. should throw no error for ldr instruction implicit operand', () => {
    const aFilePath = 'ldrImplicitOperand.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/ldrImplicitOperand.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('205. should throw error for ldr instruction with label and offset', () => {
    const aFilePath = 'ldrLabelOffset.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/ldrLabelOffset.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('206. should throw error for sext instruction missing operands', () => {
    const aFilePath = 'sextMissingOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/sextMissingOperands-2.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('207. should throw error for mvr instruction missing operands', () => {
    const aFilePath = 'mvrMissingOperands.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/mvrMissingOperands-2.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('210. should throw error for offset with missing number', () => {
    const aFilePath = 'offsetMissingNumber.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/offsetMissingNumber.a'), 'utf8');

    virtualFs[aFilePath] = source;
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('211. should throw error for lea with no arguments', () => {
    const aFilePath = 'leaNoArgs.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-edge/leaNoArgs.a'), 'utf8');

    virtualFs[aFilePath] = source;
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  // ── ret offset spacing (OB-024) ────────────────────────────────────────────
  // Tokenizer splits on whitespace; '+'/'-' are not delimiters.
  // Valid: 'ret N', 'ret +N', 'ret -N'. Invalid: 'ret+N', 'ret+ N', 'ret + N'.

  test('213. ret with space-separated offset → no error', () => {
    virtualFs['ret-space.a'] = '  ret 3\n  halt';
    assembler.main(['ret-space.a']);
  });

  test('214. ret with +N offset → no error', () => {
    virtualFs['ret-plus.a'] = '  ret +3\n  halt';
    assembler.main(['ret-plus.a']);
  });

  test('215. ret with -N offset → no error', () => {
    virtualFs['ret-minus.a'] = '  ret -3\n  halt';
    assembler.main(['ret-minus.a']);
  });

  test('216. ret+N (no space) → Invalid operation (mnemonic is ret+3)', () => {
    virtualFs['ret-nospace.a'] = '  ret+3\n  halt';
    expect(() => assembler.main(['ret-nospace.a'])).toThrow();
  });

  test('217. ret + N (spaces around +) → Bad number (+ becomes operand)', () => {
    virtualFs['ret-spaced-plus.a'] = '  ret + 3\n  halt';
    expect(() => assembler.main(['ret-spaced-plus.a'])).toThrow();
  });

  test('212. should throw pcoffset11 out of range for call target > 1023 words ahead', () => {
    // call is at locCtr=0; target label is at address 1025
    // pcoffset11 = 1025 - 0 - 1 = 1024 > 1023 → out of range
    const filler = '  .word 0\n'.repeat(1024);
    const source = `  call foo\n${filler}foo halt`;

    virtualFs['pcoffset11.a'] = source;
    expect(() => {
      assembler.main(['pcoffset11.a']);
    }).toThrow();
  });

  // ── malformed sign forms (#555) ───────────────────────────────────────────
  // JS parseInt accepts a single leading +/- but rejects compound signs.
  // +-5, --5, ++5 → parseInt returns NaN → "Bad number" error.
  // +5 (unary plus) → parseInt("+5", 10) = 5 → valid.

  test('218. add with +-5 immediate → Bad number (compound sign)', () => {
    virtualFs['add-compound-sign.a'] = '  add r0, r1, +-5\n  halt';
    expect(() => assembler.main(['add-compound-sign.a'])).toThrow();
  });

  test('219. add with --5 immediate → Bad number (double minus)', () => {
    virtualFs['add-double-minus.a'] = '  add r0, r1, --5\n  halt';
    expect(() => assembler.main(['add-double-minus.a'])).toThrow();
  });

  test('220. add with ++5 immediate → Bad number (double plus)', () => {
    virtualFs['add-double-plus.a'] = '  add r0, r1, ++5\n  halt';
    expect(() => assembler.main(['add-double-plus.a'])).toThrow();
  });

  test('221. add with +5 immediate → no error (unary plus accepted by parseInt)', () => {
    virtualFs['add-unary-plus.a'] = '  add r0, r1, +5\n  halt';
    assembler.main(['add-unary-plus.a']);
    expect(assembler.errorFlag).toBe(false);
  });

  // ── trailing comma / empty operands (#555) ────────────────────────────────
  // The tokenizer treats commas as whitespace-equivalent delimiters; it never
  // pushes an empty token.  A trailing comma or double comma silently drops the
  // missing slot, so the instruction sees fewer operands than expected and errors.

  test('222. add with trailing comma → Missing operand (3rd slot is undefined)', () => {
    virtualFs['add-trailing-comma.a'] = '  add r0, r1,\n  halt';
    expect(() => assembler.main(['add-trailing-comma.a'])).toThrow();
  });

  test('223. add with double comma → Missing operand (middle slot collapses)', () => {
    virtualFs['add-double-comma.a'] = '  add r0, , r1\n  halt';
    expect(() => assembler.main(['add-double-comma.a'])).toThrow();
  });

  // ── malformed offset syntax variants (#555) ───────────────────────────────
  // offset6 goes through evaluateImmediate → parseNumber → parseInt.
  // Compound signs are rejected the same way as in imm5 above.

  test('224. ldr with +-3 offset → Bad number (compound sign in offset6)', () => {
    virtualFs['ldr-compound-sign.a'] = '  ldr r0, r1, +-3\n  halt';
    expect(() => assembler.main(['ldr-compound-sign.a'])).toThrow();
  });

  test('225. str with --2 offset → Bad number (double minus in offset6)', () => {
    virtualFs['str-double-minus.a'] = '  str r0, r1, --2\n  halt';
    expect(() => assembler.main(['str-double-minus.a'])).toThrow();
  });
});
