// explain-errors.bdd.spec.js — step definitions for the --explain BDD feature
// (#1257; harness #1252, epic #1042, file-load fix #1247). Lives under tests/new/
// so the default `npm test` run picks it up; the Gherkin is in tests/features/.
// Steps drive the real CLI (src/cli/lcc.js) via spawnSync and assert the
// user-visible contract on STDERR (where errors + the `explain:` block are
// written). --runInBand-safe: own temp dir + pre-written name.nnn per scenario.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadFeature, defineFeature } = require('jest-cucumber');

const LCC = path.resolve(__dirname, '../../src/cli/lcc.js');
const feature = loadFeature(path.resolve(__dirname, '../features/explain-errors.feature'));

defineFeature(feature, (test) => {
  let workDir;
  let result;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-bdd-explain-'));
    fs.writeFileSync(path.join(workDir, 'name.nnn'), 'BDD Runner\n');
    result = null;
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  // Shared step bodies. jest-cucumber still requires each scenario to declare
  // exactly its own steps, so the wiring is per-test below.
  const givenSource = (given) =>
    given(/^a source file "(.*)" containing:$/, (name, source) => {
      fs.writeFileSync(path.join(workDir, name), `${source}\n`);
    });

  const givenBadExecutable = (given) =>
    given(/^a non-runnable executable "(.*)"$/, (name) => {
      // No `o` signature -> not a valid LCC executable (triggers NOT_LCC_FORMAT).
      fs.writeFileSync(path.join(workDir, name), Buffer.from([0x00, 0x00, 0x43]));
    });

  const whenRunLcc = (when) =>
    when(/^I run lcc on "(.*)" with "(.*)"$/, (name, flags) => {
      const args = [LCC, name, ...flags.split(/\s+/).filter(Boolean)];
      result = spawnSync(process.execPath, args, {
        cwd: workDir,
        encoding: 'utf8',
        timeout: 15000,
      });
    });

  const thenFails = (then) =>
    then('the command fails', () => {
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

  const andNoExplain = (and) =>
    and('the error output has no explain block', () => {
      expect(result.stderr).not.toContain('explain:');
    });

  test('An assembler error with --explain shows the error and an explanation', ({ given, when, then, and }) => {
    givenSource(given);
    whenRunLcc(when);
    thenFails(then);
    andErrContains(and);
    andHasExplain(and);
  });

  test('The same assembler error without --explain stays terse', ({ given, when, then, and }) => {
    givenSource(given);
    whenRunLcc(when);
    thenFails(then);
    andErrContains(and);
    andNoExplain(and);
  });

  test('A non-runnable executable with --explain explains why it will not run', ({ given, when, then, and }) => {
    givenBadExecutable(given);
    whenRunLcc(when);
    thenFails(then);
    andErrContains(and);
    andHasExplain(and);
  });
});
