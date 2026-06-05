'use strict';

// Unit tests for isValidLabelDefinition(str) — src/utils/labelUtils.js
// Written TDD-style (red first): covers the 8 edge cases from #850.

const { isValidLabelDefinition } = require('../../src/utils/labelUtils');

describe('isValidLabelDefinition', () => {
  // Case 6 — baseline: standard col-0 label with colon
  test('standard col-0 label with colon is a valid label def', () => {
    expect(isValidLabelDefinition('cheese: mov r0, 5')).toBe(true);
  });

  // Case 1 — col-0 label without colon
  test('col-0 label without colon is a valid label def', () => {
    expect(isValidLabelDefinition('cheese mov r0, 5')).toBe(true);
  });

  // Case 2 — indented label without colon (invalid)
  test('indented label without colon is NOT a valid label def', () => {
    expect(isValidLabelDefinition('       cheese mov r0, 5')).toBe(false);
  });

  // Case 7 — indented label with colon (valid)
  test('indented label with colon is a valid label def', () => {
    expect(isValidLabelDefinition('  cheese: halt')).toBe(true);
  });

  // Case 3 — special-prefix labels
  test('@-prefixed label is a valid label def', () => {
    expect(isValidLabelDefinition('@cheese: halt')).toBe(true);
  });

  test('$-prefixed label is a valid label def', () => {
    expect(isValidLabelDefinition('$cheese: halt')).toBe(true);
  });

  test('_-prefixed label is a valid label def', () => {
    expect(isValidLabelDefinition('_cheese: halt')).toBe(true);
  });

  // Case 4 — number-starting label (invalid)
  test('number-starting label is NOT a valid label def', () => {
    expect(isValidLabelDefinition('5cheese: mov r0, 5')).toBe(false);
  });

  // Case 8 — period-starting label (invalid — treated as directive)
  test('period-starting label is NOT a valid label def', () => {
    expect(isValidLabelDefinition('.cheese: mov r0, 5')).toBe(false);
  });

  // Case 5 — case-variant labels are distinct (not a def-validity question per se,
  // but verify that both cases are individually valid defs)
  test('uppercase label is a valid label def', () => {
    expect(isValidLabelDefinition('APPLE: .word 1')).toBe(true);
  });

  test('lowercase variant of the same name is also a valid label def', () => {
    expect(isValidLabelDefinition('apple: .word 2')).toBe(true);
  });

  // Edge guard: empty/blank lines
  test('empty string is not a valid label def', () => {
    expect(isValidLabelDefinition('')).toBe(false);
  });

  test('blank line is not a valid label def', () => {
    expect(isValidLabelDefinition('   ')).toBe(false);
  });

  // Directives at col-0 are NOT valid label defs (period fails label-name check)
  test('directive at col-0 is not a valid label def', () => {
    expect(isValidLabelDefinition('.word 42')).toBe(false);
  });
});
