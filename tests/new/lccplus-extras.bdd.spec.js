// lccplus-extras.bdd.spec.js — step definitions for the LCC+ extras BDD
// feature (#1306; tracker #1269, harness #1252). Lives under tests/new/ so
// `npm test` picks it up; the Gherkin is in tests/features/. Drives the real
// LCC+ driver module (src/plus/lccplus.js) through its CLI entry point. Normal
// scenarios run off-TTY; the terminal-control scenario flips the TTY guards
// in-process so cursor / home escapes are observable.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadFeature, defineFeature } = require('jest-cucumber');
const LCCPlus = require('../../src/plus/lccplus');

const feature = loadFeature(path.resolve(__dirname, '../features/lccplus-extras.feature'));
const ESC_HIDE = '\u001B[?25l';
const ESC_HOME = '\u001B[H';

defineFeature(feature, (test) => {
  let workDir;
  let sourceName;
  let result;
  let stdoutWrites;
  let stderrWrites;
  let clearSpy;
  let savedTTY;
  let savedSetRawMode;
  let savedPause;
  let savedResume;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-bdd-plus-'));
    fs.writeFileSync(path.join(workDir, 'name.nnn'), 'BDD Runner\n');
    result = null;
    stdoutWrites = [];
    stderrWrites = [];
    clearSpy = null;
    savedTTY = null;
    savedSetRawMode = null;
    savedPause = null;
    savedResume = null;
  });

  afterEach(() => {
    if (savedTTY) {
      process.stdin.isTTY = savedTTY.stdin;
      process.stdout.isTTY = savedTTY.stdout;
    }
    if (savedSetRawMode) process.stdin.setRawMode = savedSetRawMode;
    if (savedPause) process.stdin.pause = savedPause;
    if (savedResume) process.stdin.resume = savedResume;
    jest.restoreAllMocks();
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  const output = () => `${result.stdout || ''}${result.stderr || ''}`.replace(/\r/g, '');

  const outputLines = () =>
    output().split('\n').map((line) => line.trim()).filter(Boolean);

  const givenSource = (given) =>
    given(/^a source file "(.*)" containing:$/, (name, source) => {
      sourceName = name;
      fs.writeFileSync(path.join(workDir, name), `${source}\n`);
    });

  const captureOutput = () => {
    jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdoutWrites.push(String(chunk));
      return true;
    });
    jest.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderrWrites.push(String(chunk));
      return true;
    });
    clearSpy = jest.spyOn(console, 'clear').mockImplementation(() => {});
  };

  const captureTTY = () => {
    savedTTY = {
      stdin: process.stdin.isTTY,
      stdout: process.stdout.isTTY,
    };
    savedSetRawMode = process.stdin.setRawMode;
    savedPause = process.stdin.pause;
    savedResume = process.stdin.resume;
    process.stdin.isTTY = true;
    process.stdout.isTTY = true;
    process.stdin.setRawMode = jest.fn();
    process.stdin.pause = jest.fn();
    process.stdin.resume = jest.fn();
  };

  const runLccPlus = (name, { tty = false } = {}) => {
    captureOutput();
    if (tty) captureTTY();

    const driver = new LCCPlus();
    const prevCwd = process.cwd();
    try {
      process.chdir(workDir);
      driver.main([name]);
      result = {
        error: undefined,
        status: 0,
        stdout: stdoutWrites.join(''),
        stderr: stderrWrites.join(''),
      };
    } catch (error) {
      result = {
        error,
        status: 1,
        stdout: stdoutWrites.join(''),
        stderr: stderrWrites.join(''),
      };
    } finally {
      process.chdir(prevCwd);
    }
  };

  const thenProgramPrints = (then) =>
    then(/^the program prints "(.*)"$/, (text) => {
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(output()).toContain(text);
    });

  const thenSeparateLines = (then) =>
    then(/^"(.*)" and "(.*)" appear on separate lines$/, (a, b) => {
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      const lines = outputLines();
      expect(lines).toContain(a);
      expect(lines).toContain(b);
      expect(lines.indexOf(a)).toBeLessThan(lines.lastIndexOf(b));
    });

  test('srand seeds rand into a repeatable pair of numbers', ({ given, when, then }) => {
    givenSource(given);
    when(/^I run lccplus on "(.*)"$/, (name) => runLccPlus(name));
    thenSeparateLines(then);
  });

  test('millis prints a millisecond value', ({ given, when, then }) => {
    givenSource(given);
    when(/^I run lccplus on "(.*)"$/, (name) => runLccPlus(name));
    then('the program prints a millisecond value', () => {
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      const lines = outputLines();
      const last = lines[lines.length - 1];
      expect(last).toMatch(/^\d{1,3}$/);
      expect(Number(last)).toBeGreaterThanOrEqual(0);
      expect(Number(last)).toBeLessThan(1000);
    });
  });

  test('nbain returns 0 when no key is waiting', ({ given, when, then }) => {
    givenSource(given);
    when(/^I run lccplus on "(.*)"$/, (name) => runLccPlus(name));
    thenProgramPrints(then);
  });

  test('cursor and resetc emit terminal escapes under a TTY', ({ given, when, then, and }) => {
    givenSource(given);
    when(/^I run lccplus on "(.*)" in a TTY$/, (name) => runLccPlus(name, { tty: true }));
    then('the screen is cleared once', () => {
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(clearSpy).not.toBeNull();
      expect(clearSpy).toHaveBeenCalledTimes(1);
    });
    then('the output contains the cursor-hide escape', () => {
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(output()).toContain(ESC_HIDE);
    });
    and('the output contains the cursor-home escape', () => {
      expect(output()).toContain(ESC_HOME);
    });
    and(/^the program prints "(.*)"$/, (text) => {
      expect(output()).toContain(text);
    });
  });
});
