/**
 * Test-runner spec loader — pure seam (#1090, parent #1044).
 *
 * `loadTestSpec(buffer, baseDir)` parses a JSON test spec and returns a
 * validated in-memory object:
 *
 *   { program: string,
 *     tests: Array<{ name?, input, expected_output, exit_code?, timeout_sec? }> }
 *
 * Design constraints (see docs/research/1044-yaml-test-runner-scope.md §3):
 *   - JSON-only. No YAML parser — the repo is intentionally zero-runtime-dep.
 *   - Pure: no file I/O (the caller reads the buffer), no console.*, no
 *     process.exit. Validation failures throw a typed TestSpecError.
 *   - `program` is resolved relative to `baseDir` (string math via path.resolve;
 *     no filesystem access — existence is the runner's concern, not the loader's).
 */

const path = require('path');
const { TestSpecError } = require('../utils/errors');

function loadTestSpec(buffer, baseDir) {
  const text = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : buffer;

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new TestSpecError(`Malformed test spec JSON: ${err.message}`);
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TestSpecError('Test spec must be a JSON object with "program" and "tests".');
  }

  if (typeof parsed.program !== 'string') {
    throw new TestSpecError('Test spec is missing a string "program" field.');
  }
  const program = path.resolve(baseDir, parsed.program);

  if (!Array.isArray(parsed.tests)) {
    throw new TestSpecError('Test spec "tests" must be an array of test cases.');
  }
  if (parsed.tests.length === 0) {
    throw new TestSpecError('Test spec "tests" must contain at least one test case.');
  }

  const tests = parsed.tests.map((t, i) => {
    const where = `tests[${i}]`;
    if (t === null || typeof t !== 'object' || Array.isArray(t)) {
      throw new TestSpecError(`${where} must be an object.`);
    }
    if (typeof t.input !== 'string') {
      throw new TestSpecError(`${where} is missing a string "input" field.`);
    }
    if (typeof t.expected_output !== 'string') {
      throw new TestSpecError(`${where} is missing a string "expected_output" field.`);
    }

    const out = { input: t.input, expected_output: t.expected_output };

    if (t.name !== undefined) {
      if (typeof t.name !== 'string') {
        throw new TestSpecError(`${where} "name" must be a string.`);
      }
      out.name = t.name;
    }
    if (t.exit_code !== undefined) {
      if (!Number.isInteger(t.exit_code)) {
        throw new TestSpecError(`${where} "exit_code" must be an integer.`);
      }
      out.exit_code = t.exit_code;
    }
    if (t.timeout_sec !== undefined) {
      if (typeof t.timeout_sec !== 'number' || !(t.timeout_sec > 0)) {
        throw new TestSpecError(`${where} "timeout_sec" must be a positive number.`);
      }
      out.timeout_sec = t.timeout_sec;
    }

    return out;
  });

  return { program, tests };
}

module.exports = { loadTestSpec };
