// instruction-cap.unit.spec.js — the instruction-cap flag is consistent across
// both entry points (#1350): `--max-steps N` and `-ms<N>` work on `lcc` and
// `ilcc`; `ilcc`'s legacy Charlie-inherited `-i<N>` stays as an alias.

'use strict';

const LCC = require('../../src/cli/lcc');
const ILCC = require('../../src/interactive/ilcc');

describe('instruction-cap flag consistency (#1350)', () => {
  // Suppress the #1373 flag-diagnostics stderr noise during parsing.
  let errSpy;
  beforeEach(() => {
    errSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    errSpy.mockRestore();
    console.error.mockRestore();
  });

  describe('ilcc', () => {
    test('--max-steps N sets the instruction cap', () => {
      const ilcc = new ILCC();
      ilcc.parseArguments(['--max-steps', '100', 'prog.a']);
      expect(ilcc.options.instructionCap).toBe(100);
    });

    test('-ms<N> short form sets the instruction cap', () => {
      const ilcc = new ILCC();
      ilcc.parseArguments(['-ms250', 'prog.a']);
      expect(ilcc.options.instructionCap).toBe(250);
    });

    test('-i<N> still sets the instruction cap (Charlie-inherited alias)', () => {
      const ilcc = new ILCC();
      ilcc.parseArguments(['-i500', 'prog.a']);
      expect(ilcc.options.instructionCap).toBe(500);
    });
  });

  describe('lcc', () => {
    test('--max-steps N sets the cap (unchanged)', () => {
      const lcc = new LCC();
      lcc.parseArguments(['--max-steps', '100', 'prog.e']);
      expect(lcc.options.maxSteps).toBe(100);
    });

    test('-ms<N> short form sets the cap', () => {
      const lcc = new LCC();
      lcc.parseArguments(['-ms250', 'prog.e']);
      expect(lcc.options.maxSteps).toBe(250);
    });
  });
});
