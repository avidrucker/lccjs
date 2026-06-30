'use strict';

// Unit tests for the pure classifier seam of scripts/audit-closes.js (#1234) —
// detect closed issues whose comments lack a *timely* `error self-audit:` line
// (RULES.md R021 / #1117). No gh, no network: classifyClose() takes plain issue
// data and returns a status. The gh-fetching CLI wrapper is verified manually
// against #1169 (late → flagged) and a compliant close (ok → not flagged).

const { classifyClose, isViolation } = require('../../scripts/audit-closes.js');

const CLOSED = '2026-06-13T20:03:31Z';
function c(body, createdAt) {
  return { body, createdAt };
}

describe('classifyClose — status derivation', () => {
  test('ok: audit line in the same comment as the close marker, at close time', () => {
    const issue = {
      number: 1217,
      title: 'compliant close',
      closedAt: CLOSED,
      comments: [c('Closed in deadbeef1234.\n\nerror self-audit: 1 row logged (#395).', '2026-06-13T20:03:40Z')],
    };
    const r = classifyClose(issue);
    expect(r.status).toBe('ok');
    expect(isViolation(r)).toBe(false);
  });

  test('ok: audit line in a SEPARATE comment posted minutes after close (same session)', () => {
    const issue = {
      number: 103,
      title: 'separate-but-prompt',
      closedAt: CLOSED,
      comments: [
        c('Closed in deadbeef.', '2026-06-13T20:03:40Z'),
        c('error self-audit: no loggable errors this session.', '2026-06-13T20:05:00Z'),
      ],
    };
    expect(classifyClose(issue).status).toBe('ok');
  });

  test('late: audit line present but only ~12h after close (the #1169 repro)', () => {
    const issue = {
      number: 1169,
      title: 'late backfill',
      closedAt: CLOSED,
      comments: [
        c('Closed in 4d76416.', '2026-06-13T20:03:52Z'),
        c('error self-audit (late): 3 rows backfilled.', '2026-06-14T08:27:43Z'),
      ],
    };
    const r = classifyClose(issue);
    expect(r.status).toBe('late');
    expect(isViolation(r)).toBe(true);
  });

  test('missing: backtick-wrapped sha "Closed in `7727ca0`" still counts as a puzzle close (#1530 repro)', () => {
    const issue = {
      number: 1530,
      title: 'backtick sha',
      closedAt: CLOSED,
      comments: [c('Closed in `7727ca0` (on `main`).\n\nAdded a thing. No audit line.', '2026-06-13T20:03:40Z')],
    };
    const r = classifyClose(issue);
    expect(r.status).toBe('missing');
    expect(isViolation(r)).toBe(true);
  });

  test('no false close-match: "Closed in favor of #123" is NOT a puzzle close', () => {
    const issue = {
      number: 123,
      title: 'dup phrasing',
      closedAt: CLOSED,
      comments: [c('Closed in favor of #123 — superseded.', '2026-06-13T20:03:40Z')],
    };
    expect(classifyClose(issue).status).toBe('no-close-comment');
  });

  test('missing: a puzzle close (has "Closed in <sha>") but no audit line anywhere', () => {
    const issue = {
      number: 999,
      title: 'no audit line',
      closedAt: CLOSED,
      comments: [c('Closed in cafef00d.\n\nDid the work, no self-audit line.', '2026-06-13T20:03:40Z')],
    };
    const r = classifyClose(issue);
    expect(r.status).toBe('missing');
    expect(isViolation(r)).toBe(true);
  });

  test('no-close-comment: closed without a "Closed in <sha>" comment (likely dup/wontfix) is NOT a violation', () => {
    const issue = {
      number: 500,
      title: 'duplicate, closed via gh',
      closedAt: CLOSED,
      comments: [c('Duplicate of #123.', '2026-06-13T20:03:40Z')],
    };
    const r = classifyClose(issue);
    expect(r.status).toBe('no-close-comment');
    expect(isViolation(r)).toBe(false);
  });

  test('no-close-comment: closed silently with no comments at all', () => {
    const issue = { number: 501, title: 'silent', closedAt: CLOSED, comments: [] };
    expect(classifyClose(issue).status).toBe('no-close-comment');
  });

  test('grace window is configurable: a 30-min-late line is ok at default grace but late at --grace-min 5', () => {
    const issue = {
      number: 700,
      title: 'thirty min later',
      closedAt: CLOSED,
      comments: [
        c('Closed in abc1234.', '2026-06-13T20:03:40Z'),
        c('error self-audit: 0 rows.', '2026-06-13T20:33:31Z'),
      ],
    };
    expect(classifyClose(issue, { graceMinutes: 60 }).status).toBe('ok');
    expect(classifyClose(issue, { graceMinutes: 5 }).status).toBe('late');
  });

  test('case-insensitive: "Error Self-Audit:" still counts as the line', () => {
    const issue = {
      number: 800,
      title: 'caps',
      closedAt: CLOSED,
      comments: [c('Closed in abc1234.\n\nError Self-Audit: none.', '2026-06-13T20:03:45Z')],
    };
    expect(classifyClose(issue).status).toBe('ok');
  });

  test('unparseable timestamps do not throw and do not false-flag (treated as timely)', () => {
    const issue = {
      number: 900,
      title: 'bad dates',
      closedAt: 'not-a-date',
      comments: [c('Closed in abc1234.', 'also-bad'), c('error self-audit: x', 'nope')],
    };
    expect(() => classifyClose(issue)).not.toThrow();
    expect(classifyClose(issue).status).toBe('ok');
  });
});
