'use strict';

const {
  parseArgs, classifyPushError, shouldCleanup, classifyRebaseConflict,
  DEFAULT_MAX_RETRIES, UNION_FILES,
} = require('../../scripts/close');

describe('close.js classifyPushError()', () => {
  // The #200 incident message — "[remote rejected]" prefix does NOT indicate abort;
  // only the parenthetical reason matters. Race signals checked first per the
  // implementation's ordering rationale.
  test('cannot lock ref → race (the #200 incident signature)', () => {
    const msg = "! [remote rejected] HEAD -> main (cannot lock ref 'refs/heads/main': is at abc but expected def)";
    expect(classifyPushError(msg)).toBe('race');
  });

  test('non-fast-forward → race', () => {
    expect(classifyPushError('! [rejected] HEAD -> main (non-fast-forward)')).toBe('race');
  });

  test('fetch first → race', () => {
    const msg = [
      'Updates were rejected because the remote contains work that you do not have locally.',
      '! [rejected] refs/heads/main -> main (fetch first)',
    ].join('\n');
    expect(classifyPushError(msg)).toBe('race');
  });

  test('tip of your current branch is behind → race', () => {
    const msg = 'error: failed to push some refs\nhint: tip of your current branch is behind its remote counterpart';
    expect(classifyPushError(msg)).toBe('race');
  });

  test('[rejected] without a more specific reason → race (regex matches the token)', () => {
    expect(classifyPushError('! [rejected] HEAD -> main (some generic reason)')).toBe('race');
  });

  test('pre-push hook block → rejected-other (PDD gate failure)', () => {
    const msg = '[pre-push] BLOCKED: PDD scan FAILED\nerror: failed to push some refs';
    expect(classifyPushError(msg)).toBe('rejected-other');
  });

  test('server-side protected branch → rejected-other', () => {
    const msg = 'remote: error: GH006: Protected branch update failed for refs/heads/main';
    expect(classifyPushError(msg)).toBe('rejected-other');
  });

  test('authentication failure → rejected-other', () => {
    const msg = "error: Authentication failed for 'https://github.com/owner/repo.git'";
    expect(classifyPushError(msg)).toBe('rejected-other');
  });

  test('empty string → rejected-other (unrecognized; do not loop blindly)', () => {
    expect(classifyPushError('')).toBe('rejected-other');
  });

  test('null → rejected-other (coerced to empty string by String())', () => {
    expect(classifyPushError(null)).toBe('rejected-other');
  });

  test('undefined → rejected-other', () => {
    expect(classifyPushError(undefined)).toBe('rejected-other');
  });
});

describe('close.js shouldCleanup()', () => {
  test('onOriginMain true → cleanup permitted', () => {
    expect(shouldCleanup({ onOriginMain: true })).toBe(true);
  });

  test('onOriginMain false → cleanup blocked', () => {
    expect(shouldCleanup({ onOriginMain: false })).toBe(false);
  });

  test('onOriginMain undefined → cleanup blocked (=== true required)', () => {
    expect(shouldCleanup({ onOriginMain: undefined })).toBe(false);
  });

  test('onOriginMain null → cleanup blocked', () => {
    expect(shouldCleanup({ onOriginMain: null })).toBe(false);
  });

  test('empty object → cleanup blocked', () => {
    expect(shouldCleanup({})).toBe(false);
  });
});

describe('close.js classifyRebaseConflict()', () => {
  test('empty array → none', () => {
    expect(classifyRebaseConflict([])).toBe('none');
  });

  test('null → none', () => {
    expect(classifyRebaseConflict(null)).toBe('none');
  });

  test('undefined → none', () => {
    expect(classifyRebaseConflict(undefined)).toBe('none');
  });

  test('cluster CSV (union file) alone → union-only', () => {
    expect(classifyRebaseConflict(['docs/puzzle-clusters.csv'])).toBe('union-only');
  });

  test('velocity CSV is no longer a union file (#290 removed merge=union) → blocking', () => {
    expect(classifyRebaseConflict(['docs/puzzle-velocity.csv'])).toBe('blocking');
  });

  test('a source file → blocking', () => {
    expect(classifyRebaseConflict(['src/core/assembler.js'])).toBe('blocking');
  });

  test('README.md (non-union doc) → blocking', () => {
    expect(classifyRebaseConflict(['README.md'])).toBe('blocking');
  });

  test('two non-union files → blocking', () => {
    expect(classifyRebaseConflict(['docs/puzzle-velocity.csv', 'README.md'])).toBe('blocking');
  });

  test('custom unionFiles arg overrides the UNION_FILES default', () => {
    expect(classifyRebaseConflict(['custom/log.csv'], ['custom/log.csv'])).toBe('union-only');
  });

  test('path strings are trimmed before comparison', () => {
    expect(classifyRebaseConflict(['  docs/puzzle-clusters.csv  '])).toBe('union-only');
  });

  test('UNION_FILES matches .gitattributes — only puzzle-clusters.csv (velocity CSV removed in #290)', () => {
    expect(UNION_FILES).toContain('docs/puzzle-clusters.csv');
    expect(UNION_FILES).not.toContain('docs/puzzle-velocity.csv');
  });
});

describe('close.js parseArgs()', () => {
  test('parses the issue number', () => {
    expect(parseArgs(['267'])).toMatchObject({ issue: '267' });
  });

  test('--dry-run sets dryRun (default false)', () => {
    expect(parseArgs(['267']).dryRun).toBe(false);
    expect(parseArgs(['267', '--dry-run']).dryRun).toBe(true);
  });

  test('--keep sets keep (default false)', () => {
    expect(parseArgs(['267']).keep).toBe(false);
    expect(parseArgs(['267', '--keep']).keep).toBe(true);
  });

  test('--max overrides the default retry count', () => {
    expect(parseArgs(['267', '--max', '3']).max).toBe(3);
  });

  test('invalid --max falls back to DEFAULT_MAX_RETRIES', () => {
    expect(parseArgs(['267', '--max', 'abc']).max).toBe(DEFAULT_MAX_RETRIES);
  });

  test('--max defaults to DEFAULT_MAX_RETRIES', () => {
    expect(parseArgs(['267']).max).toBe(DEFAULT_MAX_RETRIES);
  });

  test('--no-verify-issue sets verifyIssue false (default true)', () => {
    expect(parseArgs(['267']).verifyIssue).toBe(true);
    expect(parseArgs(['267', '--no-verify-issue']).verifyIssue).toBe(false);
  });
});
