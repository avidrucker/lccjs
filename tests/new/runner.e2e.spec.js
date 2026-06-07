const fs = require('fs');
const os = require('os');
const path = require('path');
const { runTestSpec } = require('../../src/testrunner/runner');
const { TestRunnerError } = require('../../src/utils/errors');

// echo.a reads one line of stdin and echoes it back (no trailing newline).
// Running it through the runner exercises the full real path: piped stdin,
// the name.nnn pre-seed (without which the author-name prompt eats the input),
// and program-output isolation from the lcc banner.
const ECHO_FIXTURE = path.resolve(__dirname, '../fixtures/testrunner/echo.a');

function makeProgramDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-runner-e2e-'));
  fs.copyFileSync(ECHO_FIXTURE, path.join(dir, 'echo.a'));
  return dir;
}

// Per-case timeout. Passing cases now return as soon as the program exits,
// independent of this value — the lccrun.sh watchdog no longer orphans a
// `sleep` that held the stdout pipe open for the full timeout (#1149, fixed;
// regression-guarded by lccrun.e2e.spec.js). Kept small as a sane default.
const FAST = 2;

describe('runTestSpec (e2e — real piped stdin)', () => {
  test('passes a case whose piped stdin echoes back as expected_output', () => {
    const dir = makeProgramDir();
    try {
      const results = runTestSpec({
        program: path.join(dir, 'echo.a'),
        tests: [{ name: 'echoes input', input: 'hello world\n', expected_output: 'hello world\n', timeout_sec: FAST }],
      });
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ name: 'echoes input', pass: true, reason: 'ok' });
      expect(results[0].actual).toBe('hello world');
      // Proves the runner pre-seeded name.nnn (otherwise the prompt ate the input).
      expect(fs.existsSync(path.join(dir, 'name.nnn'))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reports an output mismatch as a failing case', () => {
    const dir = makeProgramDir();
    try {
      const [result] = runTestSpec({
        program: path.join(dir, 'echo.a'),
        tests: [{ input: 'hello world\n', expected_output: 'goodbye', timeout_sec: FAST }],
      });
      expect(result.pass).toBe(false);
      expect(result.reason).toBe('output mismatch');
      expect(result.actual).toBe('hello world');
      expect(result.name).toBe('case 1'); // default name when none given
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('runs each case as an independent subprocess (no state bleed)', () => {
    const dir = makeProgramDir();
    try {
      const results = runTestSpec({
        program: path.join(dir, 'echo.a'),
        tests: [
          { name: 'first', input: 'alpha\n', expected_output: 'alpha', timeout_sec: FAST },
          { name: 'second', input: 'beta\n', expected_output: 'beta', timeout_sec: FAST },
        ],
      });
      expect(results.map((r) => r.pass)).toEqual([true, true]);
      expect(results.map((r) => r.actual)).toEqual(['alpha', 'beta']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('throws TestRunnerError when the program file does not exist', () => {
    expect(() =>
      runTestSpec({
        program: path.join(os.tmpdir(), 'does-not-exist-12345.a'),
        tests: [{ input: 'x', expected_output: 'y' }],
      })
    ).toThrow(TestRunnerError);
  });
});
