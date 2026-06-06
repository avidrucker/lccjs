# RESEARCH: close.js README conflict — auto-resolve docs/learnings/README.md (#928)

**Date:** 2026-06-06  
**Agent:** DRAGONFRUIT  
**Parent:** #928

---

## Summary

`docs/learnings/README.md` is a purely append-only markdown index table. When two
agents close TIL tickets concurrently, both append a new row — producing a trivially
resolvable rebase conflict that `close.js` nevertheless aborts on. This doc answers
the five research questions posed in the issue and delivers a minimal implementation
sketch for the follow-up DEV ticket.

---

## Evidence reviewed

- `close.js` — conflict classification logic (`classifyRebaseConflict`,
  `isVelocityCsvOnlyConflict`, `tryLand`)
- `.gitattributes` — `merge=union` coverage (only `docs/puzzle-clusters.csv` has it)
- `docs/learnings/README.md` — table structure (one `| Doc | Date | Agent | Themes |`
  row per TIL, appended at the end of the file)
- Errors table (`~/.lccjs/lccjs.db`, `errors` table): all GIT_FAIL rows with
  `conflicting_files` mentioning README

---

## Q1: Does the velocity CSV auto-resolve path generalise to `docs/learnings/README.md`?

**Yes, with a straightforward extension.**

The velocity CSV auto-resolve works because there is an authoritative SQLite source
(`lccjs.db`) that holds both agents' rows — re-exporting it gives the correct merged
result without touching the conflict markers at all.

`docs/learnings/README.md` has no SQLite backing, but it doesn't need one. Every
conflict in this file has the same shape:

```
<<<<<<< HEAD
| [TIL from agent A](./...) | 2026-06-05 | AGENT_A | themes |
=======
| [TIL from agent B](./...) | 2026-06-05 | AGENT_B | themes |
>>>>>>> <sha>
```

The correct resolution is to keep both rows. A function that:
1. reads the file,
2. strips lines starting with `<<<<<<<`, `=======`, and `>>>>>>>`, and
3. deduplicates exact-duplicate lines (safety net)

...produces the correct merged result. This is the minimal change.

**Implementation sketch** (~30 lines added to `close.js`):

```js
const README_LEARNINGS = 'docs/learnings/README.md';

// Returns true if every conflicted path is the README or the velocity CSV —
// both auto-resolvable without human intervention.
function isReadmeLearningsConflict(paths) {
  const list = (paths || []).filter(Boolean);
  return list.length > 0 && list.every(
    (p) => p === README_LEARNINGS || p === VELOCITY_CSV
  );
}

// Strip git conflict markers; keep both sides' appended lines. Deduplicates
// exact-duplicate lines in case two agents wrote an identical row.
function resolveReadmeConflict(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const filtered = lines.filter(
    (l) => !l.startsWith('<<<<<<<') && !l.startsWith('=======') && !l.startsWith('>>>>>>>')
  );
  const seen = new Set();
  const deduped = filtered.filter((l) => {
    if (seen.has(l)) return false;
    seen.add(l);
    return true;
  });
  fs.writeFileSync(filePath, deduped.join('\n'), 'utf8');
}
```

Wire `isReadmeLearningsConflict` in `tryLand()` after the existing CSV-only branch,
sharing the same 3-step pattern: resolve → `git add` → `git rebase --continue`. The
velocity CSV re-export sub-path runs if the CSV is *also* conflicted.

---

## Q2: Are there other append-only files that hit this abort pattern?

**From the errors table (all GIT_FAIL rows):**

| id | agent | ticket | conflicting_files |
|----|-------|--------|------------------|
| 3  | GRAPE | 920    | `docs/learnings/README.md`, `docs/puzzle-velocity.csv` |
| 5  | FIG   | 919    | `docs/learnings/README.md`, `docs/puzzle-velocity.csv` |
| 6  | FIG   | 919    | `docs/learnings/README.md` (second attempt) |
| 9  | ELDERBERRY | 924 | `docs/puzzle-velocity.csv` only |
| 22 | CHERRY | 934  | `docs/puzzle-velocity.csv` only |

**Conclusion:** only `docs/learnings/README.md` and `docs/puzzle-velocity.csv`
appear in the conflict history. No other files.

`docs/puzzle-clusters.csv` has `merge=union` in `.gitattributes` and auto-resolves
natively — it has never appeared in the errors table. The velocity CSV was removed
from `merge=union` at #290 (replaced by the SQLite re-export path in close.js).

---

## Q3: Is union-merge the right strategy, or does the markdown table require a smarter merge?

**Union-merge (strip-markers approach) is correct and sufficient.**

The README table is purely append-only — every commit adds exactly one row at the
bottom. No row is ever edited in place. The conflict is always "A appended X,
B appended Y, both at the same location at the bottom of the table." Both rows
must survive.

A smarter parse-and-deduplicate (e.g. parsing `| doc-link |` as a primary key)
is not necessary because:
- Each row's doc-link is unique by construction (file name includes date + agent name)
- The table has no foreign-key relationships that could corrupt

The strip-markers + exact-line-dedup approach handles all real cases.

---

## Q4: What is the failure mode if two agents append identical rows?

**A duplicate row appears in the table.** The naive union-merge keeps both copies
of an identical line, producing two identical `| ... |` rows. This is cosmetically
wrong but not data-destroying.

In practice, true identical rows are impossible: each TIL row links to a unique
file (`today-i-learned-YYYY-MM-DD-<agent>.md`) and includes the agent name.
Two agents cannot produce an identical row unless they share both the same date
and the same agent name — which the claim system prevents.

The dedup step (`seen.has(l)`) in the sketch above eliminates identical lines
as a safety net, adding zero overhead for the normal case.

---

## Q5: Could `npm run close` retry automatically after auto-resolving the README conflict, instead of aborting?

**Yes, and this is already the pattern for the velocity CSV.**

The velocity CSV path already does this: resolve → `git add VELOCITY_CSV` →
`git rebase --continue`. The same 3-step pattern applies to README.md. No
structural changes to `tryLand()` are needed; the new branch just runs the
README resolution steps before calling `git rebase --continue`.

The combined case (README + CSV both conflicted) resolves both before continuing:

```
1. strip markers + dedup → git add docs/learnings/README.md
2. velocity-export.js --force → git add docs/puzzle-velocity.csv
3. GIT_EDITOR=true git rebase --continue
```

---

## Recommended follow-up

File a DEV ticket to implement `isReadmeLearningsConflict` + `resolveReadmeConflict`
in `close.js` and wire them into `tryLand()`. Estimated H: 30m, C: 20m. Should also
add a unit test that verifies the conflict-marker-stripping logic on a fixture that
mimics a real README conflict.
