const fs = require('fs');
const path = require('path');

// Integrity guards for the shared velocity log (docs/puzzle-velocity.csv).
// Filed as #217 after a botched CRLF-normalisation (commit d2ff450) both left a
// stray CRLF on the #210 row AND appended a byte-identical duplicate — and
// merge=union cannot dedup a CRLF-vs-LF pair, so it would recur. These two
// invariants are cheap to assert and catch the whole failure class.
describe('docs/puzzle-velocity.csv integrity', () => {
  const csvPath = path.join(__dirname, '..', '..', 'docs', 'puzzle-velocity.csv');
  const raw = fs.readFileSync(csvPath, 'utf8');

  test('is LF-only — no carriage returns (csv.writer CRLF trap, #217)', () => {
    const crLines = raw
      .split('\n')
      .map((line, i) => [i + 1, line])
      .filter(([, line]) => line.includes('\r'))
      .map(([n]) => n);
    expect(crLines).toEqual([]);
  });

  test('has no byte-identical duplicate rows (the #210 double-log, #217)', () => {
    const seen = new Map();
    const dups = [];
    raw.split('\n').forEach((line, i) => {
      if (line === '') return; // ignore blank / trailing lines
      if (seen.has(line)) dups.push({ firstLine: seen.get(line) + 1, dupLine: i + 1, head: line.slice(0, 24) });
      else seen.set(line, i);
    });
    expect(dups).toEqual([]);
  });
});
