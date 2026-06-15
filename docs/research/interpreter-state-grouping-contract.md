# Interpreter State Grouping — API Contract Research (#388)

**Date:** 2026-06-01  
**Role:** RESEARCH → ARC decision pending  
**Parent:** #255 (H4 decomplect), #246 (hotspots)

---

## What this doc is

Measured blast radius + option analysis for #255's "group interpreter constructor
fields" refactor. The issue (#388) found the original 45m/DEV estimate was too low
because an unresolved public-API decision made the scope unbounded. This doc measures
the actual external surface, identifies the key architectural insight that shrinks it,
and hands off a scoped decision to the architect.

---

## Key insight: `createExecutionResult` already isolates tests

The issue description (#388) counted ~50 external `result.*` test references as part
of the breaking-change blast radius. That count is misleading. Tests access the
**return value of `createExecutionResult()`**, not `interpreter.*` directly:

```js
// createExecutionResult() (interpreter.js:222+) returns:
{ output, mem, registers, pc, instructionsExecuted, maxStackSize,
  loadPoint, memMax, headerLines, lstContent?, bstContent? }
```

`result.output` comes from `this.output` inside `createExecutionResult`, not from any
external access to `interpreter.output`. Moving `this.output → this.io.output`
**only requires updating the 10 lines inside `createExecutionResult`**, not the 41
test assertions.

This collapses the "external surface" to a much smaller set.

---

## Actual external surface (the real constraint)

### `lcc.js` writes 6 fields before run:

```js
interpreter.options              = this.options;
interpreter.debugMode            = !!this.options.debug;
interpreter.allowRuntimeDebugging = true;
interpreter.traceMode            = !!this.options.trace;
interpreter.sourceMap            = this.assembler.sourceMap;  // conditional
interpreter.inputBuffer          = this.inputBuffer;          // conditional
```

### Tests write 2 fields:

```js
interpreter.generateStats = true;   // name.integration.spec.js (×2)
interp.inputBuffer = '...';         // interpreter.oracle.e2e.spec.js + interactive.unit.spec.js
```

### `iinterpreter.js` reads 9 fields at runtime:

```js
this.r, this.mem, this.pc, this.ir, this.n, this.z, this.c, this.v  // machine state
this.running                                                           // loop control
// Also inherits: loadPoint, memMax (used in display)
```

### `ilcc.unit.spec.js` reads:

```js
ilcc.interpreter.r[0]  // one test
```

### `interactive.unit.spec.js` writes/reads:

```js
interp.initialMem = interp.mem.slice();  // setup
interp.inputBuffer = '...';              // setup
interp.r[0], Array.from(interp.r)        // assertions
```

**Total actual external field references: ~25 across 6 files** — not ~450.
The ~450 count included all internal `this.*` usages inside `interpreter.js` itself.

---

## Field inventory and proposed buckets

### `cpu` — machine state (ISA-defined)

| Field | External readers |
|-------|-----------------|
| `mem` | `iinterpreter`, `interactive.unit.spec.js`, `createExecutionResult` |
| `r` | `iinterpreter`, `ilcc.unit.spec.js`, `interactive.unit.spec.js`, `createExecutionResult` |
| `pc` | `iinterpreter`, `createExecutionResult` |
| `ir` | `iinterpreter` |
| `n`, `z`, `c`, `v` | `iinterpreter` |
| `running` | `iinterpreter` |

### `io` — I/O buffers

| Field | External readers |
|-------|-----------------|
| `output` | `createExecutionResult` only |
| `inputBuffer` | `lcc.js`, `interpreter.oracle.e2e`, `interactive.unit.spec.js` |

### `diag` — diagnostics / debug control

| Field | External readers |
|-------|-----------------|
| `traceMode` | `lcc.js` (write only) |
| `debugMode` | `lcc.js` (write); `interpreter.unit.spec.js` (read) |
| `debugBreakpoint` | none (internal) |
| `disableInfiniteLoopDetection` | none (internal) |
| `allowRuntimeDebugging` | `lcc.js` (write) |
| `maxSteps` | `lcc.js` (write via `--max-steps`); `interpreterplus.js` bypasses via `disableInfiniteLoopDetection` |
| `hasJumped` | none (internal) |

### `opts` — run-time configuration (set by caller before run)

| Field | External readers |
|-------|-----------------|
| `options` | `lcc.js` (write only) |
| `generateStats` | `name.integration.spec.js` (write); `interpreter.oracle.e2e` (write) |
| `inputFileName` | `lcc.js` (indirect, via `loadExecutableFile`) |
| `sourceMap` | `lcc.js` (write); used internally for `.lst` generation |

### `acct` — execution accounting (report state)

| Field | External readers |
|-------|-----------------|
| `instructionsExecuted` | `createExecutionResult` only |
| `maxStackSize` | `createExecutionResult` only |
| `loadPoint` | `createExecutionResult`, `iinterpreter` (display) |
| `spInitial` | `createExecutionResult` only |
| `memMax` | `createExecutionResult`, `iinterpreter` (display) |
| `headerLines` | `createExecutionResult` only |
| `initialMem` | `interactive.unit.spec.js` (write), `iinterpreter` (internal reset) |

---

## Decision 1 — public API contract options

### Option A: internal-only regroup, flat external surface

Move fields into sub-objects internally (`this.cpu.mem`, `this.io.output`, etc.) but
expose all externally-accessed fields via `Object.defineProperty` getters/setters at
the old path (`interpreter.r`, `interpreter.mem`, etc.).

**Blast radius:** ~6 `Object.defineProperty` calls + update `createExecutionResult`.
No changes to `lcc.js`, tests, or `iinterpreter`.

**Pros:** Safe, zero consumer churn, demonstrates the grouping pattern.  
**Cons:** Dual naming is confusing long-term; doesn't force callers to update.  
**Effort:** ~60m per group (slightly more than original estimate due to getter boilerplate).

### Option B: breaking regroup, update all consumers

Move fields and update `lcc.js`, `iinterpreter.js`, and affected tests.

**Blast radius:** 6 `lcc.js` lines + ~25 `iinterpreter` internal uses + ~10 test
lines + `createExecutionResult` body. NOT 450 references — most are internal to
`interpreter.js` itself and move with the field.

**Pros:** Clean, no dual naming, forces all callers to the new contract.  
**Cons:** Multi-file change; `iinterpreter.js` has 48 `this.*` references that
inherit from the parent and would need updating if `cpu.*` shapes change.  
**Effort:** ~2–3h total across all groups (but each group is shippable independently).

### Recommendation

**Option B, but phase it by group and start with `diag` + `opts`** — those have
zero or trivial external consumers (`lcc.js` writes only; no reads from
`iinterpreter` or tests). `diag` can ship as an independent 45m puzzle with no
consumer changes at all. `opts` requires 4 `lcc.js` lines to update. Together,
`diag` + `opts` clear the easiest ~half of the constructor without touching the
sensitive `cpu` fields that `iinterpreter` reads.

`cpu` and `io` group updates (which touch `iinterpreter`, `lcc.js`, and a handful
of test lines) are separate subsequent puzzles, gated on the architect's sign-off.

---

## Decision 2 — the 5-bucket scheme

The original 3-bucket proposal (`cpu`/`io`/`diag`) was incomplete. The verified
inventory suggests 5 groups:

| Bucket | Fields | External writes | External reads |
|--------|--------|-----------------|----------------|
| `cpu` | `mem, r, pc, ir, n, z, c, v, running` | none | `iinterpreter`, `ilcc.unit.spec.js`, `interactive.unit.spec.js` |
| `io` | `output, inputBuffer` | `lcc.js`, tests | `createExecutionResult` |
| `diag` | `traceMode, debugMode, debugBreakpoint, disableInfiniteLoopDetection, allowRuntimeDebugging, maxSteps, hasJumped` | `lcc.js` (5 fields) | 1 test read (`debugMode`) |
| `opts` | `options, generateStats, inputFileName, sourceMap` | `lcc.js`, tests | none |
| `acct` | `instructionsExecuted, maxStackSize, loadPoint, spInitial, memMax, headerLines, initialMem` | none | `createExecutionResult`, `iinterpreter` (2 display fields) |

`initialMem` is only used by `iinterpreter.js` for state-restore; it could live in
`iinterpreter` instead of the base interpreter. Flag for architect.

---

## Decision 3 — ordering

`diag` + `opts` can ship before H1 work and don't interact with H1a/H1b.
`cpu` + `io` + `acct` should coordinate with H1b (observer lift-out) because H1b
reshapes how `step()` accesses registers and flags — doing both in the same pass
saves a second round of field-renaming.

Recommended sequence: **`diag` → `opts` → (H1a → H1b) → `cpu` → `io`/`acct`**.

---

## Proposed sub-puzzle decomposition (for ARC to confirm/replace)

Replace the `#255` placeholder marker with per-group markers once architect decides:

1. **`diag` grouping** — move `traceMode, debugMode, …` into `this.diag.*`; update 5 `lcc.js` write lines + 1 test read. `~45m/DEV`. No `iinterpreter` impact.
2. **`opts` grouping** — move `options, generateStats, inputFileName, sourceMap` into `this.opts.*`; update 4 `lcc.js` write lines + 2 test writes. `~30m/DEV`.
3. **`cpu` grouping** — move `mem, r, pc, ir, n, z, c, v, running` into `this.cpu.*`; update `iinterpreter` internal refs + 3 test-file references. `~90m/DEV`. Gate on H1b completion.
4. **`io` grouping** — move `output, inputBuffer` into `this.io.*`; update `lcc.js` + `createExecutionResult`. `~30m/DEV`.
5. **`acct` grouping** — move accounting fields into `this.acct.*`; update `createExecutionResult` + 2 `iinterpreter` display refs. `~30m/DEV`.

Total: ~225m across 5 sub-puzzles. Original estimate was 45m/DEV for the entire
module — that was scoped to a 3-bucket flat restructure and missed the `iinterpreter`
dependency. The revised estimate is still tractable if phased.

---

## Files to update (summary)

| File | Groups affected | Change type |
|------|----------------|-------------|
| `src/core/interpreter.js` | all | field renames (internal), `createExecutionResult` body |
| `src/core/lcc.js` | `diag`, `opts`, `io` | write-side injection updates (≤10 lines) |
| `src/interactive/iinterpreter.js` | `cpu`, `acct` | read-side updates (~25 lines) |
| `src/interactive/ilcc.js` | `cpu` | 1 line |
| `tests/new/name.integration.spec.js` | `opts` | `generateStats` → `opts.generateStats` |
| `tests/new/interpreter.oracle.e2e.spec.js` | `opts`, `io` | 2 lines |
| `tests/new/interactive.unit.spec.js` | `cpu`, `io`, `acct` | ~8 lines |
| `tests/new/ilcc.unit.spec.js` | `cpu` | 1 line |
| `tests/new/interpreter.unit.spec.js` | `diag` | 2 lines (`debugMode` read) |
