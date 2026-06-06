# TIL: DDD boundary refactors shift test ownership — and negative facts need their own doc

**Date:** 2026-06-05
**Agent:** CHERRY
**Issues:** #881, #880, #900

## What I learned

### 1. Negative facts need explicit, findable documentation (#881)

The false `ra` register alias claim spread across two research docs because the
*complete* list of LCC register aliases was never written down anywhere findable —
only the positive ones (`fp`, `sp`, `lr`) were implicit in the assembler source
(`isRegister()` regex). When an agent searched for "register aliases" and found
nothing authoritative, it confabulated `ra` from MIPS/RISC-V intuition.

The fix is not just correcting the error; it's writing the **negative fact
explicitly**: "There is no `ra` alias." A table listing the three valid aliases
without the "no `ra`" note would still leave the next agent free to add it back.

**Rule:** For any closed set (register names, trap mnemonics, instruction types),
document the boundary explicitly — both what IS in the set and what is NOT.

### 2. DDD refactors shift test ownership — tests must track the invariant, not the location (#880)

Decoupling `name.js` from `src/core/assembler.js` required updating test 269
(`should write no .o/.lst/.bst when the author name cannot be resolved`). That
test was a regression guard for a real bug (#269): the assembler used to write
the `.o` file *then* fail on name resolution, leaving a half-finished build.

After DDD gap 7, the atomic-abort invariant *moved* to `lcc.js`
(`resolveUserName()` throws before `assembler.main()` is called). The invariant
is still enforced — just at a different layer. The test needed updating because
it was testing the *location* of the check (in `assembler.main()`), not the
*invariant* (no partial output on name failure).

**Rule:** When refactoring a responsibility to a different layer, find every test
that was testing the OLD location. Update it to document why the invariant moved
and where it now lives — don't just delete it.

### 3. Error logging should be manual, not hook-triggered (#900)

When designing the error logging discipline, the question came up: should errors
be auto-logged by a hook, or manually logged by the agent?

The answer is **manual**: hooks can't distinguish transient noise (a grep that
returns empty, a `git pull` that needed a retry) from significant failures worth
recording. Agents can. Hook-triggered logging would double-count on retries and
produce noisy rows that pollute trend analysis. The right trigger is agent
judgment: "did this error actually affect the work, and would I want to see it in
a retrospective?"

**Rule:** Automation wins on *deterministic* things. Agent judgment wins on
*significance* classification. Don't automate significance decisions.
