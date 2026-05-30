# Multi-agent worktree workflow — findings

Status: **findings / retro.** The fix is an open puzzle — see
[#188](https://github.com/avidrucker/lccjs/issues/188).

<!-- @todo #188:60m/ARC spike: evaluate concurrency-safe work-logging + push-gating options (SQLite [CHERRY researching], one-file-per-row, write-lock, post-push SHA stamping, pre-push marker guard) and recommend a process; see docs/worktree-multi-agent-findings.md -->

## Context

lccjs is worked by **several Claude agents in parallel**, each in its own git
worktree under a self-assigned fruit identity ([#179](https://github.com/avidrucker/lccjs/issues/179),
`docs/design-agent-worktree-identity.md`), closing **trunk-based** via
`git push origin HEAD:main`. The coordination substrate is therefore **git refs
+ a shared append-only text file** (`docs/puzzle-velocity.csv`), written
concurrently by every agent.

This document records the failure modes observed during the 2026-05-29 session
(3+ agents: apple, banana, cherry) so a better process can be chosen. Worth
stating plainly: **even experienced human developers avoid running multiple
agents on worktrees against one codebase** precisely because of the issues
below — this is a known-hard coordination problem, not a tooling gap unique to
us.

## Failure modes observed

### 1. The append-only CSV is a conflict magnet
Every agent appends one row to `docs/puzzle-velocity.csv` on close. Concurrent
closes append to the **same trailing region**, so the rebase-before-push almost
always conflicts there. Text-file appends don't auto-merge; git's atomicity
protects branch *names*, not row-level file merges. This was the single most
frequent friction point of the session.

### 2. `rebase && push` chained in one command is unsafe
On the #185 close, a compound command ran `git rebase origin/main` then
unconditionally `git push origin HEAD:main`. The rebase **paused on a CSV
conflict** after applying the first of two commits; because the script didn't
gate on rebase success, it **pushed a partial state** — the test commit landed
on `main` (cleanly, since it didn't touch the CSV) while the velocity-row commit
stayed stuck mid-rebase with conflict markers in the local tree.

Outcome was benign (nothing broken shipped; the marker-guard caught it on the
next step and the velocity row was resolved + pushed correctly), but it was a
real near-miss. **Push must be gated on a clean, completed rebase
(`grep -c '<<<<<<<' == 0`)** — **now enforced by `scripts/git-hooks/pre-push` (#205).**

### 3. `closed_commit` is orphaned by concurrent rebases
The velocity two-commit pattern captures the closing SHA, then logs it. But a
concurrent push forces a rebase that **rewrites that SHA**, so `closed_commit`
points at an orphan unless manually corrected during conflict resolution (it
was, on #185: `6c4c64d` → `0487533`). The capture-after-rebase rule helps only
until the *next* agent pushes.

### 4. Branch-protection notice on push
`push origin HEAD:main` prints *"Changes must be made through a pull request."*
It is currently **non-blocking** (the ref advances anyway), but if enforcement
is ever turned on, the trunk-based flow breaks for **every** agent at once.

### 5. Classifier outages stall the close
The Opus auto-safety classifier repeatedly went unavailable ("cannot determine
the safety of Bash"), blocking the velocity-commit Bash call mid-close (4× in
one session). Each is recoverable (treat as "did not happen" → read-only verify
the file wasn't half-written → retry), but it interrupts the close and tempts
double-appends if not verified.

### 6. Claim state is only half-visible from `main`
`@inprogress` markers live on the *worktree branch*, invisible to
`puzzle:status`'s `git grep` on `main` until an agent runs it from inside its
worktree. So **who** holds a claim is reliable only via `git worktree list`
(the fruit identity), and **marker state** isn't visible cross-agent. Velocity
rows for in-flight work don't exist yet either (they're written at close).

### 7. Transient worktree churn looks like lost work
An agent re-scoping a ticket (remove worktree + delete branch + re-create under
a new branch name) momentarily looks like *vanished/abandoned work* to another
agent polling `git worktree list` (observed: banana #13 dropped its first
worktree then reappeared on a re-scoped branch). Without commits pushed,
distinguishing "abandoned" from "restarting" is guesswork.

## Root cause

The shared mutable state is an **append-only text file under concurrent
writers**, coordinated only by git's branch-level atomicity. Row-level merges
aren't atomic, SHAs aren't stable under rebase, and there's no lock. Every
symptom above traces back to this.

## Shipped since this retro

- **Gate push on a clean rebase — DONE (#205, `df6c1c2`).** `scripts/git-hooks/pre-push`
  now blocks the push if a rebase/merge is in progress (`rebase-merge`/`rebase-apply`
  dirs or `MERGE_HEAD`) or any tracked file carries a column-0 conflict marker; never
  chain `rebase && push`. This closes failure mode #2.

## Candidate mitigations (to evaluate under #188)

- **Replace the append-only CSV** with a concurrency-safer store:
  - **SQLite** for work/time logging (CHERRY is researching) — serialized
    writes, no text-merge conflicts.
  - **One-file-per-row** — a directory of tiny per-ticket files (e.g.
    `velocity/<ticket>.json`); independent paths never conflict; reduce to a CSV
    on demand.
  - Append-only log reconciled periodically rather than committed per close.
- **Stamp `closed_commit` after the final push** (or reference the GH close
  event instead of a SHA) so concurrent rebases can't orphan it.
- **PR / merge-queue** instead of trunk-based `HEAD:main` if branch protection
  is enforced.
- **Surface claim+marker state cross-agent** without needing per-worktree greps
  (e.g. the same store that replaces the CSV could hold live claims).

## Related

- `docs/claude_workflow.md` — the current per-puzzle agent workflow
- `docs/design-agent-worktree-identity.md` — the fruit-identity convention (#179)
- `docs/puzzle-velocity.md` — the CSV schema this would supersede or wrap
- [#188](https://github.com/avidrucker/lccjs/issues/188) — the open puzzle to pick a process
