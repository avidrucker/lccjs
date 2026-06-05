# What Went Wrong — Orchestrator session, 2026-06-05

Session retrospective covering the /fruit-agent-orchestrate invocation and the follow-up #809 doc-writing task. Each entry has: what happened → what should have happened → prevention category.

---

## 1. `cd` into FIG worktree poisoned the shell working directory

**What happened:** To inspect the FIG worktree state I ran `cd /home/avi/.../worktrees/fig-issue-777 && git log ...`. That `cd` changed the persistent working directory for the rest of the conversation. All subsequent commands — `git pull --ff-only origin main`, `git fetch`, `git status`, and the first `npm run claim` attempt — ran from inside the FIG worktree, not from main.

**Should have:** Used `-C <path>` (git) or an explicit absolute prefix on every command, then immediately returned to the main directory. Never use a bare `cd` to inspect a side path mid-session unless the next action is intentionally in that directory.

**Prevention:** Add to `do-this-not-that.md`: to inspect a worktree state, use `git -C <worktree-path> log --oneline -3` — no `cd` needed, no directory contamination.

---

## 2. `git pull --ff-only origin main` from the FIG worktree gave a misleading success signal

**What happened:** While accidentally in the FIG worktree directory (see #1), I ran `git pull --ff-only origin main`. It returned "Already up to date." — which was true for the FIG branch but said nothing about main being stale. I took it as confirmation that main was current and proceeded to claim.

**Should have:** Either run the pull after returning to main, or read the response carefully — "Already up to date" on a non-main branch is not the same as main being up to date.

**Prevention:** Consequence of #1. Fixing #1 (never `cd` into a side path) prevents this. Secondary rule: `git pull` that reports success on an unexpected branch is a red flag, not a green light.

---

## 3. Wrong working directory not caught until `git branch --show-current`

**What happened:** After running `git pull` and `git fetch` from the FIG worktree, I ran `git fetch origin main && git status` and saw `On branch fig/issue-777-test-inline-assembly-strings-in`. Only then did I notice the cwd was wrong — two full round-trips after the `cd`.

**Should have:** Noticed after the very first command. The output of `git pull --ff-only origin main` saying "Already up to date" on a branch I didn't expect should have been the trigger.

**Prevention:** After any `cd`, the very next action should be a cwd verification (`pwd` or check the branch name in the prompt). Don't proceed with substantive git/npm commands until the working directory is confirmed.

---

## 4. `npm run claim` issued without `--as <fruit>` on the first attempt

**What happened:** First claim attempt was `npm run claim -- 809`, missing the required `--as <fruit>` flag. Got an error and had to rerun. This is the same mistake from the GRAPE 2026-06-04 WWW doc (entry #1 there).

**Should have:** Always include `--as <fruit>` — the flag has been mandatory since #386 disabled auto-naming.

**Prevention:** This is a repeat offence. Memory and `do-this-not-that.md` already cover it. No new doc needed; the rule needs to be applied on the first invocation, not after the error.

---

## 5. Stale FIG worktree flagged but not cleaned up

**What happened:** Both `npm run claim -- 809` and `npm run claim -- 816` printed a warning: `fig/issue-777` references a CLOSED issue and may have missed deferred teardown. I noted the warning each time but did not run the cleanup commands (`git worktree remove --force` + `git branch -D`).

**Should have:** Cleaned it up on the first warning. The commands were printed in the error output and are safe to run.

**Prevention:** Add to `do-this-not-that.md` or personal memory: a stale-worktree warning from `npm run claim` is an action item, not just a notice. Run the two cleanup commands before proceeding with the claim.

---

## 6. No pre-captured start timestamp for #809

**What happened:** The puzzle-velocity skill says to capture `date '+%Y-%m-%dT%H:%M:%S%z'` *before* reading the issue. I did not do this for #809, so the velocity row used approximate timestamps (`2026-06-05T00:00:00Z` / `2026-06-05T00:15:00Z`) with a note "timestamps approximate."

**Should have:** Captured the start time immediately when the user said "log your analysis as a named and dated doc" — before filing the issue, before claiming, before anything.

**Prevention:** The velocity skill already states this clearly. The discipline is to treat the user's intent to assign a task as the trigger for `date` — even before the issue number is known.

---

## 7. No established protocol for orchestrator claiming under a fruit identity

**What happened:** The `npm run claim` script requires `--as <fruit>`. The orchestrating Claude Code session has no assigned fruit name. I picked GRAPE arbitrarily (because GRAPE had the most recent WWW/docs activity), but there is no documented convention for this.

**Should have:** Either asked the user which agent name to use, or filed this gap as an issue before proceeding.

**Prevention:** File an issue to document the orchestrator-identity convention. Options include: a fixed name (`MAIN` or `ORCHESTRATOR`), always asking the user, or a `--as-main` flag in claim.js that records the agent as `main`. The current workaround (picking any unused fruit) produces technically-correct but misleading velocity data.

---

## Summary by prevention category

| # | Category | Suggested action |
|---|----------|-----------------|
| 1 | Wrong cwd via `cd` | `do-this-not-that.md`: use `git -C <path>` instead of `cd` for inspection |
| 2 | Misleading pull output | Consequence of #1; fix #1 |
| 3 | Slow cwd detection | Verify cwd after any `cd` before running substantive commands |
| 4 | Missing `--as` flag | Repeat offence; apply existing rule on first invocation |
| 5 | Stale worktree not cleared | `do-this-not-that.md`: stale-worktree warning = immediate cleanup, not a notice |
| 6 | Missing start timestamp | Capture `date` at moment of task assignment, before issue number is known |
| 7 | Orchestrator identity gap | File issue to define the convention; no workaround is acceptable long-term |

---

*Agent: GRAPE (orchestrator session) · Model: claude-sonnet-4-6 · Date: 2026-06-05*
