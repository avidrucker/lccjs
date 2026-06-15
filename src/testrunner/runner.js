/**
 * Test-runner core (#1091, parent #1044).
 *
 * Given the internal spec object produced by the spec loader (#1090):
 *
 *   { program: string,
 *     tests: Array<{ name?, input, expected_output, exit_code?, timeout_sec? }> }
 *
 * `runTestSpec(spec)` runs each case independently through the in-memory
 * assembler/interpreter APIs, isolates + normalizes + compares the program's
 * stdout, optionally asserts the exit code, and returns a results array:
 *
 *   [{ name, pass, reason, expected, actual, exitCode }]
 *
 * This is a CLI/wrapper-layer feature (spec loading + orchestration + I/O), not
 * a pure seam — it belongs alongside lcc.js orchestration. Per-case failures
 * are reported in the results array (the CLI maps "any fail" to exit 1); a
 * harness-level failure — the program file does not exist — throws
 * TestRunnerError so the CLI can map it to exit 2.
 *
 * The impure spawn (`runCase`) is kept thin and the verdict logic lives in the
 * pure `classifyResult`, so the classification (timeout / exit-code / diff) is
 * unit-testable without shelling out.
 *
 * Reuse map (docs/research/1044-yaml-test-runner-scope.md §6):
 *   - timeout detection             → interpreter max-step cap mapped to exit 124
 *   - stdin simulation              → interpreter inputBuffer for SIN/DIN
 *   - name-prompt determinism       → pre-seed name.nnn in the program dir (§4, the #1 trap)
 *   - output normalization          → CRLF→LF + strip a trailing newline (§4)
 *
 * NOTE (gap found vs spike §4): a default `lcc <program>` run prints a toolchain
 * banner to stdout ("Starting assembly pass 1", ..., a "===... Output" separator)
 * before the program's own output. The spike's normalization (CRLF + trailing
 * newline only) would never match a teacher's expected_output. The runner
 * therefore isolates the program output after the "Output" separator that lcc
 * emits in default mode (the same marker genStats.js writes); this keeps the
 * marker present, at the cost of leaving .e/.lst/.bst artifacts beside the
 * program (normal for any lcc run). Surfaced on #1091 for the reporter child.
 */

const fs = require('fs');
const path = require('path');
const Assembler = require('../core/assembler');
const Interpreter = require('../core/interpreter');
const { TestRunnerError } = require('../utils/errors');

const DEFAULT_TIMEOUT_SEC = 10; // §4 default when a case omits timeout_sec

// The separator line lcc prints right before program output begins (default
// mode). Everything up to and including it is toolchain banner, not program
// output. Matches the first "===... Output" line only.
const OUTPUT_MARKER = /^={3,} Output$/m;

/**
 * Isolate the program's own stdout from the lcc toolchain banner by slicing
 * after the "Output" separator. If the marker is absent (e.g. assembly failed
 * before execution), the program produced no output → "".
 */
function extractProgramOutput(stdout) {
  const s = String(stdout == null ? '' : stdout);
  const m = s.match(OUTPUT_MARKER);
  if (!m) return '';
  return s.slice(m.index + m[0].length).replace(/^\n/, '');
}

/**
 * Normalize captured/expected output for comparison: CRLF→LF and drop a single
 * trailing newline so "1 2 3\n" and "1 2 3" compare equal (§4). A single
 * trailing newline only — extra/internal blank lines stay significant.
 */
function normalizeOutput(s) {
  return String(s == null ? '' : s).replace(/\r\n/g, '\n').replace(/\n$/, '');
}

/**
 * Pure verdict: classify a spawnSync-shaped result against one test case.
 * Returns { pass, reason, expected, actual, exitCode } (no `name`).
 *   res: { status:number|null, stdout:string, error?:Error }
 */
function classifyResult(testCase, res) {
  const timeoutSec = testCase.timeout_sec || DEFAULT_TIMEOUT_SEC;
  const exitCode = res.status;
  const actual = normalizeOutput(extractProgramOutput(res.stdout));
  const expected = normalizeOutput(testCase.expected_output);
  const base = { expected, actual, exitCode };

  if (exitCode === 124) {
    return { ...base, pass: false, reason: `timed out after ${timeoutSec}s` };
  }

  // Native spawn timeout from the wrapper process.
  if (res.error && res.error.code === 'ETIMEDOUT') {
    return { ...base, pass: false, reason: `timed out after ${timeoutSec}s` };
  }

  if (res.signal === 'SIGTERM' && exitCode === null) {
    return { ...base, pass: false, reason: `timed out after ${timeoutSec}s` };
  }

  // A JS-level execution failure is not a test result.
  if (res.error) {
    return { ...base, pass: false, reason: `spawn error: ${res.error.message}` };
  }

  // Optional exit-code assertion (default: don't assert).
  if (testCase.exit_code !== undefined && exitCode !== testCase.exit_code) {
    return {
      ...base,
      pass: false,
      reason: `exit code ${exitCode}, expected ${testCase.exit_code}`,
    };
  }

  if (actual !== expected) {
    return { ...base, pass: false, reason: 'output mismatch' };
  }

  return { ...base, pass: true, reason: 'ok' };
}

/**
 * Run one case in isolation and classify it. No state bleeds between cases —
 * each case assembles and executes from fresh in-memory instances.
 */
function runCase(testCase, index, programDir, programBase) {
  const name = testCase.name || `case ${index + 1}`;
  const timeoutSec = testCase.timeout_sec || DEFAULT_TIMEOUT_SEC;
  const programPath = path.join(programDir, programBase);
  const programSource = fs.readFileSync(programPath, 'utf8');

  let stdout = '';
  let status = 0;
  let error = null;

  const savedLog = console.log;
  const savedError = console.error;
  try {
    console.log = () => {};
    console.error = () => {};

    const assembler = new Assembler();
    const assembled = assembler.assembleSource(programSource, {
      inputFileName: programBase,
      throwOnAssemblyError: true,
    });

    const interpreter = new Interpreter({
      write: (m) => {
        stdout += m;
      },
      // An autograder pipes input non-interactively: capture only the program's
      // own output, not the interpreter's simulated-input echo (#1328).
      echoInput: false,
    });

    const execResult = interpreter.executeBuffer(assembled.outputBytes, {
      inputFileName: programBase,
      inputBuffer: testCase.input,
      maxSteps: Math.max(1, timeoutSec * 1000),
    });

    if (execResult.maxStepsReached) {
      status = 124;
    } else {
      status = 0;
    }

    stdout = [
      `lst file = ${path.basename(programBase, path.extname(programBase))}.lst`,
      `bst file = ${path.basename(programBase, path.extname(programBase))}.bst`,
      '====================================================== Output',
      stdout,
    ].join('\n');
  } catch (err) {
    status = 1;
    error = err;
  } finally {
    console.log = savedLog;
    console.error = savedError;
  }

  return {
    name,
    ...classifyResult(testCase, {
      status,
      stdout,
      error,
      signal: null,
    }),
  };
}

/**
 * Pre-seed name.nnn so lcc's author-name prompt does not silently eat the first
 * line of a case's stdin (§4, the #1 correctness trap). Never clobber a name.nnn
 * the program directory already has.
 */
function seedNameFile(dir) {
  const nameFile = path.join(dir, 'name.nnn');
  if (!fs.existsSync(nameFile)) {
    fs.writeFileSync(nameFile, 'TestUser\n');
  }
}

/**
 * Run every case in a loaded spec object and return the results array.
 * Throws TestRunnerError if the program file is missing (a harness error).
 */
function runTestSpec(spec) {
  const { program, tests } = spec;

  if (!fs.existsSync(program)) {
    throw new TestRunnerError(`Test-runner program not found: ${program}`);
  }

  const programDir = path.dirname(program);
  const programBase = path.basename(program);

  // One seed before the loop is enough — name.nnn persists across cases.
  seedNameFile(programDir);

  return tests.map((t, i) => runCase(t, i, programDir, programBase));
}

module.exports = {
  runTestSpec,
  classifyResult,
  extractProgramOutput,
  normalizeOutput,
};
