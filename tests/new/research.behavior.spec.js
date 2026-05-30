const Assembler = require('../../src/core/assembler');
const { AssemblerError } = require('../../src/utils/errors');

describe('Research Behavior Tests', () => {
  // DONE: researched, implemented, and documented
  // test.skip('research: original LCC handling of .org / .orig should be documented before active assertions are added', () => { ... });

  // DONE (#244): researched against the oracle and documented in
  // docs/research/line-length-limit.md + docs/parity_deviations.md (OG BUG #13,
  // BY DESIGN #7). Finding: OG LCC has no line-length diagnostic — it silently
  // splits lines past a 298-char buffer and parses the overflow as bogus source.
  // LCC.js's explicit 300-char raw-line cap (incl. comments) is an intentional,
  // safer deviation. The placeholder is now an active regression test pinning
  // that contract.
  describe('original LCC 300-character source-line behavior (#244, resolved)', () => {
    let assembler;
    beforeAll(() => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
    });
    afterAll(() => {
      console.log.mockRestore();
      console.error.mockRestore();
      process.stdout.write.mockRestore();
    });
    beforeEach(() => { assembler = new Assembler(); });

    const lineOfLength = (n) => 'a'.repeat(n); // a comment-free token line of exactly n chars

    test('a 300-char raw line assembles (boundary, inclusive)', () => {
      // At the cap, must NOT be rejected for length. label(294) + ": halt" = 300 raw chars.
      const source = `${lineOfLength(294)}: halt\n`;
      expect(source.split('\n')[0].length).toBe(300);
      expect(() => assembler.assembleSource(source, { inputFileName: 'len.a' })).not.toThrow();
    });

    test('a 301-char raw line is rejected with the explicit length diagnostic', () => {
      const source = `${lineOfLength(295)}: halt\n`; // label(295) + ": halt" = 301 raw chars
      expect(source.split('\n')[0].length).toBe(301);
      expect(() => assembler.assembleSource(source, { inputFileName: 'len.a' }))
        .toThrow(/Line exceeds maximum length of 300 characters/);
    });

    test('the limit counts the RAW line including the comment (a short instruction + long comment > 300 is rejected)', () => {
      // Only ~5 chars of code, but a comment pads the raw line past 300.
      const line = `halt ; ${'x'.repeat(320)}`;
      expect(line.length).toBeGreaterThan(300);
      const source = `${line}\n`;
      expect(() => assembler.assembleSource(source, { inputFileName: 'len.a' }))
        .toThrow(AssemblerError);
    });
  });

  test.skip('research: original LCC label-length limits should be verified separately from line-length limits', () => {
    // Current LCC.js behavior:
    // Labels are validated by character class and placement, not by an explicit
    // standalone length limit.
    //
    // Open question:
    // Does the original LCC enforce an independent label-length cap?
    //
    // Intended source of truth:
    // Original LCC behavior and documentation.
  });
});
