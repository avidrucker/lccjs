const path = require('path');
const { execFileSync } = require('child_process');
const {
  readNullTerminatedString,
  parseObjectPicture,
  formatPicture,
} = require('../../src/utils/picture');
const { InvalidExecutableFormatError } = require('../../src/utils/errors');

// First coverage for src/utils/picture.js (was 0% — #172). The parse/format
// logic was previously buried in the CLI driver at module level; the #172
// refactor extracted it into the pure functions exercised below. The CLI smoke
// covers the read -> parse -> format -> print wrapper end-to-end on a known .e.

describe('readNullTerminatedString', () => {
  test('reads up to the NUL and advances past it', () => {
    // "foo\0" then a stray byte
    const buf = Buffer.from([0x66, 0x6f, 0x6f, 0x00, 0x99]);
    expect(readNullTerminatedString(buf, 0)).toEqual({ str: 'foo', offset: 4 });
  });

  test('reads from a mid-buffer offset', () => {
    const buf = Buffer.from([0x99, 0x61, 0x62, 0x00]); // skip 1, then "ab\0"
    expect(readNullTerminatedString(buf, 1)).toEqual({ str: 'ab', offset: 4 });
  });

  test('stops at end of buffer when no NUL is present', () => {
    const buf = Buffer.from([0x61, 0x62]); // "ab", unterminated
    expect(readNullTerminatedString(buf, 0)).toEqual({ str: 'ab', offset: 2 });
  });

  test('yields an empty string when the NUL is immediate', () => {
    const buf = Buffer.from([0x00, 0x41]);
    expect(readNullTerminatedString(buf, 0)).toEqual({ str: '', offset: 1 });
  });
});

describe('parseObjectPicture', () => {
  // Hand-built fake .o: 'o' magic, an S (address-only), a G (address+label),
  // an A (address-only), the 'C' terminator, then two code words (little-endian).
  function buildObjectBuffer() {
    return Buffer.from([
      0x6f,                         // 'o'
      0x53, 0x34, 0x12,             // 'S' addr 0x1234
      0x47, 0x08, 0x00,             // 'G' addr 0x0008 ...
      0x6d, 0x61, 0x69, 0x6e, 0x00, //   ... label "main\0"
      0x41, 0xff, 0x00,             // 'A' addr 0x00ff
      0x43,                         // 'C' terminator
      0x34, 0x12,                   // code word 0x1234
      0xcd, 0xab,                   // code word 0xabcd
    ]);
  }

  test('parses header entries and code words from a hand-built .o buffer', () => {
    const { header, codeWords } = parseObjectPicture(buildObjectBuffer());
    expect(header).toEqual([
      { type: 'o' },
      { type: 'S', address: 0x1234 },
      { type: 'G', address: 0x0008, label: 'main' },
      { type: 'A', address: 0x00ff },
      { type: 'C' },
    ]);
    expect(codeWords).toEqual([0x1234, 0xabcd]);
  });

  test('drops a trailing odd byte from the code section (whole words only)', () => {
    // 'o','C' then 3 bytes: one full word (0x0201) + a dangling byte.
    const buf = Buffer.from([0x6f, 0x43, 0x01, 0x02, 0x03]);
    expect(parseObjectPicture(buf).codeWords).toEqual([0x0201]);
  });

  test('throws on an empty buffer', () => {
    expect(() => parseObjectPicture(Buffer.from([]))).toThrow(InvalidExecutableFormatError);
  });

  test("throws when the file does not start with 'o'", () => {
    expect(() => parseObjectPicture(Buffer.from([0x78, 0x43])))
      .toThrow(/does not start with 'o'/);
  });

  test('throws on an unknown header entry type', () => {
    const buf = Buffer.from([0x6f, 0x5a]); // 'o' then 'Z'
    expect(() => parseObjectPicture(buf)).toThrow(/Unknown header entry type: Z/);
  });

  test('throws when an address-bearing entry is truncated', () => {
    const buf = Buffer.from([0x6f, 0x53, 0x34]); // 'o','S', only one address byte
    expect(() => parseObjectPicture(buf)).toThrow(InvalidExecutableFormatError);
  });
});

describe('formatPicture', () => {
  test('renders header entries and wraps code words 8 per line', () => {
    const parsed = {
      header: [
        { type: 'o' },
        { type: 'S', address: 0x1234 },
        { type: 'G', address: 0x0008, label: 'main' },
        { type: 'C' },
      ],
      // 9 words -> a full first line of 8, then a 1-word partial line
      codeWords: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    };
    const lines = formatPicture(parsed).split('\n');
    expect(lines[0]).toBe('Header:');
    expect(lines[1]).toBe('   o');
    expect(lines[2]).toBe('   S 1234');
    expect(lines[3]).toBe('   G 0008 main');
    expect(lines[4]).toBe('   C');
    expect(lines[5]).toBe('Code:');
    // a full line of 8 words carries no trailing space
    expect(lines[6]).toBe('   0001 0002 0003 0004 0005 0006 0007 0008');
    // the partial last line preserves the legacy trailing space
    expect(lines[7]).toBe('   0009 ');
    expect(lines).toHaveLength(8);
  });

  test('round-trips parse -> format on a hand-built buffer', () => {
    const buf = Buffer.from([
      0x6f, 0x47, 0x08, 0x00, 0x6d, 0x61, 0x69, 0x6e, 0x00, 0x43, 0x34, 0x12,
    ]);
    expect(formatPicture(parseObjectPicture(buf))).toBe(
      ['Header:', '   o', '   G 0008 main', '   C', 'Code:', '   1234 '].join('\n'),
    );
  });
});

describe('picture.js — CLI smoke', () => {
  const script = path.join(__dirname, '..', '..', 'src', 'utils', 'picture.js');
  const golden = path.join(__dirname, '..', '..', 'tests', 'goldens', 'interpreter', 'demoB.e');

  test('prints a header + code picture for a known-good .e without crashing', () => {
    // execFileSync throws on non-zero exit, so reaching the asserts proves exit 0.
    const out = execFileSync('node', [script, golden], { encoding: 'utf8' });
    expect(out).toContain('Header:');
    expect(out).toContain('Code:');
  });
});
