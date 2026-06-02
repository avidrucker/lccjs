// tests/new/assembler.org.oracle.e2e.spec.js
//
// #500 — .org parity probe: forward-gap padding, .orig synonym, backward/invalid error parity.
//
// Decisions from oracle probe (2026-06-02):
//   D1. Forward-gap padding: oracle and lccjs produce byte-identical output — parity achieved.
//   D2. .orig synonym: oracle accepts .orig; lccjs implements it as a case-fall-through at
//       assembler.js:1098-1099. Both produce the same encoding as .org — synonym is complete.
//   D3. Backward .org error text: oracle emits "Backward address on .org" (stdout, exit 1);
//       lccjs emits the same text (stderr, exit 1). Error message parity achieved.
//   D4. Invalid operand (.org banana): oracle emits "Bad number"; lccjs emits "Invalid number
//       for .org directive". Documented as BY DESIGN deviation §22 in parity_deviations.md.
//   D5. Failure artifact: oracle leaves a 1-byte blank .e on all .org errors; lccjs writes
//       nothing. Covered by the existing OG BUG §10 pattern (no new entry needed).

const path = require('path');
const { assertOracleConfigured } = require('../helpers/env');
const { runOracleOnDemo } = require('../helpers/runOracle');
const { assembleWithJS } = require('../helpers/assembleJS');

const FIXTURE_DIR = path.resolve(__dirname, '../../experiments');

const ORG_FORWARD_GAP = path.join(FIXTURE_DIR, 'org_forward_gap.a');

// Same program as org_forward_gap.a but with .orig instead of .org.
const fs = require('fs');
const os = require('os');

function origVariantPath() {
  const src = fs.readFileSync(ORG_FORWARD_GAP, 'utf8').replace('.org 4', '.orig 4');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-500-orig-'));
  const p = path.join(tmp, 'orig_forward_gap.a');
  fs.writeFileSync(p, src);
  return p;
}

const itOracle = assertOracleConfigured() ? test : test.skip;

describe('#500 — .org / .orig parity', () => {
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

  // D1: .org forward-gap padding — lccjs and oracle produce byte-identical output.
  test('D1: .org forward-gap — lccjs assembles successfully', () => {
    expect(() => assembleWithJS(ORG_FORWARD_GAP)).not.toThrow();
  });

  itOracle('D1: .org forward-gap — lccjs .e is byte-identical to oracle', () => {
    const js = Buffer.from(assembleWithJS(ORG_FORWARD_GAP).bytes);
    const oracle = Buffer.from(runOracleOnDemo(ORG_FORWARD_GAP, [], { tolerateNonZeroExit: false }).bytes);
    expect(js.equals(oracle)).toBe(true);
  });

  // D2: .orig synonym — lccjs accepts .orig and produces the same encoding as .org.
  test('D2: .orig assembles identically to .org in lccjs', () => {
    const orgBytes = Buffer.from(assembleWithJS(ORG_FORWARD_GAP).bytes);
    const origBytes = Buffer.from(assembleWithJS(origVariantPath()).bytes);
    expect(origBytes.equals(orgBytes)).toBe(true);
  });

  itOracle('D2: .orig — lccjs .e is byte-identical to oracle .orig output', () => {
    const origPath = origVariantPath();
    const js = Buffer.from(assembleWithJS(origPath).bytes);
    const oracle = Buffer.from(runOracleOnDemo(origPath, [], { tolerateNonZeroExit: false }).bytes);
    expect(js.equals(oracle)).toBe(true);
  });
});
