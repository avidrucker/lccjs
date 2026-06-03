const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// Off-TTY smoke for the LCC+ interpreter CLI (#259, scoped by #240 research).
// Before the fix, main() called process.stdin.setRawMode(true) unconditionally,
// so the interpreter crashed with "setRawMode is not a function" the moment
// stdin was not a TTY (piped input, redirect, CI, a test harness). That is why
// #198 could not drive interpreterplus end-to-end and had to fall back to the
// pure executeRand/executeSrand seam. With setRawMode guarded behind
// process.stdin.isTTY, a write-only program now runs to completion off-TTY.

const ASSEMBLER = path.resolve(__dirname, '../../src/plus/assemblerplus.js');
const INTERPRETER = path.resolve(__dirname, '../../src/plus/interpreterplus.js');
const RAND_DEMO = path.resolve(__dirname, '../../plusdemos/randDeterministic.ap');
const ESC = String.fromCharCode(27); // 0x1b — start of any ANSI cursor escape

// The fixed sequence randDeterministic.ap emits (srand 0; 20x rand[1,20]).
// Pinned identically in interpreterplus.unit.spec.js against the pure LCG seam.
const GOLDEN = [12, 17, 4, 1, 8, 9, 4, 1, 8, 5, 20, 1, 8, 17, 12, 13, 16, 5, 12, 5];

// Minimal .ap source that immediately hits a bp breakpoint.
// Written inline so the test has no external fixture dependency.
const BP_AP_SOURCE = `        .lccplus
        bp
        halt
`;

describe('interpreterplus CLI off-TTY (#259)', () => {
  test('a write-only .ep runs to completion with a non-TTY stdin (no setRawMode crash)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-iplus-offtty-'));
    try {
      // Assemble the demo into the tmp dir so we never touch the repo tree.
      const apPath = path.join(tmpDir, 'rand.ap');
      fs.copyFileSync(RAND_DEMO, apPath);
      const asm = spawnSync(process.execPath, [ASSEMBLER, 'rand.ap'], {
        cwd: tmpDir, encoding: 'utf8', timeout: 10000,
      });
      expect(asm.status).toBe(0);
      const epPath = path.join(tmpDir, 'rand.ep');
      expect(fs.existsSync(epPath)).toBe(true);

      // input: '' makes the child's stdin an empty pipe — i.e. not a TTY, the
      // exact condition that used to throw. This is the run #198 could not do.
      const run = spawnSync(process.execPath, [INTERPRETER, 'rand.ep'], {
        cwd: tmpDir, encoding: 'utf8', input: '', timeout: 10000,
      });

      expect(run.status).toBe(0);
      expect(run.stderr).not.toMatch(/setRawMode/);
      expect(run.stderr).not.toMatch(/TypeError/);
      // The 20 deterministic numbers come through in order.
      expect(run.stdout).toContain(GOLDEN.join('\n'));
      // And no terminal cursor-control escape leaks into the piped output.
      expect(run.stdout).not.toContain(ESC);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('bp off-TTY fast-fail (#561)', () => {
  test('bp prints diagnostic to stderr and exits 1 when stdin is not a TTY', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-bp-offtty-'));
    try {
      const apPath = path.join(tmpDir, 'bp_test.ap');
      fs.writeFileSync(apPath, BP_AP_SOURCE);
      const asm = spawnSync(process.execPath, [ASSEMBLER, 'bp_test.ap'], {
        cwd: tmpDir, encoding: 'utf8', timeout: 10000,
      });
      expect(asm.status).toBe(0);
      const epPath = path.join(tmpDir, 'bp_test.ep');
      expect(fs.existsSync(epPath)).toBe(true);

      // input: '' gives a non-TTY stdin — bp must not hang
      const run = spawnSync(process.execPath, [INTERPRETER, 'bp_test.ep'], {
        cwd: tmpDir, encoding: 'utf8', input: '', timeout: 5000,
      });

      expect(run.status).toBe(1);
      expect(run.stderr).toContain(
        'lcc+: breakpoint hit off-TTY — interactive terminal required; exiting.'
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
