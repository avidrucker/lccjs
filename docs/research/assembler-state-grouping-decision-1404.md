# Assembler State-Grouping / God-Object — Spike Decision (#1404)

**Date:** 2026-06-16
**Role:** SPIKE (ARC), 60m time-box
**Sibling of:** #1352 (interpreter half — ruled DEFER/DROP)
**Tracker:** #1180 (claude-bugs-audit P2 → Architecture)

---

## Ruling: **DROP the sub-object state-grouping. Instead file ONE bounded DEV ticket for the constructor↔`resetAssemblyState()` de-duplication — the actual bug-class the audit was pointing at.**

The audit note braided two separate things together: *(a)* "group the flat field set into `cpu`/`io`/`diag`
sub-objects" and *(b)* "…would also make the reset/snapshot story cleaner." Only **(b)** carries real
value, and **(b) does not require (a).** The grouping (a) is a cosmetic decomplect of a severity:low
god-object with a ~400-reference blast radius that is **not** isolated by the pure seam; the reset
cleanliness (b) is a ~30m targeted fix with near-zero external churn. So: drop (a), file (b).

This is the assembler-specific analogue of #1352's "don't pay for the expensive cosmetic regroup" —
but reached by a *different* argument, because the assembler's constraints differ from the
interpreter's in two decisive ways (below).

---

## Why the assembler verdict differs from the interpreter's (#1352)

| Factor | Interpreter (#1352) | Assembler (#1404) |
|--------|---------------------|--------------------|
| Pure seam isolates tests? | **Yes** — tests read `createExecutionResult()`'s structured return, so external surface collapsed to ~25 refs (#388). | **No** — integration tests construct `new Assembler()` and assert on **raw** `this.*` (`errorFlag` ×72, `outputBuffer` ×32, …). The `createAssemblyResult()` seam exists but the tests bypass it. |
| Pending composition work to absorb the fields? | **Yes** — #252 (observer lift-out) + #1346 (table dispatch) reshape the engine-state fields, giving them a natural home → grouping now = double-churn → DROP/DEFER. | **No** — #1345 audit rates `AssemblerPlus` "mostly mitigated, low ROI"; #417 (table dispatch) already landed; only residual is an *opportunistic* two-pass-driver extract that doesn't touch instance fields. So "defer until composition" is **moot**. |
| Net | Defer whole; drop cpu/io/acct (subsumed). | Grouping has no cheaper-later path **and** the larger, unmitigated blast radius. Worst-of-both → drop the grouping outright; capture the real value via the cheap reset fix. |

---

## Field inventory (assembler.js constructor + `resetAssemblyState()`)

22 per-run instance fields, naturally falling into 4 cohesive groups, plus 3 const/once fields:

| Proposed bucket | Fields | External readers (the blast radius) |
|-----------------|--------|--------------------------------------|
| `parse` (assembly state) | `symbolTable, locCtr, lineNum, sourceLines, pass, labels, errors, errorFlag, programSize, startLabel, startAddress` | **tests** (`errorFlag` ×72, `locCtr`, `lineNum` ×12, `startLabel` ×3, `startAddress` ×2, `labels`), `assemblerplus.js` (`pass, locCtr, lineNum, errorFlag, startLabel, startAddress, symbolTable`) |
| `output` (emitted code) | `outputBuffer, listing, loadPoint, defaultLoadPoint, isObjectModule, globalLabels, externLabels, externalReferences, adjustmentEntries, sourceMap` | **tests** (`outputBuffer` ×32, `sourceMap` ×16, `isObjectModule` ×6, `globalLabels`/`externLabels` ×2, `listing`), **lcc.js** (`isObjectModule`, `sourceMap` read) |
| `io` (file naming) | `inputFileName, outputFileName, outFile` | **lcc.js** (writes both names), **tests** (`inputFileName` ×12, `outputFileName` ×4) |
| `opts`/`diag` (caller config) | `verboseModeOn, explainModeOn, userName, listingLoadPoint, throwOnAssemblyError` | **lcc.js** (writes all 5), **tests** (`verboseModeOn` ×20, `explainModeOn` ×4) |
| _const/once (not grouped)_ | `defaultLoadPoint`, `_instructionTable`, `onProgress` | internal only |

**Measured blast radius of an actual regroup:** ~200+ external test-assertion edits + **191** internal
`this.*` refs in `assembler.js` + **20** in `assemblerplus.js` ≈ **~400 reference edits across 8 test
files + 3 source files**, with `errorFlag` (72 test refs) and `outputBuffer` (32) dominating. None of
the heavy-hitters are shielded by `createAssemblyResult()`. This is a multi-session refactor, not a
microtask — and it changes a public-ish test contract for **zero behavioral gain** on a severity:low
concern.

---

## The value the audit actually wanted — and the cheap way to get it

The audit's concrete symptom was the **reset/constructor duplication** that produced the #1238
`listingLoadPoint` leak and the #1277 `verbose`/`explain`/`userName` leak. Root cause: the constructor
(`:49`) and `resetAssemblyState()` (`:284`) **independently enumerate the same per-run field list**, so
adding a field to one and forgetting the other silently leaks state across reused `Assembler` instances.

That bug class is killed **without moving any field into a sub-object**:

> **Make the constructor delegate to `resetAssemblyState()`** for the per-run set, leaving only the
> genuinely-constant fields (`defaultLoadPoint`, `_instructionTable`) and the once-set `onProgress` in
> the constructor body. One field list, one source of truth — adding a field can no longer drift.

This captures ~all of the audit's "cleaner reset/snapshot story" at **~30m and near-zero external
churn** (the change is internal to `assembler.js`; no test assertion or `lcc.js` line moves). It also
reconciles the existing asymmetry the spike surfaced: `inputFileName`/`outputFileName` are set in the
constructor but *not* in `resetAssemblyState()`, while `userName` is the reverse — exactly the kind of
drift that delegation eliminates.

---

## Decomposition (the spike's deliverable)

**Filed:** one bounded child ticket —

- **[DEV, ≤30m] `refactor(assembler): constructor delegates to resetAssemblyState() — kill the dual field-list drift`**
  - Constructor sets only const/once fields, then calls `this.resetAssemblyState()`.
  - Reconcile `inputFileName`/`outputFileName`/`userName` so the post-construct and post-reset states are identical.
  - Add a regression test: `new Assembler()` field set === field set after one assemble+`resetAssemblyState()` (guards the #1238/#1277 class structurally).
  - **Consumer impact: none** — internal to `assembler.js`; no external `this.*` reference changes.

**Not filed (dropped):** the `parse`/`output`/`io`/`opts` sub-object regroup. If a future need makes it
worth the ~400-edit blast radius (e.g. an actual snapshot/undo feature that wants a single
`this.parse` object to clone), re-open this decision then — but it is **not** warranted now and carries
**no live `@todo`**.

---

## Code-marker strategy (yegor-pdd)

No `@todo` placed in `assembler.js` (claim tool confirmed none exists; none added). The one DEV unit
above gets its `@todo`/`@inprogress` marker only when an agent picks it up — no pre-decomposition.

---

## Acceptance check (#1404)

- [x] Field inventory + proposed grouping documented (4 buckets, ~22 fields).
- [x] Effort estimate + cross-cutting risk measured (~400 refs; `errorFlag` ×72, `outputBuffer` ×32; not seam-isolated).
- [x] Explicit decision: **DROP grouping**, with rationale (unmitigated blast radius + no composition path + severity:low).
- [x] Sliced child ticket produced: 1× ≤30m DEV (reset/constructor de-dup) with consumer-impact note.
- [x] Tracker #1180 updated; this spike linked (see closing comment).
