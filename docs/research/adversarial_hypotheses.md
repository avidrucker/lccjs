# lccjs — Adversarial Test Hypotheses

Generated 2026-05-31 from deep read of `src/core/assembler.js`,
`src/core/interpreter.js`, `src/core/linker.js`, `open_bugs.md`,
`docs/parity_deviations.md`, and existing test suites.

> **Architect triage (2026-06-01, #404):** Priority order, batching plan, oracle-routing
> decisions, and critiques of the priority list below all live in
> `docs/research/adversarial-hypothesis-triage.md`. Read that first before picking up
> any hypothesis as a ticket — several items are re-ranked, batched, or routed to #218.

Each hypothesis is a **specific failure mode** that the current code
may or may not handle correctly. The TDD workflow is:

1. Write a test that encodes the hypothesis (red).
2. Confirm whether the code already passes it (green) or exposes a bug.
3. Fix if broken; document if intentional deviation.

Severity legend: 🔴 High (silent miscompile / crash / corrupt output)
                  🟡 Medium (wrong output, loud error)
                  🟢 Low (cosmetic / edge aesthetic)

---

## ASSEMBLER — Tokenizer & Parser

### H-001 🔴 Unterminated string literal silently truncates
**Hypothesis:** `.stringz "hello` (no closing quote) causes
`isStringLiteral` to return false and `failAssembly("Missing terminating
quote")` to fire. BUT — the tokenizer's `inString` flag keeps reading
until EOF and pushes the entire rest of the line as one token. If a
later line happens to contain a `"`, the tokenizer exits `inString` mid-
line and passes the merged blob to `handleDirective`. Net result may be a
misleading "invalid operation" error pointing at the *wrong* line, not
the unterminated literal.

**Test idea:**
```asm
.stringz "hello
add r0, r1, r2
```
Assert: error is reported on line 1, not line 2.

---

### H-002 🟡 Label-colon detection is fooled by colon inside a string
**Hypothesis:** `tokenizeLine` watches for `:` in the outer (non-string)
branch, but a line like:
```asm
  .stringz "a:b"
```
should NOT produce a label token `a`. The colon handling strips the colon
and pushes a token whenever `currentToken` is non-empty — but this code
path only runs when `!inString`. If the string starts *after* the colon
character position, a bare colon appearing before the quote could be mis-
tokenized. Edge: a label definition line like `foo: .stringz "x:y"`.

**Test idea:** Assemble `foo: .stringz "x:y"` and verify symbol table has
exactly one entry (`foo`) and the string data is `x:y\0` (4 words).

---

### H-003 🔴 `*+N` / `*-N` with hex offset is not supported
**Hypothesis:** `evaluateOperand` handles `*+N` / `*-N` by calling
`parseNumber(operand.slice(1))` on the `+N` or `-N` suffix. `parseNumber`
handles decimal and `0x` hex. But `*+0x10` would slice to `+0x10`, and
`parseInt("+0x10", 10)` returns `NaN` while `parseInt("+0x10", 16)`
returns `NaN` too (leading `+` breaks hex parse). This means a hex PC-
relative offset silently triggers `Bad number` or `Unspecified label
error` at runtime instead of assembling correctly.

**Test idea:** `.word *+0x2` — should assemble as `locCtr + 2`.

---

### H-004 🟡 `.org` backward-overlap check uses `locCtr`, not `outputBuffer` fill level
**Hypothesis:** After a `.org 5` the locCtr is 5. If code or data later
advances locCtr to 10, and then `.org 7` is encountered, the check
`orgAddress < this.locCtr` fires with `7 < 10` → "Backward address on
.org". That is intentional. But in Pass 1 the check also fires even
though no actual words have been written yet — the semantics are purely
locCtr-based. Hypothesis: a forward `.org` that skips to an address
exactly equal to `locCtr` (`.org locCtr`) emits no gap words and does not
error, but nothing prevents locCtr from equaling the orgAddress after a
previous `.org` left a gap that was then filled. Verify the exact boundary:
`.org N` where N == current locCtr should be a no-op, not an error.

**Test idea:** Assemble:
```asm
  .org 5
  .org 5   ; same address again — should this error or be a no-op?
```

---

### H-005 🔴 `.blkw` / `.space` upper bound allows exact 65536-word program
**Hypothesis:** The upper bound check is `num > (65536 - this.locCtr)`.
If `locCtr == 0` and `num == 65536`, the check is `65536 > 65536` which
is false, so it passes. Writing 65536 words with locCtr starting at 0
fills the *entire* 16-bit address space including address 0xFFFF. But
the interpreter's memory is `new Uint16Array(65536)` (indices 0..65535),
so index 65535 is valid. The `locCtr > 65536` overflow guard in
`performPass` fires when locCtr *exceeds* 65536, not when it *reaches* it.
Net result: a `.blkw 65536` at address 0 should assemble without error
but produces a 131072-byte output file. Verify this is intentional or an
off-by-one.

**Test idea:** `.blkw 65536` at locCtr==0 — does it assemble? Does the
interpreter load it without overflow?

---

### H-006 🟡 Duplicate label detected only in Pass 1; Pass 2 silently uses first value
**Hypothesis:** `this.labels` (a Set) tracks duplicates in Pass 1 and
raises an error. But `REPORT_MULTI_ERRORS = false` means the *first*
duplicate error exits immediately, so the second label definition is never
reached in Pass 1. If for some reason `REPORT_MULTI_ERRORS` were true,
Pass 2 would silently overwrite the symbol table with the second
occurrence. Verify the error fires on the *second* definition line, not
the first.

**Test idea:**
```asm
foo:  add r0, r1, 1
foo:  add r0, r1, 2
```
Assert: error mentions line 2 (the duplicate), not line 1.

---

### H-007 🟡 `.word label + N` with three tokens — only evaluated in Pass 2
**Hypothesis:** The three-operand label+offset path for `.word` checks
`operands[1] && operands[2]` in Pass 2 to merge `label + N`. In Pass 1,
`locCtr += 1` unconditionally (correct). But in Pass 2, if exactly
`operands[1]` is present but `operands[2]` is absent (two tokens: label
operator), the code hits:
```js
if((operands[1] && this.isOperator(operands[1])) &&
   (operands[2] === null || operands[2] === undefined)) {
  this.failAssembly('Missing number', 1);
}
```
But this check comes *after* the three-token merge block. If `operands[1]`
is a non-operator (e.g. a second label), it falls through to
`evaluateOperand(operands[0], 'V')`, ignoring `operands[1]` silently.

**Test idea:** `.word foo bar` (two label tokens, no operator) — does it
silently use only `foo`, or error?

---

### H-008 🔴 `tokenizeLine` collapses adjacent commas to nothing
**Hypothesis:** The tokenizer strips commas as delimiters but does not
detect *missing* operands between commas. `add r0,,r1` would tokenize as
`['add', 'r0', 'r1']`, which looks like `add r0, r1` (missing third
operand). The `assembleADD` call then sees `operands[2] === undefined` and
calls `failAssembly('Missing operand')` — the *right* error, but the
wrong message (`Missing operand` vs something like `Bad syntax`). More
importantly, `add r0, r1,` (trailing comma) silently drops the comma and
tries to assemble with only two operands, possibly giving a misleading
error.

**Test idea:** `add r0,,r1` and `add r0, r1,` — confirm both error with
a clear message, not a confusing one.

---

### H-009 🟡 Branch pcoffset9 boundary: exactly -256 and +255 should assemble
**Hypothesis:** `assembleBR` computes `pcoffset9 = address - locCtr - 1`
and checks `-256 <= pcoffset9 <= 255`. A branch to `locCtr - 256`
(maximum backward reach) should produce pcoffset9 == -256 which is
exactly at the limit. Verify both boundary values assemble and that
`-257` / `+256` produce the "pcoffset9 out of range" error. Same for
`assembleLD`/`assembleST`/`assembleLea`.

**Test idea:** Craft a program where a branch lands exactly 256
instructions behind and 255 ahead. Assemble and verify encoded bits.

**Probe result (#502):** Oracle and lccjs agree exactly. +255 assembles as `0x00ff`; -256 assembles as `0x0100`. Both reject +256 and -257 with identical "pcoffset9 out of range" errors. No deviation.

---

### H-010 🔴 `evaluateImmediate` accepts `NaN` string — `parseNumber(undefined)` returns `null`
**Hypothesis:** `evaluateImmediate(valueStr, min, max)` calls
`parseNumber(valueStr)`. `parseNumber` returns `null` when `valueStr` is
`null` or `undefined`. Then `isNaN(null)` is `false` in JS (because
`Number(null) === 0`), so `null` passes the NaN check and is treated as
the number `0`. A missing immediate would silently encode as `0` instead
of raising "Bad number".

**Test idea:** `add r0, r1` (no immediate, no third operand) — does the
assembler detect the missing operand, or does it encode `add r0, r1, 0`?

> **Architect caution (#404):** `assembleADD` likely has an upstream operand-count
> check that fires before `evaluateImmediate` is called with `undefined`. Verify
> whether that guard exists first — if it does, this hypothesis confirms correct
> behavior rather than exposing a bug. Ranked 6th (not 1st) in the triage doc.

---

### H-011 🟡 `.start` with an undefined label errors after Pass 2, not during it
**Hypothesis:** `.start` stores `this.startLabel` but resolves it *after*
Pass 2 via `this.symbolTable[this.startLabel]`. If the label is undefined,
`failAssembly('Undefined label')` fires. But by this point the output
buffer has been populated and `writeOutputFile()` has not yet been called,
so no corrupt file is written. Verify the error message correctly names
the undefined label, not a generic message.

**Test idea:** `.start nonexistent` — assert the error message includes
the label name.

---

## ASSEMBLER — Instruction Encoding

### H-012 🔴 `assembleSRL/SLL/ROL/ROR` shift count is not range-checked
**Hypothesis:** `assembleSRL` / `assembleSLL` / `assembleROL` /
`assembleROR` accept the count via `evaluateImmediateNaive`, which caps at
16 bits but does **no range check**. A shift count of 0 (no-op) or 16+
(wraps the field) is silently encoded. The count field is 4 bits in the
machine word (`ct << 5` with bits 5..8). A count of 16 (`0x10`) would
overflow into bit 9 and corrupt the opcode encoding.

**Test idea:** `srl r0, 16` — what machine word is produced? Does it
accidentally encode a valid but wrong instruction?

---

### H-013 🔴 `assembleSRA` uses `evaluateImmediate(0, 15)` — shift 0 is allowed but shift 16 is rejected
**Hypothesis:** Unlike its siblings, `assembleSRA` calls `evaluateImmediate`
with range [0, 15]. This is the only shift instruction that enforces a
range. If a count of 0 was intended to mean "shift by 1" (matching the
`ct === null → ct = 1` fallback on the others), then `sra r0, 0`
assembles a 0-count which may behave differently from the oracle. Verify
`sra r0` (no count) vs `sra r0, 0` produce the same or different encoding.

**Test idea:** `sra r0` vs `sra r0, 0` vs `sra r0, 1` — compare machine
words.

**Probe result (#502):** `sra r0` → `0xa023`; `sra r0, 0` → `0xa003`; `sra r0, 1` → `0xa023`. Oracle and lccjs produce identical encodings for all three forms. `sra r0, 0` is a valid distinct encoding (count=0 field), not an error. No deviation.

---

### H-014 🟡 `assembleRET offset6` — offset6 is not range-checked
**Hypothesis:** `assembleRET` calls `evaluateImmediate(operands[0], -32,
31)` which IS range-checked. But `assembleJMP` offset6 path also uses
`evaluateImmediate(-32, 31)`. The hypothesis is about `ret 32` and
`ret -33` — verify they both raise "offset6 out of range" and not
"Bad number".

**Test idea:** `ret 32` — confirm error text.

---

### H-015 🔴 `assembleTrap` with an unknown register string hits `getRegister`'s `failAssembly`
**Hypothesis:** `assembleTrap` calls `getRegister(operands[0])` only when
`operands[0]` is truthy. If an invalid non-register token is passed (e.g.
`dout foo`), `getRegister` calls `failAssembly('Bad register')`. But
`assembleTrap` was designed for traps like `dout r0` where the register
selects the source. If someone writes `dout 5` (a numeric literal), it
goes to `getRegister("5")`, which fails `isRegister` and fires "Bad
register". The correct error might be more specific. Verify.

**Test idea:** `dout 5` — does it error? What message?

---

### H-016 🟡 `assembleBL` rejects numeric literals as the label operand
**Hypothesis:** `assembleBL` calls `isValidLabel(label)` before anything
else and fires `failAssembly('Bad label')` if it fails. A numeric
literal like `bl 0x10` would fail `isValidLabel` (starts with `0`) and
error immediately, but the intent might be to jump to an absolute address.
Oracle behavior: does `bl 5` error on the oracle? If oracle accepts it,
lccjs has a deviation.

**Test idea:** `bl 5` — does it assemble? Does the oracle?

**Probe result (#502):** Both reject `bl 5`. Oracle: "Undefined label" (treats `5` as a syntactically valid but undefined label). lccjs: "Bad label" (rejects `5` as an invalid label name). No behavioral deviation; error message wording differs. lccjs's stricter upfront validation is acceptable.

---

## ASSEMBLER — Edge Cases / State

### H-017 🔴 `assembleSource` called twice on the same instance without explicit reset
**Hypothesis:** `assembleSource` calls `resetAssemblyState()` at the top,
so reuse should be safe. But `inputFileName` and `outputFileName` are NOT
reset by `resetAssemblyState()` — they're set via the options parameter.
If a caller invokes `assembleSource(src, {})` (no filenames) on a
previously-used instance, the stale filenames from the prior run are
inherited. Listing entries will reference the old filename in error
messages.

**Test idea:** Assemble file A, then call `assembleSource` with a
different source but no filename override. Check `inputFileName` in the
result.

---

### H-018 🟡 `performPass` removes the last line if it's blank — but only at end of Pass 2
**Hypothesis:** The tail-blank-line strip at the end of Pass 2 calls
`this.listing.pop()` unconditionally when `sourceLine.trim() === ''`. If
the source file has *multiple* trailing blank lines, only the last one is
removed. Verify: a file with three trailing blank lines produces a listing
with two trailing blank-line entries — not zero.

**Test idea:** Source ending in `\n\n\n` — how many listing entries are
there for the trailing blanks?

---

### H-019 🔴 `parseNumber` does not handle octal — `08` and `09` silently parse as 8 and 9
**Hypothesis:** `parseInt("08", 10)` returns 8 in modern JS. But
historically `parseInt("08")` (no radix) returned 0 in older engines.
lccjs always passes radix 10 for decimal and 16 for hex, so this is safe.
However, `"0777"` is parsed as decimal 777, not octal 511. If the oracle
LCC treats `0`-prefixed integers as octal, lccjs would silently produce
wrong values for `.word 0777` style literals.

**Test idea:** `.word 0777` — what value does lccjs assemble? What does
the oracle produce?

**Probe result (#502):** Oracle assembled `.word 0777` as `0x0309` (777 decimal) and printed "777" at runtime. lccjs also assembles as `0x0309`. Both treat `0`-prefixed integers as decimal. No deviation — hypothesis disproved.

---

## INTERPRETER

### H-020 🔴 Division by zero — `div` trap behavior
**Hypothesis:** `assembleDIV` encodes the instruction, but the interpreter
must handle the case where the divisor register is 0 at runtime. If there
is no explicit divide-by-zero check, the JS `%` or `/` operator will
return `Infinity` or `NaN`, which when coerced to `Uint16Array` becomes
`0`. The program continues with a silently wrong result rather than a
runtime error. Same applies to `rem`.

**Test idea:** At runtime: `mov r1, 0; mov r0, 10; div r0, r1` — does the
interpreter halt with an error, or silently produce a wrong value?

---

### H-021 🔴 `instructionsCap` triggers on programs with legitimate long loops
**Hypothesis:** The 500,000-instruction cap fires `Possible infinite loop`
for any program that genuinely runs longer. A program computing a large
Fibonacci value or doing heavy string processing could hit this. The cap
is also applied *even when `allowRuntimeDebugging = false`*, so users
can't easily override it from the API. Verify that `disableInfiniteLoopDetection = true`
fully suppresses the cap without side effects.

**Test idea:** Write a program with a deliberate 600,000-iteration loop.
Run with `disableInfiniteLoopDetection = true` — should complete.
Run without it — should error at 500,000.

---

### H-022 🟡 Stack-pointer tracking: `spInitial` set at load time; what if SP is modified before first push?
**Hypothesis:** `maxStackSize` is tracked as `spInitial - this.r[6]` (or
similar). If the program initializes SP to a custom value *after* load
(e.g. `mvi sp, 0x1000`), `spInitial` from load time is wrong and
`maxStackSize` will be meaningless or negative. Verify the interpreter
handles this gracefully (no negative maxStackSize reported in stats).

**Test idea:** Program that sets `sp` to an explicit address before
pushing anything. Check the `.bst` stats output.

---

### H-023 🔴 Reading memory above the loaded program region returns 0 (Uint16Array default)
**Hypothesis:** `ldr r0, r1, 0` where r1 points past the program's loaded
region reads from initialized-to-zero memory. This is correct and
expected. The adversarial case: a buggy program that computes a pointer
to address 0xFFFF and then does `ldr`/`str` there. Storing to 0xFFFF
should work (it's valid memory). Verify no off-by-one in the memory
bounds check.

**Test idea:** `mvi r0, 0; str r1, r0, -1` — r0=0, offset=-1 → effective
address = 0xFFFF (wraps). Does it store to 0xFFFF without error?

---

### H-024 🟡 `SEXT_PARITY_TABLE` — selector values > 15 fall through to raw-mask path
**Hypothesis:** The comment says "Selectors larger than 0x0f still behave
like raw masks." Verify that `sext r0, r1` where the selector field in the
instruction word is 16..31 actually hits the raw-mask path and produces
correct sign-extension results, vs. a possible index-out-of-bounds on the
table (which is 16 rows × 32 cols — so row index 16 would be undefined).

**Test idea:** Encode a `sext` instruction with selector nibble = 0x10
(16). Does the interpreter correctly sign-extend or throw an error?

---

## LINKER

### H-025 🔴 Two object modules both declaring `.globl` for the same label — which wins?
**Hypothesis:** The linker builds `GTable` (global symbol → address). If
two `.o` files both export the same label name, `GTable[label]` is
overwritten silently by the second module's value. The final linked
`.e` may call the wrong function. Verify the linker either errors on
duplicate globals or documents which one wins.

**Test idea:** Link two `.o` files each exporting `foo`. Verify either an
error or predictable (first-wins / last-wins) behavior.

---

### H-026 🔴 Linker `parseObjectModuleBuffer` — truncated buffer after 'C' marker
**Hypothesis:** After the `'C'` marker, the remaining buffer bytes are
read as machine code words in pairs. If the buffer length after `'C'` is
odd (an extra byte), `buffer.readUInt16LE(offset)` at the last byte would
read one byte past the end. Node.js `Buffer.readUInt16LE` throws
`ERR_OUT_OF_RANGE` in this case. An adversarially crafted `.o` file with
an odd code-section length would crash the linker instead of producing a
clean error.

**Test idea:** Craft a `Buffer` with a valid header and one trailing code
byte (odd length). Call `parseObjectModuleBuffer` — expect a `LinkerError`,
not an uncaught Node exception.

---

### H-027 🟡 Linker with zero input files after `-o` flag parsing
**Hypothesis:** The CLI parser in `linker.main()` stops when `args[i] ===
'-o'` and consumes the next arg as the output file. If someone passes
`node linker.js -o out.e` with no `.o` files, `inputFiles` stays empty and
the "No input object modules specified" error fires. But if they pass
`node linker.js -o` with no output filename AND no input files, the check
`i + 1 >= args.length` fires "Missing output file name after -o", which
is correct. Verify both cases produce clean, non-crashing errors.

**Test idea:** Run `linker.main(['-o'])` and `linker.main(['-o', 'x.e'])`
— confirm correct error messages.

---

## DISASSEMBLER (0% coverage)

### H-028 🔴 Round-trip fidelity: assemble → disassemble → re-assemble must be stable
**Hypothesis:** Any `.a` program assembled to `.e`, disassembled back to
`.a`, and re-assembled should produce byte-identical output. The OB-002
fix addressed `mvi` mask, but no round-trip test exists. Silent deviations
in any other instruction's disassembly will go unnoticed.

**Test idea:** For each instruction type, run the round-trip and diff the
`.e` files.

---

### H-029 🟡 Disassembler for `mvr` / `sext` / extended group opcode disambiguation
**Hypothesis:** The extended group (`OP_EXT = 0xA000`) covers PUSH, POP,
SRL, SRA, SLL, ROL, ROR, MUL, DIV, REM, OR, XOR, MVR, SEXT. These are
distinguished by bits in the low byte. The disassembler must inspect the
full 16-bit word carefully. A word like `0xA00D` is `sext r0, r0`; `0xA00C`
is `mvr r0, r0`. Verify the disassembler produces the correct mnemonic for
each sub-opcode across all 8 register pairs.

**Test idea:** Encode `0xA00C` manually in a `.hex` file, run through
disassembler, confirm output is `mvr r0, r0`.

---

## PLUS MODE (0% test coverage)

### H-030 🔴 `assemblerplus.js` inherits `assembleSource` — does `resetAssemblyState` also reset plus-specific state?
**Hypothesis:** `AssemblerPlus` extends `Assembler`. If it adds new
instance variables (e.g. for extended mnemonics or directives) that are
not included in `resetAssemblyState()`, reusing an `AssemblerPlus`
instance across two `assembleSource` calls would leak plus-specific state
from the first run into the second.

**Test idea:** Assemble a `.ap` program that uses a plus-only feature.
Re-assemble a minimal `.ap` program on the same instance. Verify the
second result is clean.

---

## META-HYPOTHESIS

### H-031 🟡 `REPORT_MULTI_ERRORS = false` is a global constant — no per-instance override
**Hypothesis:** The constant at the top of `assembler.js` is
`const REPORT_MULTI_ERRORS = false`. There is no way for callers to
enable multi-error mode without modifying source. An API caller (e.g. an
IDE plugin) that wants to collect all errors in one pass cannot do so.
This is a design constraint, not a bug, but adversarially: passing
`throwOnAssemblyError = true` in options does NOT enable multi-error
mode — it just makes the first error throw instead of calling
`process.exit`. Verify this is documented and test that *exactly one*
error is reported even when two errors exist on separate lines.

**Test idea:**
```asm
bad_instr_1
bad_instr_2
```
Assert: only one error in the `errors` array, not two.

---

*Total: 31 hypotheses across assembler, interpreter, linker,
disassembler, and plus-mode. Priority order for TDD:*

**Start here (highest risk, least coverage):**
H-010, H-003, H-012, H-020, H-025, H-026, H-028

**Good medium-difficulty TDD targets:**
H-001, H-002, H-008, H-009, H-015, H-023, H-030

**Deepen existing coverage:**
H-004, H-005, H-006, H-007, H-011, H-013, H-016, H-017, H-018, H-021, H-022, H-029, H-031
