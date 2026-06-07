# SPIKE #1043 — Reverse execution / scope step-back in the ilcc debugger

**Agent:** BANANA · **Role:** SPIKE · **Parent:** #931 (triage item 1.6) · **Related:** #252, #134
**Date:** 2026-06-06 · **Time-box:** ≤60m, research only

---

## TL;DR — the premise is stale; rewind already exists

The issue's *Have* says ilcc "steps forward only (`s`, `g`). There is no rewind," and that the
only captured state is the pairwise `prevSnap`/`currSnap` used by the register-diff pane.

**Both claims are out of date.** Reading `src/interactive/iinterpreter.js` (current `main`, 721 lines):

1. **There are no `s`/`g` commands.** The command surface is a numeric step: `{N}` forward,
   `{-N}` **backward** (`runInteractive`, lines 640–664; help text lines 700–718).
2. **A full rewindable history already exists** — not pairwise snapshots. `this.snapshot[]` is a
   per-step undo-log (`step()` lines 101–160), and backward stepping is implemented and tested:
   `handleSteps(stepNumber)` (lines 173–186) → `restorePrevState(target)` (196–214) →
   `restorePrevMemory(state)` (218–225). Tests cover forward-then-back register/flag/memory
   restoration (`tests/new/interactive.unit.spec.js`, `describe('IInterpreter.handleSteps()')`,
   lines 200–272).

So the design question in the issue ("full-state vs delta/undo-log; cadence") **is already
answered by the implementation**: per-step delta/undo-log, one entry per instruction, cheap.

The real, fileable work is not "build reverse execution" — it is **closing the three faithfulness
gaps in the rewind that already ships**, plus the determinism boundary the issue correctly flags.
This doc re-scopes accordingly and decomposes those gaps into DEV puzzles.

---

## 1. Snapshot strategy — already decided (delta/undo-log, per step)

`initSnapshot()` captures `snapshot[0]` = full initial machine state (registers, flags, pc, and a
memory delta whose `new` holds the **entire** loaded region `loadPoint..memMax` — one-time, lines
72–86). Every subsequent `step()` pushes a **delta** entry: registers (8 words), flags (4),
pc/ir/running, and a **single-word** memory delta `{address, old:[w], new:[w]}` (lines 132–139).

Backward step does not pop/mutate the log; it restores CPU directly from the target entry and
replays memory deltas in reverse from `currentIteration` down to `target+1` (lines 208–213), so a
later forward step cleanly overwrites (`nextIdx < length` branch, lines 146–149).

**Cost.** Per-entry payload is tiny (~12 scalars + a 1-word delta). The dominant cost is the
**per-step full-region scan** to detect the changed word: `O(memMax − loadPoint)` every step
(lines 121–129). For the instruction-cap-sized programs ilcc runs this is fine, but two notes:
- The default cap is **500 000 instructions** (`ilcc.js -i<N>`, default 500000). 500k JS objects
  each ~hundreds of bytes ≈ tens of MB — bounded, but a long `g`-to-end with a large program is
  not free. A history-depth cap / ring buffer is a possible future guard (not urgent — interactive
  stepping rarely reaches the cap).
- `-e` **efficient mode** already exists as the escape hatch: it keeps only the two most-recent
  entries and **disables backward stepping** (lines 150–158, 181). By design.

**Verdict:** no strategy change needed. The undo-log is the right shape. The remaining work is
**what** each delta captures, not how the log is structured.

## 2. State surface — what rewinds faithfully today, and the three gaps

| State | Captured? | Where | Notes |
|-------|-----------|-------|-------|
| Registers r0–r7 | ✅ | `step()` 136, restore 206 | full array each step |
| Flags N/Z/C/V | ✅ | 137, restore 202–205 | |
| pc / ir / running | ✅ | 133–135, restore 200–201 | |
| Memory **inside** `loadPoint..memMax` | ✅ | scan 121–129, restore 218–225 | self/data writes (ST to program region) |
| **Memory on the stack** (high addr) | ❌ **GAP A** | — | scan is bounded to `loadPoint..memMax`; SP starts at top of memory and grows **down**, far above `memMax`. Header comment line 94 admits: *"stack writes (outside memMax) are not tracked here."* |
| **stdin cursor** (`inputBuffer` position) | ❌ **GAP B** | — | din/ain/sin consume `this.inputBuffer` (core `readLineFromStdin`/`readCharFromStdin`). Not in the snapshot; step-back then re-forward across an input trap re-consumes / desyncs input. |
| **Output position** (`programOutput` length) | ❌ **GAP C** | — | `writeOutput()` only **appends** (lines 60–63). Backward step does not truncate it, so the Output pane shows "future" output after a rewind. |

### Gap A — stack memory is not rewindable (highest severity)

The memory-change detector scans only the loaded program region. The LCC stack lives at the top of
the 64K space (`sp` initialises to the high end and grows downward; calls, `push`, locals, saved
`fp`/`lr` all write there). None of those words fall in `loadPoint..memMax`, so:
- the per-step delta records `hasChanged:false` for any pure stack write, and
- `restorePrevState` therefore **cannot undo** it — after stepping back across a `call`/`push`,
  register `sp` is restored but the **stack contents are not**.

This is the single biggest correctness hole: any program that uses subroutines or locals (i.e.
most non-trivial teaching programs) rewinds with stale stack memory. The existing `ST_EXE` test
only writes to address `3` (inside the program region), so the gap is **untested**.

**Fix options:**
- **A1 (recommended): unbounded changed-word capture.** Replace the bounded scan with a
  write-hook: have the interpreter record the address+old value at the point of every memory store
  (ST/STR and any trap that writes memory) regardless of region. Cleanest source of truth; ties
  into the #252 observer/trace refactor (a store-observer is exactly what that wants). Removes the
  per-step full-region scan entirely (perf win).
- **A2 (cheaper, dirtier): widen the scan** to also cover a stack window (e.g. `sp-δ .. top`), or
  diff the whole 64K. Whole-64K diff per step is `O(65536)` — too slow at scale. A stack window
  is heuristic and can miss writes via arbitrary pointers.

A1 is the right long-term shape and dovetails with #252; A2 is a stopgap. Recommend A1.

### Gap B — stdin cursor not snapshotted (determinism boundary, see §4)

### Gap C — output position not restored (cosmetic but misleading, see §4)

## 3. Command surface — already partly built; gaps vs. the issue's wish-list

| Wished (issue) | Reality on `main` |
|----------------|-------------------|
| `sb` / `step-back N` | Already exists as `{-N}` (numeric, negative). A `sb`/`b` **alias** would be friendlier and matches the issue's vocabulary, but the capability is there. |
| Interaction with `s`/`g` | There is no `s` or `g`. Forward is `{N}`; `<enter>` repeats last step; `0` redisplays. **There is no run-to-end (`g`) and no breakpoints at all.** |
| Pane layout interaction | Panes already re-render against `snapshot[currentIteration]` after any step (`render()` lines 549–559), so backward step already updates every pane. The halted-state banner already tells the user to "Step back with -N" (line 556). |

Two genuinely-missing command-surface items worth puzzles:
- A `g` **run-to-end / run-to-breakpoint** command (the issue assumed it exists). Pairs naturally
  with reverse execution: run forward fast, then rewind. Breakpoints are a prerequisite for the
  "rewind to the moment before the bug" student story the #931 triage sells.
- A named `sb`/`b` alias for `{-N}` for discoverability.

## 4. Determinism caveats — the boundary the issue is right about

Rewinding **execution state** does not rewind **side effects that already left the machine**:

- **Output already printed.** In interactive mode all program I/O is buffered into `programOutput`
  rather than stdout (the override exists precisely so it lands in the Output pane), so output is
  *recoverable* here — Gap C is a real, fixable bug (truncate `programOutput` to a per-step length
  on rewind). **But** in **batch `-n` mode** output goes straight out and cannot be un-printed.
  Document the boundary: rewind restores the *pane*, never a real terminal that already scrolled.
- **stdin already consumed (Gap B).** Once din/ain/sin advances `inputBuffer`, the bytes are gone
  from the buffer. To rewind *faithfully* the snapshot must record the `inputBuffer` value (or a
  cursor into the original input) so re-forwarding replays the same input. Without it, re-forward
  across an input trap reads the *next* line, not the one it read before — silent divergence.
  Fix: snapshot `inputBuffer` (string is cheap) in `step()` and restore it in `restorePrevState`.
- **Non-determinism (`rand`, `millis`) — LCC+ only.** ilcc is base-ISA (`ilcc.js` assembles `.a`,
  no `.ap`), so this does not bite today, but if interactive LCC+ ever lands, rewinding past a
  `rand`/`millis` trap must replay the recorded result, not re-roll. Note for the future, out of
  scope now.

**Boundary statement for the docs:** *ilcc reverse stepping restores the simulated machine
(registers, flags, all memory, consumed input) and the Output pane. It does not, and cannot,
un-print to a real terminal (batch mode) or undo external effects. Reverse execution is a
re-simulation tool, not a true time machine.*

## 5. Decomposition — DEV child puzzles (each ≤60m)

Ordered by leverage. A–C are the faithfulness gaps; D–E are the command-surface adds.

1. **DEV ~45m — Gap A: capture stack/out-of-region memory writes in the undo-log.**
   Record every memory store's address+old value (write-hook, option A1) so `restorePrevState`
   undoes stack writes. Regression test: a `call`/`push` program, step over the push, step back,
   assert stack word restored. Coordinate with #252 (observer refactor). *Highest severity —
   current rewind is silently wrong for any program that touches the stack.*

2. **DEV ~30m — Gap B: snapshot & restore the stdin cursor.**
   Add `inputBuffer` to each `step()` log entry; restore it in `restorePrevState`. Test: program
   reads a line via `din`, step past it, step back, step forward, assert the same line is re-read.

3. **DEV ~25m — Gap C: truncate `programOutput` (Output pane) on backward step.**
   Record `programOutput.length` per entry; on `restorePrevState` slice the buffer back. Test:
   step past a `dout`, step back, assert the Output pane no longer shows it.

4. **DEV ~40m — `g` run-to-end + minimal breakpoints (`bp {addr|label}`).**
   Forward-run until halt or a breakpoint PC; enables the "run, then rewind to before the bug"
   workflow. Depends on nothing above but is most useful once A lands.

5. **DEV ~15m — `sb`/`b` alias for `{-N}`, and a help/`displayHelp()` line documenting reverse
   execution + the determinism boundary** (so the feature is discoverable; today only the halt
   banner hints at it).

**Also recommended (PM, separate):** redline-correct the #1043 body — the stale `s`/`g`/"no
rewind" premise — per the *Correct issues non-destructively* convention (strikethrough + banner +
correction comment). This SPIKE's summary comment serves as the correction record.

## Out of scope (confirmed)

- Implementation (produced as the puzzles above).
- LCC+ interactive / non-deterministic-trap replay (no interactive `.ap` path today).
- History-depth ring buffer (cost is bounded today; revisit only if profiling shows it).

## Source anchors

- `src/interactive/iinterpreter.js`: `step()` 101–160 · `handleSteps()` 173–186 ·
  `restorePrevState()` 196–214 · `restorePrevMemory()` 218–225 · `writeOutput()` 60–63 ·
  `runInteractive()` 543–669 · `displayHelp()` 700–718.
- `src/interactive/ilcc.js`: option/`-e`/`-i<N>` wiring 84–121, 160–164.
- `src/core/interpreter.js`: `inputBuffer` + `readLineFromStdin()` 1344–1357 ·
  `maxSteps` cap 181–227 · `loadPoint`/`memMax` 138–148, 619–627.
- `tests/new/interactive.unit.spec.js`: `handleSteps()` forward/backward suite 200–272 (note:
  the only memory-restore test writes inside the program region — Gap A is uncovered).
