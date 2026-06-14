// interpreter-traps.bdd.spec.js — step definitions for the interpreter trap / I-O
// BDD feature (#1288; tracker #1269, harness #1252). Lives under tests/new/ so
// `npm test` picks it up; the Gherkin is in tests/features/. Drives the real CLI
// (src/cli/lcc.js) via spawnSync; input traps pipe stdin via the `input` option.
// Asserts the program's printed output (text after lcc's "Output" banner).
// --runInBand-safe: own temp dir + pre-written name.nnn per scenario.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadFeature, defineFeature } = require('jest-cucumber');

const LCC = path.resolve(__dirname, '../../src/cli/lcc.js');
const feature = loadFeature(path.resolve(__dirname, '../features/interpreter-traps.feature'));

defineFeature(feature, (test) => {
  let workDir;
  let sourceName;
  let result;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-bdd-traps-'));
    fs.writeFileSync(path.join(workDir, 'name.nnn'), 'BDD Runner\n');
    result = null;
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  const programOutput = () => {
    const parts = (result.stdout || '').split(/={5,}\s*Output/);
    return parts.length > 1 ? parts[parts.length - 1] : result.stdout || '';
  };

  const runLcc = (name, input) => {
    result = spawnSync(process.execPath, [LCC, name], {
      cwd: workDir,
      encoding: 'utf8',
      timeout: 15000,
      ...(input !== undefined ? { input } : {}),
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

  const whenRunWithInput = (when) =>
    when(/^I run lcc on "(.*)" with input "(.*)"$/, (name, input) => {
      runLcc(name, `${input}\n`);
    });

  const thenPrints = (then) =>
    then(/^the program prints "(.*)"$/, (text) => {
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(programOutput()).toContain(text);
    });

  // Output-trap scenarios (no stdin).
  for (const title of [
    'dout prints a register as a decimal number',
    'aout prints a register as an ASCII character',
    'hout prints a register as hexadecimal',
    'sout prints a null-terminated string at an address',
  ]) {
    test(title, ({ given, when, then }) => {
      givenSource(given);
      whenRun(when);
      thenPrints(then);
    });
  }

  test('nl emits a newline between outputs', ({ given, when, then }) => {
    givenSource(given);
    whenRun(when);
    then(/^"(.*)" and "(.*)" appear on separate lines$/, (a, b) => {
      expect(result.status).toBe(0);
      expect(programOutput()).toMatch(new RegExp(`${a}\\s*\\n\\s*${b}`));
    });
  });

  test('halt stops the program cleanly', ({ given, when, then }) => {
    givenSource(given);
    whenRun(when);
    then('the program exits cleanly with no output', () => {
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(programOutput().trim()).toBe('');
    });
  });

  // Input-trap scenarios (stdin piped).
  for (const title of [
    'din reads a decimal number from stdin',
    'hin reads a hexadecimal number from stdin',
    'sin reads a string from stdin',
  ]) {
    test(title, ({ given, when, then }) => {
      givenSource(given);
      whenRunWithInput(when);
      thenPrints(then);
    });
  }
});
