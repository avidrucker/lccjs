# LCC Assembly Pitfalls — long-form catalog

The four highest-cost bug classes live inline in SKILL.md (`r5`/`r6`/`r7`
reservation, `pcoffset9` ±256 range, immediate widths, branch-flag semantics).
This file expands the catalog with the secondary pitfalls — bugs that bite less
often but are real, surprising, and have been hit at least once in this
codebase or its oracle.

Each entry: **symptom → why → fix.** Cross-references point to
`docs/glossary/assembler.md` (encoder semantics) or
`docs/glossary/interpreter.md` (runtime semantics) in the lccjs repo, and to
SKILL.md when an inline pitfall is the root cause.

---

## A. Assembler-level pitfalls (file won't assemble, or assembles to wrong bytes)

### A1. `mov dr, imm` is `mvi` in disguise — same 9-bit range applies

- **Symptom:** A `mov r0, 1000` errors with `imm9 out of range`. Adding a `.word 1000` constant and using `ld` works.
- **Why:** `mov dr, imm` is a pseudo-instruction that translates to `mvi dr, imm9`. The 9-bit signed range is `[-256, 255]`, same as inline pitfall #3.
- **Fix:** Put the constant in a `.word` and `ld` it. Same fix as pitfall #3.
- **Cross-ref:** SKILL.md pitfall 3; `isa-quickref.md` "Field widths" table.

### A2. `.word label +N` (two-token form) drops the `+N` offset

- **Symptom:** `.word arr +3` assembles, runs, and silently writes the address of `arr` (not `arr+3`) into the word. Programs that index into a table this way read the wrong element.
- **Why:** The assembler's `.word` directive parses a single token as the value. When `label +N` is written with whitespace between the label and the sign, the tokenizer splits them into two tokens; the second is silently ignored.
- **Fix:** Write `arr+3` with **no whitespace** around the `+`. This is the only form the parser respects.
- **Cross-ref:** `docs/glossary/assembler.md` — `.word` directive entry.

### A3. String escape set is small — `\0`/`\b`/`\f`/`\v` are not supported

- **Symptom:** `"col\0sep"` assembles with a warning ("Unknown escape sequence") and the `\0` is left as a literal `\` + `0` in the string. Programs that expect a NUL terminator at that point read garbage.
- **Why:** The assembler recognizes exactly five escapes: `\n`, `\t`, `\\`, `\"`, `\r`. Anything else is "unknown" and the backslash is preserved (non-fatal).
- **Fix:** If you need a NUL or other special byte mid-string, build it via two `.word` entries (`.word 0x68`, `.word 0x00`, …) or split the string and concatenate at runtime.
- **Cross-ref:** `docs/glossary/assembler.md` — `.string` directive entry.

### A4. Label syntax: must start with `[A-Za-z_$@]`

- **Symptom:** A label starting with a digit (`3rd_arg:`) errors with a cryptic parse failure pointing at the label, not the issue.
- **Why:** First-char alphabet is restricted to `[A-Za-z_$@]`; subsequent chars can include digits. This is stricter than what some other assemblers accept.
- **Fix:** Prefix the label (`_3rd_arg:` or `arg3:`). The `@` prefix is the house convention for compiler-generated labels — branch targets use `@L0`/`@L1`/…, strings use `@M0`/`@M1`/….
- **Cross-ref:** `docs/glossary/assembler.md` lines 96 area ("Label syntax").

### A5. `offset6` and `ct` have silent defaults

- **Symptom:** `ldr r0, fp` (no offset) assembles successfully but loads `mem[fp+0]` — usually not what was intended. `srl r0` (no count) shifts by 1.
- **Why:** When `ldr`/`str`/`blr`/`jmp`/`ret` omit `offset6`, it defaults to 0. When `srl`/`sra`/`sll`/`rol`/`ror` omit `ct`, it defaults to 1.
- **Fix:** Always write the offset / count explicitly. Defaults are a debugging hazard — they assemble silently and produce wrong results, not error messages.
- **Cross-ref:** `isa-quickref.md` "Field widths" table footnotes.

### A6. Trap operand defaults to `r0`

- **Symptom:** `dout r3` works as expected; `dout` (no operand) also assembles, and silently prints `r0` instead. Useful when you really want `r0`, surprising otherwise.
- **Why:** Trap-class opcodes (`sin`/`sout`/`din`/`dout`/`nl`/`halt`/`aout`/`ain`/`hin`/`hout`) take an optional source register that defaults to `r0`.
- **Fix:** Be explicit when the value is not in `r0`. The default is meant to make `r0` the canonical "scratch / arg / return-value" register, not to be a syntactic shortcut.
- **Cross-ref:** `isa-quickref.md` trap section.

### A7. `.start <label>` is the only way to set the entry point

- **Symptom:** Program with `main:` and `startup:` runs from address 0, which usually lands in the data section and dies. Reordering sections sometimes "fixes" it accidentally.
- **Why:** Without `.start`, execution begins at PC=0 (or `loadPoint`, the `-L<hex>` value). The assembler does not default to `main:`.
- **Fix:** Put `.start main` (or `.start startup`) near the top of the file. The label is resolved after pass 2, so position-independent.
- **Cross-ref:** `docs/glossary/assembler.md` — `.start` directive entry.

### A8. Program-size cap is 65536 words

- **Symptom:** A large generated program errors with `Program too big`.
- **Why:** Address space is 16-bit word-addressable; `MAX_MEMORY = 65536`. The assembler refuses to emit a `.e` larger than that.
- **Fix:** If you're approaching this limit, you've likely outgrown direct hand-coding — consider splitting into modules and using the (planned) `linkerplus.js` to combine `.ap` files.

---

## B. Interpreter-level pitfalls (assembled fine, breaks at runtime)

### B1. DIV / REM by zero → "Floating point exception"

- **Symptom:** Integer divide-by-zero crashes with `Floating point exception` — wording that suggests floats, not integers.
- **Why:** LCC matches its oracle's idiosyncratic wording; integer divide-by-zero is reported with the Unix-historical "SIGFPE" message. This is intentional parity, not a bug.
- **Fix:** Guard with `cmp` + `brz` before any `div`/`rem`. There is no graceful runtime handler — the program halts.
- **Cross-ref:** `docs/glossary/interpreter.md` — DIV/REM entry, line ~361.

### B2. Memory wraps at 65536 words (silent address wrap)

- **Symptom:** A bug in pointer arithmetic that produces an address > 65535 doesn't fault — it wraps to a low address and reads/writes there instead.
- **Why:** `mem[addr & 0xFFFF]` semantics — every fetch and store wraps modulo `MAX_MEMORY`. No bounds check, no fault.
- **Fix:** Defensive programming if you're computing addresses by arithmetic. Symptom often presents as "my program corrupted its own header" or "data section silently overwritten."
- **Cross-ref:** `docs/glossary/interpreter.md` — `mem` entry, line ~211.

### B3. Stack empty / underflow

- **Symptom:** A `pop` past the initial `sp` value runs without error, returning whatever happens to be there (often zero, sometimes garbage).
- **Why:** There is no stack-bounds check. The interpreter snapshots `spInitial = r6` at start, but only uses it for the `S` debugger command (stack-empty heuristic in the listing), not for runtime enforcement.
- **Fix:** Match every `push` with a `pop`. Use `mov sp, fp` in epilogues to recover the frame even if pushes/pops got out of sync mid-function.

---

## C. Cross-reference / linking pitfalls (multi-file `.ap` work)

### C1. `lea`/`ld` ±256 range crosses module boundaries unfavorably

- **Symptom:** A function in module A that referenced a global in module B worked when both were small; after the modules grew, the same `ld` errors with `pcoffset9 out of range`.
- **Why:** Inline pitfall #2 applies post-link: the linker concatenates modules and resolves PC-relative offsets at final addresses. A `ld` near the top of module A reaching a `.word` near the bottom of module B sees the post-link distance, not the per-module distance.
- **Fix:** Same as inline pitfall #2 — pointer-alias pattern. Put `@xP: .word x` in the *same module* as the use site, and let the linker resolve `@xP`'s contents to wherever `x` ends up.
- **Status:** Linker is partially implemented (`src/core/linker.js`); the planned `linkerplus.js` will extend this to LCC+ — see the [`plus-linker-planned` memory](../../../projects/-home-avi-Documents-Study-JavaScript-lccjs/memory/plus_linker_planned.md).

---

## D. Oracle-divergence pitfalls (LCC.js correct, OG LCC wrong — but documented)

These are tracked in `docs/parity_deviations.md`. Listed here so you don't
chase a phantom bug if you compare LCC.js output to OG LCC.

### D1. `ldr`/`str` no-comma negative offset

- **OG LCC:** `ldr r1 fp -1` (no commas) silently encodes `offset6 = 0`.
- **LCC.js:** Correctly encodes `offset6 = -1`.
- **Fix:** Use commas (`ldr r1, fp, -1`) for cross-tool portability. Without commas, OG LCC is wrong; LCC.js matches the spec.

### D2. `mov dr, -1` accepted by LCC.js, rejected by OG LCC (OB-008)

- **OG LCC:** `mov r0, -1` errors; `mvi r0, -1` is accepted.
- **LCC.js:** Both accepted (matches the spec: `mov` is a `mvi` pseudo).
- **Fix:** Use `mvi` explicitly if cross-tool portability matters. Otherwise `mov` is fine in LCC.js.

---

## See also

- SKILL.md — the four non-negotiable pitfalls inline
- `isa-quickref.md` — field widths, instruction table
- `calling-convention.md` — register roles, frame layout
- `idioms-and-patterns.md` — the correct-pattern shapes referenced above
- `lccjs/docs/parity_deviations.md` — exhaustive OG-LCC divergence list
- `lccjs/docs/glossary/assembler.md` — encoder semantics
- `lccjs/docs/glossary/interpreter.md` — runtime semantics
