/**
 * @file assembler.labels.integration.spec.js
 * Integration tests for assembler.js label handling and label-based offsets.
 */

const fs = require('fs');
const Assembler = require('../../src/core/assembler');
const { setupAssemblerIntegrationHarness } = require('../helpers/assemblerIntegrationHarness');

jest.mock('fs');

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
    const source = `
      ld r0, missingLabel
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Undefined label');
  });

  test('9a. should throw if .start label is undefined', () => {
    const aFilePath = 'badStart.a';
    const source = `
      .start main
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Undefined label');
  });

  test('9b. should resolve .start label if defined', () => {
    const aFilePath = 'goodStart.a';
    const source = `
      .start main
    main:
      halt
    `;
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
    const source = `
      mydata: .word 100
      ld r0, mydata + 2
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
    expect(assembler.errorFlag).toBe(false);
  });

  test('18. should throw an error when using an invalid label name', () => {
    const aFilePath = 'invalidLabel.a';
    const source = `
      mov r0, 5
      halt
    5invalidLabel: .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad label');
  });

  test('19. should throw an error when using a duplicate label name', () => {
    const aFilePath = 'duplicateLabel.a';
    const source = `
      mov r0, 5
      halt
    myLabel: .word 10
    myLabel: .word 20
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Duplicate label');
  });

  test('38. should throw error for brz instruction with undefined label', () => {
    const aFilePath = 'brzUndefined.a';
    const source = `
      brz missingLabel
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Undefined label');
  });

  test('40. should assemble brz instruction with label offset without spaces', () => {
    const aFilePath = 'brzOffsetNoSpaces.a';
    const source = `
      brz loop+1
      halt
    loop:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('41. should assemble brz instruction with label offset with spaces', () => {
    const aFilePath = 'brzOffsetSpaces.a';
    const source = `
      brz loop + 1
      halt
    loop:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('43. should throw error for brz instruction with label offset out of bounds', () => {
    const aFilePath = 'brzOffsetOutOfBounds.a';
    const source = `
      brz loop + 300
      halt
    loop:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('pcoffset9 out of range');
  });

  test('48. should assemble ld instruction with label offset without spaces', () => {
    const aFilePath = 'ldOffsetNoSpaces.a';
    const source = `
data: .word 10
      ld r0, data+1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('49. should assemble ld instruction with label offset with spaces', () => {
    const aFilePath = 'ldOffsetSpaces.a';
    const source = `
data: .word 10
      ld r0, data + 1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('55. should assemble st instruction with label offset without spaces', () => {
    const aFilePath = 'stOffsetNoSpaces.a';
    const source = `
data: .word 10
      st r0, data+1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('56. should assemble st instruction with label offset with spaces', () => {
    const aFilePath = 'stOffsetSpaces.a';
    const source = `
data: .word 10
      st r0, data + 1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('58. should throw error for st instruction with label offset out of bounds', () => {
    const aFilePath = 'stOffsetOutOfBounds.a';
    const source = `
data: .word 10
      st r0, data + 300
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('pcoffset9 out of range');
  });

  test('102. should throw error for .word directive with undefined label', () => {
    const aFilePath = 'wordUndefinedLabel.a';
    const source = `
      halt
data: .word missingLabel
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Undefined label');
  });

  test('103. should throw error for .word directive with label offset out of bounds', () => {
    const aFilePath = 'wordOffsetUndefinedBounds.a';
    const source = `
      halt
data1: .word data2 + 65536
data2: .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  test('108. should assemble .start directive with valid label', () => {
    const aFilePath = 'startValid.a';
    const source = `
      .start main
    main:
      halt
    `;
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
    const source = `
      .start main
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Undefined label');
  });

  test('110. should throw error for .start directive missing operand', () => {
    const aFilePath = 'startMissingOperand.a';
    const source = `
      .start
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  test('139. should not throw an error for .word directive with label offset in bounds', () => {
    const aFilePath = 'wordOffsetOutOfBounds.a';
    const source = `
    halt
data1: .word data2 + 65535
data2: .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  test('152. should throw error for bl instruction with undefined label', () => {
    const aFilePath = 'blUndefinedLabel.a';
    const source = `
      bl missingLabel
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Undefined label');
  });

  test('181. should throw error for br instruction with undefined label', () => {
    const aFilePath = 'brUndefinedLabel.a';
    const source = `
      br missingLoop
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Undefined label');
  });

  test('182. should throw error for br instruction with label offset out of bounds', () => {
    const aFilePath = 'brOffsetOutOfBounds.a';
    const source = `
      br loop + 1500
      halt
    loop:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('pcoffset9 out of range');
  });

  test('185. should throw error for lea instruction with label offset out of bounds', () => {
    const aFilePath = 'leaOffsetOutOfBounds.a';
    const source = `
      lea r3, buffer + 300
      halt
buffer: .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('pcoffset9 out of range');
  });

  test('208. should throw no error for different case, same spelling of labels', () => {
    const aFilePath = 'caseSensitiveLabels.a';
    const source = `
Foo:  .word 1
foo:  .word 2
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });
});
