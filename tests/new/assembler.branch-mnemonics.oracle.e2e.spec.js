// tests/new/assembler.branch-mnemonics.oracle.e2e.spec.js
//
// #190 — Audit + lock in OG-LCC parity for ALL branch-condition mnemonics.
//
// The branch set (from assembleBR's codes map in src/core/assembler.js):
//   cc 0: brz / bre      cc 1: brnz / brne   cc 2: brn    cc 3: brp
//   cc 4: brlt           cc 5: brgt          cc 6: brc / brb   cc 7: br / bral
//
// For each mnemonic this spec assembles a minimal program on BOTH lccjs and the
// OG LCC oracle and asserts:
//   (1) lccjs assembles it (no `Invalid operation`);
//   (2) the lccjs `.e` is byte-identical to the oracle's `.e` (encoding parity);
//   (3) alias pairs encode identically (brz==bre, brnz==brne, brc==brb, br==bral).
//
// Motivated by #187: `brb` was in the codes map but missing from the mnemonic
// dispatch, so it errored while its alias `brc` assembled. (2)/(3) for `brb` are
// red until #187's one-line dispatch fix lands.
//
// Migrated from direct-oracle to golden-cache (#692): oracle output was captured
// once and committed; CI runs against the golden without needing the binary.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { cfg, assertOracleConfigured } = require('../helpers/env');
const { runOracleOnDemo } = require('../helpers/runOracle');
const { assembleWithJS } = require('../helpers/assembleJS');
const { ensureDir, readBytes, writeBytes } = require('../helpers/fileHelpers');

const GOLDEN_DIR = path.resolve(__dirname, '../goldens/branch-mnemonics');

const BRANCH = [
  'brz', 'bre', 'brnz', 'brne', 'brn', 'brp',
  'brlt', 'brgt', 'brc', 'brb', 'br', 'bral',
];

// Mnemonics that share a condition code must encode identically.
const ALIAS_GROUPS = [
  ['brz', 'bre'],
  ['brnz', 'brne'],
  ['brc', 'brb'],
  ['br', 'bral'],
];

// Minimal program exercising one branch mnemonic. The branch goes FORWARD to a
// halt (not a self-loop) so the program always terminates — the oracle *runs*
// what it assembles, and a taken self-branch would infinite-loop it.
function writeProg(mn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `lccjs-190-${mn}-`));
  const p = path.join(tmp, `${mn}.a`);
  fs.writeFileSync(p, `        .start main\nmain:   ${mn} done\n        halt\ndone:   halt\n`);
  return p;
}

const jsBytes = mn => Buffer.from(assembleWithJS(writeProg(mn)).bytes);

describe('#190 — all branch mnemonics assemble with OG-LCC parity', () => {
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

  ensureDir(GOLDEN_DIR);

  // (1) lccjs assembles every branch mnemonic (no "Invalid operation").
  for (const mn of BRANCH) {
    test(`${mn}: lccjs assembles it`, () => {
      expect(() => jsBytes(mn)).not.toThrow();
    });
  }

  // (2) lccjs encoding is byte-identical to the oracle golden.
  for (const mn of BRANCH) {
    const goldenFile = path.join(GOLDEN_DIR, `${mn}.e`);
    const haveGolden = fs.existsSync(goldenFile);

    if (!haveGolden) {
      if (cfg.goldenAutoUpdate && assertOracleConfigured()) {
        const { bytes } = runOracleOnDemo(writeProg(mn));
        writeBytes(goldenFile, bytes);
      } else {
        test.skip(`${mn}: lccjs .e matches oracle golden (skipped: missing golden)`, () => {});
        continue;
      }
    }

    test(`${mn}: lccjs .e matches oracle golden`, () => {
      const js = jsBytes(mn);
      const golden = readBytes(goldenFile);
      expect(js.equals(golden)).toBe(true);
    });
  }

  // (3) alias pairs (same cc) encode identically in lccjs.
  for (const group of ALIAS_GROUPS) {
    test(`alias group ${group.join(' == ')} encodes identically`, () => {
      const [first, ...rest] = group.map(jsBytes);
      for (const b of rest) expect(b.equals(first)).toBe(true);
    });
  }
});
