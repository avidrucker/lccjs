# Multi-agent worktree workflow — findings

Status: **findings / retro.** The fix is an open puzzle — see
[#188](https://github.com/avidrucker/lccjs/issues/188).

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

All six concrete, agent-actionable mitigations from the original spike are now closed:

| Mode | Fix | Ticket |
|------|-----|--------|
| #1 — CSV append conflict | `merge=union` on `docs/puzzle-velocity.csv` + SQLite canonical store | #186, #290 |
| #2 — partial-state push | `scripts/git-hooks/pre-push` gates on conflict markers + in-progress rebase; `npm run close` retry-loops fetch→rebase→push and gates cleanup | #205, #242 |
| #3 — `closed_commit` orphaned | Protocol: always log `closed_commit` empty; derive with `git log --grep "Closes #N" -1 --format=%h` | #186 |
| #4 — branch-protection enforcement | User-owned decision — see below | — |
| #5 — classifier outage stalls close | Infra, not ours; SOP: read-only-verify-then-retry | — |
| #6 — claim/marker state half-visible | `npm run puzzle:status` shows AVAILABLE/CLAIMED/IN-PROGRESS/STALE without per-worktree greps; identity half addressed via fruit system | #179, #212 |
| #7 — transient churn looks like lost work | Discipline: check `git worktree list` + `puzzle:status` before alarming | — |

Additional hardening:
- **PDD gate `+` in worktree names** (#224): `scripts/run-pdd.sh` routes through a symlink when the worktree path contains regex-special chars, so the pre-push pdd scan is correct from every worktree.
- **Atomic close tool** (#242): `npm run close N` wraps the retry loop + gated cleanup in a single command; `git worktree remove` runs only after verifying HEAD is on `origin/main`.

## Recommended durable process (ARC synthesis — #188)

This section is the deliverable of the spike: a layered, concurrency-safe protocol for multi-agent worktree work that replaces the ad-hoc per-agent discipline that produced the failure modes above.

### Layer 1 — Velocity store (eliminating the CSV write race)

- **Canonical write store:** `~/.lccjs/velocity.db` — SQLite, local-only, never committed, accessible from every worktree via absolute path. Serialized by SQLite's own locking; no merge conflict possible.
- **Read-only git artifact:** `docs/puzzle-velocity.csv` — auto-exported by `npm run velocity:export` after each `npm run velocity:log` write. `merge=union` in `.gitattributes` as a safety net for any concurrent CSV reads.
- **`closed_commit`:** always logged as empty; recover on demand via `git log --grep "Closes #N" -1 --format=%h`. Never attempt to stamp it before the rebase + push have settled.

### Layer 2 — Push safety (eliminating partial-state and racy cleanup)

- **Pre-push hook** (`scripts/git-hooks/pre-push`, #205): runs before every `git push`; exits 1 if a rebase/merge is in progress or any tracked file has a column-0 conflict marker.
- **`npm run close N`** (#242): the standard close path — takes the issue number, loops fetch→rebase→push until the commit lands on `origin/main`, then and only then removes the worktree and branch. Aborts loudly at any step rather than cleaning up on a failed push. Use the `&&`-gated manual chain only as a documented fallback when the tool is unavailable.

### Layer 3 — Claim identity and marker visibility

- **Claim:** `npm run claim -- <issue> --as <fruit>` stakes a worktree on branch `<fruit>/issue-<N>-<slug>`. Identity persists via the `--as` flag; use the same fruit for the session's full claim→close lifecycle.
- **Marker protocol:** flip `@todo #N:…` → `@inprogress #N:…` the moment the worktree is checked out; delete the marker in the closing commit.
- **Cross-agent visibility:** `npm run puzzle:status` reads `git worktree list` + `git log` + live GitHub state to surface AVAILABLE / CLAIMED / IN-PROGRESS / STALE per puzzle without needing per-worktree greps. The `@inprogress` marker state visible to `puzzle:status` on `main` lags until the first push from the worktree (known limitation; accepted at current agent scale).
- **Cleanup:** `npm run close N` removes the worktree and branch. Leaving a worktree after close is a hard protocol violation — it looks like a live claim to every other agent.

### Layer 4 — PDD gate robustness

- `scripts/run-pdd.sh` detects regex-special characters in the worktree path (e.g. `+` from `EnterWorktree`) and scans through a symlink, so the pre-push pdd gate is correct from every worktree.
- Worktree/branch names should use only `[A-Za-z0-9._-]` (the `+` issue is handled, but clean names reduce friction in other tooling).
- `commit-msg` hook enforces Conventional Commit format; reject if `--no-verify` is needed, investigate the hook failure instead.

### Layer 5 — Branch-protection decision (user-owned, still open)

The remote currently emits a non-blocking "Changes must be made through a pull request" warning on every `git push origin HEAD:main`. If GitHub enforcement is ever turned on, the trunk-based flow breaks for **all agents simultaneously**.

**Decision needed from `@avidrucker`:** choose one before protection is enforced:

| Option | Mechanics | Trade-offs |
|--------|-----------|------------|
| **A — Stay trunk-based** | Keep `push origin HEAD:main`; ensure branch protection stays non-enforced (or add a ruleset bypass for the repo owner). | Simplest. Agents use the same protocol forever. Requires actively not enabling protection. |
| **B — PR per close** | Each agent pushes to its fruit branch and opens a PR; `npm run close` would drive `gh pr merge --squash`. | Protection-proof; adds 1 GH API call per close; squash changes commit graph (rebase SHAs change again). |
| **C — Merge queue** | PRs enter a queue; queue serializes rebases + merges. | Cleanest long-term; requires GitHub merge-queue setup; highest complexity change. |

**Recommendation:** Option A for now — the current enforcement notice is non-blocking, and switching to PRs would require changes to the close tool and the workflow. File a separate ticket if protection enforcement becomes a real constraint.

## Related

- `docs/claude_workflow.md` — the current per-puzzle agent workflow
- `docs/design-agent-worktree-identity.md` — the fruit-identity convention (#179)
- `docs/puzzle-velocity.md` — the CSV schema this would supersede or wrap
- [#188](https://github.com/avidrucker/lccjs/issues/188) — the open puzzle to pick a process
