const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// LCC+ driver --explain forwarding (#1102).
//
// `--explain` (#1096) appends a student-friendly explanation to errors that carry a
// stable `explainKey`. The core driver (`lcc.js`) wires it in two places: the
// assembler's instance `explainModeOn`, and the module-level cliExit gate
// (`setExplainMode`) that the interpreter's runtime/file-format funnel reads. The
// LCC+ driver (`lccplus.js`) never accepted the flag, so `.ap` programs got no
// explanations. This suite drives the driver itself through both the assembler-error
// path and the interpreter-runtime path, and pins that the default (no-flag) output
// is unchanged. Mirrors lccplus.verbose-forwarding.e2e.spec.js (#1005).

const LCCPLUS = path.resolve(__dirname, '../../src/plus/lccplus.js');

// `rand` requires two register operands; with one it hits AssemblerPlus.assembleRAND's
// "Missing register" path, which reuses the base REGISTER explainKey (#1102).
const RAND_MISSING_REG_AP = `        .lccplus
        rand r0
        halt
`;

// Integer divide-by-zero: an inherited InterpreterPlus runtime fault whose typed
// error carries the DIV_BY_ZERO explainKey. Exercises handleRuntimeError forwarding.
const DIV_BY_ZERO_AP = `        .lccplus
        mov r0, 10
        mov r1, 0
        div r0, r1
        halt
`;

function runDriver(apSource, name, extraArgs) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-lccplus-explain-'));
  try {
    const apPath = path.join(tmpDir, `${name}.ap`);
    fs.writeFileSync(apPath, apSource);
    return spawnSync(
      process.execPath,
      [LCCPLUS, ...extraArgs, `${name}.ap`],
      { cwd: tmpDir, encoding: 'utf8', input: '', timeout: 10000 }
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe('lccplus driver forwards --explain to the assembler error path (#1102)', () => {
  test('--explain renders the REGISTER explain block on a plus-only "Missing register" error', () => {
    const run = runDriver(RAND_MISSING_REG_AP, 'rand', ['--explain']);
    const out = `${run.stdout || ''}${run.stderr || ''}`;
    expect(out).toContain('Missing register');
    expect(out).toContain('explain: The LCC has exactly eight general-purpose registers');
  });

  test('default (no flag) path is unchanged — the same error emits no explain block', () => {
    const run = runDriver(RAND_MISSING_REG_AP, 'rand', []);
    const out = `${run.stdout || ''}${run.stderr || ''}`;
    expect(out).toContain('Missing register');
    expect(out).not.toContain('explain:');
  });
});

// Drive the driver with a hand-written corrupt `.ep` (not an assembled `.ap`) to
// reach InterpreterPlus.loadExecutableBuffer's file-format/header faults. `opXX`
// passes the `'op'` LCC+ signature guard, then `X` is an unrecognized header entry
// → BAD_EXE_HEADER. (#1273 — deferred from #1102.)
function runRawEp(bytes, name, extraArgs) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-lccplus-explain-ep-'));
  try {
    const epPath = path.join(tmpDir, `${name}.ep`);
    fs.writeFileSync(epPath, Buffer.from(bytes));
    return spawnSync(
      process.execPath,
      [LCCPLUS, ...extraArgs, `${name}.ep`],
      { cwd: tmpDir, encoding: 'utf8', input: '', timeout: 10000 }
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe('lccplus driver forwards --explain to the interpreter file-format load path (#1273)', () => {
  const CORRUPT_EP = 'opXX'; // valid 'op' signature, then an unknown header entry 'X'

  test('--explain renders the BAD_EXE_HEADER block on a corrupt .ep header', () => {
    const run = runRawEp(CORRUPT_EP, 'badep', ['--explain']);
    const out = `${run.stdout || ''}${run.stderr || ''}`;
    expect(out).toContain("Unknown header entry: 'X'");
    expect(out).toContain("explain: An executable's header lists typed entries");
  });

  test('default (no flag) path is unchanged — the load error emits no explain block', () => {
    const run = runRawEp(CORRUPT_EP, 'badep', []);
    const out = `${run.stdout || ''}${run.stderr || ''}`;
    expect(out).toContain("Unknown header entry: 'X'");
    expect(out).not.toContain('explain:');
  });
});

describe('lccplus driver forwards --explain to the interpreter runtime path (#1102)', () => {
  test('--explain renders the DIV_BY_ZERO block on a runtime divide-by-zero in an .ap', () => {
    const run = runDriver(DIV_BY_ZERO_AP, 'divzero', ['--explain']);
    const out = `${run.stdout || ''}${run.stderr || ''}`;
    expect(out).toContain('Runtime Error: Floating point exception');
    expect(out).toContain('explain: The div and rem instructions divide');
  });

  test('default (no flag) path is unchanged — the runtime error emits no explain block', () => {
    const run = runDriver(DIV_BY_ZERO_AP, 'divzero', []);
    const out = `${run.stdout || ''}${run.stderr || ''}`;
    expect(out).toContain('Runtime Error: Floating point exception');
    expect(out).not.toContain('explain:');
  });
});
