# Design: `lccjs-assembly` Claude skill (scoping spike for #115)

_Audience: AI agents, contributors · Tier: reference_

**Status:** design complete — ready for build (#116) and validation (#117).
**Scope boundary:** base LCC ISA only. LCC+ (`.lccplus`, extra traps/instructions) is
explicitly deferred to a later skill or a later section.

This document is the architect output for #115. It makes a decision on every open
question in the ticket so #116 can build directly from it.

---

## 1. Purpose & trigger

A project-level skill that teaches Claude (and other LLM agents) to write **idiomatic,
correct** LCC assembly for lccjs — not just syntactically valid, but respecting the
calling convention, the encoding constraints, and the hard-won pitfalls this codebase
has already hit.

**Trigger:** the user asks to write/modify/debug an LCC `.a` program, or to explain LCC
assembly idioms. (LCC+ `.ap` is out of scope for v1; the skill should say so and stop.)

---

## 2. Scope decisions (open questions resolved)

| Question | Decision |
|---|---|
| What does the skill encode beyond `docs/lcc-isa.md`? | The ISA doc is a *table*. The skill encodes the **operational knowledge** the table doesn't: calling-convention contract, register roles, encoding-range gotchas, branch-condition semantics, and idiom patterns keyed to working demos. |
| Charlie's textbook conventions (`@L*`/`@M*`, strings-above-function — #104)? | **Include, but as a separate, clearly-labelled "house style" layer**, not ISA-level. Gate that one reference file on #104 (conventions are still being confirmed). The rest of the skill does not depend on #104. |
| Teach calling conventions? | **Yes** — prologue (`push lr`/`push fp`/`mov fp,sp`), fp-relative locals, args at `fp+2`/`fp+3`, `r0`–`r4` scratch, return value in `r0`, epilogue. |
| Teach hard-won pitfalls? | **Yes** — first-class content (see §5). These are the highest-value part of the skill. |

---

## 3. Structure decision: progressive disclosure

Single SKILL.md would be too long once pitfalls + calling convention + ISA quickref +
idioms are included, and would crowd the task context. **Decision: SKILL.md as a router +
`references/*.md` loaded on demand.**

```
.claude/skills/lccjs-assembly/
  SKILL.md                       # router; when-to-use + the NON-NEGOTIABLE pitfalls inline
  references/
    isa-quickref.md              # distilled instruction table, field widths, traps, directives, condition codes
    calling-convention.md        # stack frame layout, prologue/epilogue, arg/local access, register roles
    pitfalls.md                  # the hard-won bugs — each: symptom → why → correct pattern
    idioms-and-patterns.md       # loop / compare / pointer / recursion / string-I/O patterns, keyed to demo IDs
    house-style.md               # Charlie's @L*/@M* textbook_demos conventions  [GATED ON #104]
```

**Location confirmed:** `.claude/skills/lccjs-assembly/SKILL.md` (project-level).

**SKILL.md must keep the four non-negotiable pitfalls (§5) inline** — they're cheap and
catch the most damage — and route to `references/*` for everything else.

---

## 4. Canonical example set (reference, don't copy)

The skill **points to `textbook_demos/` by ID** rather than copying source — single source
of truth, and the demos already follow the house style. Curated minimal set covering every
core idiom:

| Demo | Teaches |
|---|---|
| `demo-001-load-add-display` | basics: `ld`/`add`/`dout`/`nl`/`halt`/`.word` |
| `demo-003-counting-loop` | pre-test counting loop (`mov`/`sub`/`brp`) |
| `demo-007-signed-comparison` | three-way signed compare (`cmp` + `brlt`/`bre`/`brgt`) |
| `demo-010-function-call-with-args` | full calling convention (prologue/epilogue, args at `fp+2/3`) |
| `demo-013-local-variables-dynamic` | stack-frame locals via negative `fp` offsets (`ldr`/`str`) |
| `demo-017-recursion-non-tail` | non-tail recursion; pre/post-call work |
| `demo-018-pointer-to-global` | `lea` + dereference (`ldr r0,r0,0`) + write-through |
| `demo-020-pointer-to-function` | function pointer + indirect call (`blr`) |

---

## 5. The non-negotiable pitfalls (inline in SKILL.md)

Each must be stated as **symptom → why → correct pattern**, not just a rule:

1. **`r5`/`r6`/`r7` are `fp`/`sp`/`lr` — never reuse as scratch.** Use `r0`–`r4`. *Why:*
   clobbering them corrupts the frame/return (root cause of the tictactoe.ap fall-through
   bug). Scratch = `r0`–`r4`.
2. **`lea`/`ld` use `pcoffset9` = ±256 words.** A target farther than 256 words won't reach.
   *Correct pattern:* a pointer alias — `@xP: .word x` near the use site, then `ld rX, @xP`.
3. **Immediate widths differ by instruction.** `mov`/`mvi` immediate is 9-bit (−256..255);
   `cmp`/`add`/`sub` immediate is 5-bit (−16..15). *Correct pattern for large constants:*
   `ld` the value from a `.word` constant rather than an impossible inline immediate.
4. **Branch-condition semantics are non-obvious.** `bre`/`brz` = equal/zero;
   `brne`/`brnz` = not-equal/nonzero; `brlt`/`brgt` = signed; **`brp` = strictly positive
   (n=z)**; `brc`/`brb` = unsigned-below (carry). Pick the suffix from the *flag* you mean,
   not the English word.

(`references/pitfalls.md` can expand these and add more, e.g. trap operand defaults to `r0`,
`offset6` defaults to 0, `ct` defaults to 1.)

---

## 6. Evaluation criteria (drives #117)

**Positive** — fresh session + skill writes, assembles (`node src/cli/lcc.js`), and runs:
- a countdown loop (tests loop idiom + branch choice),
- a function with 2 locals and a return value (tests calling convention),
- a struct or static linked-list traversal (tests pointer/`ldr`/`str` idioms).
Output must match the spec.

**Negative** (highest value — each maps to a real bug class in §5):
- a prompt that naturally tempts `r5`/`r6`/`r7` reuse → skill reserves them;
- a prompt that grows the file past `lea`/`ld` range → skill surfaces the pointer-alias workaround;
- a prompt needing a large immediate in `cmp`/`add`/`sub` → skill steers to `ld` from `.word`;
- a prompt branching after a compare → skill picks the correct `brXX` suffix.

**Pedagogical fit:** explanations include the *why* (encoding limits, calling-convention
contract); the skill is concise enough to not crowd the task.

---

## 7. Recommended build decomposition for #116 (each ≤60m)

#116 as a whole exceeds the 60m cap. Split before building:

- **#116a** — `SKILL.md` router + the four inline pitfalls (§5). *Standalone; highest value.*
- **#116b** — `references/isa-quickref.md` + `references/calling-convention.md`.
- **#116c** — `references/pitfalls.md` (expanded) + `references/idioms-and-patterns.md` keyed to the §4 demo set.
- **#116d** — `references/house-style.md` **(blocked by #104)** + README/`docs` index pointer for discoverability.

**Dependency note:** closing #115 unblocks **#116a–#116c** immediately. Only **#116d** stays
blocked on #104 (the `@L*`/`@M*` conventions aren't final). Build can start without waiting on #104.

---

## 8. Source materials (inputs used)

`docs/lcc-isa.md` (ISA table), `docs/lccplus-isa.md` (out of scope, boundary marker),
`docs/cuh63/ch03–ch12.md` (exercise notes), `textbook_demos/` (canonical examples + house
style), `demos/` / `plusdemos/` (working examples), and *C and C++ Under the Hood* (Dos Reis).
