'use strict';

const {
  parseArgs, classifyPushError, shouldCleanup, classifyRebaseConflict,
  isVelocityCsvOnlyConflict,
  DEFAULT_MAX_RETRIES, UNION_FILES, VELOCITY_CSV,
  extractTicketFromCsvDiff, velocityTicketMismatch,
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

  test('velocity CSV is not a union file (#290 removed merge=union) → blocking from classifyRebaseConflict; tryLand() catches it earlier via isVelocityCsvOnlyConflict (#313)', () => {
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

  test('--skip-ticket-match sets skipTicketMatch (default false, #310)', () => {
    expect(parseArgs(['310']).skipTicketMatch).toBe(false);
    expect(parseArgs(['310', '--skip-ticket-match']).skipTicketMatch).toBe(true);
  });
});

// Guard 1 (#310): a full `git show HEAD -- docs/puzzle-velocity.csv` diff. The CSV
// is `id,ticket,title,role,...` with a `# AUTO-GENERATED` comment as its first
// physical line, so a fresh-file diff can carry BOTH that comment and the header.
const csvDiff = (...addedRows) => [
  'diff --git a/docs/puzzle-velocity.csv b/docs/puzzle-velocity.csv',
  'index 1111111..2222222 100644',
  '--- a/docs/puzzle-velocity.csv',
  '+++ b/docs/puzzle-velocity.csv',
  '@@ -160,3 +160,4 @@',
  ' 168,309,"prior row",RESEARCH,60,25,,,,,,,,CHERRY,', // context line (leading space)
  ...addedRows.map((r) => '+' + r),
].join('\n');

describe('close.js extractTicketFromCsvDiff() — Guard 1 parsing', () => {
  test('single added row → its ticket (column index 1)', () => {
    expect(extractTicketFromCsvDiff(csvDiff('170,304,"scope day-4",RESEARCH,30,12,6,,,,,,,CHERRY,')))
      .toEqual([304]);
  });

  test('multi-row → every added ticket, in order', () => {
    const diff = csvDiff(
      '170,304,"a",RESEARCH,30,12,,,,,,,,CHERRY,',
      '171,305,"b",DEV,30,20,,,,,,,,CHERRY,',
    );
    expect(extractTicketFromCsvDiff(diff)).toEqual([304, 305]);
  });

  test('no added data row → [] (not every close logs a velocity row)', () => {
    const diff = [
      'diff --git a/docs/puzzle-velocity.csv b/docs/puzzle-velocity.csv',
      '--- a/docs/puzzle-velocity.csv',
      '+++ b/docs/puzzle-velocity.csv',
      '@@ -160,2 +160,2 @@',
      ' 168,309,"unchanged",RESEARCH,,,,,,,,,,CHERRY,',
    ].join('\n');
    expect(extractTicketFromCsvDiff(diff)).toEqual([]);
  });

  test('the +++ file-header line is never parsed as a row', () => {
    // +++ b/docs/... would split to fields[1] === undefined; must be skipped.
    expect(extractTicketFromCsvDiff(csvDiff('170,304,"x",DEV,,,,,,,,,,CHERRY,')))
      .toEqual([304]);
  });

  test('the # AUTO-GENERATED comment line added on a fresh file is skipped', () => {
    const diff = [
      '+++ b/docs/puzzle-velocity.csv',
      '+# AUTO-GENERATED by scripts/velocity-export.js — do not edit directly. Source: db',
      '+id,ticket,title,role,h_min,c_min,actual_min',
      '+170,304,"first",RESEARCH,30,12,6',
    ].join('\n');
    expect(extractTicketFromCsvDiff(diff)).toEqual([304]); // comment + header dropped
  });

  test('the id,ticket,... header line is skipped (column 1 is non-numeric)', () => {
    expect(extractTicketFromCsvDiff('+id,ticket,title,role')).toEqual([]);
  });

  test('removed (-) and context ( ) lines are ignored', () => {
    const diff = [
      '-169,999,"deleted row",DEV,,,,,,,,,,CHERRY,',
      ' 168,309,"context",RESEARCH,,,,,,,,,,CHERRY,',
      '+170,304,"added",DEV,,,,,,,,,,CHERRY,',
    ].join('\n');
    expect(extractTicketFromCsvDiff(diff)).toEqual([304]);
  });

  test('commas inside later free-text fields do not shift the ticket column', () => {
    // notes column (late) full of commas; ticket is column 1, parsed before them.
    expect(extractTicketFromCsvDiff('+170,304,"t",DEV,30,12,6,,,,,,"a, b, c, d",CHERRY,'))
      .toEqual([304]);
  });

  test('whitespace around the ticket value is trimmed', () => {
    expect(extractTicketFromCsvDiff('+170, 304 ,"t",DEV')).toEqual([304]);
  });

  test('empty / null / undefined diff → []', () => {
    expect(extractTicketFromCsvDiff('')).toEqual([]);
    expect(extractTicketFromCsvDiff(null)).toEqual([]);
    expect(extractTicketFromCsvDiff(undefined)).toEqual([]);
  });
});

describe('close.js velocityTicketMismatch() — Guard 1 decision', () => {
  test('match: row ticket equals the issue → no mismatch', () => {
    expect(velocityTicketMismatch([304], '304')).toEqual([]);
  });

  test('mismatch: the #278/#279 transposition → the offending ticket', () => {
    expect(velocityTicketMismatch([279], '278')).toEqual([279]);
  });

  test('no row added → no mismatch (guard skips silently)', () => {
    expect(velocityTicketMismatch([], '304')).toEqual([]);
  });

  test('multi-row, all match → no mismatch', () => {
    expect(velocityTicketMismatch([304, 304], '304')).toEqual([]);
  });

  test('multi-row, one wrong → only the wrong one is reported', () => {
    expect(velocityTicketMismatch([304, 279], '304')).toEqual([279]);
  });

  test('issue passed as string matches a numeric ticket (Number coercion)', () => {
    expect(velocityTicketMismatch([310], '310')).toEqual([]);
  });

  test('null tickets → no mismatch (defensive)', () => {
    expect(velocityTicketMismatch(null, '304')).toEqual([]);
  });
});

describe('close.js isVelocityCsvOnlyConflict()', () => {
  test('velocity CSV alone → true (auto-resolvable by re-export)', () => {
    expect(isVelocityCsvOnlyConflict([VELOCITY_CSV])).toBe(true);
  });

  test('velocity CSV + another file → false (human-resolvable conflict)', () => {
    expect(isVelocityCsvOnlyConflict([VELOCITY_CSV, 'README.md'])).toBe(false);
  });

  test('a source file alone → false', () => {
    expect(isVelocityCsvOnlyConflict(['src/core/assembler.js'])).toBe(false);
  });

  test('cluster CSV (union file) alone → false (not the velocity CSV)', () => {
    expect(isVelocityCsvOnlyConflict(['docs/puzzle-clusters.csv'])).toBe(false);
  });

  test('empty array → false (no conflict at all)', () => {
    expect(isVelocityCsvOnlyConflict([])).toBe(false);
  });

  test('null → false', () => {
    expect(isVelocityCsvOnlyConflict(null)).toBe(false);
  });

  test('undefined → false', () => {
    expect(isVelocityCsvOnlyConflict(undefined)).toBe(false);
  });

  test('path strings are trimmed before comparison', () => {
    expect(isVelocityCsvOnlyConflict([`  ${VELOCITY_CSV}  `])).toBe(true);
  });

  test('VELOCITY_CSV constant matches the actual export path', () => {
    expect(VELOCITY_CSV).toBe('docs/puzzle-velocity.csv');
  });
});
