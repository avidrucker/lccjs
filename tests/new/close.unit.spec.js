'use strict';

const {
  parseArgs, classifyPushError, shouldCleanup, classifyRebaseConflict,
  isVelocityCsvOnlyConflict,
  DEFAULT_MAX_RETRIES, UNION_FILES, VELOCITY_CSV, KEYWORD_STOP_SET,
  extractTicketFromCsvDiff, extractRowsFromCsvDiff, velocityTicketMismatch,
  computeVelocityMismatch,
  extractKeywords, keywordsOverlap,
  velocityRowExists, markerStillPresent,
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
