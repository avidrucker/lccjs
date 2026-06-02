# Today I Learned — 2026-06-01 (DRAGONFRUIT, session 4)

Shadow hazard re-analysis after #417 (remove `AssemblerPlus.handleInstruction`).

---

## 1. Shadow hazard count is sticky — narrow PRs don't reduce it

**What happened:** #417 removed `AssemblerPlus.handleInstruction` and registered plus
mnemonics in the constructor's `_instructionTable`. The pre-#417 baseline (#425) counted
3 combined shadow hazards. The expected post-cutover state was 1–2 survivors. The actual
post-#417 count: still 3.

**Why:** `AssemblerPlus.main` and `InterpreterPlus.main` + `loadExecutableBuffer` were
never in #417's scope. The issue's "expected survivors" table was optimistic about what a
single narrow DEV ticket would accomplish. The hazard surface changed for AssemblerPlus
(4→3 overrides) but the shadow hazard *count* didn't move.

**The pattern:** Shadow hazard analysis checks for *new* risks introduced by a change,
not whether all *pre-existing* hazards were cleaned up. The right question after a narrow
cutover PR is "did we make it worse?" not "did we reach the ideal state?"

## 2. "Super-delegating" can be partial — HALT case in executeTRAP

**What happened:** #425 counted `InterpreterPlus.executeTRAP` as "super-delegating"
because its `default` case calls `super.executeTRAP()`. On re-inspection: HALT (case 0)
is handled directly without super.

**The nuance:** This is intentional — the plus HALT handler calls `resetProcessStdin()`
in addition to setting `this.running = false`, which is correct for the async/TTY model.
The core HALT handler only does `this.running = false`, so the plus version is a correct
superset. But if core HALT gains new behavior in the future, plus won't inherit it.

**Takeaway:** When classifying a partial-delegation override, note *which cases* delegate
and which are reimplemented. "Super-delegating" on the `default` arm doesn't protect the
explicitly handled cases.

## 3. No new hazards from `_instructionTable` registration pattern

**What happened:** #417 moved plus mnemonic registration from a method override into the
constructor. The concern at issue-time was whether registering into the shared table could
create new shadow risks (e.g., a core mnemonic getting silently replaced).

**Finding:** No. The constructor populates only plus-specific mnemonics (`clear`, `sleep`,
`nbain`, `cursor`, `srand`, `rand`, `millis`, `resetc`) that have no core counterparts.
The pattern is additive, not shadowing.

---

## What went well

- The issue included a ready-to-run analysis script; re-running it took < 2 minutes.
- Checking the core interpreter's HALT handler revealed the `executeTRAP` nuance was
  intentional, avoiding a false positive hazard report.

## What didn't go well

- Didn't capture the session start time before reading the issue — left `started_iso`
  empty in the velocity row. Timestamps should be captured before `gh issue view`, every
  time.
