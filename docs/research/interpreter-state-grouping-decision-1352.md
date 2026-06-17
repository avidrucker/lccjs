# Interpreter State-Grouping — Restrategize Decision (#1352)

**Date:** 2026-06-16
**Role:** SPIKE (ARC), 60m time-box
**Supersedes the plan in:** `docs/research/interpreter-state-grouping-contract.md` (#388)
**Closes:** #1352 · **Re-scopes:** #255 (closed, over-scoped) · **Disposition for:** #872, #873 (both already closed)

---

## Ruling: **DEFER the whole effort; permanently DROP the `cpu`/`io`/`acct` standalone regroup.**

In one line: state-grouping is a *cosmetic* decomplect of a severity:low god-object, and the
portion that carries real value (`cpu`/`io`) now collides head-on with the *structural* decomplect
the #1345 audit prescribes (#252 observer lift-out, #1346 table-driven dispatch). Doing it as
field-bucketing first means re-touching the same references twice. So we don't.

This is one of the legitimate outcomes the spike enumerated ("defer until after #1346", "drop
`cpu`/`io` regroup entirely"). It is recorded as a single ruling with three parts below.

---

## Why (the ROI-vs-risk call the spike was asked to make)

The #388 contract's own measurement is the evidence. Bucket-by-bucket, weighed against the new
context:

| Bucket | Fields | External surface (per #388) | Collides with #252/#1346/#1345? | Verdict |
|--------|--------|------------------------------|----------------------------------|---------|
| `cpu` | `mem, r, pc, ir, n, z, c, v, running` | `iinterpreter` (~25 reads), `interpreterplus` (29 refs), 3 test files | **Yes — directly.** These *are* the engine-state fields #252's observer hooks and #1346's trap-dispatch table reshape; `iinterpreter`/`interpreterplus` are the two classes #1345 wants converted to composition. | **DROP (subsumed)** |
| `io` | `output, inputBuffer` | `lcc.js`, `createExecutionResult`, tests | Partly — `inputBuffer`/`output` flow through the same `step()`/result path #252 touches. | **DROP (subsumed)** |
| `acct` | `instructionsExecuted, maxStackSize, loadPoint, …, initialMem` | `createExecutionResult`, `iinterpreter` display, `initialMem` only used by `iinterpreter` | Partly — `initialMem` belongs in the future `DebuggerController`, not the base. | **DROP (subsumed)** |
| `diag` | `traceMode, debugMode, …, hasJumped` | `lcc.js` writes 5, 1 test reads `debugMode`. No engine reads. | No — orthogonal to the composition work. | **DEFER (not worth it standalone)** |
| `opts` | `options, generateStats, inputFileName, sourceMap` | `lcc.js` writes 4, 2 test writes. No engine reads. | No — orthogonal. | **DEFER (not worth it standalone)** |

Two distinct reasons, one per group of buckets:

**1. `cpu`/`io`/`acct` — drop because they are double-churn against the audit.**
The #1345 audit (§3, §4, recommended-sequence items 1–2) is explicit:
- `IInterpreter` should become an **observer + `DebuggerController`** that *owns* a base
  `Interpreter` and subscribes to `onStep`/`onMemWrite` hooks — and it says this "aligns directly
  with **#252** … and the state grouping of **#255**," to be done *"coordinate with #252/#255
  rather than running standalone."*
- `InterpreterPlus` should become a **configured** `Interpreter` via table-driven trap/eopcode
  dispatch (#1346), mirroring #417.

Both refactors rewrite exactly how `iinterpreter.js` (48 refs) and `interpreterplus.js` (29 refs)
reach `mem/r/pc/flags/running`. If we move those fields into `this.cpu.*` *first*, then land #252
and #1346, every one of those ~77 references gets edited twice — once for the bucket rename, once
for the observer/registry seam. The contract already half-saw this (Decision 3: "`cpu`+`io` should
coordinate with H1b"). The audit makes it decisive: the engine-state fields get their natural home
*as a byproduct* of the composition split, so a separate field-bucketing pass is redundant work
that also raises merge risk against the in-flight #252/#1346.

The owner's #1352 comment pre-authorized exactly this: *"the breaking cpu/io regroup (#873)…
default should be drop unless justified."* No justification survives the double-churn analysis.
**Dropped.**

**2. `diag`/`opts` — defer because alone they make the constructor *worse*, not better.**
These two are genuinely safe and orthogonal (lcc.js-write-only, no engine reads, untouched by the
composition work). The contract recommended shipping them first for that reason. But the spike's
job is ROI, and the ROI is now negative-to-flat:
- The *point* of the whole effort was one readable constructor instead of ~50 flat fields. If we
  drop `cpu`/`io`/`acct` (≈23 fields stay flat) and group only `diag`+`opts` (11 fields), the
  result is a **half-bucketed constructor** — `this.diag.x`, `this.opts.y`, but `this.mem`,
  `this.r`, `this.pc` still flat. The contract itself flagged "dual naming is confusing" as the
  con of partial regrouping. An inconsistent half-and-half constructor is arguably *less* readable
  than a uniformly-flat one.
- Severity is `low`. There is no correctness or velocity pressure that justifies paying for a
  cosmetic, internally-inconsistent intermediate state.

So `diag`/`opts` are **deferred**, not dropped: once #252 and #1346 land and the engine-state
shape is settled, a *single coherent* grouping pass (if still wanted) can bucket the whole
constructor at once. That re-evaluation is the only future ticket this spike authorizes, and it is
gated, not filed now (see "Code-marker strategy").

---

## Reconciliation of existing artifacts

| Artifact | State | Disposition |
|----------|-------|-------------|
| **#255** (parent, cpu/io/diag grouping) | CLOSED (over-scoped) | Stays closed. This doc is its terminal re-scope. |
| **#388 contract** (`…-contract.md`) | doc | **Superseded** by this decision — banner added at its head. Its *measurements* remain valid and are cited above; its *plan* (5 tickets, `diag → opts → cpu → io/acct`) is retired. |
| **#872** (diag bucket, phase 1) | CLOSED | **Do NOT refile.** Folded into the deferred whole-constructor re-eval. The owner's "refile a fresh diag ticket if go" door is consciously left unopened — see reason #2 (half-bucketed constructor). |
| **#873** (breaking cpu/io regroup, 1b) | CLOSED | **DROPPED — stays closed, do not refile.** Subsumed by #252 + #1346 + the #1345 `IInterpreter`→`DebuggerController` direction. |

No tickets are reopened or newly filed by this spike.

---

## Code-marker strategy (#1352 acceptance item 4)

- **No live `@todo` for this effort.** The claim tool already confirmed "no `@todo #1352` marker
  found"; none is added. The old `#255` placeholder marker is gone with #255's closure.
- Per yegor-pdd (no pre-decomposition): a puzzle marker is placed only when a unit is *about to
  start*. Since nothing starts now, nothing is marked.
- **Re-evaluation trigger (not a marker, a tripwire in this doc):** when **both #252 and #1346 are
  closed**, whoever lands the second one should open a fresh **≤30m ARC re-scope** asking: *given
  the post-composition constructor, is any state-grouping still warranted, and if so, can the whole
  constructor be bucketed in one coherent pass?* Only that ARC pass may place per-unit `@todo`
  markers. Until then, the interpreter constructor stays as-is.

---

## Acceptance check (#1352)

- [x] A go/defer/drop decision is recorded in writing → **DEFER whole; DROP cpu/io/acct.**
- [x] #872 and #873 each explicitly dispositioned → #872 not-refiled (folded into deferred
      re-eval); #873 dropped (stays closed).
- [x] "If go" path → N/A (no go), so no ≤60m tickets filed — correct, none should exist.
- [x] "If defer/drop" path → reason documented (this doc); code carries **no live `@todo`** for the
      effort.
