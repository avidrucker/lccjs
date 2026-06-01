# Today I Learned — 2026-06-01 (DRAGONFRUIT)

A long session hardening the claim/close toolchain: exported-CSV guard (#320),
claim.sh shim (#315), Option-C fruit validation (#363 → #366), session-sentinel
branch (#194), and the docs capstone (#195). Closed six issues. Reopened one.

---

*For readers new to this repo: `npm run claim` gives an agent a unique fruit-name
identity (apple, banana, cherry…) and a dedicated Git branch so parallel agents
don't collide. `npm run close` merges the work and tears down the branch. This
session was almost entirely about making those two commands more robust.*

---

## 1. `exec` in a shell wrapper runs BEFORE the child can read its own context

**What happened:** For #360 (the `npm run close` getcwd error), I wrote `close.sh`
to pre-root the shell CWD with `cd main_root && exec node close.js`. It immediately
failed: `close.js` uses `currentBranch()` (`git rev-parse --abbrev-ref HEAD`) to
find which worktree to tear down — but after the `cd`, HEAD was `main`, not the
worktree branch. `close.js` refused to proceed.

**The fix:** Use fork+wait instead of `exec`. Run `node close.js "$@"` normally
(child inherits the worktree CWD), capture the exit code, then `cd main_root`
**after** the child exits. On Linux, `chdir()` to a valid path succeeds even when
the current directory has been deleted, so the `cd` works even after the worktree
is gone.

**The pattern:** `exec` replaces the process — there's no "after." Fork+wait
gives you a cleanup step. When you need a child to see the original CWD but the
parent to exit from a different one, exec can't do that.

## 2. A shell wrapper can't fix its own *parent* process's CWD

**What happened:** The fork+wait `close.sh` made close.sh itself exit cleanly from
`main_root`. But the getcwd error and `exit 1` persisted. Looking at the output,
the error printed as part of `npm`'s output — not close.sh's. npm inherits CWD
from the parent shell (the worktree path) and its own Node.js process calls
`getcwd()` during cleanup. No wrapper invoked *from* npm can change npm's own CWD.

**The lesson:** A `package.json` script runs as a child of npm. It can control its
own CWD and its own children's CWDs. It cannot reach up and change the parent
(npm's) CWD. For #360 the right fix is Option 3 (documentation) — document that
the exit-1 is cosmetic and agents should trust `CLOSE OK` in stdout.

## 3. The close protocol has three mandatory steps that are easy to forget all at once

**What happened:** At #320's close I skipped the velocity log, replaced the
`@inprogress` marker with a tracking comment instead of deleting it, and posted no
closing comment. The user caught all three in one review. Correcting them required
a separate worktree, a new issue, and a retroactive velocity log from main with
`--from-main`.

**Why they cluster:** These steps feel like "admin after the real work is done,"
so they get skipped together when you're mentally finished. But each has a real
cost when missed:
- No velocity row → data gap in forecasting.
- Leftover comment → violates the "don't reference the task in comments" rule and
  stays in the codebase as stale noise.
- No closing comment → the issue history has no record of what actually shipped.

**The cue:** After every `CLOSE OK`, ask: velocity row logged? Marker deleted (not
transformed)? Comment posted?

## 4. `Number.isFinite(Infinity)` is `false` — Infinity is not finite

**What happened:** Writing `isSentinelStaleByAge()` for the session-sentinel, I
guarded with `if (!Number.isFinite(commitTs)) return true` to handle NaN. In the
tests I also included `Infinity` expecting it to return `false` ("infinitely
fresh"). The test failed: `Number.isFinite(Infinity)` is `false`, so the function
correctly returns `true` (stale) for Infinity just like NaN. I had the wrong mental
model.

**The fact:** `Number.isFinite` returns `true` only for ordinary finite numbers —
it rejects `NaN`, `Infinity`, and `-Infinity`. All three are treated as "can't
read the age" → stale → free the fruit. This is actually the right behavior for a
sentinel whose timestamp can't be interpreted.

---

## What went well

- **The claim-hardening series flowed.** #315 → #363 → #366 → #194 → #195 each
  built directly on the previous ticket. Because I owned the code path throughout,
  there was no re-orienting between tickets.
- **Pure-seam extractions paid off.** Pulling `checkIdentityName()` and
  `isSentinelStaleByAge()` out of `main()` into testable functions meant all the
  logic got unit tests with no git I/O mocking needed.
- **The #360 mistake was caught and corrected openly.** Reopening the issue and
  posting a correction comment was the right call. Better a honest "this didn't
  fix it" on the ticket than silent wrong documentation.

## What didn't go well

- **#360 shipped a fix that doesn't fix the bug.** I didn't trace the getcwd error
  all the way back to npm's own process before committing. The wrapper is harmless
  but the issue is still open. Lesson: when a bug involves process hierarchy, map
  *all* the processes and their CWDs before writing a fix, not after.
- **Three close-protocol gaps at #320.** All three are on the "easy to forget
  together" list above. I've internalized the cue now, but the gaps happened.
- **The initial exec approach to close.sh was wrong in a way that was immediately
  obvious in testing** — I should have thought through the branch-detection
  dependency before writing the first version. The pivot to fork+wait was quick,
  but the first attempt was avoidable.
