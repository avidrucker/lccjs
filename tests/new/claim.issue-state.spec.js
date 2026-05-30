'use strict';

const { shouldBlockClaim, parseArgs } = require('../../scripts/claim');

// #227: claim.js must refuse to stake a worktree for an already-CLOSED issue, but
// ONLY on a *definitive* CLOSED state. A missing/unknown issue or an unavailable
// gh (readIssue returns null) stays best-effort -- the claim proceeds so the
// offline-first workflow never regresses -- and --force bypasses entirely. These
// exercise the pure decision seam (no gh round-trip), mirroring the
// assessBaseStaleness (#228) pure-seam tests in claim.unit.spec.js.
describe('claim.js shouldBlockClaim() -- #227 closed-issue guard', () => {
  test('a definitively CLOSED issue is blocked', () => {
    expect(shouldBlockClaim({ title: 't', state: 'CLOSED' }, false)).toBe(true);
  });

  test('an OPEN issue is not blocked', () => {
    expect(shouldBlockClaim({ title: 't', state: 'OPEN' }, false)).toBe(false);
  });

  test('--force bypasses the block even for a CLOSED issue', () => {
    expect(shouldBlockClaim({ title: 't', state: 'CLOSED' }, true)).toBe(false);
  });

  test('null info (gh unavailable / unknown issue) is best-effort: not blocked', () => {
    expect(shouldBlockClaim(null, false)).toBe(false);
  });

  test('an unexpected/empty state is not blocked (only CLOSED is definitive)', () => {
    expect(shouldBlockClaim({ title: 't', state: '' }, false)).toBe(false);
  });
});

describe('claim.js parseArgs() -- #227 --force flag', () => {
  test('--force sets opts.force true', () => {
    expect(parseArgs(['239', '--force']).force).toBe(true);
  });

  test('opts.force defaults to false', () => {
    expect(parseArgs(['239']).force).toBe(false);
  });
});
