/**
 * @file assembler.labels.integration.spec.js
 * Integration tests for assembler.js label handling and label-based offsets.
 */

const fs = require('fs');
const Assembler = require('../../src/core/assembler');
const { setupAssemblerIntegrationHarness } = require('../helpers/assemblerIntegrationHarness');

jest.mock('fs');
const path = require('path');
const realFs = jest.requireActual('fs');

describe('Assembler Label Integration', () => {
  let assembler;
  let virtualFs;
  const { getAssembler, getVirtualFs } = setupAssemblerIntegrationHarness(Assembler);

  beforeEach(() => {
    assembler = getAssembler();
    virtualFs = getVirtualFs();
  });

  test('8. should throw if a referenced label (from an instruction) is never defined or declared .extern', () => {
    const aFilePath = 'undefinedLabel.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/undefinedLabel.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('9a. should throw if .start label is undefined', () => {
    const aFilePath = 'badStart.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/badStart.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('9b. should resolve .start label if defined', () => {
    const aFilePath = 'goodStart.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/goodStart.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
    expect(assembler.startLabel).toBe('main');
    expect(assembler.startAddress).toBeDefined();
    expect(assembler.errorFlag).toBe(false);
  });

  test('13. should properly handle label with offset in instruction operand', () => {
    const aFilePath = 'labelOffset.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/labelOffset.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
    expect(assembler.errorFlag).toBe(false);
  });

  test('18. should throw an error when using an invalid label name', () => {
    const aFilePath = 'invalidLabel.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/invalidLabel.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('19. should throw an error when using a duplicate label name', () => {
    const aFilePath = 'duplicateLabel.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/duplicateLabel.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('38. should throw error for brz instruction with undefined label', () => {
    const aFilePath = 'brzUndefined.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/brzUndefined.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('40. should assemble brz instruction with label offset without spaces', () => {
    const aFilePath = 'brzOffsetNoSpaces.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/brzOffsetNoSpaces.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('41. should assemble brz instruction with label offset with spaces', () => {
    const aFilePath = 'brzOffsetSpaces.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/brzOffsetSpaces.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('43. should throw error for brz instruction with label offset out of bounds', () => {
    const aFilePath = 'brzOffsetOutOfBounds.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/brzOffsetOutOfBounds.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('48. should assemble ld instruction with label offset without spaces', () => {
    const aFilePath = 'ldOffsetNoSpaces.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/ldOffsetNoSpaces.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('49. should assemble ld instruction with label offset with spaces', () => {
    const aFilePath = 'ldOffsetSpaces.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/ldOffsetSpaces.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('55. should assemble st instruction with label offset without spaces', () => {
    const aFilePath = 'stOffsetNoSpaces.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/stOffsetNoSpaces.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('56. should assemble st instruction with label offset with spaces', () => {
    const aFilePath = 'stOffsetSpaces.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/stOffsetSpaces.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('58. should throw error for st instruction with label offset out of bounds', () => {
    const aFilePath = 'stOffsetOutOfBounds.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/stOffsetOutOfBounds.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('102. should throw error for .word directive with undefined label', () => {
    const aFilePath = 'wordUndefinedLabel.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/wordUndefinedLabel.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('103. should throw error for .word directive with label offset out of bounds', () => {
    const aFilePath = 'wordOffsetUndefinedBounds.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/wordOffsetUndefinedBounds.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('108. should assemble .start directive with valid label', () => {
    const aFilePath = 'startValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/goodStart.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.startLabel).toBe('main');
    expect(assembler.startAddress).toBeDefined();
    expect(assembler.errorFlag).toBe(false);
  });

  test('109. should throw error for .start directive with undefined label', () => {
    const aFilePath = 'startUndefinedLabel.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/badStart.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('110. should throw error for .start directive missing operand', () => {
    const aFilePath = 'startMissingOperand.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/startMissingOperand.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('139. should not throw an error for .word directive with label offset in bounds', () => {
    const aFilePath = 'wordOffsetOutOfBounds.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/wordOffsetOutOfBounds.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('152. should throw error for bl instruction with undefined label', () => {
    const aFilePath = 'blUndefinedLabel.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/blUndefinedLabel.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  // #510 — OG BUG §24: oracle accepts numeric tokens as syntactically valid label names
  // and rejects them at lookup time ("Undefined label"). LCC.js rejects upfront ("Bad label").
  test('510. bl with numeric token emits Bad label, not Undefined label', () => {
    const aFilePath = 'blNumericLabel.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/blNumericLabel.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('181. should throw error for br instruction with undefined label', () => {
    const aFilePath = 'brUndefinedLabel.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/brUndefinedLabel.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('182. should throw error for br instruction with label offset out of bounds', () => {
    const aFilePath = 'brOffsetOutOfBounds.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/brOffsetOutOfBounds.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('185. should throw error for lea instruction with label offset out of bounds', () => {
    const aFilePath = 'leaOffsetOutOfBounds.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/leaOffsetOutOfBounds.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  test('208. should throw no error for different case, same spelling of labels', () => {
    const aFilePath = 'caseSensitiveLabels.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-labels/caseSensitiveLabels.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });
});
