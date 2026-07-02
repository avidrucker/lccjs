---
name: lccjs-assembly
description: Write idiomatic, correct LCC assembly (`.a` files) for the lccjs toolchain — base ISA only. Encodes the calling-convention contract, register-role discipline, encoding-range gotchas, and branch-condition semantics that the ISA table alone doesn't convey. Use when the user asks to write, modify, debug, or explain LCC assembly programs.
version: 0.6.0
last_reviewed: 2026-05-28
---

# LCC Assembly (lccjs)

A skill for writing **idiomatic, correct** LCC assembly — not just syntactically valid. The point is to avoid the five classes of bug this codebase has actually hit (see Non-negotiable pitfalls below), follow the calling-convention contract, and reach for the right idiom for the job.

## Triggers

- User asks to write, modify, debug, or explain an LCC `.a` program
- User asks about LCC instruction encoding, calling convention, or stack frame layout
- User mentions "LCC assembly", "lccjs assembler", "textbook_demos", or specific demos by ID
- User pastes LCC assembly and asks for a review or fix

## Scope boundary

**This skill covers base LCC only.** LCC+ (`.lccplus`, the extra traps `rand`/`srand`/`millis`/`nbain`/`clear`/`resetc`/`sleep`/`cursor`/`bp`) is **out of scope for v1** — if the user asks for `.ap` work, say so and stop, or fall back to reading `docs/lccplus-isa.md` directly.

## Non-negotiable pitfalls (read these first)

These four catch the highest-cost bugs and must be in working memory before any LCC assembly is written. Each is stated as **symptom → why → correct pattern**.

### 1. `r5`/`r6`/`r7` are reserved — never reuse as scratch

- **Symptom:** A function "works" until it's called from inside another function, then the program crashes, returns to garbage, or stomps the caller's frame. (Real example: the tictactoe.ap fall-through bug — a helper used `r5`/`r6` for local counters, clobbering `fp`/`sp` and turning the main loop into a wall-of-boards render storm.)
- **Why:** `r5 = fp` (frame pointer), `r6 = sp` (stack pointer), `r7 = lr` (link register). The calling convention assumes they survive across any operation that doesn't explicitly mutate them. Touching `r5`/`r6` between prologue and epilogue corrupts every fp-relative load/store and every push/pop until the frame is rebuilt.
- **Correct pattern:** **Scratch is `r0`–`r4`, period.** If you need more than 5 registers' worth of state, spill to stack locals (`str rX, fp, -N`) and load back on demand. Never use `r5`/`r6`/`r7` for anything except their assigned role.

### 2. `lea` and `ld` reach ±256 words via `pcoffset9`

- **Symptom:** Assembler error like `pcoffset9 out of range` (or silent miscalculation), or the value loaded into a register is not the value at the labeled address. Manifests when a program grows past ~500 words and a label at the bottom of the file is referenced from the top.
- **Why:** `lea` and `ld` encode the destination as a signed 9-bit PC-relative word offset. The reachable window is `PC + [-256..+255]` words from the instruction itself, not from anywhere convenient.
- **Correct pattern:** Use a **pointer alias** near the use site. Place `@xP: .word x` close to the consumer; load through it: `ld rX, @xP` then `ldr rY, rX, 0` (or `str` for write-through). The alias only needs to be within ±256 of the `ld`; the actual target `x` can be anywhere in the file. This is the lccjs idiom for cross-file-distance access.

### 3. Immediate widths differ per instruction

- **Symptom:** Assembler errors like `imm5 out of range` on what looks like a small constant; or a `mov` accepts a value that the very next `cmp` refuses; or a constant silently wraps and the program branches the wrong way.
- **Why:** Immediate encoding is not uniform across opcodes. Memorize these three classes:
  - `mov` / `mvi` immediate: **9-bit signed**, range `[-256, 255]`
  - `cmp` / `add` / `sub` immediate: **5-bit signed**, range `[-16, 15]`
  - `lea` / `ld` / `st` / `br*` PC-offset: **9-bit signed** word offset (pitfall 2)
  - `ldr` / `str` base-register offset: **6-bit signed**, range `[-32, 31]`
- **Correct pattern for constants too large for the destination encoding:** put the constant in a `.word` and load it. Don't try to materialize a large value via add chains — use the constant pool:
  ```
  ld   r0, @TARGET    ; @TARGET: .word 1000
  cmp  r1, r0         ; now legal even though 1000 won't fit in cmp's 5-bit imm
  ```

### 4. Branch suffixes encode *flags*, not English

- **Symptom:** A loop runs one too many times, or an off-by-one in a comparison that "should be obvious". The branch chosen reads like the right English word (`brp` "branch if positive") but tests a different flag combination than expected.
- **Why:** Branch instructions test the N/Z/C flags set by the *previous* `cmp`, `add`, or `sub`. The suffix names the flag pattern, not the natural-language predicate.
  - `bre` / `brz` — equal / zero (`Z=1`)
  - `brne` / `brnz` — not-equal / nonzero (`Z=0`)
  - `brlt` — signed less than (`N≠V`, but in practice: A < B when result of `cmp A, B` is negative)
  - `brgt` — signed greater than
  - **`brp` — strictly positive (`N=0 AND Z=0`).** This is the surprising one. `brp` does *not* fire on zero; for "non-negative" you need `brp || bre` (or a separate `brzp`).
  - `brc` / `brb` — unsigned below / carry
- **Correct pattern:** When in doubt, write the comparison in C-like pseudo-form *first*, then pick the suffix that matches the *flag outcome*, not the English word. The decision tree:
  - "equal" → `bre`
  - "not equal" → `brne`
  - signed `<` / `>` → `brlt` / `brgt`
  - signed `≤` → `brlt` + `bre` (or invert to `brgt` and fall through)
  - "more than zero" → `brp`
  - "zero or more" → `brzp` (or `brp` then `bre`)
  - unsigned compares → `brc` / `brnc`

### 5. Column-0 rule — indent everything except labels

- **Symptom:** `Error on line N: <mnemonic> ... / Invalid operation` even though the instruction is spelled correctly and the operands are in range. The program assembles fine when the same code is indented.
- **Why:** The LCC assembler uses column 0 as the label namespace. Any token that starts at column 0 is parsed as a label definition attempt. If the token doesn't end in `:`, the assembler rejects it as an invalid operation — it never reaches instruction decode. This means a `halt` at column 0 is not a `halt`; it's a bad label.
- **Correct pattern:** **Labels (tokens ending in `:`) go at column 0. Every other token — instructions, directives, traps — must be preceded by at least one space or tab.**
  ```
  ; Wrong — mov at column 0 → "Invalid operation"
  mov r0, 5
  halt

  ; Correct — indented
    mov r0, 5
    halt

  ; Labels always at column 0, body indented
  loop:
    sub r0, r0, 1
    brp loop
    halt
  ```
- **Common trigger:** Copying assembly from a text source (docstring, template literal, issue body) where dedent strips all leading whitespace. Discovered while migrating inline test fixtures to `.a` files in #777 — dedent to col 0 broke every non-label line.

## Register aliases

The assembler recognises three named aliases for the reserved registers:

| Alias | Maps to | Conventional role |
|-------|---------|-------------------|
| `fp`  | `r5`    | frame pointer |
| `sp`  | `r6`    | stack pointer |
| `lr`  | `r7`    | link register (return address) |

The only valid aliases are `fp`, `sp`, and `lr` — source: `assembler.js` `isRegister()` regex `^(r[0-7]|fp|sp|lr)$`. Any other name (including names from MIPS, RISC-V, or other ISAs) is not recognised.

## Closed sets — don't invent extensions

The LCC trap set is a **closed list**, sourced from
[`lccjs/docs/lcc-isa.md`](../../../../Documents/Study/JavaScript/lccjs/docs/lcc-isa.md) §
"Trap Instructions". The lccjs repo's `docs/lcc-isa.md` is the authoritative
spec — derive trap names from it, never from C-stdlib intuition.

**There is no `puts` / `printf` / `print` / `puts_int` / `write` / `read` /
`getchar` / `putchar`.** Any plausibly-named C-library function you reach
for that isn't in the tables below does not exist. Validation pass #117
hit this exactly: an agent wrote `puts r0` for string output; assembly
failed with `Invalid operation`.

**I/O traps (11):**

| Mnemonic | Direction | Format | Notes |
|---|---|---|---|
| `sin`  | read  | string  | NUL-terminated; reads into buffer at `sr` |
| `sout` | write | string  | NUL-terminated; prints string at `sr` |
| `din`  | read  | decimal | signed decimal → `dr` |
| `dout` | write | decimal | signed decimal from `sr` |
| `udout`| write | decimal | **un**signed decimal from `sr` |
| `hin`  | read  | hex     | hex integer → `dr` |
| `hout` | write | hex     | hex integer from `sr` |
| `ain`  | read  | char    | ASCII char → `dr` |
| `aout` | write | char    | ASCII char from `sr` |
| `nl`   | write | char    | literal `\n` (no operand needed) |
| `halt` | —     | —       | stop execution, return to OS |

**Debugging traps (4):** `m` (dump memory), `r` (dump registers), `s`
(dump stack), `bp` (software breakpoint). Rarely needed in user code, but
legal — won't cause assembly errors.

**Operand defaults:** if `sr` / `dr` is omitted, it defaults to `r0`
(see [`lccjs/docs/lcc-isa.md`](../../../../Documents/Study/JavaScript/lccjs/docs/lcc-isa.md):81
and `pitfalls.md` A6). Be explicit when the value isn't in `r0` — silent
defaults are debugging hazards.

**Newlines: use `nl`, not a `"\n"` string.** `nl` writes the newline byte
directly — one instruction, no data section entry, no `lea`/`sout`. The
common-but-wrong shape is `@NL: .string "\n"` + `lea r0, @NL` + `sout` —
that's three instructions plus a 2-byte data allocation for what `nl`
does on its own.

> If you need formatted output (numbers mixed with strings, padding,
> field width), build it from these primitives. There is no
> `printf`-equivalent in LCC.

## Beyond these four pitfalls

These references are loaded on demand — read them only when the task touches the area:

- `references/isa-quickref.md` — terse one-page instruction table, field widths, trap vectors, condition codes
- `references/calling-convention.md` — prologue/epilogue, stack frame layout, arg/local access patterns, register roles in detail
- `references/pitfalls.md` — the long-form catalog beyond the four above (e.g. `.word` two-token form, divide-by-zero wording, 65536-word program cap)
- `references/idioms-and-patterns.md` — loop, compare, pointer, recursion, string-I/O patterns, keyed to the canonical demos below
- `references/house-style.md` — Charlie's textbook-demo conventions (`@L*` branch labels, `@M*` strings, data-above-code layout) — read this before editing anything under `textbook_demos/`. **Do NOT apply these conventions outside that directory** (e.g. to scratch programs, hand-written demos under `demos/` or `plusdemos/`, or one-off test code) — those use semantic names. The conventions are scoped to the curated textbook set, not a project-wide style guide.

## Canonical examples (reference, don't copy)

The lccjs repo ships a curated set of working demos under `textbook_demos/`. **Point to them by ID** rather than copying their contents — they're the single source of truth and already follow the house style.

| Demo | Teaches |
|---|---|
| `demo-001-load-add-display` | basics: `ld`/`add`/`dout`/`nl`/`halt`/`.word` |
| `demo-003-counting-loop` | pre-test counting loop (`mov`/`sub`/`brp`) |
| `demo-007-signed-comparison` | three-way signed compare (`cmp` + `brlt`/`bre`/`brgt`) |
| `demo-010-function-call-with-args` | full calling convention (prologue/epilogue, args at `fp+2`/`fp+3`) |
| `demo-013-local-variables-dynamic` | stack-frame locals via negative `fp` offsets (`ldr`/`str`) |
| `demo-017-recursion-non-tail` | non-tail recursion; pre/post-call work |
| `demo-018-pointer-to-global` | `lea` + dereference + write-through |
| `demo-020-pointer-to-function` | function pointer + indirect call (`blr`) |

## Source materials (when you need to go deeper)

- `docs/lcc-isa.md` — full ISA reference table
- `docs/glossary/assembler.md` — encoder semantics + per-instruction field widths
- `docs/glossary/interpreter.md` — runtime semantics (flag setting, trap behavior)
- `textbook_demos/` — the canonical working set
- `demos/` — additional working examples

## Verification loop

When you write or modify LCC assembly, verify it before declaring done. Always route through `scripts/lccrun.sh` — bare invocations can hang indefinitely when `name.nnn` is absent and stdin is not a TTY:

```bash
scripts/lccrun.sh node src/core/lcc.js <file>.a        # 30 s default timeout
```

Successful assembly produces a `.e` executable. To run:

```bash
scripts/lccrun.sh node src/core/interpreter.js <file>.e
```

If the assembly fails, the assembler's error usually names the exact instruction and encoding constraint violated — re-read the relevant pitfall above before guessing at a fix.
