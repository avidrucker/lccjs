# TIL 2026-06-03 (APPLE-4) — close.js HEAD guard fix and closing-comment discipline gap

## Context

Two puzzles closed this session: #619 (bug fix) and #620 (docs). Both were
straightforward, but together they surfaced two workflow observations worth keeping.

---

## 1. `npm run close` scanned only HEAD — the velocity two-commit protocol broke it

**The bug (#619).** `headClosesIssue()` in `scripts/close.js` ran `git log -1` —
checking only the HEAD commit for a `Closes #N` keyword. The standard velocity
protocol produces two commits before pushing:

1. The fix commit — contains `Closes #N` in the body.
2. The velocity CSV commit — `data(velocity): log #N …` — no close reference.

After the velocity commit, HEAD is commit 2. The script refused:

```
[close] ✗ HEAD commit does not reference "Closes #619".
```

GitHub itself closes the issue correctly (it scans the full push set), but the
close script's worktree teardown and branch cleanup are bypassed. The issue was first
discovered and filed by FIG in #614 / TIL FIG-3; this session delivered the fix.

**The fix.** Replaced `headClosesIssue` with two functions:

- `bodyClosesIssue(text, issue)` — pure predicate, checks whether any commit text
  contains a GitHub close keyword for the issue. Exported and unit-tested.
- `findClosingCommitSha(issue)` — I/O wrapper that runs
  `git log origin/main..HEAD --format=%H`, walks each SHA, and returns the first
  commit whose body satisfies `bodyClosesIssue`. Returns `null` if none found.

Guard 2 (keyword check) also needed updating: it was reading
`git log -1 --format=%s` (HEAD's subject). When HEAD is the velocity commit, the
subject is `data(velocity): log #N …` — no keywords from the issue title, so Guard 2
would also have fired a false rejection. The fix passes `closingCommitSha` to
`checkKeywordMatch` so it checks the right commit's subject.

**Self-hosting proof.** The closing commit for #619 was committed first (with
`Closes #619`), then a separate velocity CSV commit was made — putting the velocity
commit at HEAD, exactly the failing scenario. Running `npm run close 619` with the
fixed script succeeded, confirming the fix works end-to-end.

8 regression tests added for `bodyClosesIssue`; all 120 unit tests pass.

---

## 2. The closing-comment step is a discipline gap

`npm run close` ends every successful run with:

```
[close] Post your closing comment:
  gh issue comment N --body "Closed in <sha>. <your summary here>"
```

This session's APPLE agent (on #619) treated the report-to-human turn as the done
signal and stopped without executing the comment. The human had to ask why no comment
was left before APPLE posted it retroactively.

The prompt is advisory text in the terminal — it does not gate on the comment being
posted. Agents read it, mentally note it as "a suggested next step," then summarize
the work to the human and stop. The comment falls through the gap between "the script
finished" and "the task is done."

Filed as #637. Possible remediation paths: auto-post inside `close.js` (requires a
summary string), hard-stop in the workflow skill/docs, or a `--comment` flag that
takes a body and posts it in the same script run.

**The discipline rule that works now:** do not report the task as done until
`gh issue comment N` has been executed and the URL has been confirmed in terminal
output. Treat the comment as part of the close sequence, not as an optional courtesy.

---

## What landed

| Artifact | Change |
|---|---|
| [#619](https://github.com/avidrucker/lccjs/issues/619) | `bodyClosesIssue` + `findClosingCommitSha` replace HEAD-only check; Guard 2 uses closing commit SHA. 8 new tests. |
| [#620](https://github.com/avidrucker/lccjs/issues/620) | `actual_min` validity condition documented in `velocity-schema.md` and `puzzle-velocity.md`. |
| [#637](https://github.com/avidrucker/lccjs/issues/637) | Bug filed: closing-comment step skipped by agents after `npm run close`. |
| [#646](https://github.com/avidrucker/lccjs/issues/646) | This TIL. |
