# Changelog — lccjs-assembly skill

## 0.6.0 — 2026-05-28

Closes lccjs #149 — the remaining two findings from the #117 validation
pass (§3.2 and §3.3 of the validation writeup).

Two small inline edits:

1. **`nl` idiom callout** (in the "Closed sets" section, right after the
   operand-defaults paragraph). Surfaced by N2 in validation: agent built
   `@NL: .string "\n"` + `lea r0, @NL` + `sout` for newlines, instead of
   using the one-instruction `nl` trap. Now explicit: "use `nl`, not a
   `"\n"` string" with the common-wrong-shape called out.
2. **House-style scoping clarification** (on the `references/house-style.md`
   bullet in the references list). Was: "read this before editing anything
   under `textbook_demos/`" — good but only the positive side. Now also
   "Do NOT apply these conventions outside that directory" with explicit
   examples (`demos/`, `plusdemos/`, scratch code).

Skill is now considered feature-complete against the #117 validation
findings. Next changes will come from the v2 validation pass (per
validation writeup §3.4 / §3.5) or from external feedback.

## 0.5.0 — 2026-05-28

Closes lccjs #148 — surface the closed LCC trap set inline in SKILL.md so
agents stop inventing `puts` / `printf` / `print` / `puts_int` / `write` /
`read` / `getchar` / `putchar`. Failure surfaced in the #117 validation pass
(test N3).

New section between pitfall #4 and the references router: **"Closed sets — don't
invent extensions"**. Contents:

- Authoritative-source callout: trap list is derived from
  [`lccjs/docs/lcc-isa.md`](../../../Documents/Study/JavaScript/lccjs/docs/lcc-isa.md) §
  "Trap Instructions"; the lccjs repo's ISA doc is the spec
- I/O traps table (11 mnemonics with direction / format / notes): `sin`,
  `sout`, `din`, `dout`, `udout` (was missing from the issue's own sketch —
  caught while reading the source), `hin`, `hout`, `ain`, `aout`, `nl`, `halt`
- Debugging traps (4): `m`, `r`, `s`, `bp`
- Operand-default reminder (`r0`) cross-linking lcc-isa.md:81 and pitfalls.md A6
- Explicit "there is no `printf`-equivalent — build from primitives" note

## 0.4.0 — 2026-05-28

Closes #140 (sub-puzzle of tracker #116). Final reference file lands:

- `references/house-style.md` — Charlie's textbook-demo conventions
  (ratified in lccjs #104). 8 rules with rationale: per-file `@L*`/`@M*`
  numbering, in-function vs. call-target naming split, data-above-code
  layout for both function-structured and straight-line demos, static-local
  mangling (`@sN_<name>`), definition-site `; comment` for the semantic
  name. Includes a quick decision tree for picking label names. Source of
  truth is `lccjs/textbook_demos/README.md` "Conventions" section; this
  file is the agent-facing view with rationale.

SKILL.md cleanup: removed the "reference files arrive in #138/#139/#140"
caveat now that all four references exist. Skill is feature-complete per
the design in `lccjs/docs/lccjs-assembly-skill-design.md`.

Tracker #116 closes with this release. Next chain: lccjs #117 (validate)
becomes actionable.

## 0.3.0 — 2026-05-28

Closes #139 (sub-puzzle of tracker #116). Adds the next two on-demand references:

- `references/pitfalls.md` — long-form catalog beyond the four inline ones in
  SKILL.md. Four sections: (A) assembler-level — `mov`/`mvi` overlap, `.word`
  two-token offset drop, limited string escape set, label syntax, `offset6`/`ct`
  silent defaults, trap-operand default, `.start` requirement, 65536-word cap;
  (B) interpreter-level — DIV/REM "Floating point exception" wording, silent
  memory wrap at 65536, stack underflow has no guard; (C) cross-reference /
  linking; (D) oracle-divergence pitfalls (LCC.js correct, OG LCC wrong).
- `references/idioms-and-patterns.md` — 11 named patterns (P1–P11) keyed to the
  canonical demo set (001/003/007/010/013/017/018/020): program skeleton,
  counting loop, pre-test loop, three-way signed compare, function call with
  args, stack-allocated locals, non-tail recursion, pointer deref + write-
  through, function pointer + indirect call, string output, pointer-alias for
  cross-distance access.

After this release the skill has 4 of 5 reference files; only `house-style.md`
remains (#140, blocked on lccjs #104).

## 0.2.0 — 2026-05-28

Closes #138 (sub-puzzle of tracker #116). Adds the first two on-demand references:

- `references/isa-quickref.md` — terse base-ISA lookup: register roles, the field-width
  table (imm9/imm5/offset6/pcoffset9/pcoffset11/ct), instruction table, branch
  condition codes, trap vectors, directives. Cross-links to `lccjs/docs/lcc-isa.md`.
- `references/calling-convention.md` — register roles, frame layout (args at fp+2…,
  locals at fp−1…), prologue/epilogue skeleton, caller-side arg push/cleanup, locals
  allocation, r0 return value. Keyed to `textbook_demos` demo-010/011/013.

Neither file duplicates the four inline SKILL.md pitfalls; they cross-reference them.

## 0.1.0 — 2026-05-28

Initial scaffold per design in `lccjs/docs/lccjs-assembly-skill-design.md` (#115).

Closes #137 (sub-puzzle of tracker #116). Provides:

- SKILL.md router with the four non-negotiable pitfalls inline:
  - `r5`/`r6`/`r7` reservation (root cause of the tictactoe.ap fall-through bug)
  - `lea`/`ld` ±256 word `pcoffset9` range + pointer-alias workaround
  - Immediate width mismatch (`mov` 9-bit vs `cmp`/`add`/`sub` 5-bit vs `ldr`/`str` 6-bit)
  - Branch-condition flag semantics (`brp` = strictly positive, the surprising one)
- Pointers to the canonical demo set in `lccjs/textbook_demos/` (demos 001/003/007/010/013/017/018/020)
- Pointers to references that arrive in companion puzzles:
  - `references/isa-quickref.md` + `references/calling-convention.md` (#138)
  - `references/pitfalls.md` + `references/idioms-and-patterns.md` (#139)
  - `references/house-style.md` (#140, blocked on lccjs #104)

Scope is base LCC only; LCC+ (`.lccplus`, `.ap` files) is deferred to a later skill or section.
