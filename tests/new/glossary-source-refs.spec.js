'use strict';
/*
 * Enforces ADR 0001: every symbol-anchored `Source:` ref in the core-module glossaries must
 * still resolve to its source. This is the automated guard #1362 added so a rename/removal
 * can't silently re-introduce the staleness ADR 0001 set out to kill (now in symbol form).
 *
 * Engine + pure helpers live in scripts/check-glossary-symbols.js (also runnable as
 * `npm run glossary:check`).
 */
const {
  checkGlossarySymbols,
  parseSourceLine,
  tokensNotFound,
} = require('../../scripts/check-glossary-symbols');

describe('glossary Source: symbol references (ADR 0001 rot-guard)', () => {
  test('every cited symbol & grep-landmark resolves in its source file(s)', () => {
    const { unresolved, stats } = checkGlossarySymbols();
    // sanity: the check is actually exercising the glossaries, not a no-op
    expect(stats.lines).toBeGreaterThan(100);
    expect(stats.symbolsChecked).toBeGreaterThan(100);
    // the real assertion: nothing stale. Readable failure lists offending refs.
    expect(unresolved).toEqual([]);
  });

  describe('parseSourceLine classifies the Source-line grammar', () => {
    test('plain method', () => {
      expect(parseSourceLine('`assembler.js` — `getRegister()`'))
        .toEqual({ files: ['assembler.js'], symbols: ['getRegister'], greps: [] });
    });

    test('method group + trailing grep landmark', () => {
      const p = parseSourceLine('`assembler.js` — `assembleBR()`, `assembleLD()`; grep `address - this.locCtr - 1`');
      expect(p.files).toEqual(['assembler.js']);
      expect(p.symbols).toEqual(['assembleBR', 'assembleLD']);
      expect(p.greps).toEqual(['address - this.locCtr - 1']);
    });

    test('comma-separated grep landmarks are all captured', () => {
      const p = parseSourceLine('`linker.js` — `parseObjectModuleBuffer()`; grep `not a linkable file`, `Unknown header entry`');
      expect(p.greps).toEqual(['not a linkable file', 'Unknown header entry']);
    });

    test('a `.js` token NOT followed by em-dash is a landmark, never a cited file', () => {
      const p = parseSourceLine('`assembler.js` — `parseHexFile()`; grep `path.extname`, `assemblerPlus.js`');
      expect(p.files).toEqual(['assembler.js']);            // assemblerPlus.js is NOT a file
      expect(p.greps).toContain('assemblerPlus.js');        // it's a grep landmark
    });

    test('wildcard/range tokens are skipped, concrete endpoint kept', () => {
      const p = parseSourceLine('`constants.js` — `TRAP_NL`…`TRAP_*` (trap vectors)');
      expect(p.symbols).toContain('TRAP_NL');               // concrete → checked
      expect(p.symbols).not.toContain('TRAP_*');            // wildcard → skipped
    });

    test('cross-file clauses capture each file', () => {
      const p = parseSourceLine('`assembler.js` — `createAssemblyError()`; `errors.js` — `AssemblerError` (class)');
      expect(p.files).toEqual(['assembler.js', 'errors.js']);
      expect(p.symbols).toEqual(['createAssemblyError', 'AssemblerError']);
    });
  });

  describe('tokensNotFound has teeth (can fail)', () => {
    test('reports a missing symbol and a missing grep literal; passes present ones', () => {
      const parsed = { symbols: ['getRegister', 'totallyGoneSymbol'], greps: ['present here', 'absent xyz'] };
      const contents = ['function getRegister(){} /* present here */'];
      expect(tokensNotFound(parsed, contents)).toEqual([
        { kind: 'symbol', token: 'totallyGoneSymbol' },
        { kind: 'grep', token: 'absent xyz' },
      ]);
    });

    test('a present symbol in ANY cited file resolves (ambiguous basenames)', () => {
      const parsed = { symbols: ['OPCODE_EXT'], greps: [] };
      // simulates constants.js → [core, plus]; symbol lives in only one
      expect(tokensNotFound(parsed, ['no match here', 'const OPCODE_EXT = 0xA000;'])).toEqual([]);
    });
  });
});
