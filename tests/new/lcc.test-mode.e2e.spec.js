const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const LCC = path.resolve(__dirname, '../../src/cli/lcc.js');
const ECHO_FIXTURE = path.resolve(__dirname, '../fixtures/testrunner/echo.a');
const HANG_FIXTURE = path.resolve(__dirname, '../../demos/demoJ.a');

function makeWorkspace(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function copyProgramFixture(src, dir, name) {
  fs.copyFileSync(src, path.join(dir, name));
}

function writeJsonSpec(dir, spec, fileName = 'spec.json') {
  const specPath = path.join(dir, fileName);
  fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
  return specPath;
}

function runTestMode(specPath, cwd) {
  return spawnSync(process.execPath, [LCC, '--test', specPath], {
    cwd,
    encoding: 'utf8',
    timeout: 20000,
  });
}

describe('lcc --test e2e', () => {
  test('reports all-pass cases with PASS and a zero exit code', () => {
    const dir = makeWorkspace('lccjs-test-mode-pass-');
    try {
      copyProgramFixture(ECHO_FIXTURE, dir, 'echo.a');
      const specPath = writeJsonSpec(dir, {
        program: 'echo.a',
        tests: [
          {
            name: 'pass case',
            input: 'hello world\n',
            expected_output: 'hello world',
          },
        ],
      });

      const res = runTestMode(specPath, dir);

      expect(res.error).toBeUndefined();
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('PASS  pass case');
      expect(res.stdout).toContain('1 passed, 0 failed');
      expect(res.stderr).toBe('');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reports stdout mismatches with a first-diff block and exit code 1', () => {
    const dir = makeWorkspace('lccjs-test-mode-diff-');
    try {
      copyProgramFixture(ECHO_FIXTURE, dir, 'echo.a');
      const specPath = writeJsonSpec(dir, {
        program: 'echo.a',
        tests: [
          {
            name: 'diff case',
            input: 'hello world\n',
            expected_output: 'goodbye\n',
          },
        ],
      });

      const res = runTestMode(specPath, dir);

      expect(res.error).toBeUndefined();
      expect(res.status).toBe(1);
      expect(res.stdout).toContain('FAIL  diff case  (output mismatch)');
      expect(res.stdout).toContain('first diff at line 1:');
      expect(res.stdout).toContain('expected: "goodbye"');
      expect(res.stdout).toContain('actual:   "hello world"');
      expect(res.stdout).toContain('0 passed, 1 failed');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reports a timeout as a FAIL with the timeout reason', () => {
    const dir = makeWorkspace('lccjs-test-mode-timeout-');
    try {
      copyProgramFixture(HANG_FIXTURE, dir, 'demoJ.a');
      const specPath = writeJsonSpec(dir, {
        program: 'demoJ.a',
        tests: [
          {
            name: 'hangs',
            input: '',
            expected_output: '',
            timeout_sec: 1,
          },
        ],
      });

      const res = runTestMode(specPath, dir);

      expect(res.error).toBeUndefined();
      expect(res.status).toBe(1);
      expect(res.stdout).toContain('FAIL  hangs  (timed out after 1s)');
      expect(res.stdout).toContain('0 passed, 1 failed');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reports an exit-code mismatch as a FAIL', () => {
    const dir = makeWorkspace('lccjs-test-mode-exit-');
    try {
      copyProgramFixture(ECHO_FIXTURE, dir, 'echo.a');
      const specPath = writeJsonSpec(dir, {
        program: 'echo.a',
        tests: [
          {
            name: 'exit mismatch',
            input: 'hello world\n',
            expected_output: 'hello world',
            exit_code: 1,
          },
        ],
      });

      const res = runTestMode(specPath, dir);

      expect(res.error).toBeUndefined();
      expect(res.status).toBe(1);
      expect(res.stdout).toContain('FAIL  exit mismatch  (exit code 0, expected 1)');
      expect(res.stdout).toContain('0 passed, 1 failed');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('returns exit 2 for malformed specs and missing programs', () => {
    const malformedDir = makeWorkspace('lccjs-test-mode-malformed-');
    const missingDir = makeWorkspace('lccjs-test-mode-missing-');
    try {
      fs.writeFileSync(path.join(malformedDir, 'spec.json'), '{ not json }');
      const malformedRes = runTestMode(path.join(malformedDir, 'spec.json'), malformedDir);
      expect(malformedRes.error).toBeUndefined();
      expect(malformedRes.status).toBe(2);
      expect(malformedRes.stderr).toContain('Malformed test spec JSON');

      const missingSpecPath = writeJsonSpec(missingDir, {
        program: 'missing.a',
        tests: [
          {
            name: 'missing',
            input: 'hello\n',
            expected_output: 'hello\n',
          },
        ],
      });
      const missingRes = runTestMode(missingSpecPath, missingDir);
      expect(missingRes.error).toBeUndefined();
      expect(missingRes.status).toBe(2);
      expect(missingRes.stderr).toContain('Test-runner program not found');
    } finally {
      fs.rmSync(malformedDir, { recursive: true, force: true });
      fs.rmSync(missingDir, { recursive: true, force: true });
    }
  });
});
