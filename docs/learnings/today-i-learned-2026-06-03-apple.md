# Today I Learned — 2026-06-03 (APPLE)

**Date:** 2026-06-03  
**Agent:** APPLE  
**Context:** Parity research (#524) — probing whether `br 5` diverges from the oracle
— led directly to discovering and fixing LCC.js BUG §25 (#538). Three sharp lessons
came out of that chain.

---

## 1. A confirmed bug with no fix ticket is unfinished work

After #524 closed, the parity deviation was documented and the research issue was shut.
But no follow-up ticket existed for the fix. The human had to ask: "did you log your bug
as a ticket to be resolved?" — and the answer was no.

When a RESEARCH task confirms a divergence classified as LCC.js BUG, the deliverable
isn't just the write-up. It's the write-up **plus** a filed, actionable fix ticket
pointing at the root cause. Documentation without an action item is a dead end.

**The rule:** before closing any RESEARCH task that turns up a confirmed bug, check —
does a fix ticket exist? If not, file one as the last step, then close.

---

## 2. Pick the gate that blocks exactly what you mean to block

`assembleBL` uses `isValidLabel(label)` to reject bare integers. The temptation was to
copy that pattern into `assembleBR` verbatim. But `br *` (infinite loop) and `br *+5`
(skip forward) are legitimate LCC idioms — and `isValidLabel('*')` returns `false`,
which would break them.

The right gate for `assembleBR` is `isNumLiteral(operands[0])`: it catches `5`, `0x5`,
and `'A'` (char literals), while leaving `*`, `*+5`, and label names untouched. Copying
a gate without checking what it *excludes* on the valid path would have silently broken
real programs.

**The rule:** before adding a validation gate, enumerate the valid inputs that must
still pass. A gate that blocks the bad case but also breaks a legitimate case is a
regression in disguise.

---

## 3. `npm run close` checks HEAD specifically

The close script requires `Closes #N` to appear in the **HEAD commit**. If you commit
a velocity row or any follow-up commit after your closing commit, that later commit
becomes HEAD — and the script rejects with "HEAD commit does not reference Closes #N."

The cleanest fix is to put `Closes #N` in every commit that could become HEAD before
you run close, or to combine the velocity commit and closing commit into one.

**The rule:** if you add commits after a "Closes #N" commit, carry the `Closes #N`
footer forward into each one until you run `npm run close`. The script reads HEAD, not
history.

---

## What landed

| Artifact | Change |
|---|---|
| [#524](https://github.com/avidrucker/lccjs/issues/524) | RESEARCH closed — oracle rejects `br 5` / `brz 5` / `brn 5` with `Undefined label`; LCC.js silently assembled. Documented as §25 in `parity_deviations.md`. |
| [#538](https://github.com/avidrucker/lccjs/issues/538) | FIX closed — `isNumLiteral` gate added to `assembleBR`; 3 regression tests; §25 removed from LCC.js BUG section. |
| [#543](https://github.com/avidrucker/lccjs/issues/543) | This TIL. |
