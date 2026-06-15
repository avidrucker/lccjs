'use strict';

const { preflightEvidence } = require('../../scripts/preflight');

// Pure evidence-surfacing seam for `npm run preflight <issue>` (#1131, follow-up
// to #1122). From the issue text (body + comments) and a candidate file list, it
// returns the in-repo evidence paths — docs/logs/<N>-* and docs/research/<N>-* —
// for every #N the issue references, so an investigator reads a captured work log
// before reconstructing a story from git/gh. main()'s readdir + gh reads are not
// under test here — only this decision seam (mirrors preflightIssueGate).
describe('preflight.js preflightEvidence()', () => {
  test('surfaces a docs/logs file whose prefix matches a referenced #N', () => {
    const text = 'references #1076 in the body';
    const files = ['docs/logs/1076-honeydew-ticket-work-log.md'];
    expect(preflightEvidence(text, files)).toEqual([
      'docs/logs/1076-honeydew-ticket-work-log.md',
    ]);
  });

  // The whole reason the match is prefix-anchored: a substring match would make
  // #76 spuriously surface 1076-*.md. The convention is <N>-slug.md.
  test('does NOT over-match — #76 must not surface 1076-*.md', () => {
    const text = 'this issue references #76 only';
    const files = ['docs/logs/1076-honeydew-ticket-work-log.md'];
    expect(preflightEvidence(text, files)).toEqual([]);
  });

  // The #1122 repro: body references #1121 (research) and #1076 (log); both dirs
  // are scanned, results deduped and sorted. Mirrors the issue's own example.
  test('scans both docs/logs and docs/research, deduped and sorted', () => {
    const text = '## Notes\nFollow-up from #1121. See log for #1076 and #1076 again.';
    const files = [
      'docs/research/1121-research-findings-honeydew-review.md',
      'docs/logs/1076-honeydew-ticket-work-log.md',
      'docs/research/2000-unrelated.md',
    ];
    expect(preflightEvidence(text, files)).toEqual([
      'docs/logs/1076-honeydew-ticket-work-log.md',
      'docs/research/1121-research-findings-honeydew-review.md',
    ]);
  });

  test('ignores files outside docs/logs and docs/research', () => {
    const text = 'references #1131';
    const files = [
      'scripts/preflight.js',
      'docs/1131-loose.md',
      'docs/logs/sub/1131-nested.md',
    ];
    expect(preflightEvidence(text, files)).toEqual([]);
  });

  test('no refs / empty / null inputs → [] (offline-tolerant, never throws)', () => {
    expect(preflightEvidence('no refs here', ['docs/logs/1076-x.md'])).toEqual([]);
    expect(preflightEvidence('', [])).toEqual([]);
    expect(preflightEvidence(null, null)).toEqual([]);
    expect(preflightEvidence('#1076', undefined)).toEqual([]);
  });
});
