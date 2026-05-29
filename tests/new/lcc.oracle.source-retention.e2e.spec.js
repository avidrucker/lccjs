// tests/new/lcc.oracle.source-retention.e2e.spec.js
//
// #155 — Lock in `.a`-path LST source-text parity.
//
// lccjs's `.a` listing (via lcc.js / generateStats) renders the FULL source
// text — mnemonics + operands + same-line comments + standalone comments.
// The general lcc.oracle.e2e suite compares LSTs with `stripComments: true`,
// so it deliberately removes comments before comparing and therefore does NOT
// guard their retention. This spec is the comments-INCLUDED complement:
//
//   1. self-contained: every source line of the `.a` (comments included)
//      appears in the lccjs `.lst` — fails loudly if the source column or
//      comments are ever dropped by a generateStats refactor;
//   2. oracle parity (comments included): the lccjs `.lst` matches the cached
//      oracle golden with `stripComments: false`.
//
// Whitespace-lenient per the #145 decision: lines are trimmed + whitespace-
// collapsed and truncated to 40 chars, which also tolerates parity deviation
// 11 (oracle truncates long source lines to the listing width; lccjs keeps
// them full — see docs/parity_deviations.md).

const fs = require('fs');
const path = require('path');
const {
  createTempWorkspace,
  runInWorkspaceCwd,
  stageFileInWorkspace,
} = require('../helpers/tempWorkspace');
const { compareLstFiles, lstDiff } = require('../helpers/compareFiles');

const DEMOS_DIR = path.resolve(__dirname, '../../demos');
const GOLDEN_DIR = path.resolve(__dirname, '../goldens/lcc');

// Comment-rich, input-free demos with same-line AND standalone comments.
const DEMOS = ['demoQ', 'demoR', 'demoZ'];

// Same normalization as the general oracle suite, but comments are KEPT.
const compareOptions = {
  skipLeadingLines: 2,   // drop the volatile version/date banner + author line
  stripComments: false,  // <-- the whole point: verify comments survive
  trimLines: true,
  collapseWhitespace: true,
  omitEmptyLines: true,
  caseInsensitive: true,
  truncateTo: 40,        // tolerates deviation 11 (oracle truncation) + gutter width
  skipPatterns: [/input\s+file\s+name/i],
};

function collapse(line) {
  // trim + collapse internal whitespace; comments are intentionally KEPT
  return line.trim().replace(/\s+/g, ' ');
}

function runJSLCC(aFile) {
  const LCC = require('../../src/core/lcc');
  const base = path.basename(aFile, '.a');
  const tmp = createTempWorkspace('lccjs-155-');
  const tmpAFile = stageFileInWorkspace(aFile, tmp, `${base}.a`);
  const lstFile = path.join(tmp, `${base}.lst`);

  const lcc = new LCC();
  runInWorkspaceCwd(tmp, () => {
    lcc.main([path.basename(tmpAFile)]);
  });

  if (!fs.existsSync(lstFile)) {
    throw new Error(`lcc.js did not produce .lst: ${lstFile}`);
  }
  return lstFile;
}

describe('#155 — .a-path LST retains full source text (mnemonics + comments)', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });
  afterAll(() => {
    console.log.mockRestore();
    console.error.mockRestore();
    process.stdout.write.mockRestore();
    process.stderr.write.mockRestore();
  });

  for (const base of DEMOS) {
    const aPath = path.join(DEMOS_DIR, `${base}.a`);

    // (1) Self-contained retention guard — no oracle needed.
    test(`${base}: every .a source line (incl. comments) appears in the .lst`, () => {
      const lstPath = runJSLCC(aPath);
      const lstBlob = fs
        .readFileSync(lstPath, 'utf8')
        .split('\n')
        .map(collapse)
        .join('\n');

      const srcLines = fs
        .readFileSync(aPath, 'utf8')
        .split('\n')
        .map(collapse)
        .filter(l => l.length > 0);

      // sanity: the demo must actually contain comments, else the test is vacuous
      const commentLines = srcLines.filter(l => l.includes(';'));
      expect(commentLines.length).toBeGreaterThan(0);

      const missing = srcLines.filter(l => !lstBlob.includes(l));
      if (missing.length) {
        throw new Error(
          `${base}: ${missing.length} source line(s) absent from the .lst ` +
          `(source text not retained):\n  ${missing.join('\n  ')}`
        );
      }
    });

    // (2) Oracle parity WITH comments included (uses the cached golden).
    const goldenLst = path.join(GOLDEN_DIR, `${base}.lst`);
    const haveGolden = fs.existsSync(goldenLst);
    const maybe = haveGolden ? test : test.skip;
    maybe(`${base}: .lst matches oracle golden with comments included`, () => {
      const lstPath = runJSLCC(aPath);
      const match = compareLstFiles(lstPath, goldenLst, compareOptions);
      if (!match) {
        throw new Error(
          `${base} .lst diverges from oracle golden (comments-included):\n` +
          lstDiff(lstPath, goldenLst, compareOptions)
        );
      }
      expect(match).toBe(true);
    });
  }
});
