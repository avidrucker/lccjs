const path = require('path');
const { loadFencedSpec } = require('../../src/testrunner/specLoader');
const { TestSpecError } = require('../../src/utils/errors');

const BASE_DIR = '/work/demos';

describe('loadFencedSpec', () => {
  test('parses a valid single-case fenced spec into the same object shape as the JSON loader', () => {
    const text = [
      'program: mySort.a',
      '',
      'test: sorts three numbers',
      '--- input ---',
      '3 1 2',
      '--- expected ---',
      '1 2 3',
      '--- end ---',
      '',
    ].join('\n');

    const spec = loadFencedSpec(text, BASE_DIR);

    expect(spec.program).toBe(path.resolve(BASE_DIR, 'mySort.a'));
    expect(spec.tests).toHaveLength(1);
    expect(spec.tests[0]).toEqual({
      name: 'sorts three numbers',
      input: '3 1 2\n',
      expected_output: '1 2 3\n',
    });
  });

  test('parses multiple cases and carries optional exit/timeout metadata through', () => {
    const text = [
      'program: examples/echo.a',
      '',
      'test: first',
      'exit: 0',
      'timeout: 10',
      '--- input ---',
      'hello',
      '--- expected ---',
      'hello',
      '--- end ---',
      '',
      'test: second',
      'exit: 2',
      '--- input ---',
      'bye',
      '--- expected ---',
      'bye',
      '--- end ---',
    ].join('\n');

    const spec = loadFencedSpec(text, BASE_DIR);

    expect(spec.program).toBe(path.resolve(BASE_DIR, 'examples/echo.a'));
    expect(spec.tests).toEqual([
      { name: 'first', exit_code: 0, timeout_sec: 10, input: 'hello\n', expected_output: 'hello\n' },
      { name: 'second', exit_code: 2, input: 'bye\n', expected_output: 'bye\n' },
    ]);
  });

  test('an unnamed case (bare "test:") omits the name field', () => {
    const text = [
      'program: a.a',
      'test:',
      '--- input ---',
      'x',
      '--- expected ---',
      'y',
      '--- end ---',
    ].join('\n');

    expect(loadFencedSpec(text, BASE_DIR).tests[0]).toEqual({
      input: 'x\n',
      expected_output: 'y\n',
    });
  });

  test('an empty input block yields an empty-string input', () => {
    const text = [
      'program: a.a',
      'test: no stdin needed',
      '--- input ---',
      '--- expected ---',
      'ready',
      '--- end ---',
    ].join('\n');

    expect(loadFencedSpec(text, BASE_DIR).tests[0]).toEqual({
      name: 'no stdin needed',
      input: '',
      expected_output: 'ready\n',
    });
  });

  test('blank lines inside a literal block are preserved verbatim', () => {
    const text = [
      'program: a.a',
      'test: multi-line output',
      '--- input ---',
      '--- expected ---',
      'line1',
      '',
      'line3',
      '--- end ---',
    ].join('\n');

    expect(loadFencedSpec(text, BASE_DIR).tests[0].expected_output).toBe('line1\n\nline3\n');
  });

  test('accepts a Buffer as well as a string', () => {
    const text = [
      'program: a.a',
      'test: c',
      '--- input ---',
      'i',
      '--- expected ---',
      'o',
      '--- end ---',
    ].join('\n');

    const spec = loadFencedSpec(Buffer.from(text, 'utf8'), BASE_DIR);
    expect(spec.tests[0]).toEqual({ name: 'c', input: 'i\n', expected_output: 'o\n' });
  });

  test('normalizes CRLF line endings', () => {
    const text =
      'program: a.a\r\ntest: c\r\n--- input ---\r\n3 1 2\r\n--- expected ---\r\n1 2 3\r\n--- end ---\r\n';
    const spec = loadFencedSpec(text, BASE_DIR);
    expect(spec.tests[0]).toEqual({ name: 'c', input: '3 1 2\n', expected_output: '1 2 3\n' });
  });

  test('a delimiter look-alike that is indented is kept as literal content, not a terminator', () => {
    const text = [
      'program: a.a',
      'test: prints a fence-looking line',
      '--- input ---',
      '--- expected ---',
      '  --- end ---',
      'real output',
      '--- end ---',
    ].join('\n');

    // The indented "  --- end ---" is column-shifted, so it is content, and the
    // real bare "--- end ---" closes the case.
    expect(loadFencedSpec(text, BASE_DIR).tests[0].expected_output).toBe('  --- end ---\nreal output\n');
  });

  // --- error paths ---

  test('throws TestSpecError on an empty spec', () => {
    expect(() => loadFencedSpec('', BASE_DIR)).toThrow(TestSpecError);
    expect(() => loadFencedSpec('   \n\n', BASE_DIR)).toThrow(TestSpecError);
  });

  test('throws TestSpecError when the program: header is missing', () => {
    const text = ['test: c', '--- input ---', 'x', '--- expected ---', 'y', '--- end ---'].join('\n');
    expect(() => loadFencedSpec(text, BASE_DIR)).toThrow(TestSpecError);
  });

  test('throws TestSpecError when program: has no value', () => {
    expect(() => loadFencedSpec('program:\ntest: c\n--- input ---\n--- expected ---\n--- end ---', BASE_DIR)).toThrow(
      TestSpecError
    );
  });

  test('throws TestSpecError when there are no test cases', () => {
    expect(() => loadFencedSpec('program: a.a\n', BASE_DIR)).toThrow(TestSpecError);
  });

  test('throws TestSpecError on junk between the header and the first test:', () => {
    const text = ['program: a.a', 'garbage line', 'test: c', '--- input ---', '--- expected ---', '--- end ---'].join(
      '\n'
    );
    expect(() => loadFencedSpec(text, BASE_DIR)).toThrow(TestSpecError);
  });

  test('throws TestSpecError when a case is missing its --- input --- block', () => {
    const text = ['program: a.a', 'test: c', '--- expected ---', 'y', '--- end ---'].join('\n');
    expect(() => loadFencedSpec(text, BASE_DIR)).toThrow(TestSpecError);
  });

  test('throws TestSpecError when a case is missing its --- expected --- block', () => {
    const text = ['program: a.a', 'test: c', '--- input ---', 'x', '--- end ---'].join('\n');
    expect(() => loadFencedSpec(text, BASE_DIR)).toThrow(TestSpecError);
  });

  test('throws TestSpecError when a case is missing its --- end --- delimiter', () => {
    const text = ['program: a.a', 'test: c', '--- input ---', 'x', '--- expected ---', 'y'].join('\n');
    expect(() => loadFencedSpec(text, BASE_DIR)).toThrow(TestSpecError);
  });

  test('throws TestSpecError on a non-integer exit:', () => {
    const text = ['program: a.a', 'test: c', 'exit: nope', '--- input ---', '--- expected ---', '--- end ---'].join(
      '\n'
    );
    expect(() => loadFencedSpec(text, BASE_DIR)).toThrow(TestSpecError);
  });

  test('throws TestSpecError on a non-positive timeout:', () => {
    const text = ['program: a.a', 'test: c', 'timeout: -3', '--- input ---', '--- expected ---', '--- end ---'].join(
      '\n'
    );
    expect(() => loadFencedSpec(text, BASE_DIR)).toThrow(TestSpecError);
  });

  test('throws TestSpecError on an unknown key in a case header', () => {
    const text = ['program: a.a', 'test: c', 'bogus: 1', '--- input ---', '--- expected ---', '--- end ---'].join('\n');
    expect(() => loadFencedSpec(text, BASE_DIR)).toThrow(TestSpecError);
  });
});
