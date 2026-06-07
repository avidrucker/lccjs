const {
  classifyResult,
  extractProgramOutput,
  normalizeOutput,
} = require('../../src/testrunner/runner');

// Build a stdout string shaped like a real default-mode `lcc <prog>` run:
// toolchain banner, the "Output" separator, then the program's own output.
function withBanner(programOutput) {
  return (
    'Starting assembly pass 1\n' +
    'Starting assembly pass 2\n' +
    'Starting interpretation of prog.e\n' +
    'lst file = prog.lst\n' +
    'bst file = prog.bst\n' +
    '====================================================== Output\n' +
    programOutput
  );
}

describe('normalizeOutput', () => {
  test('converts CRLF to LF', () => {
    expect(normalizeOutput('a\r\nb\r\n')).toBe('a\nb');
  });

  test('strips a single trailing newline, not internal blank lines', () => {
    expect(normalizeOutput('a\n\nb\n')).toBe('a\n\nb');
  });

  test('treats null/undefined as empty string', () => {
    expect(normalizeOutput(undefined)).toBe('');
    expect(normalizeOutput(null)).toBe('');
  });
});

describe('extractProgramOutput', () => {
  test('returns only the text after the Output separator', () => {
    expect(extractProgramOutput(withBanner('hello world\n'))).toBe('hello world\n');
  });

  test('returns empty string when the Output marker is absent (e.g. assembly failed)', () => {
    expect(extractProgramOutput('Starting assembly pass 1\nError on line 3\n')).toBe('');
  });

  test('keeps program output that itself contains "=" characters', () => {
    expect(extractProgramOutput(withBanner('1 + 1 = 2\n'))).toBe('1 + 1 = 2\n');
  });
});

describe('classifyResult', () => {
  const okCase = { input: '3 1 2\n', expected_output: '1 2 3\n' };

  test('passes when the extracted+normalized output matches', () => {
    const res = classifyResult(okCase, { status: 0, stdout: withBanner('1 2 3\n') });
    expect(res).toMatchObject({ pass: true, reason: 'ok', actual: '1 2 3', expected: '1 2 3', exitCode: 0 });
  });

  test('fails with an output mismatch reason', () => {
    const res = classifyResult(okCase, { status: 0, stdout: withBanner('9 9 9\n') });
    expect(res.pass).toBe(false);
    expect(res.reason).toBe('output mismatch');
    expect(res.actual).toBe('9 9 9');
  });

  test('classifies the lccrun 124 timeout sentinel as a timed-out failure', () => {
    const res = classifyResult({ ...okCase, timeout_sec: 3 }, { status: 124, stdout: '' });
    expect(res.pass).toBe(false);
    expect(res.reason).toBe('timed out after 3s');
  });

  test('classifies a JS-level spawn error as a failure, not a throw', () => {
    const res = classifyResult(okCase, { status: null, stdout: '', error: new Error('spawn bash ENOENT') });
    expect(res.pass).toBe(false);
    expect(res.reason).toMatch(/spawn error/);
  });

  test('asserts exit_code only when the case specifies it', () => {
    // exit_code specified and mismatched → fail even though output matches
    const mismatch = classifyResult(
      { ...okCase, exit_code: 0 },
      { status: 1, stdout: withBanner('1 2 3\n') }
    );
    expect(mismatch.pass).toBe(false);
    expect(mismatch.reason).toBe('exit code 1, expected 0');

    // exit_code NOT specified → a non-zero exit does not fail a matching-output case
    const tolerated = classifyResult(okCase, { status: 1, stdout: withBanner('1 2 3\n') });
    expect(tolerated.pass).toBe(true);
  });

  test('passes when exit_code is specified and matches', () => {
    const res = classifyResult(
      { ...okCase, exit_code: 0 },
      { status: 0, stdout: withBanner('1 2 3\n') }
    );
    expect(res.pass).toBe(true);
  });
});
