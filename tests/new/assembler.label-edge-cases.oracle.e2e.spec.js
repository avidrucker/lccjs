// tests/new/assembler.label-edge-cases.oracle.e2e.spec.js
//
// #850 — Label definition edge-case oracle parity suite.
//
// Eight edge cases from the issue checklist:
//   1. Col-0 label without colon        (valid)
//   2. Indented label without colon     (invalid — "Invalid operation")
//   3a. @-prefixed label                (valid)
//   3b. $-prefixed label                (valid)
//   3c. _-prefixed label                (valid)
//   4.  Number-starting label           (invalid — "Bad label")
//   5.  Case-variant labels in one file (valid — both treated as distinct symbols)
//   6.  Standard col-0 label with colon (valid — baseline)
//   7.  Indented label with colon       (valid)
//   8.  Period-starting label           (invalid — "Bad label")
//
// Oracle golden files live in tests/goldens/label-edge-cases/.
// INVALID cases: LCC.js throws; oracle errors (exit 1) but still writes a partial
// .e — this is the documented deviation §10 in docs/parity_deviations.md.

const fs   = require('fs');
const path = require('path');
const { cfg, assertOracleConfigured } = require('../helpers/env');
const { runOracleOnDemo }              = require('../helpers/runOracle');
const { assembleWithJS }               = require('../helpers/assembleJS');
const { ensureDir, readBytes, writeBytes } = require('../helpers/fileHelpers');

const FIXTURES = path.resolve(__dirname, '../fixtures/assembler-labels');
const GOLDEN_DIR = path.resolve(__dirname, '../goldens/label-edge-cases');

const VALID_CASES = [
  { fixture: 'label-col0-no-colon.a',    label: 'col-0 no-colon (case 1)' },
  { fixture: 'label-at-prefix.a',        label: '@-prefixed label (case 3a)' },
  { fixture: 'label-dollar-prefix.a',    label: '$-prefixed label (case 3b)' },
  { fixture: 'label-underscore-prefix.a',label: '_-prefixed label (case 3c)' },
  { fixture: 'label-indented-colon.a',   label: 'indented label with colon (case 7)' },
  { fixture: 'caseSensitiveLabels.a',    label: 'case-variant labels distinct (case 5)' },
];

const INVALID_CASES = [
  { fixture: 'label-indented-no-colon.a', label: 'indented label without colon (case 2)', error: 'Invalid operation' },
  { fixture: 'label-num-start.a',         label: 'number-starting label (case 4)',         error: 'Bad label' },
  { fixture: 'label-period-prefix.a',     label: 'period-starting label (case 8)',          error: 'Bad label' },
];

describe('#850 — Label definition edge cases: LCC.js assembler acceptance/rejection', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterAll(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  for (const { fixture, label } of VALID_CASES) {
    test(`LCC.js accepts: ${label}`, () => {
      expect(() => assembleWithJS(path.join(FIXTURES, fixture))).not.toThrow();
    });
  }

  for (const { fixture, label } of INVALID_CASES) {
    test(`LCC.js rejects: ${label}`, () => {
      expect(() => assembleWithJS(path.join(FIXTURES, fixture))).toThrow();
    });
  }
});

describe('#850 — Label definition edge cases: oracle parity (golden cache)', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterAll(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  ensureDir(GOLDEN_DIR);

  for (const { fixture, label } of VALID_CASES) {
    const base = path.basename(fixture, '.a');
    const goldenFile = path.join(GOLDEN_DIR, `${base}.e`);
    const srcFile = path.join(FIXTURES, fixture);

    const haveGolden = fs.existsSync(goldenFile);

    if (!haveGolden) {
      if (cfg.goldenAutoUpdate && assertOracleConfigured()) {
        const { bytes } = runOracleOnDemo(srcFile);
        writeBytes(goldenFile, bytes);
      } else {
        test.skip(`${label}: lccjs .e matches oracle golden (skipped: missing golden)`, () => {});
        continue;
      }
    }

    test(`${label}: lccjs .e matches oracle golden`, () => {
      const { bytes: jsBytes } = assembleWithJS(srcFile);
      const golden = readBytes(goldenFile);
      expect(Buffer.from(jsBytes).equals(golden)).toBe(true);
    });
  }

  // INVALID cases: oracle errors (exit 1, deviation §10) — just verify LCC.js throws.
  // No golden comparison because oracle creates a partial .e on error that LCC.js doesn't.
  for (const { fixture, label } of INVALID_CASES) {
    test(`oracle-parity for rejected input: ${label}`, () => {
      expect(() => assembleWithJS(path.join(FIXTURES, fixture))).toThrow();
    });
  }
});
