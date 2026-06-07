const path = require('path');
const { loadTestSpec } = require('../../src/testrunner/specLoader');
const { TestSpecError } = require('../../src/utils/errors');

const BASE_DIR = '/work/demos';

function specBuffer(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8');
}

describe('loadTestSpec', () => {
  test('parses a valid spec into program + tests, resolving program relative to baseDir', () => {
    const spec = loadTestSpec(
      specBuffer({
        program: 'mySort.a',
        tests: [{ name: 'sorts three', input: '3 1 2\n', expected_output: '1 2 3\n' }],
      }),
      BASE_DIR
    );

    expect(spec.program).toBe(path.resolve(BASE_DIR, 'mySort.a'));
    expect(spec.tests).toHaveLength(1);
    expect(spec.tests[0]).toEqual({
      name: 'sorts three',
      input: '3 1 2\n',
      expected_output: '1 2 3\n',
    });
  });

  test('accepts a string buffer as well as a Buffer', () => {
    const spec = loadTestSpec(
      JSON.stringify({ program: 'a.a', tests: [{ input: 'x', expected_output: 'y' }] }),
      BASE_DIR
    );
    expect(spec.program).toBe(path.resolve(BASE_DIR, 'a.a'));
    expect(spec.tests[0]).toEqual({ input: 'x', expected_output: 'y' });
  });

  test('throws TestSpecError on malformed JSON', () => {
    expect(() => loadTestSpec(Buffer.from('{ not json', 'utf8'), BASE_DIR)).toThrow(TestSpecError);
  });

  test('throws TestSpecError when the spec is not a JSON object', () => {
    expect(() => loadTestSpec(specBuffer([1, 2, 3]), BASE_DIR)).toThrow(TestSpecError);
    expect(() => loadTestSpec(Buffer.from('"a string"', 'utf8'), BASE_DIR)).toThrow(TestSpecError);
  });

  test('throws TestSpecError when program is missing', () => {
    expect(() =>
      loadTestSpec(specBuffer({ tests: [{ input: 'x', expected_output: 'y' }] }), BASE_DIR)
    ).toThrow(TestSpecError);
  });

  test('throws TestSpecError when program is not a string', () => {
    expect(() =>
      loadTestSpec(specBuffer({ program: 42, tests: [{ input: 'x', expected_output: 'y' }] }), BASE_DIR)
    ).toThrow(TestSpecError);
  });

  test('throws TestSpecError when tests is missing or not an array', () => {
    expect(() => loadTestSpec(specBuffer({ program: 'a.a' }), BASE_DIR)).toThrow(TestSpecError);
    expect(() =>
      loadTestSpec(specBuffer({ program: 'a.a', tests: 'nope' }), BASE_DIR)
    ).toThrow(TestSpecError);
  });

  test('throws TestSpecError when tests is empty', () => {
    expect(() => loadTestSpec(specBuffer({ program: 'a.a', tests: [] }), BASE_DIR)).toThrow(
      TestSpecError
    );
  });

  test('throws TestSpecError when a test case is missing input', () => {
    expect(() =>
      loadTestSpec(specBuffer({ program: 'a.a', tests: [{ expected_output: 'y' }] }), BASE_DIR)
    ).toThrow(TestSpecError);
  });

  test('throws TestSpecError when a test case is missing expected_output', () => {
    expect(() =>
      loadTestSpec(specBuffer({ program: 'a.a', tests: [{ input: 'x' }] }), BASE_DIR)
    ).toThrow(TestSpecError);
  });

  test('throws TestSpecError when input/expected_output have the wrong type', () => {
    expect(() =>
      loadTestSpec(specBuffer({ program: 'a.a', tests: [{ input: 5, expected_output: 'y' }] }), BASE_DIR)
    ).toThrow(TestSpecError);
    expect(() =>
      loadTestSpec(specBuffer({ program: 'a.a', tests: [{ input: 'x', expected_output: 5 }] }), BASE_DIR)
    ).toThrow(TestSpecError);
  });

  test('throws TestSpecError when a test case is not an object', () => {
    expect(() =>
      loadTestSpec(specBuffer({ program: 'a.a', tests: ['not an object'] }), BASE_DIR)
    ).toThrow(TestSpecError);
  });

  test('carries optional name, exit_code, and timeout_sec through to the object', () => {
    const spec = loadTestSpec(
      specBuffer({
        program: 'a.a',
        tests: [
          { name: 'c', input: 'x', expected_output: 'y', exit_code: 1, timeout_sec: 5 },
        ],
      }),
      BASE_DIR
    );
    expect(spec.tests[0]).toEqual({
      name: 'c',
      input: 'x',
      expected_output: 'y',
      exit_code: 1,
      timeout_sec: 5,
    });
  });

  test('throws TestSpecError when optional exit_code/timeout_sec have the wrong type', () => {
    expect(() =>
      loadTestSpec(
        specBuffer({ program: 'a.a', tests: [{ input: 'x', expected_output: 'y', exit_code: 'nope' }] }),
        BASE_DIR
      )
    ).toThrow(TestSpecError);
    expect(() =>
      loadTestSpec(
        specBuffer({ program: 'a.a', tests: [{ input: 'x', expected_output: 'y', timeout_sec: -3 }] }),
        BASE_DIR
      )
    ).toThrow(TestSpecError);
    expect(() =>
      loadTestSpec(
        specBuffer({ program: 'a.a', tests: [{ input: 'x', expected_output: 'y', name: 9 }] }),
        BASE_DIR
      )
    ).toThrow(TestSpecError);
  });
});
