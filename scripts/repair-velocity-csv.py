#!/usr/bin/env python3
"""Repair 4 malformed rows in docs/puzzle-velocity.csv.

Fixes:
  Line 121: #157 duplicate (misattributed original) — DROP
  Line 123: #157 (corrected version) — re-encode backslash-escaping -> quote-doubling
  Line 124: #271 — re-encode backslash-escaping -> quote-doubling
  Any row with ticket=275 and 15 fields: remove extra empty field (15 -> 14)
"""
import csv, os
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SRC  = REPO / 'docs' / 'puzzle-velocity.csv'
TMP  = SRC.with_suffix('.csv.tmp')

DROP_LINE = 121  # 1-indexed: misattributed #157 duplicate


def reparse_backslash(line):
    """Re-parse a row written with escapechar='\\'.

    Python's csv.reader with escapechar='\\' treats \\" as a literal quote
    (not a field terminator) and \\\\ as a literal backslash — the inverse
    of how these rows were written. Returns a 13- or 14-element list.
    """
    row = next(csv.reader([line], escapechar='\\'))
    if len(row) in (13, 14):
        return row
    # escapechar parse still over-split (e.g. a bare comma inside the notes
    # that followed a \\": rejoin the middle fragments.
    # Layout: [0..10] = ticket..closed_commit (11 fields), [-2] = agent, [-1] = model
    notes = ','.join(row[11:-2])
    agent = row[-2]
    model = row[-1] if len(row) > 13 else ''
    fixed = list(row[:11]) + [notes, agent, model]
    assert len(fixed) in (13, 14), \
        f'Still wrong after rejoin: {len(fixed)} fields (line content: {line[:80]!r})'
    return fixed


with SRC.open(newline='') as f:
    lines = f.read().splitlines()

out_rows = []
repairs = 0

for i, line in enumerate(lines, 1):
    # DROP the misattributed #157 duplicate
    if i == DROP_LINE:
        print(f'  DROP  line {i}: #157 duplicate (misattribution; keeping line 123)')
        repairs += 1
        continue

    # Standard parse first
    row = next(csv.reader([line]))

    # Backslash-escaped rows: re-parse with escapechar dialect
    if len(row) not in (13, 14) and i > 1 and ('\\"' in line or '\\\\' in line):
        print(f'  FIX   line {i}: backslash-escape ({len(row)} fields -> ', end='')
        row = reparse_backslash(line)
        print(f'{len(row)} fields)')
        repairs += 1

    # #275 row: one extra empty field (15 -> 14)
    if len(row) == 15 and i > 1 and row[0] == '275':
        print(f'  FIX   line {i}: #275 extra empty field (15 -> 14)')
        # columns 5-11 are all empty (actual_min..closed_commit) — 7 when should be 6
        # remove index 11 (the extra slot before notes at index 12)
        row = row[:11] + row[12:]
        repairs += 1

    if i > 1 and len(row) not in (13, 14):
        print(f'  WARN  line {i}: {len(row)} fields after repair — needs manual check')

    out_rows.append(row)

with TMP.open('w', newline='') as f:
    w = csv.writer(f, quoting=csv.QUOTE_MINIMAL, lineterminator='\n')
    w.writerows(out_rows)

os.replace(TMP, SRC)
print(f'\nDone: {repairs} repair(s), {len(out_rows) - 1} data rows in {SRC}')
