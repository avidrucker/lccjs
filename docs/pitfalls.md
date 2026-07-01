# LCC Assembly Pitfalls

_Audience: students/learners, assembly enthusiasts · Tier: recommended, public_

The canonical, in-repo catalog of the surprises that bite people writing LCC
assembly for the LCC.js toolchain — especially first-timers. Most of these
**assemble (or run) without an obvious error** and then misbehave, which is
exactly why they cost time.

This doc is the **single source of truth** for LCC-assembly pitfalls. It is built
on the authoritative references already in this repo:

- [docs/lcc-isa.md](./lcc-isa.md) — instruction set, field widths, branch codes.
- [docs/parity_deviations.md](./parity_deviations.md) — exhaustive record of where
  LCC.js intentionally differs from the original LCC (the "oracle").
- [docs/glossary/assembler.md](./glossary/assembler.md) and
  [docs/glossary/interpreter.md](./glossary/interpreter.md) — encoder and runtime
  semantics.

Each entry is **symptom → why → fix**.

---

## 1. The four highest-cost pitfalls (read these first)

These four account for most of the painful debugging sessions. Internalize them
before anything else.

### 1.1 `r5` / `r6` / `r7` are reserved — never reuse them as scratch

- **Symptom:** A function works in isolation but crashes, returns to garbage, or
  stomps the caller's frame the moment it's called from inside another function.
- **Why:** `r5 = fp` (frame pointer), `r6 = sp` (stack pointer), `r7 = lr` (link
  register, set by `bl`/`blr`). The calling convention assumes these survive
  across any operation that doesn't explicitly maintain them. Touching `r5`/`r6`
  between prologue and epilogue corrupts every `fp`-relative load/store and every
  `push`/`pop`.
- **Fix:** **Scratch is `r0`–`r4`, period.** Need more state? Spill to stack
  locals (`str rX, fp, -N`) and load back on demand — never borrow `r5`/`r6`/`r7`.

### 1.2 PC-relative instructions only reach ±256 words

- **Symptom:** A `ld`/`st`/`lea`/`br*` that worked in a small program starts
  erroring with `pcoffset9 out of range` (or loads the wrong value) once the file
  grows and the label is far from the instruction.
- **Why:** `ld`, `st`, `lea`, and the branch family encode the target as a 9-bit
  **signed** PC-relative word offset — reach is roughly **−256…+255 words** from
  the instruction. (`bl`/`call`/`jsr` get more room via an 11-bit offset.)
- **Fix:** Use a **pointer alias** near the use site. Put `@xP: .word x` close to
  the consumer, then `ld rX, @xP` followed by `ldr rY, rX, 0` (or `str` to write
  through). The alias only has to be within ±256 of the instruction; the real
  target `x` can live anywhere in the file.

### 1.3 Immediate fields are narrow and signed

- **Symptom:** `mov r0, 1000` or `add r0, r0, 40` errors with an out-of-range
  immediate, even though the number is "small."
- **Why:** Immediates are tiny signed fields, not full words:

  | Instruction(s) | Immediate field | Signed range |
  |---|---|---|
  | `mvi`, `mov` | `imm9` | −256 … +255 |
  | `add`, `sub`, `cmp`, `and` | `imm5` | −16 … +15 |
  | `ldr`, `str`, `jmp`, `blr`, `ret` | `offset6` | −32 … +31 |

  (`mov dr, imm` is just a pseudo-instruction for `mvi dr, imm9`, so it inherits
  the 9-bit range — see also pitfall 2.1.)
- **Fix:** For a constant that doesn't fit, store it once with `.word` and load it
  (`ld`), rather than trying to encode it inline.

### 1.4 Branch suffixes test flags, not English

- **Symptom:** A loop runs one too many times, or a comparison that "should
  obviously" be right does the opposite.
- **Why:** Branch instructions test the N/Z/C/V condition flags set by the
  **previous** flag-setting instruction (`cmp`, `add`, `sub`, `and`, `mov`, `ld`,
  …). The suffix names a **flag pattern**, not a natural-language predicate — and
  whatever instruction ran last is what set the flags, not necessarily the `cmp`
  you meant.
- **Fix:** Put a `cmp` (or other flag-setter) **immediately** before the branch,
  with nothing in between that also sets flags. See the
  [branch condition codes table](./lcc-isa.md#branch-condition-codes).

---

## 2. Assembler-level pitfalls (won't assemble, or assembles to wrong bytes)

### 2.1 `mov dr, imm` is `mvi` in disguise

`mov dr, imm` translates to `mvi dr, imm9`, so the 9-bit signed range
(−256…+255) applies — `mov r0, 1000` fails. Put large constants in a `.word` and
`ld` them. (Same root cause as pitfall 1.3.)

### 2.2 `.word label +N` with a space drops the `+N`

- **Symptom:** `.word arr +3` assembles and runs, but silently writes the address
  of `arr`, not `arr+3` — table indexing reads the wrong element.
- **Why:** `.word` parses a **single** token. With whitespace around the `+`, the
  tokenizer splits `arr` and `+3`, and the offset token is silently ignored.
- **Fix:** Write `arr+3` with **no whitespace** around the `+`.

### 2.3 Unknown string escapes are a hard error (only five are valid)

- **Symptom:** `.string "col\0sep"` (or any `\X` outside the supported set) **fails
  assembly** with `Unknown escape sequence: \0` and exit 1 — the file does not
  assemble at all.
- **Why:** Only five escapes are recognized: `\n`, `\t`, `\\`, `\"`, `\r`. Anything
  else (`\0`, `\a`, `\b`, `\f`, `\v`, `\'`, the C numeric escapes `\xNN`/`\NNN`, …)
  is **rejected outright** — LCC.js fails loud rather than silently dropping the
  backslash the way OG LCC does (a deliberate divergence; see
  [parity deviation #15](./parity_deviations.md)).
- **Fix:** For a NUL or other byte with no escape, emit it with `.word` entries
  instead, or split the string. Don't reach for C-style numeric escapes — they
  aren't supported.

### 2.4 Labels must start with `[A-Za-z_$@]`

- **Symptom:** A label starting with a digit (`3rd_arg:`) fails with a cryptic
  parse error.
- **Why:** The first character is restricted to `[A-Za-z_$@]`; later characters
  may include digits. (House convention: `@`-prefixed labels are
  compiler/generated — `@L0` for branch targets, `@M0` for strings.)
- **Fix:** Rename so the first character is a letter or `_`/`$`/`@`
  (`arg3:`, `_3rd_arg:`).

### 2.5 `offset6` and shift counts have silent defaults

- **Symptom:** `ldr r0, fp` (no offset) assembles and loads `mem[fp+0]`; `srl r0`
  (no count) shifts by 1 — neither errors, both are usually unintended.
- **Why:** Omitted `offset6` on `ldr`/`str`/`blr`/`jmp`/`ret` defaults to 0;
  omitted shift count on `srl`/`sra`/`sll`/`rol`/`ror` defaults to 1.
- **Fix:** Always write the offset / count explicitly — the defaults assemble
  silently and produce wrong results, not error messages.

### 2.6 Trap operands default to `r0`

- **Symptom:** `dout` with no operand assembles and silently prints `r0`.
- **Why:** Trap-class opcodes (`sin`/`sout`/`din`/`dout`/`nl`/`halt`/`aout`/`ain`/
  `hin`/`hout`) take an optional source register defaulting to `r0`.
- **Fix:** Be explicit when the value isn't in `r0`.

### 2.7 `.start <label>` is the only way to set the entry point

- **Symptom:** A program with `main:` runs from address 0 (usually landing in the
  data section) and dies; reordering sections sometimes "fixes" it by accident.
- **Why:** Without `.start`, execution begins at PC = 0 (or the `-L<hex>` load
  point). The assembler does **not** default to `main:`.
- **Fix:** Put `.start main` near the top of the file. The label is resolved after
  pass 2, so its position doesn't matter.

### 2.8 Programs cap at 65536 words

- **Symptom:** A large generated program errors with `Program too big`.
- **Why:** The address space is 16-bit word-addressable (`MAX_MEMORY = 65536`).
- **Fix:** Split into modules. (Multi-module `.ap` linking via the planned
  `linkerplus.js` is not yet available — see pitfall 4.1.)

### 2.9 Source lines are capped at 300 characters

- **Symptom:** A long machine-generated line — or even a short instruction with a
  very long trailing comment — aborts with `Line exceeds maximum length of 300
  characters`.
- **Why:** LCC.js rejects any source line longer than 300 **raw** characters (code +
  whitespace + comment, counted before stripping). This is a deliberate fail-fast
  replacement for OG LCC, which silently splits lines past its ~298-char buffer and
  parses the overflow tail as bogus following source (see
  [parity deviation #7](./parity_deviations.md)).
- **Fix:** Keep lines under 300 chars — move long comments onto their own line and
  split generated data across multiple `.word` lines.

---

### 2.10 One mnemonic per source line — extra tokens are silently dropped

The assembler processes exactly **one** mnemonic per source line. Any tokens after the
operands are silently ignored — a second instruction crammed onto the same line (e.g.
`dout r0  nl`) will **not** assemble the second mnemonic, and you get no error.

- **Symptom:** an instruction "disappears"; output is missing a `nl`, a `dout`, etc.
  This accounts for the parity failures in textbook demos 029–032.
- **Fix:** write each instruction on its own line.
- (Was `RULES.md` rule `violet-mantis` — relocated #1059, origin #759.)

---

### 2.11 `.hex`/`.bin` fixtures use raw 16-bit words, not `.e` bytes

When writing `.hex` or `.bin` test fixtures, use **raw 16-bit word values** (e.g. `D005`
for `mvi r0, 5`) — NOT the bytes of a `.e` file.

- **Why:** a `.e` file begins with an `oC` preamble and stores words little-endian.
  `.hex`/`.bin` files contain plain word values with no wrapper. Copying bytes out of a
  `.e` file into a `.hex` fixture produces silently wrong machine code with **no
  assembler error**.
- (Was `RULES.md` rule `magenta-gecko` — relocated #1059, origin #758.)

---

## 3. Runtime-level pitfalls (assembles fine, breaks when run)

### 3.1 Divide/remainder by zero reports "Floating point exception"

- **Symptom:** Integer `div`/`rem` by zero crashes with `Floating point
  exception` — wording that misleadingly suggests floats.
- **Why:** LCC inherits the Unix-historical SIGFPE message for integer
  divide-by-zero. This is intentional oracle parity, not a bug.
- **Fix:** Guard with `cmp` + `brz` before any `div`/`rem`. There is no graceful
  handler — the program halts.

### 3.2 Memory wraps silently at 65536 words

- **Symptom:** Pointer arithmetic that produces an address > 65535 doesn't fault —
  it wraps to a low address and reads/writes there. Often shows up as "my program
  corrupted its own header" or "data section silently overwritten."
- **Why:** Every access is `mem[addr & 0xFFFF]` — wrap modulo `MAX_MEMORY`, no
  bounds check.
- **Fix:** Be defensive when computing addresses arithmetically.

### 3.3 The stack has no underflow check

- **Symptom:** A `pop` past the initial `sp` runs without error and returns
  whatever happens to be there (often 0, sometimes garbage).
- **Why:** There is no runtime stack-bounds enforcement.
- **Fix:** Match every `push` with a `pop`. Use `mov sp, fp` in epilogues to
  recover the frame if pushes/pops got out of sync.

### 3.4 `ain` immediately after `din` reads the leftover `\n`

- **Symptom:** In a program that calls `din` then `ain`, the `ain` reads ASCII 10
  (`\n`) instead of the next intended character. The operator/character is effectively
  "skipped" and the program proceeds with a newline value.
- **Why:** `din` leaves the terminating `\n` in stdin after reading the decimal number.
  A bare `ain` immediately following will read that leftover `\n`.
- **Fix:** Use a double-`ain` pattern — the first call discards the newline, the second
  reads the intended character:
  ```asm
  din r0         ; Read number — leaves \n in stdin
  ain r1         ; discard leftover \n
  ain r1         ; now read the intended character
  ```
  This pattern works correctly in both OG LCC and lccjs (#857 fixed the lccjs parity bug).

---

## 4. Linking / multi-module pitfalls

### 4.1 PC-relative reach also bites across module boundaries

- **Symptom:** A reference from module A to a global in module B worked while both
  were small, then errors with `pcoffset9 out of range` after the modules grew.
- **Why:** The linker concatenates modules and resolves PC-relative offsets at
  final addresses, so a `ld` near the top of A reaching a `.word` near the bottom
  of B sees the **post-link** distance (pitfall 1.2 applied after linking).
- **Fix:** Use the pointer-alias pattern (pitfall 1.2) with the `@xP: .word x`
  alias in the **same module** as the use site; let the linker resolve the alias's
  contents to wherever the target lands.
- **Status:** The base linker is implemented (`src/core/linker.js`); LCC+
  multi-module linking (`src/plus/linkerplus.js`) is planned but not yet written.

---

## 5. Oracle-divergence pitfalls (don't chase a phantom bug)

When you compare LCC.js output against the original LCC, a few differences are
**intentional** — LCC.js is correct and OG LCC is wrong, or the divergence is by
design. The full record is in [docs/parity_deviations.md](./parity_deviations.md);
the two you're most likely to hit:

### 5.1 `ldr`/`str` no-comma negative offset

- **OG LCC:** `ldr r1 fp -1` (no commas) silently encodes `offset6 = 0`.
- **LCC.js:** correctly encodes `offset6 = -1`.
- **Also the immediate family (`add`/`sub`/`and`/`cmp`/`mvi`):** OG LCC *rejects* a
  no-comma negative immediate (`add r0 r0 -1`) with a generic error (and leaves a
  blank `.e` behind); LCC.js encodes it correctly. Same root cause — OG LCC's
  no-comma parser can't read a negative integer (#257).
- **Fix:** Use commas (`ldr r1, fp, -1`, `add r0, r0, -1`) for cross-tool
  portability; without them, OG LCC is wrong and LCC.js matches the spec.

### 5.2 `mov dr, -1` — accepted by LCC.js, rejected by OG LCC (OB-008)

- **OG LCC:** `mov r0, -1` errors, while `mvi r0, -1` is accepted.
- **LCC.js:** both accepted (the spec says `mov` is an `mvi` pseudo-instruction).
- **Fix:** Use `mvi` explicitly if cross-tool portability matters; otherwise `mov`
  is fine in LCC.js.

---

## 6. Toolchain / workflow pitfalls

**`*.spec.js` files are outside PDD scan coverage.** `tests/**/*.spec.js` is excluded from `.pddignore` (#367), so a `@todo` marker placed inside a spec file will not appear in `npm run puzzles` output and will not be enforced against a GitHub issue. Real puzzle markers belong in source files under `src/`.

**Wrap every toolchain invocation in `scripts/lccrun.sh`.** Any shell invocation of `lcc.js`, `assembler.js`, `interpreter.js`, `linker.js`, or the oracle binary (`$LCC_ORACLE`) must go through `scripts/lccrun.sh [secs]`. Bare invocations block **indefinitely** when `name.nnn` is absent and stdin is not a TTY — `lccrun.sh` adds a timeout and kills a hung process. (Was `RULES.md` rule `maroon-civet` — relocated #1059, origin #376.)

**New terminal stdout must mirror into the `.lst` Output section — or be debug-gated.** The oracle-parity golden suites diff the `.e`/`.lst`/`.bst` artifacts, and the `.lst` carries the runtime `====== Output` section, so program-output regressions *are* caught. But anything lccjs writes to the **terminal only** — a stray `console.log`, an extra banner — that is **not** also captured into the `.lst` Output section is **invisible to golden parity**: it can diverge from the oracle (which never emits it) while every golden suite still passes. A stdout-capture assertion was deliberately *not* built into the suites (high-cost/low-yield — #1055 verdict); this convention is the belt-and-suspenders instead. So: route new program output through the same surface the `.lst` records, or gate purely-diagnostic output behind a debug flag. (Origin: #1055 SPIKE item #4; narrow residual of the #931 failure class.)

## See also

- [docs/lcc-isa.md](./lcc-isa.md) — instruction set, field widths, branch codes.
- [docs/parity_deviations.md](./parity_deviations.md) — full oracle-divergence list.
- [docs/glossary/assembler.md](./glossary/assembler.md) — encoder semantics.
- [docs/glossary/interpreter.md](./glossary/interpreter.md) — runtime semantics.
- [docs/tutorial_01_intro.md](./tutorial_01_intro.md) — step-by-step intro for learners.
- [docs/who_lccjs_is_for.md](./who_lccjs_is_for.md) — find your starting point.
