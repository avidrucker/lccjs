# Inheritance-vs-Composition Audit

**Issue:** #1345 · **Role:** RESEARCH (read-only; no production code changed) · **Date:** 2026-06-15 · **Agent:** APPLE

## Purpose

Map every `class … extends …` site in `src/` under a single lens — *is inheritance the right
tool here, or would composition (delegation / strategy / registry / observer hooks) be
materially better?* — and produce a sequenced refactor recommendation that future
DEV/ARCHITECT tickets can act on. This doc **recommends**; it does not refactor, and it
creates no follow-up tickets (that is a separate step, pending human go-ahead — see
[Scope guard](#scope-guard)).

### Relationship to existing work

- **vs `docs/do-this-not-that.md`** — that doc is tactical ("use X not Y"); this is a one-time
  structural audit of the inheritance edges.
- **vs the interpreter-decomplect program (#429 tracker, #255, #252, #873)** — that program
  decomplects interpreter *state* and *display*; this audit looks at the *subclassing edges*.
  They overlap at `IInterpreter` and the interpreter dispatch — cross-referenced, not duplicated.
- **vs the plus-subclass shadow-hazard research (#425, #432, #896, #417)** — that work reactively
  counted/shrank overridden methods; this consolidates those findings into an
  inheritance→composition verdict. Prior artifacts: `docs/research/plus-shadow-hazard-baseline.md`,
  `docs/learnings/today-i-learned-2026-06-01-dragonfruit-4.md`.

## Inventory (every `extends` in `src/`)

`grep -rn "extends " src/ --include=*.js` → four families:

| # | Site | Base | Kind | Verdict |
|---|------|------|------|---------|
| 1 | `src/utils/errors.js` — `LccError` + 7 subclasses | `Error` / `LccError` | Typed-error identity hierarchy | ✅ **Appropriate** |
| 2 | `src/plus/assemblerplus.js` — `AssemblerPlus` | `Assembler` | Behavioral subclass | ⚠️ **Mostly mitigated** (low ROI remaining) |
| 3 | `src/plus/interpreterplus.js` — `InterpreterPlus` | `Interpreter` | Behavioral subclass | ⚠️ **Composition preferred** (highest ROI) |
| 4 | `src/interactive/iinterpreter.js` — `IInterpreter` | `Interpreter` | Instrumentation + UI subclass | ⚠️ **Composition preferred** (UI⊗engine) |

---

## 1. `errors.js` hierarchy — ✅ APPROPRIATE (do not touch)

`LccError extends Error`; `AssemblerError`, `LinkerError`, `InterpreterRuntimeError`,
`InvalidExecutableFormatError`, `TestSpecError`, `TestRunnerError` each `extends LccError` with
**empty bodies** — they add no behavior, only a distinct type/`name` for `instanceof`-based
catch routing at the pure-seam↔CLI boundary.

This is the canonical legitimate use of inheritance: a genuine *is-a* with a stable base and
zero behavioral override. Composition (an error with a `kind` string field) would be **strictly
worse** — it breaks `instanceof`, loses stack-trace ergonomics, and complicates `catch`. **Leave
as-is.** (Aside: `InputPauseSignal` already correctly does *not* extend `Error` — it's a
control-flow signal, not an error. Good.)

---

## 2. `AssemblerPlus extends Assembler` — ⚠️ mostly mitigated, low ROI remaining

### Coupling found

| Override | `super`? | Note |
|---|---|---|
| `constructor` | ✓ | Adds `isLCCPlusFile`; registers 13 LCC+ mnemonics into the inherited `_instructionTable` |
| `main(args)` | ✗ | **Full reimplementation** of the two-pass orchestration for `.ap`/`.ep` — the one real shadow hazard |
| `_getValidDirectives` | ✓ | Appends `.lccplus` |
| `handleDirective` | ✓ | Handles `.lccplus`, else delegates |
| `writeOutputFile` | ✓ | Calls `super.writeOutputFile('p')` for the plus header |

Base-field reliance is moderate and confined to `main()` (`pass`, `locCtr`, `errorFlag`,
`startLabel`, `startAddress`, …).

### Why it's mostly fine already

The high-value conversion **already happened** in #417: mnemonics are *registered into a shared
table* in the constructor rather than dispatched via an overridden `handleInstruction`. There is
also a `registerExtension()` hook for external mnemonic modules. That is exactly the
composition-flavored pattern we'd otherwise recommend — adding a core mnemonic can no longer be
shadowed.

### Composition alternative (for the remainder)

The residual coupling is `main()` duplicating the two-pass driver. Extract the pass-1/pass-2
orchestration into a shared free function (e.g. `runTwoPass(assembler, opts)`) that both
`Assembler.main` and `AssemblerPlus.main` call, so the plus entry configures (`.ap` validation,
`.ep` naming) rather than re-implements. The small super-delegating overrides
(`_getValidDirectives`, `handleDirective`, `writeOutputFile`) are healthy extension points and can
stay.

**Cost/benefit:** modest. Removes one duplicated orchestration path and the lone shadow hazard,
but the blast radius (touching `Assembler.main`) and test surface aren't trivial relative to the
payoff. **Low priority.**

---

## 3. `InterpreterPlus extends Interpreter` — ⚠️ composition preferred (highest ROI)

### Coupling found

| Override | `super`? | Note |
|---|---|---|
| `constructor` | ✓ | Adds `keyQueue`, `seed`, `nonBlockingInput`, `screenManipulated`; **mutates** inherited `disableInfiniteLoopDetection = true` |
| `executeTRAP` | ✓ (fallback) | `_extTrapHandlers` table lookup → hardcoded `switch` for vectors 0xF5–0xFF → `super.executeTRAP()` for core |
| `executeCase10` | ✓ (fallback) | `EOP_RAND` → else `super.executeCase10()` |
| `loadExecutableBuffer` | ✗ | Reimplemented for `.ep` verification |
| `main` | ✗ | Reimplemented for `.ep` + non-blocking input |

15 new methods (the trap handlers + async loop + error funnel) and a `registerExtension()` hook
feeding `_extTrapHandlers`.

### Why composition is preferred

This site **best demonstrates the target pattern and the gap at once.** It already has the right
seam — an `_extTrapHandlers` registry plus `registerExtension()` — but the LCC+ traps themselves
are *not* registered through it; they're a hardcoded `switch` in an override, with the
high-vector range (0xF5–0xFF) reserved only by convention. This is precisely the shadow hazard
CLAUDE.md warns about: a change to base `executeTRAP`/`step`/dispatch can silently break LCC+.

The proven fix is the **#417 pattern applied to the interpreter**: have the *base* Interpreter own
a trap-vector dispatch **table** (and an eopcode table) that both core and plus register into.
LCC+ then becomes a *configuration* of a base Interpreter — register its trap handlers + `EOP_RAND`
+ its option flags — instead of a subclass that overrides dispatch. `.ap` execution would
construct a configured core `Interpreter`, not an `InterpreterPlus`.

**Cost/benefit:** highest payoff in the audit — removes the documented shadow hazard and unifies
core/plus dispatch on one mechanism the codebase already trusts (#417). But it's a genuine
refactor: base dispatch becomes table-driven, and the trap/eopcode handlers (which read/write
base CPU state: `mem`, `r`, `pc`, `running`, decoded fields) need a clear `this`/context contract.
**Medium-high priority; scope via an ARC ticket before any DEV.**

---

## 4. `IInterpreter extends Interpreter` — ⚠️ composition preferred (UI ⊗ engine)

### Coupling found

| Override | `super`? | Note |
|---|---|---|
| `constructor` | ✓ | Adds 13 fields (snapshot/time-travel + display config) |
| `writeOutput` | ✓-ish | Captures program I/O to `programOutput` |
| `storeMem` | ✓ | Records old value **before** `super.storeMem()` — undo-log instrumentation |
| `step` | ✓ | Calls `super.step()` then snapshots the state delta |

Plus **25+ new methods**, the large majority being **terminal UI** (pane layout, box drawing,
register/memory/stack/code display, the interactive prompt loop, help).

### Why composition is preferred

Two distinct entanglements here:

1. **Instrumentation via inheritance.** `step` and `storeMem` are overridden only to *observe*
   base behavior (snapshot deltas, undo-log). That is the textbook case for an **observer hook**:
   the base exposes `onStep` / `onMemWrite` callbacks, and the debugger registers an observer that
   records snapshots — no subclassing of the execution engine required. This aligns directly with
   **#252** (lift trace + register-diff display out of `step()` into an observer) and the state
   grouping of **#255**.
2. **UI ⊗ execution engine.** 25+ display/prompt methods live *on the interpreter subclass*. A
   debugger UI *has-a* interpreter; it is not *an* interpreter. These belong in a separate
   debugger/controller object that drives a base `Interpreter` (or its observer), independent of
   the execution engine.

### Composition alternative

Split into: (a) a base `Interpreter` that emits `onStep`/`onMemWrite` (the observer hooks #252
wants), and (b) a `DebuggerController` (the current UI + stepping + snapshot logic) that *owns* an
`Interpreter` and subscribes to its hooks. `instanceof Interpreter` is not relied upon by callers
(`ilcc.js` constructs it directly and calls inherited `loadExecutableFile` then the new
`runInteractive`), so the is-a is incidental, not load-bearing.

**Cost/benefit:** medium. Big changeability/testability win (UI testable without the engine; engine
unburdened of debugger state) and it converges with the existing decomplect program — but it's the
largest surface of the three. **Medium priority; fold into the #429 decomplect tracker / coordinate
with #252 + #255 rather than running standalone.**

---

## Recommended refactor sequence

Ordered by ROI ÷ risk. Each names a **ticket shape** only — none are filed here.

1. **[ARC → DEV] Table-driven interpreter trap/eopcode dispatch** (site 3). Promote
   `_extTrapHandlers` to the primary mechanism; base owns trap + eopcode registries; core and plus
   both register; `.ap` runs a *configured* `Interpreter`. Mirrors #417. **Highest ROI** — kills
   the shadow hazard CLAUDE.md warns about. Needs an ARC scoping pass first (the `this`/context
   contract for handlers).
2. **[ARC, coordinate with #252/#255/#429] `IInterpreter` → observer + `DebuggerController`**
   (site 4). Base emits `onStep`/`onMemWrite`; debugger UI/stepping becomes a HAS-A driver. Do
   **not** run standalone — graft onto the existing decomplect tracker.
3. **[refactor DEV] Extract shared two-pass driver** so `AssemblerPlus.main` configures rather
   than duplicates (site 2). Low ROI; do opportunistically.
4. **[none] `errors.js`** (site 1). Leave as-is; appropriate inheritance.

## Cross-cutting observation

The codebase is **already mid-migration toward the preferred pattern** — registration tables and
`registerExtension()` hooks exist in *both* plus classes, and #417 converted the assembler's
mnemonic dispatch. The recommendations above are "finish the migration that's underway"
(extend the table/hook pattern to interpreter dispatch and to debugger instrumentation), not
"introduce composition from scratch." That lowers conceptual risk: we're standardizing on a
seam the project already trusts.

## Scope guard

Research only — **no production code was changed** by this ticket, and **no follow-up tickets were
created**. The sequence above is a recommendation; filing the ARC/DEV children (and deciding
whether to action them at all) is a separate step pending human go-ahead.
