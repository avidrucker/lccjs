const path = require('path');
const { execFileSync } = require('child_process');
const { isPrintableASCII, formatHexLine } = require('../../src/utils/hexDisplay');

// First coverage for src/utils/hexDisplay.js (was 0% — #172). isPrintableASCII
// and formatHexLine were buried in the CLI loop at module level; the #172
// refactor extracted them. The CLI smoke covers the read -> format -> print
// wrapper end-to-end on a known .e.

describe('isPrintableASCII — printable-range boundaries', () => {
  test('31 (just below space) is not printable', () => {
    expect(isPrintableASCII(31)).toBe(false);
  });
  test('32 (space) is the low printable boundary', () => {
    expect(isPrintableASCII(32)).toBe(true);
  });
  test('126 (~) is the high printable boundary', () => {
    expect(isPrintableASCII(126)).toBe(true);
  });
  test('127 (DEL) is not printable', () => {
    expect(isPrintableASCII(127)).toBe(false);
  });
});

describe('formatHexLine', () => {
  // The hex column is padded to a fixed 39 chars so the ASCII gutter aligns
  // across full and short lines; padEnd(39) mirrors that contract in the asserts.
  test('formats a full 16-byte line (no padding needed) with the ASCII gutter', () => {
    const bytes = [
      0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48,
      0x49, 0x4a, 0x4b, 0x4c, 0x4d, 0x4e, 0x4f, 0x50,
    ]; // "ABCDEFGHIJKLMNOP"
    expect(formatHexLine(bytes)).toBe(
      '4142 4344 4546 4748 494A 4B4C 4D4E 4F50'.padEnd(39) + '    ' + 'ABCDEFGHIJKLMNOP',
    );
  });

  test('pads a short (3-byte) line so the gutter stays aligned', () => {
    // 3 bytes -> one full pair + one lone byte
    expect(formatHexLine([0x48, 0x69, 0x21])).toBe(
      '4869 21'.padEnd(39) + '    ' + 'Hi!',
    );
  });

  test('handles an odd-length line with non-printable bytes shown as dots', () => {
    // NUL, DEL, 'A' -> ".", ".", "A"
    expect(formatHexLine([0x00, 0x7f, 0x41])).toBe(
      '007F 41'.padEnd(39) + '    ' + '..A',
    );
  });

  test('formats a single (odd) byte as a lone hex pair', () => {
    expect(formatHexLine([0xff])).toBe('FF'.padEnd(39) + '    ' + '.');
  });

  test('accepts a Buffer slice as well as an array', () => {
    expect(formatHexLine(Buffer.from([0x41, 0x42]))).toBe('4142'.padEnd(39) + '    ' + 'AB');
  });
});

describe('hexDisplay.js — CLI smoke', () => {
  const script = path.join(__dirname, '..', '..', 'src', 'utils', 'hexDisplay.js');
  const golden = path.join(__dirname, '..', '..', 'tests', 'goldens', 'interpreter', 'demoB.e');

  test('dumps a known-good .e as hex/ASCII lines without crashing', () => {
    // execFileSync throws on non-zero exit, so reaching the asserts proves exit 0.
    const out = execFileSync('node', [script, golden], { encoding: 'utf8' });
    expect(out.length).toBeGreaterThan(0);
    // every emitted line begins with a 4-hex-digit pair
    const firstLine = out.split('\n').filter(Boolean)[0];
    expect(firstLine).toMatch(/^[0-9A-F]{4}/);
  });
});
