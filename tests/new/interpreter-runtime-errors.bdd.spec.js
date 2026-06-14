// interpreter-runtime-errors.bdd.spec.js — step definitions for the interpreter
// runtime-errors BDD feature (#1294; tracker #1269, harness #1252). Lives under
// tests/new/ so `npm test` picks it up; the Gherkin is in tests/features/. Drives
// the real CLI (src/cli/lcc.js) via spawnSync and asserts on stderr (where the
// error and any --explain block are written) plus the non-zero exit. Runtime
// errors exit 1 (unlike linker errors, which exit 0 for OG-LCC parity).
// --runInBand-safe: own temp dir + pre-written name.nnn.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadFeature, defineFeature } = require('jest-cucumber');

const LCC = path.resolve(__dirname, '../../src/cli/lcc.js');
const feature = loadFeature(path.resolve(__dirname, '../features/interpreter-runtime-errors.feature'));

defineFeature(feature, (test) => {
  let workDir;
  let sourceName;
  let result;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-bdd-rt-'));
    fs.writeFileSync(path.join(workDir, 'name.nnn'), 'BDD Runner\n');
    result = null;
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  const runLcc = (name, extraArgs) => {
    const args = [LCC, name, ...(extraArgs || [])];
    result = spawnSync(process.execPath, args, {
      cwd: workDir,
      encoding: 'utf8',
      timeout: 15000,
    });
  };

  const givenSource = (given) =>
    given(/^a source file "(.*)" containing:$/, (name, source) => {
      sourceName = name;
      fs.writeFileSync(path.join(workDir, name), `${source}\n`);
    });

  const whenRun = (when) =>
    when(/^I run lcc on "(.*)"$/, (name) => {
      runLcc(name);
    });

  const whenRunExplain = (when) =>
    when(/^I run lcc on "(.*)" with --explain$/, (name) => {
      runLcc(name, ['--explain']);
    });

  const thenRunFails = (then) =>
    then('the run fails', () => {
      expect(result.error).toBeUndefined();
      expect(result.status).not.toBe(0);
    });

  const andErrContains = (and) =>
    and(/^the error output contains "(.*)"$/, (text) => {
      expect(result.stderr).toContain(text);
    });

  const andHasExplain = (and) =>
    and('the error output includes an explain block', () => {
      expect(result.stderr).toContain('explain:');
    });

  test('dividing by zero raises a floating point exception', ({ given, when, then, and }) => {
    givenSource(given);
    whenRun(when);
    thenRunFails(then);
    andErrContains(and);
  });

  test('an out-of-range trap vector is rejected', ({ given, when, then, and }) => {
    givenSource(given);
    whenRun(when);
    thenRunFails(then);
    andErrContains(and);
  });

  test('--explain adds a teaching note to a runtime error', ({ given, when, then, and }) => {
    givenSource(given);
    whenRunExplain(when);
    thenRunFails(then);
    andErrContains(and);
    andHasExplain(and);
  });
});
