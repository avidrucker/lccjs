# LCC Assembly House Style — textbook-demo conventions

Charlie's label-naming and data-layout conventions for the lccjs
`textbook_demos/` set. Ratified in lccjs #104; canonical source-of-truth is
[`textbook_demos/README.md`](../../../../Documents/Study/JavaScript/lccjs/textbook_demos/README.md)
("Conventions" section). This file is the agent-facing view: what to apply
when writing or modifying a demo, with the rationale behind each rule so you
can judge edge cases.

**Scope:** applies to anything under `lccjs/textbook_demos/`. Hand-written
working programs under `demos/` and `plusdemos/` predate the convention; do
**not** retroactively reformat them unless a ticket asks for it. Outside
`textbook_demos/`, the rules in this file are guidance, not enforcement.

---

## The rules (each: rule + why)

### 1. Branch labels use `@L0`, `@L1`, `@L2`, … per file, in order of first appearance

- **Why:** decouples the label name from any English meaning. Renames don't
  cascade through the file. The semantic name lives in a `; comment` at the
  definition site — see rule 8.
- **Numbering is per-file**, not per-function. One global `@L*` sequence
  increments across every function in the file. Why per-file rather than
  per-function: avoids the `@f_L0` mangling a per-function scheme would
  require to keep file-scope labels unique.
- `@L*` is **only** for in-function jump targets (`brXX` / `br` destinations).
  Never use it for `bl` / `blr` / `call` destinations — those keep semantic
  names (rule 3).

### 2. String constants use `@M0`, `@M1`, … per file, in order of first appearance

- **Why:** same logic as `@L*` — name from position, semantic meaning lives
  in a comment.
- Same per-file numbering as `@L*` (one global `@M*` sequence per file).

### 3. Function / subroutine call targets keep their semantic names

- `main:`, `startup:`, `descend:`, `print_board:`, etc. — anything reached by
  `bl` / `blr` / `call` stays readable.
- **Why:** call sites read like the C they translate from
  (`bl descend` ≈ `descend(...)`). Calls jump across far distances in the
  file; the reader needs the name for navigation, where in-function branches
  are local-context-only.

### 4. String constants (and static locals) live ABOVE the function that uses them

- **Why:** keeps data physically close to the consumer, which keeps the
  `lea`/`ld` pcoffset9 range (±256 words — see SKILL.md pitfall #2) from
  becoming a problem as the file grows. Each function's data sits in its
  reach by construction.
- Applies to function-structured demos (demo-010 onwards, anything with
  `startup: bl main` + named functions).

### 5. Top-level / straight-line demos: data at the TOP of the file with explicit `.start`

- For demos that are straight-line code (no `bl main`, no function structure)
  — e.g. demo-001/002/003/006/007/008 — string constants go at the top of
  the file, followed by `.start main` (or equivalent entry-point label).
- **Why:** mirrors the "data above code that uses it" rule. Before #104's Q2
  ratification, top-level demos kept data at the bottom; the new layout
  unifies all demos under one rule.
- **Refactor status:** ch03 demos were refactored to this layout in lccjs
  #135; demo-009 and demo-044 are tracked in #136.

### 6. Numerical constants use `@N: .word N` when needed

- Format: `@1000: .word 1000` for positive; `@_1000: .word -1000` for negative
  (the leading underscore stands in for the minus sign since labels can't
  start with `-`).
- **Why:** needed for the pointer-alias / immediate-too-wide pattern (SKILL.md
  pitfall #3). The naming convention makes the value of the constant readable
  at the use site (`ld r0, @1000` reads as "load 1000").

### 7. Static locals get a file-scope name like `@s0_x`, `@s1_y`, …

- **Why:** static locals outlive any single function call and so can't live
  on the stack frame; they need a fixed memory address. Mangling them with
  `@sN_<name>` keeps file-scope labels unique even when two functions both
  have a static `x`.
- Demo-014 (Chapter 5) is the canonical example.

### 8. Definition-site `; comment` preserves the prior semantic name

- Pattern:
  ```
  @M0:      .string "bottom\n"  ; msg_bottom
  @L0:      ; @else — recursive case
  ```
- **Why:** the file should still read in plain English. Stripping the
  semantic name from the label would make the code unreadable; relegating it
  to a comment keeps it visible at the definition site without dragging it
  through every use site.

---

## Canonical reference files

| Demo | Why look here |
|---|---|
| `ch03-assembly-basics/demo-003-counting-loop.a` | top-level / straight-line demo with the post-#104 data-at-top layout |
| `ch06-control-flow-and-recursion/demo-017-recursion-non-tail.a` | function-style demo; `@M*` above the function, `@L*` in-function only |
| `ch05-variable-storage-classes/demo-014-local-variables-static.a` | static-local naming (`@sN_<name>`) |

Read these instead of inventing patterns. If a real demo deviates from these
rules, the demo is the authority — flag the discrepancy and ask before
"correcting" it.

---

## Quick decision tree

When writing a new demo (or modifying one) under `textbook_demos/`:

1. Is this a straight-line top-level demo or a function-structured one?
   - Straight-line → data at the **top**, `.start` to the code, no `bl main`
   - Function-structured → data above each function, `startup: bl main` at
     entry
2. Picking a label name:
   - In-function jump target → `@L<next>` (per-file counter)
   - String literal → `@M<next>` (per-file counter)
   - Numerical constant → `@<value>` (positive) or `@_<value>` (negative)
   - Static local → `@s<N>_<name>`
   - Call target (any `bl`/`blr`/`call` destination) → semantic name
     (`main:`, `helper:`, etc.) — **not** `@L*`
3. Add a `; comment` at the definition site naming what the label means.

---

## See also

- SKILL.md — non-negotiable pitfalls (pitfalls 2, 3 are why "data near code" matters)
- `isa-quickref.md` — encoding ranges that drive rules 4, 5, 6
- `idioms-and-patterns.md` — patterns P1 (program skeleton) and P11 (pointer-alias) lean on rules 4–6
- `lccjs/textbook_demos/README.md` — source-of-truth conventions section
- lccjs #104 closure comment — full ratification record including the three
  open questions and their decisions
