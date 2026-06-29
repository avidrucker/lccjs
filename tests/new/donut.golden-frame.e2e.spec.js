// donut.golden-frame.e2e.spec.js — pins the base-LCC ASCII donut render to its
// committed golden frame (#1472, child of #1468). A future edit to any donut
// module that corrupts the render now fails this test.
//
// The donut is NOT a single file: it links cordic.a + mul.a + render.a + donut.a
// into donut.e, then runs with the instruction cap lifted (-ms-1; the frame is
// ~8-10M instructions, ~6s). This wraps experiments/donut/run_donut.sh's
// build→link→run→diff as a serial-safe (--runInBand) jest e2e in its own temp dir,
// in the style of linking.bdd.spec.js. (#1471 landed the driver at
// experiments/donut/donut.a — not the demos/donut.a some ticket text predates.)
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const LCC = path.resolve(__dirname, '../../src/cli/lcc.js');
const DONUT_DIR = path.resolve(__dirname, '../../experiments/donut');
const MODULES = ['cordic', 'mul', 'render', 'donut']; // assembled, then linked in this order

describe('base-LCC ASCII donut — golden frame (#1472 / #1468)', () => {
  let workDir;

  beforeAll(() => {
    // Own temp dir + pre-written name.nnn so the run is non-interactive and the
    // build artifacts never touch the repo (--runInBand-safe).
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-donut-'));
    fs.writeFileSync(path.join(workDir, 'name.nnn'), 'Donut Test\n');
    for (const m of MODULES) {
      fs.copyFileSync(path.join(DONUT_DIR, `${m}.a`), path.join(workDir, `${m}.a`));
    }
  });

  afterAll(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  const lcc = (...args) =>
    spawnSync(process.execPath, [LCC, ...args], {
      cwd: workDir,
      encoding: 'utf8',
      timeout: 60000,
    });

  test('the linked donut renders experiments/donut/frame_simple.txt byte-for-byte', () => {
    // assemble each module -> <mod>.o
    for (const m of MODULES) {
      const asm = lcc(`${m}.a`);
      expect(asm.error).toBeUndefined();
      expect(asm.status).toBe(0);
    }

    // link the objects -> donut.e
    const link = lcc('cordic.o', 'mul.o', 'render.o', 'donut.o', '-o', 'donut.e');
    expect(link.error).toBeUndefined();
    expect(link.status).toBe(0);

    // run with the instruction cap lifted (the frame is ~8-10M instructions)
    const run = lcc('donut.e', '-ms-1');
    expect(run.error).toBeUndefined();

    // Strip the interpreter preamble ("=...= Output") and the single trailing
    // blank line — exactly what experiments/donut/run_donut.sh's awk+sed do.
    const parts = run.stdout.split(/=+ Output[^\n]*\n/);
    expect(parts.length).toBe(2); // the banner appeared exactly once
    const rendered = parts[1].replace(/\n$/, '');

    const golden = fs.readFileSync(path.join(DONUT_DIR, 'frame_simple.txt'), 'utf8');
    expect(rendered).toBe(golden);
  }, 60000); // generous timeout: ~6s render + assemble/link
});
