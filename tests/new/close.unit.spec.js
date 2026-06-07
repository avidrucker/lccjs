'use strict';

const {
  parseArgs, classifyPushError, shouldCleanup, classifyRebaseConflict,
  claimRefDeleteCommand, classifyClaimRefDelete,
  isVelocityCsvOnlyConflict,
  README_LEARNINGS, isReadmeLearningsConflict, resolveReadmeConflict,
  DEFAULT_MAX_RETRIES, UNION_FILES, VELOCITY_CSV, KEYWORD_STOP_SET,
  extractTicketFromCsvDiff, extractRowsFromCsvDiff, velocityTicketMismatch,
  computeVelocityMismatch,
  extractKeywords, keywordsOverlap,
  velocityRowExists, markerStillPresent,
  bodyClosesIssue,
  findParentTrackers,
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

  test('--skip-keyword-check sets skipKeywordCheck (default false, #311)', () => {
    expect(parseArgs(['311']).skipKeywordCheck).toBe(false);
    expect(parseArgs(['311', '--skip-keyword-check']).skipKeywordCheck).toBe(true);
  });

  test('--branch sets branch (default null, #379)', () => {
    expect(parseArgs(['379']).branch).toBe(null);
    expect(parseArgs(['379', '--branch', 'lemon/issue-379-fig']).branch).toBe('lemon/issue-379-fig');
  });

  test('--skip-scope-audit sets skipScopeAudit (default false, #671)', () => {
    expect(parseArgs(['671']).skipScopeAudit).toBe(false);
    expect(parseArgs(['671', '--skip-scope-audit']).skipScopeAudit).toBe(true);
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

describe('close.js isReadmeLearningsConflict()', () => {
  test('learnings README alone → true (append-only, auto-resolvable)', () => {
    expect(isReadmeLearningsConflict([README_LEARNINGS])).toBe(true);
  });

  test('learnings README + velocity CSV → true (both auto-resolvable)', () => {
    expect(isReadmeLearningsConflict([README_LEARNINGS, VELOCITY_CSV])).toBe(true);
  });

  test('learnings README + a source file → false (human-resolvable)', () => {
    expect(isReadmeLearningsConflict([README_LEARNINGS, 'src/core/assembler.js'])).toBe(false);
  });

  test('velocity CSV alone → true (subset of the auto-resolvable set)', () => {
    // CSV-only is caught earlier by isVelocityCsvOnlyConflict(); this predicate
    // still classifies it as auto-resolvable so the ordering in tryLand() is the
    // only thing that routes it to the re-export path.
    expect(isReadmeLearningsConflict([VELOCITY_CSV])).toBe(true);
  });

  test('the top-level repo README is NOT the learnings README → false', () => {
    expect(isReadmeLearningsConflict(['README.md'])).toBe(false);
  });

  test('empty array → false', () => {
    expect(isReadmeLearningsConflict([])).toBe(false);
  });

  test('null / undefined → false', () => {
    expect(isReadmeLearningsConflict(null)).toBe(false);
    expect(isReadmeLearningsConflict(undefined)).toBe(false);
  });

  test('path strings are trimmed before comparison', () => {
    expect(isReadmeLearningsConflict([`  ${README_LEARNINGS}  `])).toBe(true);
  });

  test('README_LEARNINGS constant matches the actual index path', () => {
    expect(README_LEARNINGS).toBe('docs/learnings/README.md');
  });
});

describe('close.js resolveReadmeConflict()', () => {
  const fs   = require('fs');
  const os   = require('os');
  const path = require('path');

  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-readme-conflict-'));
  });
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const write = (text) => {
    const f = path.join(tmpDir, 'README.md');
    fs.writeFileSync(f, text, 'utf8');
    return f;
  };
  const read = (f) => fs.readFileSync(f, 'utf8');

  test('strips conflict markers and keeps BOTH appended rows (the real case)', () => {
    const f = write([
      '| Doc | Date | Agent | Themes |',
      '| --- | --- | --- | --- |',
      '| [older](./a.md) | 2026-06-05 | APPLE | x |',
      '<<<<<<< HEAD',
      '| [mine](./b.md) | 2026-06-06 | DRAGONFRUIT | y |',
      '=======',
      '| [theirs](./c.md) | 2026-06-06 | CHERRY | z |',
      '>>>>>>> 1a2b3c4',
      '',
    ].join('\n'));
    resolveReadmeConflict(f);
    expect(read(f)).toBe([
      '| Doc | Date | Agent | Themes |',
      '| --- | --- | --- | --- |',
      '| [older](./a.md) | 2026-06-05 | APPLE | x |',
      '| [mine](./b.md) | 2026-06-06 | DRAGONFRUIT | y |',
      '| [theirs](./c.md) | 2026-06-06 | CHERRY | z |',
      '',
    ].join('\n'));
  });

  test('collapses two identical appended rows to one (dedup safety net)', () => {
    const f = write([
      '| [older](./a.md) | 2026-06-05 | APPLE | x |',
      '<<<<<<< HEAD',
      '| [same](./b.md) | 2026-06-06 | FIG | y |',
      '=======',
      '| [same](./b.md) | 2026-06-06 | FIG | y |',
      '>>>>>>> 1a2b3c4',
    ].join('\n'));
    resolveReadmeConflict(f);
    expect(read(f)).toBe([
      '| [older](./a.md) | 2026-06-05 | APPLE | x |',
      '| [same](./b.md) | 2026-06-06 | FIG | y |',
    ].join('\n'));
  });

  test('preserves blank lines elsewhere in the file (no whole-file dedup)', () => {
    const f = write([
      '# Learnings',
      '',
      'Intro paragraph.',
      '',
      '## Index',
      '',
      '| [older](./a.md) | 2026-06-05 | APPLE | x |',
      '<<<<<<< HEAD',
      '| [mine](./b.md) | 2026-06-06 | GRAPE | y |',
      '=======',
      '| [theirs](./c.md) | 2026-06-06 | BANANA | z |',
      '>>>>>>> 1a2b3c4',
      '',
    ].join('\n'));
    resolveReadmeConflict(f);
    expect(read(f)).toBe([
      '# Learnings',
      '',
      'Intro paragraph.',
      '',
      '## Index',
      '',
      '| [older](./a.md) | 2026-06-05 | APPLE | x |',
      '| [mine](./b.md) | 2026-06-06 | GRAPE | y |',
      '| [theirs](./c.md) | 2026-06-06 | BANANA | z |',
      '',
    ].join('\n'));
  });

  test('handles the diff3 base marker (|||||||) — empty base for an append', () => {
    const f = write([
      '| [older](./a.md) | 2026-06-05 | APPLE | x |',
      '<<<<<<< HEAD',
      '| [mine](./b.md) | 2026-06-06 | DRAGONFRUIT | y |',
      '||||||| merged common ancestor',
      '=======',
      '| [theirs](./c.md) | 2026-06-06 | ELDERBERRY | z |',
      '>>>>>>> 1a2b3c4',
    ].join('\n'));
    resolveReadmeConflict(f);
    expect(read(f)).toBe([
      '| [older](./a.md) | 2026-06-05 | APPLE | x |',
      '| [mine](./b.md) | 2026-06-06 | DRAGONFRUIT | y |',
      '| [theirs](./c.md) | 2026-06-06 | ELDERBERRY | z |',
    ].join('\n'));
  });

  test('a clean file with no markers is left unchanged', () => {
    const original = [
      '| [a](./a.md) | 2026-06-05 | APPLE | x |',
      '| [b](./b.md) | 2026-06-06 | CHERRY | y |',
      '',
    ].join('\n');
    const f = write(original);
    resolveReadmeConflict(f);
    expect(read(f)).toBe(original);
  });
});

describe('close.js extractKeywords() — Guard 2 tokenizer', () => {
  test('returns lowercase words of length ≥4', () => {
    expect(extractKeywords('Guard close check')).toEqual(['guard', 'close', 'check']);
  });

  test('strips punctuation and symbols — hyphen, dot, slash', () => {
    expect(extractKeywords('puzzle-velocity.csv migration')).toEqual(['puzzle', 'velocity', 'migration']);
  });

  test('filters words shorter than 4 chars', () => {
    expect(extractKeywords('add the fix')).toEqual([]);
  });

  test('filters stop-set words (research, data, writer, spike, architect)', () => {
    expect(extractKeywords('research into data migration')).toEqual(['migration']);
    expect(extractKeywords('writer spike architect')).toEqual([]);
  });

  test('filters pure numbers (year, issue IDs)', () => {
    expect(extractKeywords('TIL 2026 session 311 notes')).toEqual(['session', 'notes']);
  });

  test('empty string returns empty array', () => {
    expect(extractKeywords('')).toEqual([]);
  });

  test('null/undefined coerced safely', () => {
    expect(extractKeywords(null)).toEqual([]);
    expect(extractKeywords(undefined)).toEqual([]);
  });

  test('custom stopSet overrides the default', () => {
    expect(extractKeywords('close migration', new Set(['migration']))).toEqual(['close']);
  });

  test('KEYWORD_STOP_SET is exported and is a Set', () => {
    expect(KEYWORD_STOP_SET).toBeInstanceOf(Set);
    expect(KEYWORD_STOP_SET.has('research')).toBe(true);
    expect(KEYWORD_STOP_SET.has('data')).toBe(true);
  });

  // FC-2 (#649): short technical acronyms that matter to this project bypass the
  // 4-char floor via an explicit allowlist, so titles like "fix CLI arg" are
  // checkable rather than tokenizing to [] and triggering a false-block.
  test('FC-2: short technical acronym "cli" is retained by project allowlist (#649)', () => {
    expect(extractKeywords('fix CLI arg')).toContain('cli');
  });

  test('FC-2: "api" and "lcc" are retained by project allowlist (#649)', () => {
    expect(extractKeywords('update LCC api docs')).toContain('lcc');
    expect(extractKeywords('update LCC api docs')).toContain('api');
  });
});

describe('close.js keywordsOverlap() — Guard 2 decision', () => {
  test('returns true when ≥1 word in common', () => {
    expect(keywordsOverlap(['migration', 'model'], ['velocity', 'migration'])).toBe(true);
  });

  test('returns false when no words in common', () => {
    expect(keywordsOverlap(['migration', 'model'], ['cherry', 'hardening'])).toBe(false);
  });

  test('returns false for empty title words', () => {
    expect(keywordsOverlap([], ['migration'])).toBe(false);
  });

  test('returns false for empty subject words', () => {
    expect(keywordsOverlap(['migration'], [])).toBe(false);
  });

  test('returns false when both empty', () => {
    expect(keywordsOverlap([], [])).toBe(false);
  });

  test('null arrays handled safely', () => {
    expect(keywordsOverlap(null, null)).toBe(false);
    expect(keywordsOverlap(null, ['migration'])).toBe(false);
    expect(keywordsOverlap(['migration'], null)).toBe(false);
  });

  // The #278 failure case: TIL commit accidentally closing a data-migration ticket.
  // This is the canonical motivating example from the closed-issue audit (#294).
  test('#278 failure: TIL-CHERRY subject vs model-column-migration title → no overlap', () => {
    const titleWords = extractKeywords(
      'Data: complete + document the model column migration in puzzle-velocity.csv'
    );
    const subjectWords = extractKeywords(
      'TIL 2026-05-30 CHERRY s3 — close-sequence hardening'
    );
    expect(keywordsOverlap(titleWords, subjectWords)).toBe(false);
  });

  // Guard 2 true positive: a genuine close with shared keywords passes naturally.
  test('genuine close: Guard 2 commit vs Guard 2 issue title → overlap', () => {
    const titleWords = extractKeywords(
      'DEV: Guard 2 — issue-title keyword spot-check in close.js'
    );
    const subjectWords = extractKeywords(
      'feat(close): Guard 2 — issue-title keyword spot-check'
    );
    expect(keywordsOverlap(titleWords, subjectWords)).toBe(true);
  });

  // False-positive cases from Finding 4 of audit #294. These require
  // --skip-keyword-check; confirmed here that they produce no overlap so the flag
  // is necessary for each, rather than relying on a coincidental keyword match.
  test('#215 false-positive: retroactive tracker close has no natural overlap', () => {
    // issue title: "velocity log no-ticket gap"; commit: "cross-link cluster ..."
    // Both share no ≥4-char non-stop-set word → guard fires → needs --skip
    const titleWords = extractKeywords('velocity logging for issueless PM rows');
    const subjectWords = extractKeywords('cross-link cluster identity issues');
    expect(keywordsOverlap(titleWords, subjectWords)).toBe(false);
  });

  // Guard 2 fallback (#645): content-free close marker commits ("chore: close #N")
  // produce no overlap with any substantive title. The fallback scans all unpushed
  // subjects so the work commit's vocabulary saves the check.
  test('#645 fallback: "chore: close #N" produces no overlap (documents the problem)', () => {
    const titleWords = extractKeywords(
      'DEV: Guard 2 fallback — scan all unpushed subjects when closing commit is content-free'
    );
    const closeMarkerWords = extractKeywords('chore: close #645');
    expect(keywordsOverlap(titleWords, closeMarkerWords)).toBe(false);
  });

  test('#645 fallback: work commit subject overlaps title (fallback succeeds)', () => {
    const titleWords = extractKeywords(
      'DEV: Guard 2 fallback — scan all unpushed subjects when closing commit is content-free'
    );
    const workSubjectWords = extractKeywords(
      'fix(close): Guard 2 fallback — scan unpushed subjects for content-free close markers'
    );
    expect(keywordsOverlap(titleWords, workSubjectWords)).toBe(true);
  });

  // FC-3 (#650): paraphrased commit subjects — synonym pairs that share no unigram
  // overlap. Guard 2 fires on these and --skip-keyword-check is the correct bypass.
  // Tests confirm no accidental keyword match saves them, documenting the known gap.
  test('FC-3: "collate" vs "enumerate" — synonymous verbs, no common keywords', () => {
    const titleWords = extractKeywords('RESEARCH: collate timestamp drift samples from CSV rows');
    const subjectWords = extractKeywords('research: enumerate elapsed anomalies found in puzzle logs');
    expect(keywordsOverlap(titleWords, subjectWords)).toBe(false);
  });

  test('FC-3: "reduce" vs "eliminate" — synonymous verbs, no common keywords', () => {
    const titleWords = extractKeywords('DEV: reduce prompt overhead in workflow tooling');
    const subjectWords = extractKeywords('fix: eliminate dialog friction from agent scripts');
    expect(keywordsOverlap(titleWords, subjectWords)).toBe(false);
  });

  test('FC-3: "failure modes" vs "breakdowns" — synonymous nouns, no common keywords', () => {
    const titleWords = extractKeywords('RESEARCH: collate failure modes from session notes');
    const subjectWords = extractKeywords('research: enumerate observed breakdowns in puzzle logs');
    expect(keywordsOverlap(titleWords, subjectWords)).toBe(false);
  });

  // FC-2 (#649): Guard 2 passes for a title whose only discriminating word is a
  // short technical acronym — "cli" survives extractKeywords via the allowlist and
  // then overlaps with the commit subject that also references cli.
  test('FC-2: "fix CLI arg" title overlaps a commit that references CLI (#649)', () => {
    const titleKws = extractKeywords('fix CLI arg');
    const subjectKws = extractKeywords('fix: Guard 2 false-block on cli short-keyword titles');
    expect(keywordsOverlap(titleKws, subjectKws)).toBe(true);
  });
});

// Guard 1 fix (#346): extractRowsFromCsvDiff returns {ticket, agent}[] so
// checkVelocityTicketMatch can ignore concurrent agents' rows.
describe('close.js extractRowsFromCsvDiff() — Guard 1 fix (#346)', () => {
  const row = (ticket, agent, model = '') =>
    `+1,${ticket},title,DEV,30,,,,,,,,,notes,${agent},${model}`;

  test('single row → [{ticket, agent}]', () => {
    expect(extractRowsFromCsvDiff(row(311, 'DRAGONFRUIT', 'claude-sonnet-4-6')))
      .toEqual([{ ticket: 311, agent: 'DRAGONFRUIT' }]);
  });

  test('two rows from different agents → both returned', () => {
    const diff = [row(330, 'ELDERBERRY', 'sonnet-4.6'), row(311, 'DRAGONFRUIT', 'claude-sonnet-4-6')].join('\n');
    expect(extractRowsFromCsvDiff(diff)).toEqual([
      { ticket: 330, agent: 'ELDERBERRY' },
      { ticket: 311, agent: 'DRAGONFRUIT' },
    ]);
  });

  test('the #346 repro: concurrent row is present but filtered by caller', () => {
    // Closing agent is DRAGONFRUIT (#311); ELDERBERRY (#330) is concurrent.
    const diff = [row(330, 'ELDERBERRY'), row(311, 'DRAGONFRUIT')].join('\n');
    const rows = extractRowsFromCsvDiff(diff);
    const myRows = rows.filter((r) => r.agent.toLowerCase() === 'dragonfruit');
    expect(velocityTicketMismatch(myRows.map((r) => r.ticket), '311')).toEqual([]);
  });

  test('own-agent mismatch still fires after filtering', () => {
    // DRAGONFRUIT logged ticket 279 but is closing 278 — Guard 1 must still fire.
    const diff = [row(330, 'ELDERBERRY'), row(279, 'DRAGONFRUIT')].join('\n');
    const rows = extractRowsFromCsvDiff(diff);
    const myRows = rows.filter((r) => r.agent.toLowerCase() === 'dragonfruit');
    expect(velocityTicketMismatch(myRows.map((r) => r.ticket), '278')).toEqual([279]);
  });

  test('agent with empty model (trailing comma) is extracted correctly', () => {
    expect(extractRowsFromCsvDiff('+1,311,title,DEV,,,,,,,,,,,BANANA,'))
      .toEqual([{ ticket: 311, agent: 'BANANA' }]);
  });

  test('commas inside notes do not corrupt agent extraction', () => {
    expect(extractRowsFromCsvDiff('+1,311,title,DEV,,,,,,,,,,"a, b, c",CHERRY,'))
      .toEqual([{ ticket: 311, agent: 'CHERRY' }]);
  });

  test('no agent/model columns → agent is some non-empty string that will not match a real branch agent', () => {
    // Old rows missing agent/model: the regex finds whatever word-pair is at the
    // end. The result won't match any real branch agent name, so such rows are
    // filtered out by checkVelocityTicketMatch — correct degraded behaviour.
    const rows = extractRowsFromCsvDiff('+1,304,title,DEV');
    // The row IS parsed (ticket extracted), just agent is unreliable for old rows.
    expect(rows).toHaveLength(1);
    expect(rows[0].ticket).toBe(304);
  });

  test('empty/null/undefined diff → []', () => {
    expect(extractRowsFromCsvDiff('')).toEqual([]);
    expect(extractRowsFromCsvDiff(null)).toEqual([]);
    expect(extractRowsFromCsvDiff(undefined)).toEqual([]);
  });

  test('+++ header line is ignored', () => {
    const diff = '+++ b/docs/puzzle-velocity.csv\n' + row(311, 'DRAGONFRUIT');
    expect(extractRowsFromCsvDiff(diff)).toEqual([{ ticket: 311, agent: 'DRAGONFRUIT' }]);
  });
});

// Guard 1 (#361 fix): computeVelocityMismatch — ticket-first attribution.
// The #346 agent-filter assumed velocity row agent == branch-prefix fruit.
// When terminal-name convention diverges from that (e.g. row says "CHERRY",
// branch says "banana"), the filter picks up a concurrent BANANA row for a
// different ticket and ignores the correct CHERRY row → false-positive mismatch.
// Fix: any added row for the correct ticket passes immediately; the agent-filter
// fallback only runs when no correct-ticket row is present (catches #278 transposition).
describe('close.js computeVelocityMismatch() — Guard 1 #361 fix', () => {
  const mkRow = (ticket, agent) => ({ ticket, agent });

  test('#361 repro: concurrent BANANA/#357 + closer CHERRY/#317 → pass (branch=banana)', () => {
    // Exact scenario from the #317 close that triggered the bug.
    const rows = [mkRow(357, 'BANANA'), mkRow(317, 'CHERRY')];
    expect(computeVelocityMismatch(rows, '317', 'banana')).toEqual([]);
  });

  test('#278 transposition still fires: closer logged wrong ticket, no correct-ticket row', () => {
    // DRAGONFRUIT logged #279 but is closing #278 — Guard 1 must still catch this.
    const rows = [mkRow(279, 'DRAGONFRUIT')];
    expect(computeVelocityMismatch(rows, '278', 'dragonfruit')).toEqual([279]);
  });

  test('correct-ticket row from any agent passes — agent identity does not matter', () => {
    // Even if closingAgent is something else entirely, a row for the right ticket passes.
    const rows = [mkRow(317, 'CHERRY')];
    expect(computeVelocityMismatch(rows, '317', 'dragonfruit')).toEqual([]);
  });

  test('no rows at all → pass (nothing to check; row-presence is a separate guard)', () => {
    expect(computeVelocityMismatch([], '317', 'banana')).toEqual([]);
    expect(computeVelocityMismatch(null, '317', 'banana')).toEqual([]);
  });

  test('only concurrent rows for a different ticket, closer has no rows → pass silently', () => {
    // Concurrent BANANA logged #357; closer CHERRY logged nothing.
    // closingAgent is 'cherry' — no rows match → myRows = [] → no mismatch.
    const rows = [mkRow(357, 'BANANA')];
    expect(computeVelocityMismatch(rows, '317', 'cherry')).toEqual([]);
  });

  test('CLAUDE_AGENT_NAME path: closingAgent=CHERRY filters correctly when env agent matches row', () => {
    // When CLAUDE_AGENT_NAME=CHERRY is passed as closingAgent, the correct row
    // is found both via the ticket-first shortcut AND via agent filtering.
    const rows = [mkRow(357, 'BANANA'), mkRow(317, 'CHERRY')];
    expect(computeVelocityMismatch(rows, '317', 'CHERRY')).toEqual([]);
  });

  test('no closingAgent (null) → all rows checked; fires on any mismatch', () => {
    // Pre-#346 fallback: no agent identity → check all rows.
    const rows = [mkRow(279, 'DRAGONFRUIT')];
    expect(computeVelocityMismatch(rows, '278', null)).toEqual([279]);
  });

  test('multiple rows: correct-ticket row among mismatches → pass (correct row present)', () => {
    // Closer has correct row (#317); also has a spurious row for #318 (unusual).
    // The correct row's presence is sufficient to pass.
    const rows = [mkRow(317, 'CHERRY'), mkRow(318, 'CHERRY')];
    expect(computeVelocityMismatch(rows, '317', 'cherry')).toEqual([]);
  });
});

// ─── Check A: velocityRowExists() (#359) ─────────────────────────────────────

describe('close.js velocityRowExists() — Check A (#359)', () => {
  let db;
  beforeEach(() => {
    // In-memory DB with the minimal velocity schema needed for the check.
    const Database = require('better-sqlite3');
    db = new Database(':memory:');
    db.exec('CREATE TABLE velocity (id INTEGER PRIMARY KEY, ticket INTEGER)');
  });
  afterEach(() => db.close());

  test('returns true when a row for the ticket exists', () => {
    db.prepare('INSERT INTO velocity (ticket) VALUES (?)').run(359);
    expect(velocityRowExists(db, 359)).toBe(true);
  });

  test('returns false when no row for the ticket exists', () => {
    db.prepare('INSERT INTO velocity (ticket) VALUES (?)').run(100);
    expect(velocityRowExists(db, 359)).toBe(false);
  });

  test('returns false on an empty table', () => {
    expect(velocityRowExists(db, 1)).toBe(false);
  });

  test('matches by integer value — string ticket coerced correctly', () => {
    db.prepare('INSERT INTO velocity (ticket) VALUES (?)').run(42);
    expect(velocityRowExists(db, Number('42'))).toBe(true);
  });

  test('does not match a different ticket', () => {
    db.prepare('INSERT INTO velocity (ticket) VALUES (?)').run(100);
    db.prepare('INSERT INTO velocity (ticket) VALUES (?)').run(200);
    expect(velocityRowExists(db, 300)).toBe(false);
  });
});

// ─── Check B: markerStillPresent() (#359) ────────────────────────────────────

describe('close.js markerStillPresent() — Check B (#359)', () => {
  test('finds a @todo marker', () => {
    const out = 'scripts/close.js:42:  // @todo #359:30/DEV fix the thing';
    const { found, lines } = markerStillPresent('359', out);
    expect(found).toBe(true);
    expect(lines).toHaveLength(1);
  });

  test('finds an @inprogress marker', () => {
    const out = 'scripts/claim.js:10:  // @inprogress #359:30/DEV fixing';
    const { found, lines } = markerStillPresent('359', out);
    expect(found).toBe(true);
    expect(lines[0]).toMatch(/@inprogress/);
  });

  test('returns found=false when grep output is empty (no matches)', () => {
    expect(markerStillPresent('359', '').found).toBe(false);
    expect(markerStillPresent('359', null).found).toBe(false);
    expect(markerStillPresent('359', undefined).found).toBe(false);
  });

  test('does not match a different issue number', () => {
    const out = 'src/foo.js:5: // @todo #100:20/DEV something else';
    expect(markerStillPresent('359', out).found).toBe(false);
  });

  test('case-insensitive on todo/inprogress keyword', () => {
    expect(markerStillPresent('359', 'src/x.js:1: @TODO #359:10/DEV').found).toBe(true);
    expect(markerStillPresent('359', 'src/x.js:1: @InProgress #359:10/DEV').found).toBe(true);
  });

  test('does not match issue number appearing mid-word (word boundary)', () => {
    // #3590 should not match #359
    const out = 'src/x.js:1: // @todo #3590:10/DEV other issue';
    expect(markerStillPresent('359', out).found).toBe(false);
  });

  test('returns all matched lines when multiple markers present', () => {
    const out = [
      'src/a.js:1: // @todo #359:10/DEV',
      'src/b.js:2: // @inprogress #359:20/DEV',
    ].join('\n');
    const { found, lines } = markerStillPresent('359', out);
    expect(found).toBe(true);
    expect(lines).toHaveLength(2);
  });
});

describe('close.js deferred teardown warning (#551)', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require.resolve('../../scripts/close.js'), 'utf8');

  test('spawn stdio is not "ignore" — stderr is inherited so the warning can reach the terminal', () => {
    // stdio: 'ignore' discards all output including the warning echo; must use an array.
    const spawnBlock = src.slice(src.indexOf('spawn(\'bash\''));
    expect(spawnBlock).not.toMatch(/stdio:\s*'ignore'/);
    expect(spawnBlock).toMatch(/stdio:\s*\[/);
  });

  test('shell command includes a warning echo on teardown failure', () => {
    const spawnBlock = src.slice(src.indexOf('spawn(\'bash\''));
    expect(spawnBlock).toMatch(/\|\|\s*echo.*deferred teardown may have failed/);
  });
});

describe('close.js velocity CSV conflict-resolution source guard (#503)', () => {
  // Regression: when close.js is invoked via --branch from the main checkout,
  // __dirname resolves to the main scripts/ dir, so velocity-export.js's
  // isMainCheckout() sees .git as a directory and silently skips the export
  // (exits 0). The auto-resolve must pass --force to bypass that guard.
  test('velocity-export.js is invoked with --force in the conflict-resolution block', () => {
    const fs = require('fs');
    const src = fs.readFileSync(require.resolve('../../scripts/close.js'), 'utf8');
    // Capture the conflict-resolution block — the re-export call and its immediate context.
    const block = src.slice(src.indexOf('isVelocityCsvOnlyConflict'), src.indexOf('log(\'velocity CSV conflict auto-resolved'));
    // velocity-export.js path is on one line; --force is on the next shCapture line.
    expect(block).toMatch(/velocity-export/);
    expect(block).toMatch(/shCapture\(`node[^`]*--force`\)/);
  });
});

// bodyClosesIssue() (#619): multi-commit close detection. The standard velocity
// protocol produces two commits before push — fix commit (Closes #N) then a
// separate velocity CSV commit — so close.js must scan the full unpushed set,
// not just HEAD, to find the closing keyword.
describe('close.js bodyClosesIssue() — multi-commit close detection (#619)', () => {
  test('single commit body with Closes #N → true', () => {
    expect(bodyClosesIssue('fix: fix the close bug\n\nCloses #619\n', '619')).toBe(true);
  });

  // Canonical #619 repro: velocity commit is HEAD, fix commit is one below.
  // Concatenated bodies from git log origin/main..HEAD contain the close keyword.
  test('#619 repro: velocity commit body then fix commit body concatenated → true', () => {
    const bodies = [
      'data(velocity): log #619 DEV close-scan fix\n\n',
      'fix: close.js — scan unpushed set for Closes #N, not just HEAD\n\nCloses #619\n',
    ].join('\n');
    expect(bodyClosesIssue(bodies, '619')).toBe(true);
  });

  test('only velocity commit body, no Closes #N → false', () => {
    expect(bodyClosesIssue('data(velocity): log #619 DEV close-scan fix', '619')).toBe(false);
  });

  test('GitHub close keyword variants are accepted', () => {
    expect(bodyClosesIssue('CLOSES #619', '619')).toBe(true);
    expect(bodyClosesIssue('Fixed #619', '619')).toBe(true);
    expect(bodyClosesIssue('Resolves #619', '619')).toBe(true);
    expect(bodyClosesIssue('close #619', '619')).toBe(true);
    expect(bodyClosesIssue('resolve #619', '619')).toBe(true);
  });

  test('wrong issue number → false', () => {
    expect(bodyClosesIssue('Closes #620', '619')).toBe(false);
  });

  test('issue number appearing mid-word does not match (word boundary)', () => {
    // #6190 must not satisfy a search for #619
    expect(bodyClosesIssue('Closes #6190', '619')).toBe(false);
  });

  test('empty / null / undefined → false', () => {
    expect(bodyClosesIssue('', '619')).toBe(false);
    expect(bodyClosesIssue(null, '619')).toBe(false);
    expect(bodyClosesIssue(undefined, '619')).toBe(false);
  });
});

// findParentTrackers() (#907): pure scan for open trackers with unchecked boxes
// referencing a just-closed issue.
describe('close.js findParentTrackers() — parent-tracker checklist scan (#907)', () => {
  test('empty issue list → []', () => {
    expect(findParentTrackers([], 42)).toEqual([]);
  });

  test('null/undefined list → []', () => {
    expect(findParentTrackers(null, 42)).toEqual([]);
    expect(findParentTrackers(undefined, 42)).toEqual([]);
  });

  test('tracker body has unchecked box referencing the issue → match returned', () => {
    const issues = [{ number: 100, body: '- [ ] close #42\n- [x] #41' }];
    expect(findParentTrackers(issues, 42)).toEqual([
      { trackerNumber: 100, line: '- [ ] close #42' },
    ]);
  });

  test('already-checked box [x] is ignored', () => {
    const issues = [{ number: 100, body: '- [x] already done #42' }];
    expect(findParentTrackers(issues, 42)).toEqual([]);
  });

  test('word boundary: #420 does not match issue 42', () => {
    const issues = [{ number: 100, body: '- [ ] tracker item #420' }];
    expect(findParentTrackers(issues, 42)).toEqual([]);
  });

  test('word boundary: #42 matches exactly within longer line text', () => {
    const issues = [{ number: 100, body: '- [ ] see ticket #42 for details' }];
    expect(findParentTrackers(issues, 42)).toEqual([
      { trackerNumber: 100, line: '- [ ] see ticket #42 for details' },
    ]);
  });

  test('no reference to the issue at all → []', () => {
    const issues = [{ number: 200, body: '- [ ] unrelated item\n- [ ] another #99' }];
    expect(findParentTrackers(issues, 42)).toEqual([]);
  });

  test('multiple trackers both referencing the issue → both returned', () => {
    const issues = [
      { number: 10, body: '- [ ] sub-task #42' },
      { number: 20, body: '## Checklist\n- [ ] item #42\n- [ ] item #43' },
    ];
    const result = findParentTrackers(issues, 42);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ trackerNumber: 10, line: '- [ ] sub-task #42' });
    expect(result[1]).toEqual({ trackerNumber: 20, line: '- [ ] item #42' });
  });

  test('one tracker body with multiple unchecked boxes for the same issue → all returned', () => {
    const issues = [
      { number: 50, body: '- [ ] part A #42\n- [ ] part B #42' },
    ];
    const result = findParentTrackers(issues, 50);
    // issue 50 is being searched, but no reference to #50 in the body
    // (the lines reference #42, not the search target)
    expect(result).toEqual([]);
  });

  test('body with unchecked box referencing issue number as a string argument', () => {
    const issues = [{ number: 300, body: '- [ ] fix #907 now' }];
    expect(findParentTrackers(issues, '907')).toEqual([
      { trackerNumber: 300, line: '- [ ] fix #907 now' },
    ]);
  });

  test('issue with null/undefined body does not throw', () => {
    const issues = [
      { number: 1, body: null },
      { number: 2, body: undefined },
      { number: 3, body: '- [ ] valid #42' },
    ];
    expect(findParentTrackers(issues, 42)).toEqual([
      { trackerNumber: 3, line: '- [ ] valid #42' },
    ]);
  });

  test('--update-trackers flag parsed correctly by parseArgs', () => {
    const opts = parseArgs(['99', '--update-trackers']);
    expect(opts.updateTrackers).toBe(true);
  });

  test('updateTrackers defaults to false when flag absent', () => {
    const opts = parseArgs(['99']);
    expect(opts.updateTrackers).toBe(false);
  });

  // multi-ref guard (#944): a line with >1 issue refs must be detected so scanParentTrackers
  // can skip auto-edit and fall back to hint-only output.
  describe('multi-issue-ref detection on matched line (#944)', () => {
    test('single-ref line: one issue number → not multi-ref', () => {
      const line = '- [ ] close the batch #42';
      const refs = (line.match(/#\d+/g) || []);
      expect(refs.length).toBe(1);
    });

    test('multi-ref line: two issue numbers → detected as multi-ref', () => {
      const line = '- [ ] batch — #42, #43';
      const refs = (line.match(/#\d+/g) || []);
      expect(refs.length).toBeGreaterThan(1);
    });

    test('multi-ref line: six issue numbers (real-world case from #944)', () => {
      const line = '- [ ] B — batch 2 — #932, #931, #930, #928, #927, #926';
      const refs = (line.match(/#\d+/g) || []);
      expect(refs.length).toBe(6);
    });

    test('findParentTrackers returns a multi-ref line as-is so the caller can inspect it', () => {
      const issues = [
        { number: 938, body: '- [ ] B — batch 2 — #932, #931, #930\n- [ ] done #999' },
      ];
      const result = findParentTrackers(issues, 932);
      expect(result).toHaveLength(1);
      expect(result[0].line).toBe('- [ ] B — batch 2 — #932, #931, #930');
      // Callers use line.match(/#\d+/g).length > 1 to skip auto-edit
      expect((result[0].line.match(/#\d+/g) || []).length).toBeGreaterThan(1);
    });

    test('findParentTrackers returns single-ref line that can safely auto-edit', () => {
      const issues = [
        { number: 100, body: '- [ ] close this #42' },
      ];
      const result = findParentTrackers(issues, 42);
      expect(result).toHaveLength(1);
      expect((result[0].line.match(/#\d+/g) || []).length).toBe(1);
    });
  });
});

// Claim-ref deletion on close (#1039). Pure seams only — the git push lives in
// deleteClaimRef()'s `|| true` runner, which by construction cannot abort the close.
describe('close.js claimRefDeleteCommand()', () => {
  test('emits the deleting refspec for the issue (normal close)', () => {
    expect(claimRefDeleteCommand(1039)).toBe('git push origin :refs/claims/issue-1039');
  });
  // The command is issue-keyed, identical under --keep (the wiring runs it before
  // the --keep early-return), so the emitted delete is the same in both modes.
  test('same command regardless of --keep (issue-keyed, not mode-keyed)', () => {
    expect(claimRefDeleteCommand(42)).toBe('git push origin :refs/claims/issue-42');
  });
});

describe('close.js classifyClaimRefDelete() — idempotent, never aborts', () => {
  test('[deleted] → DELETED', () => {
    expect(classifyClaimRefDelete(' - [deleted]         refs/claims/issue-1039')).toBe('DELETED');
  });
  test('clean/empty exit → DELETED', () => {
    expect(classifyClaimRefDelete('')).toBe('DELETED');
    expect(classifyClaimRefDelete(null)).toBe('DELETED');
  });
  // A missing ref (already deleted / never staked) is NOT a failure.
  test('remote ref does not exist → ABSENT (idempotent)', () => {
    expect(classifyClaimRefDelete("error: unable to delete 'refs/claims/issue-1039': remote ref does not exist")).toBe('ABSENT');
  });
  // Offline / auth / unknown → WARN (the close continues; never a hard fail).
  test('offline/unknown → WARN', () => {
    expect(classifyClaimRefDelete('fatal: Could not resolve host: github.com')).toBe('WARN');
    expect(classifyClaimRefDelete('some unrecognised git output')).toBe('WARN');
  });
});
