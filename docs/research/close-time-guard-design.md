# Close-time guard design — #301

**Agent:** BANANA · **Ticket:** #301 · **Parent:** #294 (audit), #266 (close.js)

## Scope

Design and decompose the two guards recommended in `docs/research/closed-issue-audit-2026-05-31.md`:

- **Guard 1** — velocity-row / `Closes #N` ticket-match check (HIGH ROI)
- **Guard 2** — issue-title keyword spot-check (MEDIUM ROI)

Both go into `scripts/close.js` as pre-flight checks — before the push loop, after the existing `headClosesIssue` check. If they fire, the commit is still local and can be amended without consequence.

---

## Guard 1 — velocity-row ticket-match check

### Decision: ACCEPT

The `#278` failure mode (digit transposition in `Closes #N` while the velocity row references the right ticket) is exactly what Guard 1 catches. The check is cheap, pure, and has near-zero false-positive risk — it only fires when the numbers actually differ.

### Implementation plan

**How to read the velocity row from the commit:**
Parse `git show HEAD -- docs/puzzle-velocity.csv` (the unified diff). Extract lines starting with `+` (not `+++`). Parse as CSV to get the `ticket` column value. This is self-contained — no DB access needed, and we know the CSV is always committed as part of the close commit (auto-exported by `velocity-log.js`).

**When to skip the check:**
- If no CSV row was added in HEAD → skip silently (some closes don't have a velocity row: very fast turns, retroactive tracker tickets). Guard 1 only fires when a row IS present.
- If multiple rows added → check all of them; any row with `ticket ≠ issue` → fail.
- New flag `--skip-ticket-match` bypasses the check explicitly.

**Where in close.js:**
After `headClosesIssue(issue)` passes (line ~285 in `main()`), add:

```js
if (!opts.skipTicketMatch) checkVelocityTicketMatch(issue);
```

`checkVelocityTicketMatch` is a pure function (takes issue string + CSV diff string) for unit-testability. The thin I/O wrapper (`git show HEAD -- docs/puzzle-velocity.csv`) lives in `main()`.

**Error UX:**
```
[close] ✗ velocity row ticket mismatch: the CSV row added in HEAD records ticket
         #279, but you are closing issue #278. Amend the commit (or the velocity
         row) to align them first. Pass --skip-ticket-match if intentional.
```

**New flag added to parseArgs:** `--skip-ticket-match`

**CSV parsing:** Use a minimal inline split (`,` delimiter, trim, no external dep) — the velocity CSV is machine-generated with no quoting or embedded commas in the ticket column.

---

## Guard 2 — issue-title keyword spot-check

### Decision: ACCEPT (with escape hatch)

The audit's Finding 4 showed 7 false positives out of 185 keyword-related closes (3.8%) — all legitimate. With `--skip-keyword-check`, those would need one flag but wouldn't fail silently. The `#278` failure would have been caught (zero overlap between "model column migration" and "TIL CHERRY s3 close-sequence hardening").

### Implementation plan

**How to get the issue title:**
`gh issue view N --json title -q .title` — already used later in close.js for the post-land state check. Move or duplicate the call to pre-flight.

**Keyword extraction:**
1. Tokenize the issue title and commit subject: split on non-word chars, lowercase.
2. Filter to words with length ≥ 4 (eliminates articles, pronouns, most short prepositions).
3. Also strip a small hardcoded stop-set: `['this', 'that', 'with', 'from', 'have', 'been', 'will', 'into', 'onto', 'also', 'when', 'then', 'than', 'what', 'where', 'which', 'writer', 'research', 'architect', 'spike', 'data']` — role prefixes and filler words that appear in titles but carry no discriminating signal.
4. Check if ≥1 word from the filtered title set appears in the filtered subject set.

**When to skip the check:**
- `gh` unavailable or `gh issue view` fails → skip with a warning (don't block the close over a network failure).
- New flag `--skip-keyword-check` bypasses explicitly.

**Where in close.js:**
After Guard 1, before the push loop:

```js
if (!opts.skipKeywordCheck) await checkKeywordMatch(issue);
```

Actually close.js is synchronous — keep it synchronous. `execSync` for the `gh` call, same as the rest of the file.

**Error UX:**
```
[close] ✗ keyword check: no word from issue #278 title
         ("Data: complete + document the model column migration in puzzle-velocity.csv")
         appears in commit subject
         ("TIL 2026-05-30 CHERRY s3 — close-sequence hardening").
         Is this the right issue? Pass --skip-keyword-check to override.
```

**New flag added to parseArgs:** `--skip-keyword-check`

**Pure seam:** `checkKeywordWords(title, subject, stopSet)` returns `{ titleWords, subjectWords, overlap, pass }` — unit-testable, no I/O. The I/O wrapper (calls `gh issue view`) stays in `main()`.

---

## Guard 3 — deferred

Guard 3 (periodic `puzzle:status` closed-state reconciliation sweep) is expensive and low-precision. Deferred until Guard 1 + 2 are in place and we have evidence they're insufficient.

---

## Decomposition into child DEV tickets

### Child 1 — Guard 1: velocity-row ticket-match check in close.js

**Role:** DEV · **Estimate:** 30 min H

**Scope:**
- Add `extractTicketFromCsvDiff(diff)` pure function — parses the `+`-lines of `git show HEAD -- docs/puzzle-velocity.csv`, extracts the `ticket` column value(s)
- Add `--skip-ticket-match` flag to `parseArgs`
- Wire pre-flight call in `main()` after `headClosesIssue`
- Add unit tests in `tests/new/close.unit.spec.js` (or sibling file matching #267 pattern)
- Update usage comment at top of `close.js`

**Acceptance:** `npm run close 278` with a commit whose CSV row says `ticket=279` must exit non-zero with the mismatch message. `--skip-ticket-match` must let it proceed.

### Child 2 — Guard 2: issue-title keyword spot-check in close.js

**Role:** DEV · **Estimate:** 45 min H

**Scope:**
- Add `extractKeywords(text, stopSet)` pure function
- Add `keywordsOverlap(titleWords, subjectWords)` pure function
- Add `--skip-keyword-check` flag to `parseArgs`
- Wire pre-flight call in `main()` after Guard 1 — degrades gracefully if `gh` is unavailable
- Add unit tests: at least the `#278` failure case, one true-positive, and the 7 audit false-positives (to confirm `--skip-keyword-check` handles them)
- Update usage comment at top of `close.js`

**Acceptance:** A commit whose subject has zero keyword overlap with the issue title must exit non-zero with the mismatch message. `--skip-keyword-check` must let it proceed. The 7 audit false-positives (Finding 4) must pass with the flag.

---

## open questions (none blocking decomposition)

- Should the two `--skip-*` flags be collapsed into a single `--no-guards` for convenience? Lean no — granular is better for understanding what was overridden and why.
- Guard 2 stop-set will need tuning as edge cases surface. Consider making it configurable via `close.js` constant rather than hardcoded inline so it's easy to patch without a full redesign.
