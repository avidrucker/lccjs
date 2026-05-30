const { h4, REG_NAMES, REG_ALIASES } = require('../../src/core/debug/format');

// Characterization tests for the shared debug display-formatting helpers.
// Red-green: written to lock the current contract of src/core/debug/format.js
// (extracted in #163) so the interpreter/ilcc layers can depend on it. See #168.
describe('debug/format unit', () => {
  describe('h4() — 4-digit 16-bit hex', () => {
    test('zero-pads small values to four digits', () => {
      expect(h4(5)).toBe('0005');
    });

    test('formats the full 16-bit range lowercase', () => {
      expect(h4(0xFFFF)).toBe('ffff');
    });

    test('formats zero as 0000', () => {
      expect(h4(0)).toBe('0000');
    });

    test('masks values wider than 16 bits to the low word', () => {
      expect(h4(0x12345)).toBe('2345');
    });

    test('wraps negative values into 16-bit two’s-complement', () => {
      expect(h4(-1)).toBe('ffff');
    });
  });

  describe('REG_NAMES — register display names by index', () => {
    test('has exactly eight entries', () => {
      expect(REG_NAMES).toHaveLength(8);
    });

    test('preserves the canonical r0..r4 / role-name order', () => {
      expect(REG_NAMES).toEqual(['r0', 'r1', 'r2', 'r3', 'r4', 'fp', 'sp', 'lr']);
    });

    test('maps the LCC role registers: 5=fp, 6=sp, 7=lr', () => {
      expect(REG_NAMES[5]).toBe('fp');
      expect(REG_NAMES[6]).toBe('sp');
      expect(REG_NAMES[7]).toBe('lr');
    });
  });

  describe('REG_ALIASES — name -> index', () => {
    test('resolves role-name aliases to their indices', () => {
      expect(REG_ALIASES.sp).toBe(6);
      expect(REG_ALIASES.fp).toBe(5);
      expect(REG_ALIASES.lr).toBe(7);
    });

    test('resolves the rN aliases to the same indices as the role names', () => {
      expect(REG_ALIASES.r6).toBe(6);
      expect(REG_ALIASES.r5).toBe(5);
      expect(REG_ALIASES.r7).toBe(7);
    });

    test('maps the non-role registers r0..r4 to 0..4', () => {
      expect(REG_ALIASES.r0).toBe(0);
      expect(REG_ALIASES.r1).toBe(1);
      expect(REG_ALIASES.r2).toBe(2);
      expect(REG_ALIASES.r3).toBe(3);
      expect(REG_ALIASES.r4).toBe(4);
    });

    test('omits unknown register keys entirely', () => {
      expect(REG_ALIASES).not.toHaveProperty('r8');
      expect(REG_ALIASES.pc).toBeUndefined();
    });
  });
});
