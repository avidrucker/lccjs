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

  // Resolved by #245 (see docs/research/label-length-limit.md): the original LCC
  // has NO independent label-length cap and NO label-significance/truncation
  // limit. Labels are bounded ONLY by the source-line length limit (#244).
  // LCC.js matches this — isValidLabel checks character class/placement only.
  describe('label-length behavior (#245, resolved): no cap independent of line length', () => {
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

    test('a long label well past any usual cap (256 chars) assembles, bounded only by line length', () => {
      // 256-char label + ": halt" = 262 raw chars, comfortably inside the 300 cap.
      const source = `${'a'.repeat(256)}: halt\n`;
      expect(source.split('\n')[0].length).toBeLessThan(300);
      expect(() => assembler.assembleSource(source, { inputFileName: 'lbl.a' })).not.toThrow();
    });

    test('a label is bounded ONLY by the line-length limit, not a label-specific rule', () => {
      // 295-char label + ": halt" pushes the raw line to 301 — rejected by the
      // LINE-length diagnostic (#244), NOT a label-length one. Proves the only
      // bound on label size is the line cap.
      const source = `${'a'.repeat(295)}: halt\n`;
      expect(source.split('\n')[0].length).toBe(301);
      expect(() => assembler.assembleSource(source, { inputFileName: 'lbl.a' }))
        .toThrow(/Line exceeds maximum length of 300 characters/);
    });

    test('labels differing only past char 200 stay distinct (no significance/truncation limit)', () => {
      // If labels were truncated to K significant chars, these two would collide
      // into a Duplicate. They do not — the full label is retained.
      const l1 = `${'a'.repeat(200)}b`;
      const l2 = `${'a'.repeat(200)}c`;
      const source = `${l1}: .word 1\n${l2}: .word 2\n\thalt\n`;
      expect(() => assembler.assembleSource(source, { inputFileName: 'lbl.a' })).not.toThrow();
    });
  });
});
