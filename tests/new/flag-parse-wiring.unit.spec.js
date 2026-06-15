// flag-parse-wiring.unit.spec.js — assert the -d and -o flag parse wiring in
// both CLI parsers (#1396, last #1343 audit gaps). The downstream effects are
// tested elsewhere; these pin the parse step itself (flag -> option/field).

'use strict';

const LCC = require('../../src/cli/lcc');
const ILCC = require('../../src/interactive/ilcc');

describe('flag parse wiring: -d / -o (#1396)', () => {
  // Keep #1373 flag-diagnostics stderr quiet (these flags are known, so no
  // warning is expected, but stay defensive).
  let errSpy;
  beforeEach(() => {
    errSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    errSpy.mockRestore();
    console.error.mockRestore();
  });

  describe('-d sets options.debug', () => {
    test('lcc', () => {
      const lcc = new LCC();
      lcc.parseArguments(['-d', 'prog.a']);
      expect(lcc.options.debug).toBe(true);
    });

    test('ilcc', () => {
      const ilcc = new ILCC();
      ilcc.parseArguments(['-d', 'prog.a']);
      expect(ilcc.options.debug).toBe(true);
    });
  });

  describe('-o <file> sets outputFileName (and consumes the next arg)', () => {
    test('lcc', () => {
      const lcc = new LCC();
      lcc.parseArguments(['-o', 'out.e', 'prog.a']);
      expect(lcc.outputFileName).toBe('out.e');
      expect(lcc.args).toContain('prog.a'); // the file is not swallowed by -o
      expect(lcc.args).not.toContain('out.e');
    });

    test('ilcc', () => {
      const ilcc = new ILCC();
      ilcc.parseArguments(['-o', 'out.e', 'prog.a']);
      expect(ilcc.outputFileName).toBe('out.e');
      expect(ilcc.args).toContain('prog.a');
      expect(ilcc.args).not.toContain('out.e');
    });
  });
});
