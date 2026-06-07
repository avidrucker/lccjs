const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// Runtime-error capture for the LCC+ async run loop (#1031, child A of #1011).
//
// InterpreterPlus.startNonBlockingLoop drives execution via setImmediate(runBatch),
// 500 steps per tick. The only try/catch used to wrap the *first synchronous*
// startNonBlockingLoop() call, which returns once the first batch schedules its
// setImmediate. Any error thrown in a *later* batch was therefore an uncaught
// exception — Node dumped a raw stack trace instead of the intended
// "Runtime Error: <msg>". This suite drives a divide-by-zero that fires well past
// the first 500-step batch and asserts it surfaces cleanly, matching the core
// toolchain contract (lcc.js: "Runtime Error: <msg>", exit 1).

const ASSEMBLER = path.resolve(__dirname, '../../src/plus/assemblerplus.js');
const INTERPRETER = path.resolve(__dirname, '../../src/plus/interpreterplus.js');

// Two back-to-back 255-count countdowns (~1022 steps) before the div, so the
// divide-by-zero throws in a later setImmediate batch, not the first. Nothing
// sets the condition flags between `sub` and `brp`, so brp tests the decrement.
const DIVZERO_LATE_AP = `        .lccplus
        mov  r0, 255
loop1:
        sub  r0, r0, 1
        brp  loop1
        mov  r0, 255
loop2:
        sub  r0, r0, 1
        brp  loop2
        mov  r1, 10
        div  r1, r0
        halt
`;

function assembleAndRun(apSource, name) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-iplus-rterr-'));
  try {
    const apPath = path.join(tmpDir, `${name}.ap`);
    fs.writeFileSync(apPath, apSource);
    const asm = spawnSync(process.execPath, [ASSEMBLER, `${name}.ap`], {
      cwd: tmpDir, encoding: 'utf8', timeout: 10000,
    });
    expect(asm.status).toBe(0);
    const epPath = path.join(tmpDir, `${name}.ep`);
    expect(fs.existsSync(epPath)).toBe(true);

    // input:'' → non-TTY stdin, so escape writes are guarded off and the run
    // terminates (matches the CI/headless path).
    return spawnSync(process.execPath, [INTERPRETER, `${name}.ep`], {
      cwd: tmpDir, encoding: 'utf8', input: '', timeout: 10000,
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe('interpreterplus runtime-error capture in later batches (#1031)', () => {
  test('divide-by-zero past the first batch surfaces "Runtime Error", exit 1 — not a raw stack trace', () => {
    const run = assembleAndRun(DIVZERO_LATE_AP, 'divzero_late');

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('Runtime Error: Floating point exception');
    // The defect was an UNCAUGHT exception: Node printing the class name and a
    // stack frame inside runBatch. A clean capture shows neither.
    expect(run.stderr).not.toMatch(/InterpreterRuntimeError/);
    expect(run.stderr).not.toMatch(/at .*runBatch/);
  });
});
