# Today I Learned — 2026-06-01 (DRAGONFRUIT, session 3)

Three small fixes (#412, #423) and one non-fix (#406). The non-fix produced the
most useful lesson.

---

## 1. Check `git log --follow <file>` before claiming a refactor ticket

**What happened:** I was assigned #406 ("flatten disassembler.js nesting depth").
Before touching any code I ran the issue's own repro command:

```bash
grep -En '^( {24,})[^ ]' src/extra/disassembler.js | head -20
```

Zero hits. The file was already at ≤5 levels. `git log --follow src/extra/disassembler.js`
immediately showed commit `638f4e0: refactor(disassembler): flatten deep nesting with
guard clauses` — closing #256, landed 2.5 hours *before* #406 was even created.

**The pattern:** Refactor and cleanup tickets describe a property of the code, not
a specific broken behavior, so the fix can land under a different ticket number
without anyone noticing. A quick `git log --follow <file>` + running the repro
before claiming takes 30 seconds and catches this; skipping it wastes a full
worktree claim cycle.

**The cue:** For any refactor/cleanup ticket, run the repro first. Zero hits →
check `git log` before assuming the ticket is wrong.

## 2. Log a velocity row even when the output is "nothing to do"

**What happened:** After closing #406 as already-done I almost moved on without
logging. The user reminded me: 15 minutes of investigation — reading the issue,
running the repro, tracing the git history, verifying the timeline — is real work
and belongs in the DB as a RESEARCH row.

**The principle:** The velocity log tracks *time spent*, not *files changed*.
"Already done" is a valid research finding. A missing row creates a silent gap in
the data. A RESEARCH row with notes like "discovered work already shipped in commit
638f4e0" is actually more informative than many DEV rows.

## 3. `velocity-log.js --from-main`: JSON must be `argv[2]`, flag after

**What happened:** I tried `npm run velocity:log -- --from-main '{...}'`, putting
`--from-main` at `argv[2]` and the JSON at `argv[3]`. The script always reads
`process.argv[2]` as the JSON, so it tried to parse `--from-main` as JSON and
threw "No number after minus sign."

**The fix:** JSON first, flag after:
```bash
node scripts/velocity-log.js '{...}' --from-main
```
`--from-main` is detected with `process.argv.includes()` so any position past
`argv[2]` is fine. Positional args have a fixed slot; flags don't. They don't
compose the way you'd expect from a typical options-first CLI.

---

## What went well

- **Repro-before-claiming saved a full worktree cycle on #406.** 15 minutes of
  investigation, zero code churn.
- **#423 and #409 both closed in one pass.** Reading both issues before starting
  revealed they were duplicates; one fix, two closures.
- **#412 was a clean 3-line delete.** No gating needed — the messages had no user
  value, no oracle parity concern, and the fix silenced LCC+ to match core.

## What didn't go well

- **I skipped the velocity row for #406** until the user prompted me. "No code
  shipped" ≠ "no work happened." This has come up before (#216 precedent). It needs
  to be automatic: every session with a ticket number gets a row.
