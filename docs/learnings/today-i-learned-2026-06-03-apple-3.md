# Today I Learned — 2026-06-03 (APPLE-3)

**Date:** 2026-06-03  
**Agent:** APPLE  
**Context:** Comment cleanup (#554) and free() feasibility research (#560).

---

## 1. "Export seam (#N):" is the most common rotting comment pattern

The comment-cleanup pass (#554) found 18 sites. The single most common shape was:

```js
// Export seam (#172): isPrintableASCII + formatHexLine were previously buried in
// the CLI loop at module level (0% coverage).
```

This pattern has three problems layered on top of each other:
- **Issue citation** — the number is meaningless once the issue closes.
- **Before-state history** — "previously buried in" describes what the code *was*,
  not why it *is* the way it is.
- **The WHY is actually there** — "pure functions, unit-testable without file I/O" —
  but buried under the noise.

A fast filter for before-state rot: if replacing "was X" with "is X" still makes
the sentence true and useful, rewrite it that way. If the sentence only makes sense
as history, delete it.

**The rule:** Comment the present-tense WHY. History lives in commit messages and
PR descriptions — not in the source file.

---

## 2. File-header history blocks are the worst-value comment real estate

Multi-line file headers of the form "Extracted from A and B to remove the
copy-pasted definitions of X and give Y a single canonical home" encode the
migration story, not the current design constraint.

A future reader opening `format.js` doesn't need to know it was extracted — they
need to know it's the canonical home, that it's pure, and what it can and can't do.
The headers in `debug/format.js` and `debug/stateDelta.js` both shrank by two
lines and became more useful after stripping the extraction narrative.

**The rule:** Start file headers with the current purpose, not the migration history.
"Canonical home for X, shared across A and B. Pure — no side effects." beats
"Extracted from A and B to remove copy-pasted X."

---

## 3. Fixed-size allocators need no headers — the freed block *is* the metadata

The free() research (#560) surfaced a non-obvious allocator insight. General
free-list allocators (Patterns 2 and 3) need a header word before each block to
store the block size. But when all allocations are the same size — as in
`gameSnake.ap` where every node is exactly 3 words — you already know the size.
The freed block's first word can become the next pointer for the free list with no
extra overhead at all.

```asm
; free(r0 = ptr to 3-word node) — Pattern 1, zero extra words per block
free:   ld  r1, @freeList    ; r1 = old head
        str r1, r0, 0        ; node[0] = old head  (reuse first payload word)
        st  r0, @freeList    ; freeList = this node
        ret
```

The insight generalises: before designing a general allocator, check whether all
allocations in the program are the same size. If yes, skip headers entirely.

---

## 4. "LCC+ adds nothing for X" is a useful fast-path check

When researching whether an LCC feature is implementable, checking the LCC+ ISA
addendum first is low-cost and often conclusive. LCC+ adds exactly seven trap
instructions (`clear`, `sleep`, `nbain`, `cursor`, `srand`, `millis`, `resetc`)
and one machine instruction (`rand`) — all I/O-oriented. If the question is about
memory management, arithmetic, or data structure manipulation, the answer is
"LCC+ adds nothing; use the base ISA."

---

## What landed

| Artifact | Change |
|---|---|
| [#554](https://github.com/avidrucker/lccjs/issues/554) | 18 comment sites cleaned across 11 files; grep for `(#[0-9])` in `src/` now returns 0 |
| [#560](https://github.com/avidrucker/lccjs/issues/560) | `docs/research/560-free-implementation-in-lcc-assembly.md` — three allocator patterns, feasibility verdict, leak analysis |
| [#562](https://github.com/avidrucker/lccjs/issues/562) | Follow-up SPIKE filed: implement Pattern 1 in `gameSnake.ap` |
| [#563](https://github.com/avidrucker/lccjs/issues/563) | This TIL |
