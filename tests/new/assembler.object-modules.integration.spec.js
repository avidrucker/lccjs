/**
 * @file assembler.object-modules.integration.spec.js
 * Integration tests for assembler.js object-module behavior.
 */

const fs = require('fs');
const path = require('path');
const Assembler = require('../../src/core/assembler');
const { setupAssemblerIntegrationHarness } = require('../helpers/assemblerIntegrationHarness');

jest.mock('fs');

describe('Assembler Object Module Integration', () => {
  let assembler;
  let virtualFs;
  const { getAssembler, getVirtualFs } = setupAssemblerIntegrationHarness(Assembler);

  beforeEach(() => {
    assembler = getAssembler();
    virtualFs = getVirtualFs();
  });

  // -------------------------------------------------------------------------
  // 10. Test global and .o object-file generation
  // -------------------------------------------------------------------------
  test('10. should produce .o file when .global is used', () => {
    const aFilePath = 'testObject.a';
    const source = `
      .global foo
      mov r0, 123
      halt
foo:  .word 456
    `;
    virtualFs[aFilePath] = source;
    virtualFs['name.nnn'] = 'Cheese\n';

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.isObjectModule).toBe(true);
    expect(path.extname(assembler.outputFileName)).toBe('.o');
  });

  test('10b. should write .o, .lst, and .bst files when .global is used', () => {
    const aFilePath = 'testObjectArtifacts.a';
    const source = `
      .global foo
      mov r0, 123
      halt
foo:  .word 456
    `;
    virtualFs[aFilePath] = source;
    virtualFs['name.nnn'] = 'Cheese\n';

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(virtualFs['testObjectArtifacts.o']).toBeDefined();
    expect(virtualFs['testObjectArtifacts.lst']).toBeDefined();
    expect(virtualFs['testObjectArtifacts.bst']).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 17. Test extern and .o object-file generation
  // -------------------------------------------------------------------------
  test('17. should produce .o file when .extern is used', () => {
    const aFilePath = 'testObject2.a';
    const source = `
      .extern bar
      ld r0, bar
      halt
    `;
    virtualFs[aFilePath] = source;
    virtualFs['name.nnn'] = 'Cheese\n';

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.isObjectModule).toBe(true);
    expect(path.extname(assembler.outputFileName)).toBe('.o');
  });

  // -------------------------------------------------------------------------
  // 111. Test global directive (.global) with valid variable
  // -------------------------------------------------------------------------
  test('111. should assemble .global directive with valid variable', () => {
    const aFilePath = 'globalValid.a';
    const source = `
      .global var1
      halt
var1: .word 10
    `;
    virtualFs[aFilePath] = source;
    virtualFs['name.nnn'] = 'Cheese\n';

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.globalLabels.has('var1')).toBe(true);
    expect(assembler.isObjectModule).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 112. Test global directive (.global) with invalid variable name
  // -------------------------------------------------------------------------
  test('112. should throw error for .global directive with invalid variable name', () => {
    const aFilePath = 'globalInvalid.a';
    const source = `
      .global 1var
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad operand--not a valid label');
  });

  // -------------------------------------------------------------------------
  // 113. Test global directive (.global) with missing operand
  // -------------------------------------------------------------------------
  test('113. should throw error for .global directive missing operand', () => {
    const aFilePath = 'globalMissingOperand.a';
    const source = `
      .global
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  // -------------------------------------------------------------------------
  // 114. Test extern directive (.extern) with valid variable
  // -------------------------------------------------------------------------
  test('114. should assemble .extern directive with valid variable', () => {
    const aFilePath = 'externValid.a';
    const source = `
      .extern externalVar
      ld r0, externalVar
      halt
    `;
    virtualFs[aFilePath] = source;
    virtualFs['name.nnn'] = 'Cheese\n';

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.externLabels.has('externalVar')).toBe(true);
    expect(assembler.isObjectModule).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 115. Test extern directive (.extern) with invalid variable name
  // -------------------------------------------------------------------------
  test('115. should throw error for .extern directive with invalid variable name', () => {
    const aFilePath = 'externInvalid.a';
    const source = `
      .extern $var!
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad operand--not a valid label');
  });

  // -------------------------------------------------------------------------
  // 116. Test extern directive (.extern) with missing operand
  // -------------------------------------------------------------------------
  test('116. should throw error for .extern directive missing operand', () => {
    const aFilePath = 'externMissingOperand.a';
    const source = `
      .extern
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  // -------------------------------------------------------------------------
  // 175. Test assembly with multiple .extern declarations for the same label
  // -------------------------------------------------------------------------
  test('175. should throw not error for multiple .extern declarations of the same label', () => {
    const aFilePath = 'multipleExterns.a';
    const source = `
      .extern bar
      .extern bar
      ld r0, bar
      halt
    `;
    virtualFs[aFilePath] = source;
    virtualFs['name.nnn'] = 'Cheese\n';

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });
});
