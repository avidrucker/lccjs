// tests/new/interpreter.bp.oracle.e2e.spec.js
//
// #515 — Lock in LCC.js's clean bp non-interactive behavior (parity_deviations.md §22).
//
// §22 documents a BY DESIGN deviation: in non-interactive (non-TTY) context, the oracle
// enters step-trace mode after `bp` and emits per-instruction trace lines interleaved
// with program output. LCC.js prints `software breakpoint` and continues cleanly.
//
// These tests assert LCC.js's correct behavior and, where the oracle is configured,
// demonstrate the deviation by showing the oracle DOES produce step-trace output.
//
// Migrated from direct-oracle to golden-cache (#692): the oracle's stdout (proving
// step-trace output exists) was captured once and committed as a golden; the
// deviation proof now reads the golden without needing the binary.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { cfg, assertOracleConfigured } = require('../helpers/env');
const { runOracleOnDemo } = require('../helpers/runOracle');
const { ensureDir, readText, writeText } = require('../helpers/fileHelpers');

const GOLDEN_DIR = path.resolve(__dirname, '../goldens/bp');
const { assembleWithJS } = require('../helpers/assembleJS');
const {
  createTempWorkspace,
  runInWorkspaceCwd,
  stageFileInWorkspace,
} = require('../helpers/tempWorkspace');

const EXPERIMENTS_DIR = path.resolve(__dirname, '../../experiments');
const BP_BASIC = path.join(EXPERIMENTS_DIR, 'bp_basic.a');

// Write a multi-bp variant inline (two consecutive bp instructions) to confirm
// debugMode is not latched after the first hit.
function writeTwoBpProgram() {
  const src = [
    '        mov r0, 7',
    '        bp',
    '        bp',
    '        dout r0',
    '        nl',
    '        halt',
  ].join('\n') + '\n';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-515-twobp-'));
  const p = path.join(tmp, 'bp_two.a');
  fs.writeFileSync(p, src);
  return p;
}

// Run the LCC.js interpreter on a pre-assembled .e file; return interpreter.output
// and interpreter.debugMode. Runs in-process so output is captured via the property.
function runJSInterpreter(eBytes, label) {
  const Interpreter = require('../../src/core/interpreter');
  const tmp = createTempWorkspace(`lccjs-515-${label}-`);
  const eFile = path.join(tmp, `${label}.e`);
  fs.writeFileSync(eFile, eBytes);

  const interp = new Interpreter();
  runInWorkspaceCwd(tmp, () => {
    interp.main([`${label}.e`]);
  });
  return { output: interp.output, debugMode: interp.debugMode };
}

describe('#515 — bp non-interactive: LCC.js clean output (parity_deviations.md §22)', () => {
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

  // ── LCC.js assertions (run without oracle) ───────────────────────────────────

  test('LCC.js: bp_basic assembles without error', () => {
    expect(() => assembleWithJS(BP_BASIC)).not.toThrow();
  });

  test('LCC.js: output contains "software breakpoint"', () => {
    const { bytes } = assembleWithJS(BP_BASIC);
    const { output } = runJSInterpreter(Buffer.from(bytes), 'bp_basic');
    expect(output).toContain('software breakpoint');
  });

  test('LCC.js: output contains program result (dout r0 = 7)', () => {
    const { bytes } = assembleWithJS(BP_BASIC);
    const { output } = runJSInterpreter(Buffer.from(bytes), 'bp_basic_val');
    expect(output).toContain('7');
  });

  test('LCC.js: output does NOT contain step-trace markers (>>>)', () => {
    const { bytes } = assembleWithJS(BP_BASIC);
    const { output } = runJSInterpreter(Buffer.from(bytes), 'bp_basic_notrace');
    expect(output).not.toContain('>>>');
  });

  test('LCC.js: debugMode is false after bp in non-TTY context', () => {
    const { bytes } = assembleWithJS(BP_BASIC);
    const { debugMode } = runJSInterpreter(Buffer.from(bytes), 'bp_basic_dm');
    expect(debugMode).toBe(false);
  });

  test('LCC.js: two consecutive bp instructions do not latch debugMode', () => {
    const twoBpPath = writeTwoBpProgram();
    const { bytes } = assembleWithJS(twoBpPath);
    const { output, debugMode } = runJSInterpreter(Buffer.from(bytes), 'bp_two');
    expect(output).toContain('software breakpoint');
    expect(output).toContain('7');
    expect(output).not.toContain('>>>');
    expect(debugMode).toBe(false);
  });

  // ── Oracle deviation proof (golden-cache — no live oracle needed) ────────────

  ensureDir(GOLDEN_DIR);
  const bpGoldenFile = path.join(GOLDEN_DIR, 'bp_basic.stdout.txt');
  if (!fs.existsSync(bpGoldenFile) && cfg.goldenAutoUpdate && assertOracleConfigured()) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-515-oracle-gen-'));
    fs.copyFileSync(BP_BASIC, path.join(tmp, 'bp_basic1.a'));
    fs.writeFileSync(path.join(tmp, 'name.nnn'), 'TestUser\n');
    const res = spawnSync(cfg.lccPath, ['bp_basic1.a'], {
      cwd: tmp,
      encoding: 'utf8',
      timeout: 15000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    writeText(bpGoldenFile, res.stdout || '');
  }

  if (fs.existsSync(bpGoldenFile)) {
    test('Oracle golden: bp_basic stdout DOES contain step-trace markers (>>> — §22 deviation)', () => {
      const golden = readText(bpGoldenFile);
      expect(golden).toContain('>>>');
    });
  } else {
    test.skip('Oracle golden: bp_basic stdout DOES contain step-trace markers (skipped: missing golden)', () => {});
  }
});
