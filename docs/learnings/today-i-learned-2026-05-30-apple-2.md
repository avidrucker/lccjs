# Today I Learned — 2026-05-30 (APPLE) — segment 2

Date: 2026-05-30
Agent: APPLE
Context: Started from "run the suite, what's our testing status?" → noticed the one
skipped suite → converted it to research probes → did probe **#244** → the probe's
test run surfaced a real tooling bug → filed + fixed **#247**.

---

## 1. #244 — OG LCC has no line-length limit; it silently corrupts instead

Probed the oracle for a source-line length cap. There is **none, and no
diagnostic.** OG LCC reads each line into a **fixed 298-char buffer**; lines ≥ 299
are **silently split** and the overflow tail is parsed as the *next source line*:

- single over-long line → **exit 0, `.e` written**, bogus label injected (silent corruption)
- two over-long lines, matching tails → misleading `Duplicate label`
- failure is **non-monotonic** in length (whitespace line fails at 900, passes at 1000) — the tell of an unchecked fixed buffer

So lcc.js's explicit 300-char cap is **BY DESIGN and safer**, not a port of an
oracle limit; "counts the raw line incl. comments" is confirmed correct. Logged as
parity_deviations BY DESIGN #7 (updated) + OG BUG #13 (new). The OG bug report to
Dos Reis stays **conditional/deferred** per the #244 scope note.

**Lesson:** "match the oracle" isn't always the goal — when the oracle's behavior
*is* silent corruption, the right move is a louder, earlier failure, documented as
an intentional deviation rather than chased as a parity bug.

## 2. #247 — `jest tests/new` from main runs OTHER agents' worktree tests

`npm test` on main went red inside `banana-issue-227/tests/new/...`. Cause: Jest
treats `tests/new` as a **substring path pattern**, so it also matches
`.claude/worktrees/<agent>-issue-N/tests/new/...`. With worktree-per-task as the
default, every parallel run was exposed to other agents' WIP. `jest --listTests`
showed **42 worktree files leaking** into a main run.

**The trap (caught before writing code):** a **bare** `/.claude/worktrees/` ignore
pattern also matches a worktree's OWN tests when Jest runs from *inside* it (its
path contains `.claude/worktrees`), silently running **zero** tests there. Must
anchor with **`<rootDir>`** — it resolves to the invoking checkout, so main
excludes its worktrees while a worktree-local run is never self-excluded. Verified
both directions; pinned with a 6-test guard replicating Jest's `<rootDir>`
substitution + regex match.

**Lesson:** before adding an exclude pattern over a path the tool can *itself* run
from, check the symmetric case — the pattern that excludes "them from here" can
also exclude "you from there." `--listTests` proves a Jest path-filter change
cheaply and non-destructively.

> Sibling note: my segment-1 TIL flagged that the **pre-push pdd scan** false-fails
> from every worktree. #247 is the same family of bug (tooling that doesn't account
> for `.claude/worktrees/`), now fixed for the test runner specifically.

## 3. Process

- The **#228 stale-main guard** fired on my first `claim` (local main 1 behind) and
  blocked it — as intended. Pull `--ff-only`, re-claim.
- "Don't overstep" = before claiming, diff every active worktree's changed files
  against your target. Only banana (#227) was live and touched none of mine; #247
  was unclustered. Cheap check, avoids collisions.
- Converting a permanently-skipped test into either an **active assertion** (when
  research resolves it) or a **deleted placeholder pointing at a findings doc**
  beats leaving it skipped — #244 dropped the suite's skip count 2→1.
