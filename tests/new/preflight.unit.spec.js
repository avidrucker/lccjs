'use strict';

const { preflightIssueGate } = require('../../scripts/preflight');

// Pure OPEN-state gate for `npm run preflight <issue>` (#1036, child of #998).
// The git/gh reads and the started_iso scratch write live in main() and are not
// under test here — only the decision seam.
describe('preflight.js preflightIssueGate()', () => {
  test('OPEN → proceed (no warn, no error)', () => {
    const g = preflightIssueGate('OPEN');
    expect(g.ok).toBe(true);
    expect(g.error).toBeUndefined();
  });

  test('is case/whitespace tolerant', () => {
    expect(preflightIssueGate('  open  ').ok).toBe(true);
  });

  test('CLOSED → block with a loud error (the #223 race the guard exists for)', () => {
    const g = preflightIssueGate('CLOSED');
    expect(g.ok).toBe(false);
    expect(g.error).toMatch(/not OPEN/);
  });

  test('any non-OPEN state blocks', () => {
    expect(preflightIssueGate('MERGED').ok).toBe(false);
    expect(preflightIssueGate('LOCKED').ok).toBe(false);
  });

  // gh unavailable (offline): warn-and-proceed, matching claim.js's best-effort guards.
  test('null/empty state → proceed with a warning (offline best-effort)', () => {
    const gNull = preflightIssueGate(null);
    expect(gNull.ok).toBe(true);
    expect(gNull.warn).toMatch(/unknown/);
    expect(preflightIssueGate('').ok).toBe(true);
    expect(preflightIssueGate('   ').ok).toBe(true);
  });
});
