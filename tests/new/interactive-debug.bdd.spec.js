// interactive-debug.bdd.spec.js — step definitions for the interactive debugger
// BDD feature (#1259; harness #1252). Lives under tests/new/ so `npm test` picks
// it up; the Gherkin is in tests/features/. Drives the real `lcc -i` CLI via
// spawnSync with the command sequence piped on stdin (a number steps N
// instructions; `q` quits). Verified deterministic (~50ms, exits 0). The debugger
// panel is ANSI-coloured, so output is stripped of escape codes before asserting
// on register text. --runInBand-safe: own temp dir + pre-written name.nnn.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadFeature, defineFeature } = require('jest-cucumber');

const LCC = path.resolve(__dirname, '../../src/cli/lcc.js');
const feature = loadFeature(path.resolve(__dirname, '../features/interactive-debug.feature'));

// eslint-disable-next-line no-control-regex
const stripAnsi = (s) => (s || '').replace(/\[[0-9;]*m/g, '');

defineFeature(feature, (test) => {
  let workDir;
  let sourceName;
  let result;
  let plainOut;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-bdd-idbg-'));
    fs.writeFileSync(path.join(workDir, 'name.nnn'), 'BDD Runner\n');
    result = null;
    plainOut = '';
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  const runDebugger = (commands) => {
    result = spawnSync(process.execPath, [LCC, '-i', sourceName], {
      cwd: workDir,
      encoding: 'utf8',
      timeout: 15000,
      input: commands,
    });
    plainOut = stripAnsi(result.stdout);
  };

  const givenSource = (given) =>
    given(/^a source file "(.*)" containing:$/, (name, source) => {
      sourceName = name;
      fs.writeFileSync(path.join(workDir, name), `${source}\n`);
    });

  const thenDebuggerStarts = (then) =>
    then('the interactive debugger starts', () => {
      expect(result.error).toBeUndefined();
      expect(plainOut).toContain('Registers');
    });

  const andExitsCleanly = (and) =>
    and('the debugger exits cleanly', () => {
      expect(result.status).toBe(0);
    });

  test('Stepping one instruction updates the register it writes', ({ given, when, then, and }) => {
    givenSource(given);
    when('I step once and then quit the debugger', () => {
      runDebugger('1\nq\n'); // step 1 instruction, then quit
    });
    thenDebuggerStarts(then);
    and('register r0 holds 5 after the step', () => {
      // mov r0, 5 executed -> the post-step register panel shows r0 = 0x0005.
      expect(plainOut).toContain('r0: 0005');
    });
    andExitsCleanly(and);
  });

  test('Quitting without stepping leaves the registers untouched', ({ given, when, then, and }) => {
    givenSource(given);
    when('I quit the debugger without stepping', () => {
      runDebugger('q\n'); // quit immediately
    });
    thenDebuggerStarts(then);
    and('no instruction has executed yet', () => {
      // No step taken: r0 is still 0x0000 and never reaches 0x0005.
      expect(plainOut).toContain('r0: 0000');
      expect(plainOut).not.toContain('r0: 0005');
    });
    andExitsCleanly(and);
  });
});
