// tests/new/interpreter.e-path-hex-only.oracle.e2e.spec.js
//
// #156 — Lock in `.e`-path LST hex-only parity vs the oracle.
//
// When LCC.js (or the oracle) interprets a `.e` executable, the `.lst` it emits
// has a code-listing region that is HEX ONLY — `Loc` + machine words, with no
// mnemonics, operands, or comments from the original `.a`. (Source text only
// belongs in the `.a`-path listing; that retention is guarded separately by
// #155's `lcc.oracle.source-retention.e2e.spec.js`.)
//
// The general `interpreter.oracle.e2e.spec.js` suite compares the whole `.lst`
// with `stripComments: true`, so it deliberately removes any source text before
// comparing — meaning it would NOT catch a regression that leaked source/comment
// text into the `.e` listing. This spec is that missing guard. Per demo it asserts:
//
//   1. STRUCTURE  — every line of the code region (between the `Loc  Code`
//      header and the first `====` separator) is a pure hex row. A leaked
//      source/mnemonic/comment column fails this loudly.
//   2. NO LEAKAGE — distinctive comment tokens taken from the `.a` are absent
//      from the `.e` `.lst` (the ticket's negative assertion).
//   3. ORACLE PARITY — the code-region hex words match the oracle's `.e` `.lst`,
//      whitespace-lenient (banner/date and column padding normalized away;
//      padding deltas are parity deviation 12, BY DESIGN).
//
// Requires the LCC oracle (`LCC_ORACLE` in `.env`); skips cleanly without it.

const fs = require('fs');
const path = require('path');
const { cfg, assertOracleConfigured } = require('../helpers/env');
const { runOracleInterpreterOnExecutable } = require('../helpers/runOracle');
const { assembleWithJS } = require('../helpers/assembleJS');
const {
  createTempWorkspace,
  runInWorkspaceCwd,
  stageFileInWorkspace,
} = require('../helpers/tempWorkspace');

const DEMOS_DIR = path.resolve(__dirname, '../../demos');

// Comment-rich, input-free demos (same set #155 uses) so the negative token
// probe is non-vacuous.
const DEMOS = ['demoQ', 'demoR', 'demoZ'];

// A hex code row: a 4-hex-digit Loc followed by one or more 4-hex-digit words.
const HEX_ROW = /^[0-9a-f]{4}(\s+[0-9a-f]{4})+\s*$/;

// Vocabulary that legitimately appears in a `.e` `.lst` outside the code region
// (banner, section headers, statistics block) — excluded from the token probe.
const STRUCTURAL = new Set([
  'lcc', 'lccjs', 'assemble', 'link', 'interpret', 'debug', 'ver', 'testuser',
  'header', 'loc', 'code', 'output', 'program', 'statistics', 'input', 'file',
  'name', 'instructions', 'executed', 'size', 'max', 'stack', 'load', 'point',
  'hex', 'dec',
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
  'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
]);

// Extract the code-listing region: lines after the `Loc  Code` header, up to the
// first `====` separator or blank line.
function codeRegion(lstText) {
  const lines = lstText.split('\n');
  const headerIdx = lines.findIndex(l => /^\s*loc\s+code\s*$/i.test(l));
  if (headerIdx === -1) return [];
  const out = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*=/.test(l) || l.trim() === '') break;
    out.push(l.trim().replace(/\s+/g, ' ').toLowerCase());
  }
  return out;
}

// Distinctive comment tokens from the `.a`: alphabetic, length >= 4, not a
// hex word (e.g. "face"/"beef"), not part of the listing's structural vocabulary.
function distinctiveCommentTokens(aText) {
  const tokens = new Set();
  for (const line of aText.split('\n')) {
    const semi = line.indexOf(';');
    if (semi === -1) continue;
    for (const w of line.slice(semi + 1).toLowerCase().match(/[a-z]+/g) || []) {
      if (w.length >= 4 && !/^[a-f]+$/.test(w) && !STRUCTURAL.has(w)) tokens.add(w);
    }
  }
  return [...tokens];
}

function runJSInterpreter(eFile, tag) {
  const Interpreter = require('../../src/core/interpreter');
  const base = path.basename(eFile, '.e');
  const tmp = createTempWorkspace(`lccjs-156-${tag}-`);
  const tmpEFile = stageFileInWorkspace(eFile, tmp, `${base}.e`);
  const lstFile = path.join(tmp, `${base}.lst`);

  const interp = new Interpreter();
  interp.generateStats = true;
  runInWorkspaceCwd(tmp, () => {
    interp.main([path.basename(tmpEFile)]);
  });

  if (!fs.existsSync(lstFile)) {
    throw new Error(`JS interpreter did not produce .lst: ${lstFile}`);
  }
  return fs.readFileSync(lstFile, 'utf8');
}

// Assemble `.a` -> `.e` with LCC.js and return the path to a staged `.e`.
function assembleToE(aPath, tag) {
  const base = path.basename(aPath, '.a');
  const { bytes } = assembleWithJS(aPath);
  const tmp = createTempWorkspace(`lccjs-156-e-${tag}-`);
  const ePath = path.join(tmp, `${base}.e`);
  fs.writeFileSync(ePath, bytes);
  return ePath;
}

const itOracle = assertOracleConfigured() ? test : test.skip;

describe('#156 — .e-path LST is hex-only and matches the oracle', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });
  afterAll(() => {
    console.log.mockRestore();
    console.error.mockRestore();
    console.warn.mockRestore();
    process.stdout.write.mockRestore();
    process.stderr.write.mockRestore();
  });

  for (const base of DEMOS) {
    const aPath = path.join(DEMOS_DIR, `${base}.a`);

    // (1) STRUCTURE — code region is pure hex (no source/mnemonic/comment column).
    test(`${base}: .e-path LST code region is hex-only`, () => {
      const ePath = assembleToE(aPath, base);
      const rows = codeRegion(runJSInterpreter(ePath, base));

      expect(rows.length).toBeGreaterThan(0); // non-vacuous: there must be code rows
      const nonHex = rows.filter(r => !HEX_ROW.test(r));
      if (nonHex.length) {
        throw new Error(
          `${base}: ${nonHex.length} non-hex line(s) in the .e listing code region ` +
          `(source text leaked into the .e LST):\n  ${nonHex.join('\n  ')}`
        );
      }
    });

    // (2) NO LEAKAGE — distinctive .a comment tokens are absent from the code
    // region of the .e LST. (Scoped to the code region, not the whole file: the
    // statistics block legitimately echoes the input filename, e.g. `demoQ1.e`,
    // which is not source-text leakage.)
    test(`${base}: no .a comment text appears in the .e-path LST code region`, () => {
      const aText = fs.readFileSync(aPath, 'utf8');
      const tokens = distinctiveCommentTokens(aText);
      expect(tokens.length).toBeGreaterThan(0); // demo must have distinctive comments

      const ePath = assembleToE(aPath, `${base}-neg`);
      const codeBlob = codeRegion(runJSInterpreter(ePath, `${base}-neg`)).join(' '); // already lowercased

      const leaked = tokens.filter(t => codeBlob.includes(t));
      if (leaked.length) {
        throw new Error(
          `${base}: comment token(s) from the .a leaked into the .e LST code region: ` +
          leaked.join(', ')
        );
      }
    });

    // (3) ORACLE PARITY — code-region hex words match the oracle (whitespace-lenient).
    itOracle(`${base}: .e-path LST code words match the oracle`, () => {
      const ePath = assembleToE(aPath, `${base}-oracle`);
      const jsRows = codeRegion(runJSInterpreter(ePath, `${base}-oracle`));
      const { lstText } = runOracleInterpreterOnExecutable(ePath, []);
      const oracleRows = codeRegion(lstText);

      expect(jsRows.length).toBeGreaterThan(0);
      expect(jsRows).toEqual(oracleRows);
    });
  }
});
