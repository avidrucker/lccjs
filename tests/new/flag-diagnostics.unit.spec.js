// flag-diagnostics.unit.spec.js — the pure flag-classification message builder (#1373).
// formatFlagDiagnostics({ unknown, unimplemented }) returns the warning line(s):
//   - unknown flags  -> "Flag {x} is not a known LCCjs flag." / "Flags {x, y} are not known LCCjs flags."
//   - unimplemented  -> "Flag {x} has not yet been implemented." / "Flags {x, y} have not yet been implemented."
// Both groups can be non-empty; unknown line first, then unimplemented. Both are warnings.

'use strict';

const { formatFlagDiagnostics } = require('../../src/utils/flagDiagnostics');
const LCC = require('../../src/cli/lcc');
const ILCC = require('../../src/interactive/ilcc');

describe('formatFlagDiagnostics (#1373)', () => {
  test('a single unknown flag', () => {
    expect(formatFlagDiagnostics({ unknown: ['-q'], unimplemented: [] }))
      .toEqual(['Flag {-q} is not a known LCCjs flag.']);
  });

  test('multiple unknown flags use the plural form', () => {
    expect(formatFlagDiagnostics({ unknown: ['-q', '--banana'], unimplemented: [] }))
      .toEqual(['Flags {-q, --banana} are not known LCCjs flags.']);
  });

  test('a single unimplemented flag', () => {
    expect(formatFlagDiagnostics({ unknown: [], unimplemented: ['-f'] }))
      .toEqual(['Flag {-f} has not yet been implemented.']);
  });

  test('multiple unimplemented flags use the plural form', () => {
    expect(formatFlagDiagnostics({ unknown: [], unimplemented: ['-f', '-g'] }))
      .toEqual(['Flags {-f, -g} have not yet been implemented.']);
  });

  test('both buckets non-empty: unknown line first, then unimplemented', () => {
    expect(formatFlagDiagnostics({ unknown: ['-q', '--banana'], unimplemented: ['-f'] }))
      .toEqual([
        'Flags {-q, --banana} are not known LCCjs flags.',
        'Flag {-f} has not yet been implemented.',
      ]);
  });

  test('neither bucket: no lines', () => {
    expect(formatFlagDiagnostics({ unknown: [], unimplemented: [] })).toEqual([]);
    expect(formatFlagDiagnostics()).toEqual([]);
  });
});

describe('lcc.js parseArguments — flag diagnostics (#1373)', () => {
  let errSpy;
  beforeEach(() => {
    errSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation((m) => process.stderr.write(String(m) + '\n'));
  });
  afterEach(() => {
    errSpy.mockRestore();
    console.error.mockRestore();
  });
  const stderr = () => errSpy.mock.calls.map((c) => c[0]).join('');

  test('an unknown flag warns and parsing continues (no exit)', () => {
    const lcc = new LCC();
    expect(() => lcc.parseArguments(['-zzz', 'foo.a'])).not.toThrow();
    expect(stderr()).toContain('Flag {-zzz} is not a known LCCjs flag.');
    expect(lcc.args).toContain('foo.a'); // parsing continued past the bad flag
  });

  test('the unimplemented -f flag warns and parsing continues', () => {
    const lcc = new LCC();
    expect(() => lcc.parseArguments(['-f', 'foo.a'])).not.toThrow();
    expect(stderr()).toContain('Flag {-f} has not yet been implemented.');
    expect(lcc.args).toContain('foo.a');
  });

  test('both an unknown and an unimplemented flag: two warning lines', () => {
    const lcc = new LCC();
    lcc.parseArguments(['-q', '--banana', '-f', 'foo.a']);
    const out = stderr();
    expect(out).toContain('Flags {-q, --banana} are not known LCCjs flags.');
    expect(out).toContain('Flag {-f} has not yet been implemented.');
  });

  test('a clean invocation emits no flag warnings', () => {
    const lcc = new LCC();
    lcc.parseArguments(['-x', 'foo.a']);
    expect(stderr()).toBe('');
  });
});

describe('ilcc.js parseArguments — flag diagnostics (#1373)', () => {
  let errSpy;
  beforeEach(() => {
    errSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation((m) => process.stderr.write(String(m) + '\n'));
  });
  afterEach(() => {
    errSpy.mockRestore();
    console.error.mockRestore();
  });
  const stderr = () => errSpy.mock.calls.map((c) => c[0]).join('');

  test('an unknown flag warns and parsing continues (no exit)', () => {
    const ilcc = new ILCC();
    expect(() => ilcc.parseArguments(['-zzz', 'foo.a'])).not.toThrow();
    expect(stderr()).toContain('Flag {-zzz} is not a known LCCjs flag.');
    expect(ilcc.args).toContain('foo.a');
  });

  test('the unimplemented -f flag warns and parsing continues', () => {
    const ilcc = new ILCC();
    expect(() => ilcc.parseArguments(['-f', 'foo.a'])).not.toThrow();
    expect(stderr()).toContain('Flag {-f} has not yet been implemented.');
  });
});
