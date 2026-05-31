# Today I Learned — 2026-05-31 (DRAGONFRUIT, session 2)

An afternoon session writing test coverage for `scripts/close.js` (#267). Three
concrete mistakes caught before landing, one tool-output pitfall, one config-drift
bug discovered in production.

---

## 1. Code that says "keep in sync with X" will drift

**What happened:** `scripts/close.js` has a constant `UNION_FILES` and a comment
reading "Keep in sync with `.gitattributes`." When `.gitattributes` had
`merge=union` removed from `docs/puzzle-velocity.csv` (ticket #290), nobody updated
`UNION_FILES`. The constant was stale for every commit after #290. When the conflict
finally hit on rebase, `close.js` fired the "should be impossible" error path
instead of the actionable "blocking conflict, resolve manually" path.

**Why it matters:** A comment asking humans to keep two things in sync is not
enforcement. The drift was invisible until it hit a real conflict.

**What to do:** Treat "keep in sync with X" comments as code smells. Either derive
the value from the authoritative source at runtime, or add a test that reads both
and asserts they match. A test for UNION_FILES vs `.gitattributes` would have caught
this drift immediately.

## 2. `git log --oneline` only shows the commit subject

**What happened:** E2e tests committed a message of `"fix: thing\n\nCloses #9001"`
(body has the Closes line) and then asserted `git log origin/main --oneline`
matched `/Closes #9001/`. The assertion silently failed: `--oneline` only prints the
first line. The body is invisible to it.

**Why it matters:** `headClosesIssue` in `close.js` reads the full body via
`git log -1 --format=%B`. Testing only the subject is testing a different thing.

**What to do:** Use `--format=%B` when asserting on commit body content.

## 3. A race-simulation hook must output a real race signature

**What happened:** A `pre-receive` hook designed to reject the first push printed
`"race: simulated rejection"`. `classifyPushError` saw this and returned
`'rejected-other'` (no race pattern matched) — so `close.js` aborted on the first
push instead of retrying. The test for "retries after a race" was actually testing
"aborts on first non-racy rejection."

**Why it matters:** The hook output must match the exact patterns `classifyPushError`
recognizes (`cannot lock ref`, `non-fast-forward`, etc.) to simulate a real race.
A plausible-sounding message that doesn't match the classifier tests nothing.

**What to do:** When faking a git rejection, copy a real rejection string. In this
case: `"! [remote rejected] HEAD -> main (cannot lock ref 'refs/heads/main')"`.

## 4. The PDD scanner reads every tracked file, including test files

**What happened:** A test description contained the string `'TODOS.md'`. The PDD
scanner found `TODO` in that string and flagged a malformed puzzle marker,
blocking the pre-push hook.

**Why it matters:** The scanner has no concept of "this is a test string, not a
marker." It scans bytes, not intent.

**What to do:** Avoid the literal string `@todo` (or standalone `TODO`) in test
descriptions and string literals. Use a different filename in the test, or write
`at_todo` in prose. This same trap appears in the first TIL doc from today —
it's been hit four separate times across the project now.
