'use strict';

// Unit tests for the pure helpers in scripts/ice-score.js (#965). These functions
// were untestable before the module exported them and gated main() behind
// `require.main === module`; importing the module now has no side effects.
//
// Covers the scoring formula, the tiebreaker direction, tier/score sorting,
// the ease-band boundaries, and CSV round-tripping (the latter doubles as the
// regression test for the parseCsv quoting bug fixed in #964).

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const {
  computeIce, finalScore, sortRows, rankRows, easeFromEhrs,
  parseCsv, encodeField, deriveAutoScore,
} = require('../../scripts/ice-score.js');

const lbl = (...names) => names.map(name => ({ name }));

describe('computeIce', () => {
  test('applies I*C*E (higher Ease ⇒ higher score)', () => {
    expect(computeIce(2, 0.8, 5)).toBe(8);      // 2 * 0.8 * 5
    expect(computeIce(3, 1.0, 10)).toBe(30);    // 3 * 1   * 10
    expect(computeIce(0.25, 0.5, 1)).toBe(0.125);
    expect(computeIce(1, 0.8, 7)).toBe(5.6);    // 1 * 0.8 * 7
  });
  test('a higher-ease task outscores an otherwise-equal harder one (#1327)', () => {
    // Same Impact & Confidence: ease must RAISE the score, not lower it.
    expect(computeIce(1, 1, 10)).toBeGreaterThan(computeIce(1, 1, 1));
  });
  test('rounds to 4 decimal places', () => {
    // Math.round(x*10000)/10000 caps precision (a safety net for non-discrete inputs).
    expect(computeIce(1 / 3, 1, 1)).toBe(0.3333);
  });
});

describe('deriveAutoScore (label-derived provisional inputs, #1322)', () => {
  test('I tracks severity label', () => {
    expect(deriveAutoScore(lbl('severity:high')).I).toBe(2);
    expect(deriveAutoScore(lbl('severity:medium')).I).toBe(1);
    expect(deriveAutoScore(lbl('severity:low')).I).toBe(0.5);
  });
  test('C is a neutral 0.8 (labels cannot reveal confidence)', () => {
    expect(deriveAutoScore(lbl('bug', 'severity:high')).C).toBe(0.8);
  });
  test('E is a coarse ease guess from the type label', () => {
    expect(deriveAutoScore(lbl('documentation')).E).toBe(7); // docs/chore = easy
    expect(deriveAutoScore(lbl('research')).E).toBe(3);      // research/spike = hard
    expect(deriveAutoScore(lbl('enhancement')).E).toBe(5);   // default = moderate
  });
  test('no labels → safe defaults (I=1 medium, C=0.8, E=5)', () => {
    expect(deriveAutoScore([])).toEqual({ I: 1, C: 0.8, E: 5 });
    expect(deriveAutoScore(undefined)).toEqual({ I: 1, C: 0.8, E: 5 });
  });
});

describe('finalScore tiebreaker', () => {
  test('adds a tiny issue-derived term so earlier issues win ties', () => {
    expect(finalScore(0.1, 1)).toBeGreaterThan(finalScore(0.1, 2));
  });
  test('the tiebreaker is too small to flip a genuinely higher score', () => {
    // A higher ICE on a later issue still outranks a lower ICE on issue 1.
    expect(finalScore(0.2, 9999)).toBeGreaterThan(finalScore(0.1, 1));
  });
});

describe('sortRows', () => {
  test('orders critical → elevated → normal, then by finalScore desc', () => {
    const rows = [
      { issue: 10, tier: '',         ice_score: 0.5 },
      { issue: 20, tier: 'critical', ice_score: 0.1 },
      { issue: 30, tier: 'elevated', ice_score: 0.2 },
      { issue: 40, tier: '',         ice_score: 0.9 },
    ];
    expect(sortRows(rows).map(r => r.issue)).toEqual([20, 30, 40, 10]);
  });
  test('within the same tier/score, the lower issue number sorts first', () => {
    const rows = [
      { issue: 9, tier: '', ice_score: 0.3 },
      { issue: 5, tier: '', ice_score: 0.3 },
    ];
    expect(sortRows(rows).map(r => r.issue)).toEqual([5, 9]);
  });
  test('does not mutate its input', () => {
    const rows = [{ issue: 2, tier: '', ice_score: 0.1 }, { issue: 1, tier: 'critical', ice_score: 0.1 }];
    const snapshot = rows.map(r => r.issue);
    sortRows(rows);
    expect(rows.map(r => r.issue)).toEqual(snapshot);
  });
});

describe('rankRows', () => {
  test('assigns 1-based ice_rank in sorted order', () => {
    const rows = [
      { issue: 10, tier: '',         ice_score: 0.5 },
      { issue: 20, tier: 'critical', ice_score: 0.1 },
    ];
    const ranked = rankRows(rows);
    expect(ranked.map(r => [r.issue, r.ice_rank])).toEqual([[20, 1], [10, 2]]);
  });
});

describe('easeFromEhrs band boundaries', () => {
  test.each([
    [0.10, 10], [0.25, 7], [0.50, 5], [0.75, 3], [1.00, 1],
  ])('eHrs %p → Ease %p (inclusive upper edge)', (h, ease) => {
    expect(easeFromEhrs(h)).toBe(ease);
  });
  test.each([
    [0.11, 7], [0.26, 5], [0.51, 3], [0.76, 1],
  ])('eHrs %p just above a boundary → Ease %p', (h, ease) => {
    expect(easeFromEhrs(h)).toBe(ease);
  });
  test('blank / zero / non-numeric falls back to 0.5h → Ease 5', () => {
    expect(easeFromEhrs('')).toBe(5);
    expect(easeFromEhrs(0)).toBe(5);
    expect(easeFromEhrs('abc')).toBe(5);
  });
  test('accepts string inputs (CSV cells are strings)', () => {
    expect(easeFromEhrs('0.25')).toBe(7);
  });
});

describe('encodeField', () => {
  test('quotes fields containing comma, quote, or newline; doubles quotes', () => {
    expect(encodeField('decision,humans-only')).toBe('"decision,humans-only"');
    expect(encodeField('he said "hi"')).toBe('"he said ""hi"""');
    expect(encodeField('line1\nline2')).toBe('"line1\nline2"');
  });
  test('leaves plain fields untouched and maps null/undefined to empty', () => {
    expect(encodeField('plain')).toBe('plain');
    expect(encodeField(null)).toBe('');
    expect(encodeField(undefined)).toBe('');
  });
});

describe('parseCsv (quote-aware, regression for #964)', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ice-parsecsv-')); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  function write(contents) {
    const p = path.join(tmpDir, 'in.csv');
    fs.writeFileSync(p, contents);
    return p;
  }

  test('parses quoted comma fields without column shift', () => {
    const p = write([
      '# AUTO-GENERATED, has a comma in the comment',
      'issue,title,labels,notes',
      '689,Some title,"decision,humans-only",plain note',
    ].join('\n') + '\n');
    const rows = parseCsv(p);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      issue: '689',
      title: 'Some title',
      labels: 'decision,humans-only',
      notes: 'plain note',
    });
  });

  test('preserves empty fields between commas', () => {
    const p = write('issue,labels,notes\n700,,trailing\n');
    expect(parseCsv(p)[0]).toMatchObject({ issue: '700', labels: '', notes: 'trailing' });
  });

  test('decodes doubled-quote escapes', () => {
    const p = write('issue,title\n710,"Quoted ""x"" y"\n');
    expect(parseCsv(p)[0].title).toBe('Quoted "x" y');
  });

  test('round-trips encodeField output through parseCsv', () => {
    const values = ['decision,humans-only', 'he said "hi"', 'plain', 'a;b'];
    const p = write('val\n' + values.map(encodeField).join('\n') + '\n');
    expect(parseCsv(p).map(r => r.val)).toEqual(values);
  });

  test('skips comment and blank lines', () => {
    const p = write('# header comment\nissue,title\n\n1,one\n\n2,two\n');
    expect(parseCsv(p).map(r => r.issue)).toEqual(['1', '2']);
  });
});
