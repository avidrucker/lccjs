// interpreter-arithmetic.bdd.spec.js — step definitions for the interpreter
// arithmetic + condition-flags BDD feature (#1287; tracker #1269, harness #1252).
// Lives under tests/new/ so `npm test` picks it up; the Gherkin is in
// tests/features/. Drives the real CLI (src/cli/lcc.js) via spawnSync, assembling
// + running each program and asserting the printed output (text after lcc's
// "Output" banner). Flags are exercised indirectly via cmp + brz. --runInBand-safe.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadFeature, defineFeature } = require('jest-cucumber');

const LCC = path.resolve(__dirname, '../../src/cli/lcc.js');
const feature = loadFeature(path.resolve(__dirname, '../features/interpreter-arithmetic.feature'));

defineFeature(feature, (test) => {
  let workDir;
  let sourceName;
  let result;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-bdd-arith-'));
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

  const givenSource = (given) =>
    given(/^a source file "(.*)" containing:$/, (name, source) => {
      sourceName = name;
      fs.writeFileSync(path.join(workDir, name), `${source}\n`);
    });

  const whenRunLcc = (when) =>
    when(/^I run lcc on "(.*)"$/, (name) => {
      result = spawnSync(process.execPath, [LCC, name], {
        cwd: workDir,
        encoding: 'utf8',
        timeout: 15000,
      });
    });

  const thenProgramPrints = (then) =>
    then(/^the program prints "(.*)"$/, (text) => {
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(programOutput()).toContain(text);
    });

  const scenario = (title) =>
    test(title, ({ given, when, then }) => {
      givenSource(given);
      whenRunLcc(when);
      thenProgramPrints(then);
    });

  scenario('add computes a sum (immediate form)');
  scenario('sub computes a difference (register form)');
  scenario('mul multiplies two registers');
  scenario('div divides two registers');
  scenario('cmp of equal values sets the zero flag so brz is taken');
  scenario('cmp of unequal values leaves the zero flag clear so brz falls through');
});
