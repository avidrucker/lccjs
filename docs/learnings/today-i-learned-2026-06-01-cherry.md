# TIL — 2026-06-01 · CHERRY

A documentation-audit session: closed six puzzles (#321, #317, #327, #326, #323,
#369, #260) and filed three follow-up bugs (#361, #364, #369) — mostly WRITER work
on the workflow/parity docs. The recurring theme: **trust the code, not the doc
about the code.**

## Lessons

1. **Verify load-bearing claims against the primary source, not a secondary doc.**
   This saved two would-be regressions:
   - **#327 (pitfalls):** `parity_deviations.md` says `mov` out-of-range immediates
     *silently wrap* (OB-001). The actual `assembleMOV` now validates the range and
     errors — OB-001 was fixed and the parity doc went stale. The pitfalls entry I
     was about to "correct" was already right. (Spun off #364 to fix the parity doc.)
   - **#323 (LOCKED):** the issue suspected the `LOCKED` state was fabricated. The
     reconciler source (`puzzle-status.js:204`) showed it's real — a derived
     soft-lock, just rarely triggered. An audit that believed the "never seen it"
     premise would have *deleted accurate documentation.*

2. **`close.js` Guard 1 collides when the velocity agent ≠ the branch prefix (#361).**
   I claimed under the auto-assigned fruit `banana` but logged velocity as `CHERRY`
   (the terminal-name convention). Guard 1 derives the closer from the *branch
   prefix*, so it matched a concurrent real-BANANA row for a different ticket and
   refused the close. `--skip-ticket-match` is the escape hatch, but the auto-mode
   classifier (correctly) blocks a guard-skip on `main`. **Honest unblock:** rebase
   onto `origin/main` so the diff base advances and the foreign row drops out.
   **Avoid entirely:** `CLAUDE_AGENT_NAME=cherry npm run claim …` so branch ==
   velocity agent. After I did that, every later close passed clean. (BANANA's TIL
   today hit the related close-protocol/Guard-1 terrain.)

3. **Findings become their own tickets, not comments.** Each audit surfaced an
   upstream defect; I filed each as a fresh BDD-shaped bug — #361 (from #317),
   #364 (from #327), #369 (from #323) — rather than commenting on a closed or
   *inverse* issue (#357 was about steps being *skipped*; my finding was a guard
   *over-firing* — opposite direction, so a new ticket was correct).

4. **The velocity CSV is a full-file export of shared SQLite — expect churn.** A
   concurrent agent can log + export + push *my* row to `main` before I close, so
   after rebase the CSV drops out of my commit entirely. `close.js` also
   auto-resolves CSV conflicts by re-exporting. Never hand-edit the CSV; let the
   rebase/export handle it.

5. **Respect doc scope.** `pitfalls.md` is *assembly-writing* pitfalls; the issue
   listed *workflow* footguns (CSV-from-main, merge=union) as candidates. Those
   belong in `claude_workflow.md` — I flagged that rather than stuffing them into
   the wrong doc.

## What went well

- The verify-against-source habit caught two accurate-doc-about-to-be-broken cases.
  Reading `assembleMOV` and `puzzle-status.js` directly beat trusting the prose.
- `CLAUDE_AGENT_NAME` eliminated the Guard 1 friction for the rest of the session.
- Tight loop: every spinoff finding left the tree with a tracked ticket and a
  cross-reference, so nothing got lost as a chat aside.
- Grounded the #260 upstream bug report by re-running the real `cuh63` binary
  (exit-0 + bogus-label, and the spurious-`line 4` `Duplicate label`) instead of
  only transcribing the prior research.

## What didn't go well

- I knew about the Guard 1 / agent-name collision (it's in my own memory) but still
  hit it on #317 because I didn't set `CLAUDE_AGENT_NAME` from the *first* claim.
  Cost a cycle. Lesson already written — apply it proactively, not after the denial.
- **cwd resets after worktree teardown** repeatedly bit me: a bare `git status` or
  `grep` ran from the main checkout (or a deleted dir) instead of the worktree,
  returning empty/misleading output. Fix: `cd <abs-worktree-path> && …` in *every*
  post-close command rather than assuming the shell cwd persisted.
- One sloppy first grep on #323 matched noise; a more precise pattern up front would
  have saved a step.
