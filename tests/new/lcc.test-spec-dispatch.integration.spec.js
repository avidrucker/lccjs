const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const LCC = require('../../src/cli/lcc');

const LCC_CLI = path.resolve(__dirname, '../../src/cli/lcc.js');
const ECHO_FIXTURE = path.resolve(__dirname, '../fixtures/testrunner/echo.a');

// LCC.loadSpec is a this-free orchestration method (reads the file, sniffs the
// first non-blank char, dispatches to the JSON or fenced loader). Calling it via
// the prototype with a bare `this` exercises the real dispatch + real file read
// without booting the whole CLI pipeline.
function loadSpec(specPath) {
  return LCC.prototype.loadSpec.call(Object.create(LCC.prototype), specPath);
}

function writeSpec(name, contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-dispatch-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, contents);
  return { dir, file };
}

const FENCED = [
  'program: prog.a',
  'test: c',
  '--- input ---',
  '3 1 2',
  '--- expected ---',
  '1 2 3',
  '--- end ---',
  '',
].join('\n');

const JSON_SPEC = JSON.stringify({
  program: 'prog.a',
  tests: [{ name: 'c', input: '3 1 2\n', expected_output: '1 2 3\n' }],
});

describe('LCC.loadSpec — content-sniff dispatch (#1240)', () => {
  test('routes a fenced spec to the fenced loader', () => {
    const { dir, file } = writeSpec('cases.test', FENCED);
    try {
      const spec = loadSpec(file);
      expect(spec.program).toBe(path.resolve(dir, 'prog.a'));
      expect(spec.tests).toEqual([{ name: 'c', input: '3 1 2\n', expected_output: '1 2 3\n' }]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('routes a JSON spec to the JSON loader', () => {
    const { dir, file } = writeSpec('cases.json', JSON_SPEC);
    try {
      const spec = loadSpec(file);
      expect(spec.program).toBe(path.resolve(dir, 'prog.a'));
      expect(spec.tests).toEqual([{ name: 'c', input: '3 1 2\n', expected_output: '1 2 3\n' }]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('dispatches on CONTENT, not extension: fenced text in a .json-named file still parses as fenced', () => {
    const { dir, file } = writeSpec('misnamed.json', FENCED);
    try {
      // If dispatch were extension-based this would be handed to JSON.parse and
      // throw; content-sniff sees the `program:` header and routes to fenced.
      const spec = loadSpec(file);
      expect(spec.tests).toEqual([{ name: 'c', input: '3 1 2\n', expected_output: '1 2 3\n' }]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('dispatches on CONTENT, not extension: JSON text in a .test-named file still parses as JSON', () => {
    const { dir, file } = writeSpec('misnamed.test', JSON_SPEC);
    try {
      const spec = loadSpec(file);
      expect(spec.tests).toEqual([{ name: 'c', input: '3 1 2\n', expected_output: '1 2 3\n' }]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('end-to-end: `lcc --test <fenced-spec>` runs a real program and exits 0 on all-pass', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-test-e2e-'));
    try {
      fs.copyFileSync(ECHO_FIXTURE, path.join(dir, 'echo.a'));
      const specPath = path.join(dir, 'echo.test');
      fs.writeFileSync(
        specPath,
        ['program: echo.a', 'test: echoes one line', '--- input ---', 'hello', '--- expected ---', 'hello', '--- end ---', ''].join('\n')
      );

      const res = spawnSync('node', [LCC_CLI, '--test', specPath], {
        encoding: 'utf8',
        input: '',
        timeout: 20000,
      });

      expect(res.status).toBe(0);
      expect(res.stdout).toMatch(/pass/i);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
