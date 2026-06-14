/**
 * Test-runner spec loaders — pure seams (#1090 / #1114, parent #1044).
 *
 * Two front-ends, one internal object. Both `loadTestSpec` (JSON, #1090) and
 * `loadFencedSpec` (fenced literal-block, #1114) return the SAME shape, so the
 * CLI sniffer (#1092) and runner core (#1091) are format-agnostic:
 *
 *   { program: string,
 *     tests: Array<{ name?, input, expected_output, exit_code?, timeout_sec? }> }
 *
 *   - JSON is the zero-dep interchange format; fenced is the human-authoring
 *     format (students paste multi-line stdin/stdout literally, no escaping).
 *     Format rationale: docs/research/1103-spec-format-recommendation.md.
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

/**
 * Parse the fenced literal-block format (#1114) into the internal spec object.
 *
 * Grammar (bespoke-fenced — the research doc's default; final grammar was the
 * impl ticket's call per docs/research/1103-spec-format-recommendation.md):
 *
 *   program: <path>                ← required file header (resolved vs baseDir)
 *
 *   test: <name>                   ← starts a case; <name> optional
 *   exit: <int>                    ← optional case metadata (any order)
 *   timeout: <positive number>     ← optional case metadata
 *   --- input ---                  ← literal stdin block follows
 *   ...lines taken verbatim...
 *   --- expected ---               ← literal expected-stdout block follows
 *   ...lines taken verbatim...
 *   --- end ---                    ← closes the case
 *
 * Literal blocks: every line between two delimiters is verbatim — no escaping,
 * no significant whitespace. Each content line contributes `line + "\n"`, so an
 * input block of `3 1 2` yields `"3 1 2\n"` (the newline a program's stdin
 * needs) and an empty block yields `""`. The runner normalizes a single
 * trailing newline on both sides, so this matches a hand-written JSON spec.
 *
 * Delimiter collision: the three `--- … ---` delimiters are structural ONLY when
 * alone on a line at column 0. An indented or decorated look-alike (e.g.
 * `  --- end ---`) is preserved as literal content. A bare delimiter line that a
 * program genuinely emits is the one un-expressible payload — a documented v1
 * limitation; a longer/parameterized fence (the Markdown trick) is the future
 * escape hatch if it ever bites.
 */
function loadFencedSpec(text, baseDir) {
  const raw = Buffer.isBuffer(text) ? text.toString('utf8') : text;
  if (typeof raw !== 'string') {
    throw new TestSpecError('Fenced test spec must be a string or Buffer.');
  }

  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const n = lines.length;
  let i = 0;

  // --- file header: program: <path> ---
  while (i < n && lines[i].trim() === '') i++;
  if (i >= n) {
    throw new TestSpecError('Fenced test spec is empty.');
  }
  const header = /^program:[ \t]?(.*)$/.exec(lines[i]);
  if (!header) {
    throw new TestSpecError(
      `Fenced test spec must begin with a "program:" header (got: ${JSON.stringify(lines[i])}).`
    );
  }
  const programRaw = header[1].trim();
  if (programRaw === '') {
    throw new TestSpecError('Fenced test spec "program:" header has no value.');
  }
  const program = path.resolve(baseDir, programRaw);
  i++;

  const tests = [];

  while (i < n) {
    if (lines[i].trim() === '') {
      i++;
      continue;
    }

    // --- case header: test: <name> ---
    const testLine = /^test:[ \t]?(.*)$/.exec(lines[i]);
    if (!testLine) {
      throw new TestSpecError(
        `Expected a "test:" line to start a test case (got: ${JSON.stringify(lines[i])}).`
      );
    }
    const tc = {};
    const name = testLine[1].trim();
    const where = name ? `test case "${name}"` : 'unnamed test case';
    if (name !== '') tc.name = name;
    i++;

    // --- optional metadata scalars until "--- input ---" ---
    while (i < n && lines[i] !== '--- input ---') {
      if (lines[i].trim() === '') {
        i++;
        continue;
      }
      const scalar = /^([A-Za-z_]+):[ \t]?(.*)$/.exec(lines[i]);
      if (!scalar) {
        throw new TestSpecError(
          `Expected "exit:", "timeout:", or "--- input ---" in ${where} (got: ${JSON.stringify(lines[i])}).`
        );
      }
      const key = scalar[1];
      const value = scalar[2].trim();
      if (key === 'exit') {
        if (!/^-?\d+$/.test(value)) {
          throw new TestSpecError(`"exit:" must be an integer in ${where} (got: ${JSON.stringify(value)}).`);
        }
        tc.exit_code = parseInt(value, 10);
      } else if (key === 'timeout') {
        const num = Number(value);
        if (!(num > 0)) {
          throw new TestSpecError(`"timeout:" must be a positive number in ${where} (got: ${JSON.stringify(value)}).`);
        }
        tc.timeout_sec = num;
      } else {
        throw new TestSpecError(`Unknown key "${key}:" in ${where} (expected "exit:" or "timeout:").`);
      }
      i++;
    }

    // --- input block ---
    if (i >= n) {
      throw new TestSpecError(`${where} is missing its "--- input ---" block.`);
    }
    i++; // consume "--- input ---"
    const inputLines = [];
    while (i < n && lines[i] !== '--- expected ---') {
      if (lines[i] === '--- end ---') {
        throw new TestSpecError(`${where} reached "--- end ---" before "--- expected ---".`);
      }
      inputLines.push(lines[i]);
      i++;
    }
    if (i >= n) {
      throw new TestSpecError(`${where} is missing its "--- expected ---" block.`);
    }
    i++; // consume "--- expected ---"

    // --- expected block ---
    const expectedLines = [];
    while (i < n && lines[i] !== '--- end ---') {
      expectedLines.push(lines[i]);
      i++;
    }
    if (i >= n) {
      throw new TestSpecError(`${where} is missing its "--- end ---" delimiter.`);
    }
    i++; // consume "--- end ---"

    tc.input = inputLines.length ? inputLines.join('\n') + '\n' : '';
    tc.expected_output = expectedLines.length ? expectedLines.join('\n') + '\n' : '';
    tests.push(tc);
  }

  if (tests.length === 0) {
    throw new TestSpecError('Fenced test spec must contain at least one test case.');
  }

  return { program, tests };
}

module.exports = { loadTestSpec, loadFencedSpec };
