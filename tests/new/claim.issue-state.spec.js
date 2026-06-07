'use strict';

const { shouldBlockClaim, parseArgs, findLiveWorktreeForIssue, shouldBlockWorktreeGuard, needsAreaLabel, shouldBlockUncategorized } = require('../../scripts/claim');

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

// #1013 (child of #1004): claim.js nudges — never blocks — when the claimed issue
// still carries only the auto-applied `area:uncategorized` placeholder, or has no
// `area:*` label at all. These exercise the pure decision seam (no gh round-trip).
describe('claim.js needsAreaLabel() -- #1013 area-label nudge', () => {
  test('warns when the issue carries area:uncategorized', () => {
    expect(needsAreaLabel(['bug', 'area:uncategorized'])).toBe(true);
  });

  test('warns when the issue has no area:* label at all', () => {
    expect(needsAreaLabel(['bug', 'severity:medium'])).toBe(true);
  });

  test('warns when the label set is empty', () => {
    expect(needsAreaLabel([])).toBe(true);
  });

  test('does NOT warn when a real area label is present', () => {
    expect(needsAreaLabel(['area:process', 'bug'])).toBe(false);
  });

  test('still warns when area:uncategorized sits alongside a real area label', () => {
    expect(needsAreaLabel(['area:process', 'area:uncategorized'])).toBe(true);
  });

  test('non-array (gh offline / unknown labels) is best-effort: no warning', () => {
    expect(needsAreaLabel(null)).toBe(false);
    expect(needsAreaLabel(undefined)).toBe(false);
  });
});

// #1151: hardens the #1013 warn into a HARD BLOCK at the claim choke point —
// categorization is mandatory before work begins. Mirrors shouldBlockClaim's
// (info, bypass) shape: offline (null info) never blocks, and an explicit human
// bypass short-circuits. Pure decision seam (no gh round-trip).
describe('claim.js shouldBlockUncategorized() -- #1151 lane gate', () => {
  test('an uncategorized-placeholder issue is blocked', () => {
    expect(shouldBlockUncategorized({ labels: ['bug', 'area:uncategorized'] }, false)).toBe(true);
  });

  test('an issue with no area:* label at all is blocked', () => {
    expect(shouldBlockUncategorized({ labels: ['bug', 'severity:medium'] }, false)).toBe(true);
  });

  test('a real area:* label is not blocked', () => {
    expect(shouldBlockUncategorized({ labels: ['area:process', 'bug'] }, false)).toBe(false);
  });

  test('a real area:* alongside the placeholder is still blocked (placeholder must be removed)', () => {
    expect(shouldBlockUncategorized({ labels: ['area:process', 'area:uncategorized'] }, false)).toBe(true);
  });

  test('--allow-uncategorized bypass short-circuits the block', () => {
    expect(shouldBlockUncategorized({ labels: ['area:uncategorized'] }, true)).toBe(false);
  });

  test('null info (gh unavailable) is best-effort: never blocked, even without bypass', () => {
    expect(shouldBlockUncategorized(null, false)).toBe(false);
  });
});

describe('claim.js parseArgs() -- #1151 --allow-uncategorized lane bypass', () => {
  test('--allow-uncategorized sets opts.allowUncategorized true', () => {
    expect(parseArgs(['239', '--allow-uncategorized']).allowUncategorized).toBe(true);
  });

  test('--no-lane-check is an accepted alias', () => {
    expect(parseArgs(['239', '--no-lane-check']).allowUncategorized).toBe(true);
  });

  test('opts.allowUncategorized defaults to false', () => {
    expect(parseArgs(['239']).allowUncategorized).toBe(false);
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

describe('claim.js findLiveWorktreeForIssue() -- #629 live-worktree guard', () => {
  test('returns null for empty entries', () => {
    expect(findLiveWorktreeForIssue([], 42)).toBeNull();
  });

  test('returns null when issue not present', () => {
    const entries = [{ branch: 'apple/issue-99-foo', fruit: 'apple', issue: 99 }];
    expect(findLiveWorktreeForIssue(entries, 42)).toBeNull();
  });

  test('returns the entry when issue matches', () => {
    const entry = { branch: 'apple/issue-42-foo', fruit: 'apple', issue: 42 };
    expect(findLiveWorktreeForIssue([entry], 42)).toBe(entry);
  });

  test('returns first match when multiple entries share the issue number', () => {
    const e1 = { branch: 'apple/issue-42-a', fruit: 'apple', issue: 42 };
    const e2 = { branch: 'banana/issue-42-b', fruit: 'banana', issue: 42 };
    expect(findLiveWorktreeForIssue([e1, e2], 42)).toBe(e1);
  });

  test('non-matching entries do not interfere', () => {
    const entries = [
      { branch: 'apple/issue-1-a', fruit: 'apple', issue: 1 },
      { branch: 'banana/issue-42-b', fruit: 'banana', issue: 42 },
      { branch: 'cherry/issue-99-c', fruit: 'cherry', issue: 99 },
    ];
    expect(findLiveWorktreeForIssue(entries, 42)).toEqual(entries[1]);
  });
});

// #796: the live-worktree guard interacts with --dry-run. When a live worktree
// exists for the target issue and --dry-run is active, the guard must warn but
// NOT die — so the WOULD CLAIM banner is still emitted. --force has the same
// bypass effect. These exercise the extracted pure seam shouldBlockWorktreeGuard().
describe('claim.js shouldBlockWorktreeGuard() -- #796 dry-run + live-worktree guard', () => {
  const liveEntry = { branch: 'apple/issue-42-foo', fruit: 'apple', issue: 42 };

  test('--dry-run with existing worktree: guard does not block', () => {
    expect(shouldBlockWorktreeGuard(liveEntry, { dryRun: true, force: false })).toBe(false);
  });

  test('--force with existing worktree: guard does not block', () => {
    expect(shouldBlockWorktreeGuard(liveEntry, { dryRun: false, force: true })).toBe(false);
  });

  test('neither flag set with existing worktree: guard blocks', () => {
    expect(shouldBlockWorktreeGuard(liveEntry, { dryRun: false, force: false })).toBe(true);
  });

  test('null existingWt: guard never blocks regardless of flags', () => {
    expect(shouldBlockWorktreeGuard(null, { dryRun: false, force: false })).toBe(false);
  });

  test('both --dry-run and --force set: guard does not block', () => {
    expect(shouldBlockWorktreeGuard(liveEntry, { dryRun: true, force: true })).toBe(false);
  });
});

describe('claim.js parseArgs() -- #796 --dry-run flag', () => {
  test('--dry-run sets opts.dryRun true', () => {
    expect(parseArgs(['123', '--dry-run']).dryRun).toBe(true);
  });

  test('opts.dryRun defaults to false', () => {
    expect(parseArgs(['123']).dryRun).toBe(false);
  });
});
