# Assembler Glossary

Glossary of LCC-specific terms used in `src/core/assembler.js`.

The original spike (#108) has been decomposed into 5 sub-spikes, each covering a
coherent section of the file. The write phase (#111) consolidates the
inventoried terms into definitions once all 5 spikes have closed.

<!-- @todo #128:60m/WRITER Write section (a) lifecycle/output definitions. Parent tracker #111. See #128 -->
<!-- @todo #129:60m/WRITER Write section (b) pass model + file parsing definitions. Parent tracker #111. See #129 -->
<!-- @todo #130:60m/WRITER Write section (c) tokenization + dispatch definitions. Parent tracker #111. See #130 -->
<!-- @todo #131:60m/WRITER Write section (d) per-instruction encoders definitions. Parent tracker #111. See #131 -->
<!-- @todo #132:60m/WRITER Write section (e) operand parsing helpers definitions. Parent tracker #111. See #132 -->

Parent: #107 · Tracker: #108 · See [README](./README.md) for entry conventions.

---

## Candidate term inventory

Tag each term by section letter `(a)`-`(e)` so the write phase (#111) can group by
area. Terms only — definitions land in the section below.

### (a) Lifecycle, output, top-level orchestration — populated by #119

**Assembly state:**
- `locCtr` (location counter)
- `loadPoint`, `defaultLoadPoint`, `listingLoadPoint` (the `-l<hex>` CLI flag)
- `programSize`
- `startLabel`, `startAddress`
- `pass` (1 or 2)
- `errorFlag`
- `isObjectModule`
- `throwOnAssemblyError`
- `sourceMap` (`addressToLine`, `allLines`)

**Symbol and label registries:**
- `symbolTable`
- `labels` (duplicate-detection set)
- `globalLabels` (from `.global`)
- `externLabels` (from `.extern`)
- `externalReferences`
- `adjustmentEntries`

**Source / output abstractions:**
- `sourceLines`
- `outputBuffer`
- `listing` (entry shape: `{locCtr, codeWords, sourceLine, lineNum}`)

**Supported file extensions:**
- `.a` (assembly source — the only extension that triggers the normal two-pass flow)
- `.e` (executable output, default)
- `.o` (object module output, when `isObjectModule`)
- `.bin` (raw binary input)
- `.hex` (raw hex input)
- `.ap` (LCC+ source — explicitly rejected; belongs to `assemblerPlus.js`)
- `.lst` (listing report)
- `.bst` — **binary listing** (resolved per #126): same content as `.lst` (header, source-code column, program statistics) but the machine words are printed in **binary** (16 bits split into 4-bit nibbles with spaces between, e.g. `1111 0000 0000 0001`) instead of hex. Same generator as `.lst` — only the `isBST` flag in `generateBSTLSTContent` toggles the encoding

**`.e` / `.o` file format** (per #124: write as **hybrid** — one overview entry showing the full layout + per-marker stubs that link back to it):
- `'o'` intro header byte (ASCII signature)
- Second intro header (extension hook — `'p'` for LCC+ `.ep`)
- Header entry types (typed records, sorted by address) — resolved per #125:
  - `'S'` — start address (from `.start`)
  - `'G'` — global label export (from `.global`)
  - `'E'` (uppercase) — external reference for `bl` (`pcoffset11` fixup)
  - `'e'` (lowercase) — external reference for `ld` / `st` / `lea` / `br` (`pcoffset9` fixup)
  - `'V'` (uppercase) — external reference for `.word` (full 16-bit value fixup)
  - `'A'` — adjustment entry (local label+offset, signals the linker to relocate)
  - The `usageType` parameter to `evaluateOperand(label, usageType)` selects which fixup kind to record (`'e'` / `'E'` / `'V'`); the linker reads the header-entry type byte and applies the matching fixup
- `'C'` code start marker
- UInt16LE encoding for addresses and machine words
- Null-terminated label strings in label-bearing entries

**Error model:**
- `AssemblerError` (typed)
- `REPORT_MULTI_ERRORS` toggle (original LCC: one error at a time)
- 300-character source line length limit
- "Empty file" — special exit code 0 when `locCtr === 0` after pass 1
- "Errors encountered during Pass 1/2"
- `validateLineLength`, `createAssemblyError`, `abortAssembly`

**CLI orchestration:**
- Direct invocation vs `lcc.js`-driven invocation (the pre-set `inputFileName` check)
- "Assembling X" / "Starting assembly pass 1/2" status messages
- "Output file X needs linking" (object-module case)
- "lst file = X" / "bst file = Y"
- `userName` via `nameHandler` (`name.nnn` for report generation)

**Output build pipeline:**
- `assembleSource(sourceCode, options)` — reusable in-memory entry point
- `createAssemblyResult({buildReports, userName, includeComments, now})` — structured in-memory result
- `buildOutputFileChunks(secondIntroHeader)` — serialization chunk producer
- `toOutputBuffer(secondIntroHeader)` — in-memory variant
- `writeOutputFile(secondIntroHeader)` — filesystem variant
- `constructOutputFileName(inputFileName, extension)` — sibling file naming
- `buildReportArtifacts(userName, includeComments, now)` — `.lst` / `.bst` content generation

### (b) Pass model + file parsing — populated by #120

**Label rules:**
- Label syntax: starts with `[A-Za-z_$@]`, followed by `[A-Za-z0-9_$@]*`
- Trailing colon allowed (`label:`)
- Mid-line label detection (whitespace at column 0 means "no label here")
- `@`-prefixed labels (compiler-mangled — `@L0`, `@M0`, `@s0_x`)
- `$` permitted in label names (likely C++ name-mangling separator; cf. `@A@set$ii`, `@f$ri`)
- Duplicate label detection (pass 1)
- Error messages: "Bad label", "Duplicate label"

**Two-pass mechanics:**
- Pass 1 — build symbol table (label → `locCtr`); no code emission
- Pass 2 — emit code into `outputBuffer`, populate full listing entries
- `loadPoint = defaultLoadPoint` set at pass-1 start (so non-zero-`.org` programs still compute `programSize` correctly)
- `outputBuffer` reset at pass-2 start
- `programSize = locCtr - loadPoint` computed at pass-2 end
- 65536-word maximum address space ("Program too big" error)
- Trailing empty-line removal from listing at pass-2 end (annotated as "possible bug / strange lcc behavior")

**Listing entry shapes (two variants):**
- Assembly path: `{lineNum, locCtr, sourceLine, codeWords, label, mnemonic, operands, comment}`
- Raw `.hex` / `.bin` path: `{lineNum, locCtr, sourceLine, macWord, comment}`

**Source-line processing:**
- `;` as comment delimiter — comment substring stored separately on the entry
- Whitespace-trim after comment stripping
- Empty lines (after comment strip) still produce a listing entry in pass 2
- Mnemonic lowercased; routing: `.<x>` → `handleDirective`, otherwise → `handleInstruction`
- `currentLine` / `currentListingEntry` — error-message context handles

**`.hex` file format:**
- One 4-nibble hex word per line
- Comments allowed (`;`)
- Whitespace (including internal) stripped before validation
- Validation: `^[0-9A-Fa-f]+$` regex + exactly 4 nibbles
- Empty file → exit code 0 (custom LCC.js behavior, not in original LCC as of 12/2024)
- `startAddress` defaulted to 0; `startLabel` null (no `.start` honored)

**`.bin` file format:**
- One 16-bit binary word per line
- Same comment / whitespace rules as `.hex`
- Validation: `^[01]+$` regex + exactly 16 bits
- Empty file → exit code 0 (custom LCC.js behavior)
- Same `startAddress` / `startLabel` defaults as `.hex`

**Error helpers (defined elsewhere in the file):**
- `this.error(...)` — accumulates / reports per current context
- Distinct abort messages per raw file type ("not purely hexadecimal", "not purely binary", "does not have exactly 4 nibbles", "does not have exactly 16 bits")

### (c) Tokenization + directive/instruction dispatch — populated by #121

**Tokenization rules:**
- Whitespace **AND** `,` both split tokens (so `add r0,r1,r2` and `add r0 r1 r2` tokenize identically)
- `:` stays attached to the preceding label token (`label:` → one token `"label:"`)
- String delimiters: `"` and `'` both supported; the delimiter chars are preserved **in** the token
- Escape sequences inside strings: `\n`, `\t`, `\\`, `\"`, `\r` only (no `\0`, `\b`, `\f`, etc.)
- Unknown escape → "Unknown escape sequence" error (non-fatal)
- "Missing terminating quote" — escape `\` at end of string content

**Directive vocabulary (synonyms grouped):**

| Mnemonic(s) | Operand | Purpose |
|---|---|---|
| `.start <label>` | label | entry-point declaration; resolved after pass 2; sets `startLabel` |
| `.org` / `.orig <addr>` | 0..0xFFFF | set `locCtr` forward (no backward); pass 2 zero-pads the gap |
| `.globl` / `.global <label>` | label | export; forces `isObjectModule`; adds to `globalLabels` |
| `.extern <label>` | label | import; forces `isObjectModule`; adds to `externLabels` |
| `.blkw` / `.space` / `.zero <n>` | 1..(65536-locCtr) | reserve N zero-init words |
| `.fill` / `.word <expr>` | literal / label / `label±N` | emit one 16-bit word |
| `.stringz` / `.asciz` / `.string "<text>"` | quoted string | emit null-terminated string |

- Custom LCC.js behavior on `.zero`: negativity is rejected (original LCC as of 12/2024 does not check)
- `.word` accepted operand forms — tokenizer splits on whitespace/comma but **not** on `+`/`-`:
  - `.word N` — literal
  - `.word label` — label address
  - `.word label+N` — single token, handled by `parseLabelWithOffset`
  - `.word label + N` — three tokens, joined manually
  - `.word label +N` — **known parsing gap**: `+N` silently dropped, only `label` is used
- `.word label±N` against a **local** symbol records an `'A'` adjustment entry
- Offset range for `.word label±N`: -32768..65535
- `.string` emits **one 16-bit word per character** (not per byte) — LCC's word-addressable memory convention
- Errors: "String constant missing leading quote", "Missing terminating quote"
- Default directive case → "Invalid operation"

**Instruction dispatch (`handleInstruction`):**

- Pass 1: each instruction bumps `locCtr` by 1 (LCC is **exactly one 16-bit word per instruction**); no encoding
- Pass 2: mnemonic-lookup switch dispatches to per-instruction encoder (`assembleADD`, `assembleBR`, etc. — see section (d))
- Final step: `writeMachineWord(word)` emits to `outputBuffer` and updates the listing entry's `codeWords`

**Instruction mnemonics seen at dispatch level:**

- **Branches:** `br` / `bral`, `brz` / `bre`, `brnz` / `brne`, `brn`, `brp`, `brlt`, `brgt`, `brc`
- **Arithmetic:** `add`, `sub`, `cmp`, `mul`, `div`, `rem`, `not`, `sext`
- **Logic / shifts / rotates:** `and`, `or`, `xor`, `srl`, `sra`, `sll`, `rol`, `ror`
- **Move:** `mov` / `mvi` (immediate) / `mvr` (register)
- **Stack:** `push`, `pop`
- **Memory (pc-relative offset9):** `ld`, `st`, `lea`, `cea`
- **Memory (base+offset6):** `ldr`, `str`
- **Flow:** `call` / `jsr` / `bl` (direct), `jsrr` / `blr` (register-indirect), `jmp`, `ret`
- **Traps** (trap vector hardcoded in dispatch):
  - `halt` (0x00) — encoded as raw `OP_TRAP`; `nl` (0x01) — encoded as raw `0xF001` (special-cased, bypasses `assembleTrap`)
  - I/O: `dout` (0x02), `udout` (0x03), `hout` (0x04), `aout` (0x05), `sout` (0x06), `din` (0x07), `hin` (0x08), `ain` (0x09), `sin` (0x0A)
  - Debug: `m` (0x0B) memory display, `r` (0x0C) register display, `s` (0x0D) stack display, `bp` (0x0E) breakpoint
- Default instruction case → "Invalid operation"

**Dispatch / emission helpers:**
- `writeMachineWord(word)` — appends to `outputBuffer`; updates the current listing entry's `codeWords`
- `isOperator(token)` — distinguishes `+` / `-` from operands
- `parseNumber`, base-10 `parseInt`
- `parseLabelWithOffset` — extracts `{label, offset}` from `label±N` single-token form
- `failAssembly` / `this.error` — error reporting paths used by directives

### (d) Per-instruction encoders — populated by #122

**16-bit instruction word field layout:**

| Bits | Field |
|---|---|
| 15-12 | opcode nibble (4 bits) |
| 11-9 | `dr` / `sr` / branch condition `cc` (3 bits) |
| 8-6 | `sr1` / `baser` (3 bits) |
| 5 | "form bit" — 0 = register form, 1 = immediate form (ADD/SUB/AND/CMP) |
| 4-0 | `imm5` / `sr2` / shift count / eopcode-low (5 bits) |

**Immediate field widths and ranges:**

| Name | Width | Range |
|---|---|---|
| `imm5` | 5-bit signed | -16..15 |
| `imm9` | 9-bit signed | -256..255 |
| `offset6` | 6-bit signed | -32..31 |
| `pcoffset9` | 9-bit signed | -256..255 |
| `pcoffset11` | 11-bit signed | -1024..1023 (BL only) |
| `ct` (shift count) | 4 bits | 0..15 (SRA strict; SRL/SLL/ROL/ROR naive) |

- **PC-relative target arithmetic:** `pcoffsetN = address - locCtr - 1` (PC has already advanced by 1)

**Extended-opcode group (`OP_EXT = 0xA000`, opcode 10) — eopcode in low 4 bits:**

| eopcode | Mnemonic | Notes |
|---|---|---|
| 0 | PUSH | sr in bits 11-9 |
| 1 | POP | dr in bits 11-9 |
| 2 | SRL | naive shift count |
| 3 | SRA | strict shift count 0..15 |
| 4 | SLL | naive shift count |
| 5 | ROL | naive shift count |
| 6 | ROR | naive shift count |
| 7 | MUL | |
| 8 | DIV | encoded as raw `0xa008`, not `OP_EXT \| 8` |
| 9 | REM | |
| A | OR | |
| B | XOR | |
| C | MVR | register-to-register move |
| D | SEXT | sign-extend |

**Pseudo-instructions (encoded as something else):**

| Pseudo | Actual encoding |
|---|---|
| `mov dr, imm` | `mvi dr, imm9` |
| `mov dr, sr` | `mvr dr, sr` (eopcode 12) |
| `cea dr, imm5` | `add dr, fp, imm5` (computed effective address; `fp` is sr1) |
| `ret` | `jmp lr` (`baser = r7 = lr`) |
| `bral` | `br` (always; condition code 7) |

**External-label fixup convention (asymmetries):**
- `assembleLD` honors `externLabels` (emits `'e'` entry with placeholder `pcoffset9 = 0`)
- `assembleST` and `assembleLea` do **not** honor externals (would fail with "Bad label")
- `assembleBL` honors externals (emits `'E'` entry with placeholder `pcoffset11 = 0`)
- No `'A'` adjustment entry added for external references (only for local label+offset uses)

**Per-instruction encoders (terms only):**
- `assembleCMP` — reg-reg vs reg-imm5 forms; bit-5 selects (`0x0020` set for imm form)
- `assembleBR(mnemonic, operands)` — branch condition lookup table; pcoffset9
- `assembleADD` / `assembleSUB` / `assembleAND` — dr/sr1/[sr2|imm5] shape; bit-5 distinguishes form
- `assembleCEA` — delegates to `assembleADD(dr, 'fp', imm5)`
- `assemblePUSH` / `assemblePOP`
- `assembleROL` / `assembleROR` / `assembleSRL` / `assembleSLL` — naive shift count; default 1
- `assembleSRA` — strict shift count 0..15 (uses `evaluateImmediate`, not `evaluateImmediateNaive`)
- `assembleDIV` — raw `0xa008` encoding (special-cased)
- `assembleMUL` / `assembleREM` / `assembleOR` / `assembleXOR` / `assembleSEXT`
- `assembleLD` / `assembleST` / `assembleLea` — pcoffset9; same `label` / `label+N` / `label + N` / `label +N`-gap operand forms as `.word`
- `assembleBL` — pcoffset11 (±1024)
- `assembleBLR` — register-indirect call: `OP_BL | (baser << 6) | offset6`
- `assembleLDR` / `assembleSTR` — base+offset6 memory access
- `assembleJMP` — `OP_JMP | baser | offset6`
- `assembleRET` — `assembleJMP` with `baser = 7`
- `assembleNOT`
- `assembleMOV(mnemonic, operands)` — multi-mnemonic; `mov` auto-detects register vs immediate
- `assembleTrap(operands, trapVector)` — `OP_TRAP | (sr << 9) | (trapVector & 0xFF)`; default `sr = r0`

**Error wording (LCC-specific catalog):**
- "Missing operand", "Missing register", "Missing number"
- "Bad number", "Bad label", "Bad register", "Bad operand--not a valid label"
- "Undefined label", "Invalid operation", "Invalid mnemonic: <m>"
- "pcoffset9 out of range" / "pcoffset9 out of range for ld" / "pcoffset9 out of range for st"
- "pcoffset11 out of range"

**Oracle parity notes embedded in code:**
- Cuh63 6.3: `jmp` with no operand prints "Missing operand" (was thought to segfault; now matches)
- OB-001 / #31: oracle rejects negative `mov` immediates (LCC.js accepts them; Charlie: `mov dr, imm` is a pseudo for `mvi dr, imm`)

**Register conventions referenced here:**
- `r7` = `lr` (link register; used by `ret`)
- `fp` = ??? (used by `cea`; the symbolic-to-numeric mapping is in section (e))

### (e) Operand parsing helpers — populated by #123

**Register parsing (`getRegister`, `isRegister`):**
- Register name patterns: `r0..r7`, `fp`, `sp`, `lr` (case-insensitive regex `^(r[0-7]|fp|sp|lr)$/i`)
- **Symbolic-to-numeric aliases:**
  - `fp` → `r5` (frame pointer)
  - `sp` → `r6` (stack pointer)
  - `lr` → `r7` (link register)
- Error: "Bad register"

**Char literals:**
- `isCharLiteral` — regex `^'(?:\\.|[^\\])'$`
- `parseCharLiteral` — extracts ASCII codepoint; handles escapes `\n`, `\t`, `\r`, `\\`, `\'`, `\"`
- Errors: "Invalid escape sequence: <X>", "Invalid character literal: <X>"

**Number parsing (`parseNumber`):**
- Char literal → ASCII codepoint
- Hex prefix `0x` / `0X` → base-16 `parseInt`
- **Negative hex literals not supported** (`-0x...` won't parse — explicit code comment)
- Decimal → base-10 `parseInt`

**Operand expressions:**
- Operators (`isOperator`): only `+` and `-`
- `parseLabelWithOffset` — regex `^([A-Za-z_$@][A-Za-z0-9_$@]*)\s*([+\-]\s*\d+)?$`
- Accepts: `label`, `label+N`, `label - N` (whitespace permitted between sign and digits)

**`*` location-counter operand:**
- `*` alone — current `locCtr`
- `*+N` / `*-N` — `locCtr ± N`
- Classified as `'star'` by `determineOperandType`

**Operand evaluation (`evaluateOperand(operand, usageType)`):**
- Tries in order: pure number → label-with-offset → plain label → `*` marker
- For known local labels: returns `symbolTable[label] + offset`
- For external labels: calls `handleExternalReference(label, usageType)`, returns `0 + offset` placeholder
- Error progression: "Bad number" (invalid hex) → "Bad label" (invalid syntax) → "Undefined label" (valid syntax, not defined, not external) → "Unspecified label error for: <X>"

**`determineOperandType(operand)`:**
- Syntactic classification only (no evaluation): `'char'`, `'star'`, `'num'`, `'label'`
- Future: per-mnemonic operand-type schemas (current code does not enforce; needs oracle research — see `core-behavior-matrix.md`)

**`handleExternalReference(label, usageType)`:**
- Dedups by `(label, type)` pair
- Adds `{label, type, address: locCtr}` to `externalReferences`
- Caller guards with `externLabels.has(label)` check

**Immediate evaluation:**
- `evaluateImmediate(valueStr, min, max, type)` — strict range check; emits "<type> out of range" or "Bad number"
- `evaluateImmediateNaive(valueStr)` — no range check; masks with `0xFFFF` (used by ROL / SRL / SLL / ROR shift counts)

**Number-form predicates:**
- `isNumLiteral(operand)` — true if char literal OR valid number OR valid hex
- `isValidHexNumber(str)` — regex `^0x[0-9A-Fa-f]+$`

**Error reporting plumbing (final piece):**
- `failAssembly(message, code)` — calls `error()`; aborts only if `REPORT_MULTI_ERRORS`
- `error(message)` — emits LCC-style error to stderr, pushes to `errors[]`, sets `errorFlag = true`; if `!REPORT_MULTI_ERRORS`, aborts immediately

**LCC error message format:**

```
Error on line <lineNum> of <inputFileName>:
    <currentLine>
<message>
```

**Module export + CLI auto-instantiation:**
- `module.exports = Assembler;`
- `if (require.main === module)` — auto-instantiates and runs when invoked directly

---

## Definitions

### (a) — populated by #128

#### `locCtr` (location counter)

The next free word address. Bumped by every code-emitting directive (`.word`/`.string`/`.zero`/`.fill`/…) and every instruction. Pass 1 uses `locCtr` to record each label's address in `[symbolTable]`; pass 2 uses it as the destination for `[outputBuffer]` writes via `[writeMachineWord]`. Reset to `[loadPoint]` at the start of each pass.

**Source:** `src/core/assembler.js:81, 635-756`
**See also:** [loadPoint], [programSize], [writeMachineWord]

#### `loadPoint` / `defaultLoadPoint` / `listingLoadPoint`

Three closely related fields that exist to keep three different "load point" concepts from contaminating each other:

- `defaultLoadPoint` — the project-wide constant default (always 0). All reset sites use this so the default has a single source of truth.
- `loadPoint` — the assembly-time `locCtr` start. Normally 0; explicitly set to `locCtr` at the beginning of pass 1 so that `[programSize] = locCtr - loadPoint` is correct even when a program starts at a non-zero `locCtr` via `.org`.
- `listingLoadPoint` — the **display-only** offset from the `-l<hex>` CLI flag. Added to `locCtr` when rendering listing addresses so the listing shows the intended runtime memory layout. **Does not** affect encoded machine code or the `.e` file.

**Source:** `src/core/assembler.js:138-150, 635-770`
**See also:** [locCtr], [programSize], [.lst / .bst report](#bst--lst)

#### `programSize`

The size of the assembled program in words, computed at the end of pass 2 as `locCtr - loadPoint`. Included in the listing reports' program-statistics block. Distinct from "highest address used" — `programSize` is the span between `[loadPoint]` and the final `[locCtr]`, not the count of bytes actually written.

**Source:** `src/core/assembler.js:155, 760`
**See also:** [locCtr], [loadPoint]

#### `startLabel` / `startAddress`

`startLabel` holds the string operand of the `.start` directive (or `null` if absent); `startAddress` holds its resolved address after pass 2. Resolution is deferred because `.start`'s argument may be a forward reference. If `.start` was never given, `startAddress` defaults to 0. Both are consumed by `[buildOutputFileChunks]` to emit the `'S'` header entry.

**Source:** `src/core/assembler.js:160-165, 411-422`
**See also:** [`.e` / `.o` file format], [`'S'` start address record]

#### `pass`

The current assembly pass — `1` (symbol-table build) or `2` (code emission). The same `[performPass]` method runs twice, with this field switching its behaviour. Some directives also branch on `pass` directly (e.g. `.zero` only writes words in pass 2).

**Source:** `src/core/assembler.js:101, 364, 377, 635-770`
**See also:** [performPass], [outputBuffer]

#### `errorFlag`

Sticky flag flipped to true whenever `[error]` is called; checked at the end of each pass to decide whether to abort the run. Lets the assembler continue scanning a single line to find multiple unrelated problems while still failing the run as a whole. (Effectively unused when `REPORT_MULTI_ERRORS = false`, but kept in place for the multi-error future.)

**Source:** `src/core/assembler.js:96, 371, 402, 2279`
**See also:** [REPORT_MULTI_ERRORS], [error], [failAssembly]

#### `isObjectModule`

True when the source uses any of `.global`/`.globl`/`.extern`. Causes the output extension to be `.o` instead of `.e` and triggers the post-pass-2 `.lst`/`.bst` report generation in `main()`. The flag is set the first time one of those directives runs; it is *not* checked back to `false` if all such directives are later removed.

**Source:** `src/core/assembler.js:170, 1075, 1096, 398-400, 572`
**See also:** [globalLabels], [externLabels], [main]

#### `throwOnAssemblyError`

Per-call switch on `[assembleSource]` that controls failure semantics: when `true`, `[abortAssembly]` throws a typed `[AssemblerError]` instead of calling `process.exit`. Tests and in-process wrappers set this to `true`; the CLI entry leaves it `false`.

**Source:** `src/core/assembler.js:195, 261-267, 305, 431`
**See also:** [AssemblerError], [abortAssembly], [assembleSource]

#### `sourceMap`

`{addressToLine: Map<addr, {lineNumber, sourceLine}>, allLines: string[]}` — built after pass 2 from the `[listing]` entries that emitted code. Forwarded to the interpreter so debug / trace output can render `addr:   <source text>` instead of raw hex. Built only for `.a` files; `null` for `.bin`/`.hex`/object modules.

**Source:** `src/core/assembler.js:198-202, 384-395`
**See also:** [listing], [interpreter sourceMap](interpreter.md#sourcemap)

#### `symbolTable`

The label → `locCtr` map populated in pass 1. Consumed in pass 2 by every operand-resolution path (`[evaluateOperand]`, label-arithmetic, `.start` resolution). Local definitions only — external labels are tracked separately in `[externLabels]`.

**Source:** `src/core/assembler.js:76, 716, 1080, 1171, 2180-2200`
**See also:** [labels], [evaluateOperand], [GTable (linker)](linker.md#gtable)

#### `labels`

A `Set` of label strings used purely for **duplicate-label detection** during pass 1. Distinct from `[symbolTable]`: `labels` is just for "have I seen this name?" while `symbolTable` is the actual name → address mapping. Duplicates trigger the `"Duplicate label"` error.

**Source:** `src/core/assembler.js:106, 712-718`
**See also:** [symbolTable], [isValidLabel]

#### `globalLabels`

Set of labels that should be exported in the output `.o`. Populated by `.global` / `.globl`; serialized as `'G'` header entries by `[buildOutputFileChunks]`. Setting any global also trips `[isObjectModule]` so the output extension switches to `.o`.

**Source:** `src/core/assembler.js:175, 1074-1084, 467-470`
**See also:** [isObjectModule], [`'G'` global record], [externLabels]

#### `externLabels`

Set of labels declared with `.extern` — the symbols the linker will be asked to resolve. The presence of a label here changes operand-resolution semantics: `[evaluateOperand]` returns the placeholder (`0 + offset`) and records an `[externalReferences]` entry instead of erroring on "undefined label".

**Source:** `src/core/assembler.js:180, 1086-1098, 2183-2200`
**See also:** [externalReferences], [globalLabels], [evaluateOperand]

#### `externalReferences`

Array of `{label, type, address}` records — one per place in the code that references an `.extern` label. The `type` is one of `'e'` / `'E'` / `'V'` (see [externalReferences entry types]) and tells the linker which fix-up encoding to apply. Serialized as the matching header entry types by `[buildOutputFileChunks]`.

**Source:** `src/core/assembler.js:185, 2109-2125, 472-475`
**See also:** [externLabels], [externalReferences entry types]

#### externalReferences entry types

Three single-letter type tags that distinguish how the linker should patch the referencing word:

- `'e'` (lowercase) — `[ld]` / `[st]` / `[lea]` / branch instructions; fix-up rewrites the low 9 bits with a `pcoffset9`.
- `'E'` (uppercase) — `[bl]`; fix-up rewrites the low 11 bits with a `pcoffset11`.
- `'V'` (uppercase) — `.word label`; fix-up adds the resolved address to the existing word (no masking).

The capitalisation matches the type byte that appears in the `.o` file header. Selected at emit time via the `usageType` argument to `[evaluateOperand]`.

**Source:** `src/core/assembler.js:472-475, 488-518, 1827, 1718, 1163`
**See also:** [externalReferences], [ETable / eTable / VTable (linker)](linker.md#etable--etable--vtable)

#### `adjustmentEntries`

Array of addresses that need linker-side relocation when the containing module is concatenated onto another module. A word becomes an adjustment entry whenever `.word label+N` (or a similar label-arithmetic form) references a **local** symbol — the offset survives concatenation but the base must be shifted. Serialized as `'A'` header entries.

**Source:** `src/core/assembler.js:190, 209-213, 1172-1174, 478-480`
**See also:** [`'A'` adjustment record], [ATable (linker)](linker.md#atable)

#### `sourceLines`

The raw source split into an array of lines (one per `\n`). Re-iterated by `[performPass]` for pass 1 then pass 2. Populated by `[assembleSource]` from its `sourceCode` argument.

**Source:** `src/core/assembler.js:91, 315, 648`
**See also:** [assembleSource], [performPass]

#### `outputBuffer`

Array of 16-bit machine words emitted by pass 2. Each `[writeMachineWord]` call appends one entry. At the end of assembly, `[buildOutputFileChunks]` packs the buffer into UInt16LE bytes for the output file. Reset to `[]` at the start of pass 2.

**Source:** `src/core/assembler.js:116, 524-529, 1399-1406, 645`
**See also:** [writeMachineWord], [buildOutputFileChunks]

#### `listing`

Per-line metadata accumulated across pass 2. Each entry is `{lineNum, locCtr, sourceLine, codeWords, label, mnemonic, operands, comment}` (for assembly source) or `{lineNum, locCtr, sourceLine, macWord, comment}` (for raw `.hex`/`.bin`). Feeds the `.lst` / `.bst` reports via `[buildReportArtifacts]` and the `[sourceMap]` build.

**Source:** `src/core/assembler.js:136, 654-665, 753-755`
**See also:** [sourceMap], [.lst / .bst report](#bst--lst)

#### File extensions

The assembler recognizes a small fixed set of extensions, each with distinct behaviour:

- `.a` — assembly source; runs the normal two-pass pipeline.
- `.e` — default executable output (when `[isObjectModule]` is false).
- `.o` — object-module output (when `[isObjectModule]` is true).
- `.bin` — raw binary input (one 16-bit binary word per line); parsed by `[parseBinFile]`, never assembled.
- `.hex` — raw hex input (one 4-nibble hex word per line); parsed by `[parseHexFile]`.
- `.ap` — LCC+ source; **explicitly rejected** with a "use `assemblerPlus.js`" message.
- `.lst` — listing report (hex word format).
- `.bst` — binary listing report (binary word format).

**Source:** `src/core/assembler.js:319-356, 360, 399`
**See also:** [parseBinFile], [parseHexFile], [.bst / .lst report]

#### `.bst` / `.lst` report

Sibling report files generated for object-module assembly. Both contain the same header + source-code column + program statistics; the difference is the encoding of the machine code column. `.lst` prints each word as 4 hex digits; `.bst` prints each word as 16 binary digits split into 4-bit nibbles (e.g. `1111 0000 0000 0001`). Both come out of the same `generateBSTLSTContent` generator — the `isBST` boolean toggles the encoding.

**Source:** `src/core/assembler.js:582-589`, `src/utils/genStats.js:65-67`
**See also:** [listing], [.e / .o file format], [interpreter buildReportArtifacts](interpreter.md#main-cli-orchestration)

#### `.e` / `.o` file format

The on-disk shape of an LCC-assembled module. The assembler is the producer; the linker and interpreter are consumers. Every file starts with a single intro-byte signature, an optional second intro for extension hooks, a sorted series of typed header entries, a `'C'` code-section marker, and the code itself as little-endian 16-bit words.

```
'o'                              ← intro signature
['p']?                           ← optional second-intro byte (LCC+ uses 'p')
header entries (sorted by addr)  ← any combination of 'S' 'G' 'E' 'e' 'V' 'A'
'C'                              ← code-section marker
<UInt16LE word>*                 ← machine code (one entry per assembled word)
```

Per-marker details below. The same layout is used for `.e` (when [isObjectModule] is false) and `.o` (when it is true) — the file extension is the only thing that differs.

**Source:** `src/core/assembler.js:447-532`
**See also:** [interpreter loadExecutableBuffer](interpreter.md#executable-loading-executebuffer--loadexecutablebuffer--loadexecutablefile), [parseObjectModuleBuffer (linker)](linker.md#parseobjectmodulebuffer)

#### `'o'` intro header byte

The literal byte `0x6f` ("o") at offset 0. Both the linker and the interpreter use it as a quick sanity check before attempting any further parsing — anything else triggers `"is not in lcc format"` / `"not a linkable file"`.

**Source:** `src/core/assembler.js:448, 528`
**See also:** [.e / .o file format]

#### Second intro header byte

An optional second byte after `'o'`, passed through `[buildOutputFileChunks]`'s `secondIntroHeader` argument. Lets extensions add their own marker without re-defining the rest of the format. LCC+ uses `'p'` here; vanilla LCC does not write one.

**Source:** `src/core/assembler.js:447-455`
**See also:** [.e / .o file format]

#### `'S'` start address record

Emitted when `[startLabel]` and `[startAddress]` are both set. Three bytes: `'S' <UInt16LE address>`. The interpreter and linker each consume this to determine the program's entry point. At most one `'S'` per linked output — the linker raises `[Multiple-entry-points error]` if it sees two.

**Source:** `src/core/assembler.js:462-464, 488-494`
**See also:** [startLabel / startAddress], [.e / .o file format]

#### `'G'` global record

Emitted for every label in `[globalLabels]`. Variable-length: `'G' <UInt16LE address> <label string> 0x00`. Lets the linker build its global-symbol table.

**Source:** `src/core/assembler.js:466-470, 495-505`
**See also:** [globalLabels], [GTable (linker)](linker.md#gtable)

#### `'E'` / `'e'` / `'V'` external reference records

One header entry per `[externalReferences]` array element. The type byte distinguishes the fix-up encoding (see [externalReferences entry types]). Layout matches `'G'`: `<type> <UInt16LE address> <label string> 0x00`. The linker reads the type byte to decide which mask + arithmetic to apply during fix-up.

**Source:** `src/core/assembler.js:472-475, 495-505`
**See also:** [externalReferences entry types], [ETable / eTable / VTable (linker)](linker.md#etable--etable--vtable)

#### `'A'` adjustment record

Three bytes: `'A' <UInt16LE address>`. Tells the linker "the word at `address` is a label-arithmetic value that needs the module-start offset added on relocation." Emitted for each entry in `[adjustmentEntries]` plus once per `'V'` (the linker also wants to know the V-fix-up site is relocatable).

**Source:** `src/core/assembler.js:477-480, 507-513`
**See also:** [adjustmentEntries], [ATable (linker)](linker.md#atable)

#### `'C'` code-section marker

The single byte that separates the header block from the code block. Encountering `'C'` while reading the header tells the consumer "no more typed entries — what follows is `programSize` × UInt16LE machine words". Written unconditionally by `[buildOutputFileChunks]`.

**Source:** `src/core/assembler.js:522`
**See also:** [.e / .o file format]

#### UInt16LE word encoding

Every 16-bit address and every machine code word in the `.e` / `.o` file uses little-endian byte order. Matches both `Buffer.readUInt16LE`/`writeUInt16LE` on the consumer side and the LCC tradition of treating word addresses as base-2¹⁶.

**Source:** `src/core/assembler.js:491, 501, 510, 527`
**See also:** [.e / .o file format]

#### Null-terminated label strings

In every label-bearing header entry (`'G'` / `'E'` / `'e'` / `'V'`), the label name follows the address as ASCII bytes and is terminated by a single `0x00`. The consumer reads until null to recover the label string. Empty labels are not allowed (no directive that emits these entries accepts an empty operand).

**Source:** `src/core/assembler.js:499-503`
**See also:** [`'G'` global record], [`'E'` / `'e'` / `'V'` external reference records]

#### `AssemblerError`

The typed error class used by every assembler failure path. Wrapping failures in a known type lets test runs and in-process wrappers catch them specifically (instead of conflating with arbitrary `Error`s), and lets the same code path either throw or `process.exit` based on the `[throwOnAssemblyError]` switch.

**Source:** `src/core/assembler.js:20, 242-246`, `src/utils/errors.js`
**See also:** [throwOnAssemblyError], [abortAssembly], [createAssemblyError]

#### `REPORT_MULTI_ERRORS`

Module-level boolean (currently `false`) that controls whether the assembler reports just the first error or accumulates and reports many. False matches the original LCC's one-error-at-a-time behaviour; the multi-error path exists but is intentionally off pending oracle parity research.

**Source:** `src/core/assembler.js:69, 2267-2286`
**See also:** [error], [failAssembly]

#### 300-character source line length limit

Hard limit on raw source line length, enforced by `[validateLineLength]` before any tokenisation. Exceeding it triggers `"Line exceeds maximum length of 300 characters"`. Counts include the comment, pending oracle research on the exact original-LCC behaviour.

**Source:** `src/core/assembler.js:249-258`
**See also:** [validateLineLength]

#### `validateLineLength`

The 300-character check, called once per source line by `[performPass]` (and by `[parseHexFile]` / `[parseBinFile]`) before any other parsing. Throws via `[abortAssembly]` so it fails the run immediately rather than recording into `[errors]`.

**Source:** `src/core/assembler.js:255-258`
**See also:** [300-character source line length limit]

#### `createAssemblyError`

Helper that constructs an `[AssemblerError]` with `message` and `exitCode` properties. Used by `[abortAssembly]` to manufacture the error object before throwing — keeps `process.exit` and `throw` paths producing structurally identical errors.

**Source:** `src/core/assembler.js:242-246`
**See also:** [AssemblerError], [abortAssembly]

#### `abortAssembly`

Single termination point. Branches on `[throwOnAssemblyError]`: throw a typed `[AssemblerError]` when true (test / in-process callers), or fall through to `fatalExit` (which calls `process.exit` in real CLI mode, throws under Jest's `it`) when false.

**Source:** `src/core/assembler.js:261-267`
**See also:** [AssemblerError], [throwOnAssemblyError], [fatalExit]

#### `"Empty file"` exit-code-0

Special case: when pass 1 finishes with `locCtr === 0` (no code or data was emitted), the assembler reports `"Empty file"` and exits with **status 0**, not 1. This matches the original LCC's treatment of an empty assembly as not-quite-an-error. Distinct from the empty-`.hex`/empty-`.bin` checks, which are noted as custom LCC.js behaviour that does not match the oracle.

**Source:** `src/core/assembler.js:367-369`
**See also:** [parseHexFile], [parseBinFile]

#### `"Errors encountered during Pass 1/2"`

The user-facing message printed when either pass ends with `[errorFlag]` set. Concrete failures are already reported on the lines they occurred; this aggregate message signals "halting because of the above". The pass number distinguishes early vs late failure for the user.

**Source:** `src/core/assembler.js:372, 407`
**See also:** [errorFlag], [abortAssembly]

#### CLI orchestration (`main`)

The CLI entry point. Reads the input file, calls `[assembleSource]`, then calls `[writeOutputFile]`. When `[isObjectModule]` is true, it also reads the user name via `[nameHandler]` and writes the `.lst` / `.bst` report files via `[writeReportFiles]`. Honours the pre-set `inputFileName` so `lcc.js` can drive the assembler without re-parsing CLI args.

**Source:** `src/core/assembler.js:538-592`
**See also:** [assembleSource], [writeOutputFile], [buildReportArtifacts]

#### `"Assembling X"` / `"Starting assembly pass 1/2"`

Status output lines printed to stdout during the run. `"Assembling <file>"` appears for `.bin` and `.hex` inputs (LCC.js-custom — the oracle does not print this); `"Starting assembly pass 1"` and `"Starting assembly pass 2"` appear for `.a` assembly. Used by integration tests as a coarse progress signal.

**Source:** `src/core/assembler.js:326, 338, 363, 376`
**See also:** [main], [performPass]

#### `"Output file X needs linking"` / `"lst file = X"` / `"bst file = Y"`

Object-module-only status output. Printed by `[main]` when `[isObjectModule]` is true, in this order: the `.o` filename, then the `.lst` filename, then the `.bst` filename. Mirrors the original LCC's wording exactly so test golden files can be reused.

**Source:** `src/core/assembler.js:580, 588-589`
**See also:** [main], [.bst / .lst report]

#### `userName` (from `nameHandler`)

Identity string from `~/name.nnn` (created on first run by `nameHandler.createNameFile`). Inserted at the top of every `.lst` / `.bst` report (right after the `LCC.js Assemble/Link/Interpret/Debug Ver` line). Read lazily — only when reports are about to be written.

**Source:** `src/core/assembler.js:21, 573-578`, `src/utils/name.js`
**See also:** [main], [.bst / .lst report]

#### `assembleSource`

Reusable in-memory entry point: takes source code as a string plus options, performs both passes, and returns an `[createAssemblyResult]` structure. Tests and pure-API callers use this instead of `[main]` so they can run the assembler without touching the filesystem.

**Source:** `src/core/assembler.js:301-433`
**See also:** [createAssemblyResult], [main], [performPass]

#### `createAssemblyResult`

Snapshots the post-pass-2 state into a structured object: `inputFileName`, `outputFileName`, `isObjectModule`, `startAddress`, `loadPoint`, deep copies of `symbolTable`/`listing`/`outputBuffer`, the rendered output bytes, optional reports, and the `sourceMap`. Lets callers consume assembled output without depending on instance mutation.

**Source:** `src/core/assembler.js:271-299`
**See also:** [assembleSource], [buildReportArtifacts]

#### `buildOutputFileChunks`

Produces the array of `Buffer` chunks that make up the `.e` / `.o` file. Writes `'o'`, then the optional `secondIntroHeader`, then the typed header entries (sorted by address), then `'C'`, then the code as UInt16LE words. Returning chunks instead of a single concatenated buffer lets callers stream them to disk or concatenate them in memory.

**Source:** `src/core/assembler.js:447-532`
**See also:** [.e / .o file format], [toOutputBuffer], [writeOutputFile]

#### `toOutputBuffer`

In-memory variant of file-writing: concatenates the chunks returned by `[buildOutputFileChunks]` into a single `Buffer`. Used by `[createAssemblyResult]` to surface the assembled bytes to API callers.

**Source:** `src/core/assembler.js:534-536`
**See also:** [buildOutputFileChunks], [createAssemblyResult]

#### `writeOutputFile`

Filesystem variant of `[toOutputBuffer]`: opens the output file, writes the same chunks `[buildOutputFileChunks]` produced, closes the handle. Used by `[main]` (CLI path); pure-API callers use `[toOutputBuffer]` instead.

**Source:** `src/core/assembler.js:594-609`
**See also:** [buildOutputFileChunks], [main]

#### `constructOutputFileName`

Default output filename rule: strip the input file's extension and replace with the new extension via `constructSiblingFileName`. So `foo.a` becomes `foo.e` or `foo.o`. Called once after pass 1 (initial `.e`), and again after pass 2 if `[isObjectModule]` flipped (re-named to `.o`).

**Source:** `src/core/assembler.js:611-613, 329, 340, 360, 399`
**See also:** [main], [assembleSource]

#### `buildReportArtifacts`

Builds the `.lst` and `.bst` content strings in memory without touching the filesystem. Delegates to the shared `src/utils/reportArtifacts.js` (also used by the interpreter for post-run reports). Returns `{lstContent, bstContent}`; the caller decides whether to write them to disk.

**Source:** `src/core/assembler.js:437-445`, `src/utils/reportArtifacts.js`
**See also:** [.bst / .lst report], [main], [interpreter buildReportArtifacts](interpreter.md#main-cli-orchestration)

---

### (b) — populated by #129

#### Label syntax

A label is `[A-Za-z_$@][A-Za-z0-9_$@]*` (one alphabetic / `_` / `$` / `@` head character, then any number of those plus digits). The trailing colon in a definition is optional — both `label:` and `label` are accepted at column 0, since `[isValidLabelDef]` treats either form (and any line without column-0 whitespace) as a label-bearing line. The `$` / `@` characters exist for compiler-mangled identifiers (`@L0`, `@M0`, `@s0_x`, `@A@set$ii`, `@f$ri`); LCC.js doesn't restrict their use to compiler-generated code.

**Source:** `src/core/assembler.js:617-626`
**See also:** [isValidLabel], [isValidLabelDef], [labels]

#### `isValidLabelDef`

A two-condition heuristic: a line starts with a label if **either** the first token ends with `:` **or** the original line's first character isn't whitespace. The "no whitespace at column 0" branch is what makes the assembler accept old-style labels without colons — a convention preserved for parity with the original LCC.

**Source:** `src/core/assembler.js:617-619`
**See also:** [Label syntax], [isValidLabel], [performPass]

#### `isValidLabel`

Pure regex check (`^[A-Za-z_$@][A-Za-z0-9_$@]*$`) used after `[isValidLabelDef]` has spotted a label-bearing line. Catches malformed labels (digits at the head, illegal characters) and triggers the `"Bad label"` error.

**Source:** `src/core/assembler.js:623-626`
**See also:** [Label syntax], [isValidLabelDef]

#### Mid-line label detection

A consequence of `[isValidLabelDef]`'s rules: when a line has column-0 whitespace, the first token is *not* treated as a label, even if it would otherwise be a valid identifier. This lets the assembler parse mnemonics directly without ambiguity — `   add r0, r1, r2` is unambiguously an instruction line, not a label `add` followed by garbage.

**Source:** `src/core/assembler.js:617-618, 703`
**See also:** [isValidLabelDef], [performPass]

#### `@`-prefixed labels (compiler-mangled)

LCC's compiler emits identifiers like `@L0`, `@M0`, `@s0_x`, `@f$ri`, `@A@set$ii` for branch targets, string literals, static locals, and C++ name-mangled symbols respectively. The assembler doesn't distinguish them from any other label — the `@` prefix is just there to keep compiler-generated names from colliding with user-written ones. Treat them as plain labels in any analysis.

**Source:** `src/core/assembler.js:624-625` (regex permits)
**See also:** [Label syntax]

#### `$` in label names (C++ name-mangling separator)

The `$` character is permitted in label names primarily so LCC's C++ frontend can emit mangled names like `@f$ri` (function `f` taking `int&`) or `@A@set$ii` (method `A::set(int, int)`). LCC.js doesn't enforce a specific mangling scheme — it just allows `$` in identifiers and lets the compiler use it however.

**Source:** `src/core/assembler.js:624-625` (regex permits)
**See also:** [Label syntax], [@-prefixed labels (compiler-mangled)]

#### Duplicate label detection

Performed in pass 1 only, via the `[labels]` set. If a label has already been added to the set when a definition is encountered, `[error]` is called with `"Duplicate label"`. Pass 2 doesn't re-check — it trusts pass 1 to have caught all duplicates and only updates `[symbolTable]` on first sight.

**Source:** `src/core/assembler.js:712-718`
**See also:** [labels], [symbolTable]

#### `"Bad label"` / `"Duplicate label"`

The two label-specific error wordings. `"Bad label"` fires whenever `[isValidLabel]` rejects an identifier (illegal characters, leading digit). `"Duplicate label"` fires on the second pass-1 sighting of a name. Both are raised through `[error]` and so trip `[errorFlag]`.

**Source:** `src/core/assembler.js:710, 714`
**See also:** [isValidLabel], [Duplicate label detection], [errorFlag]

#### Pass 1 — symbol table build

The first traversal of `[sourceLines]`. Reads each line, tokenizes, records any label at `locCtr` into `[symbolTable]` + `[labels]`, then increments `locCtr` by whatever the directive or instruction would emit (without actually emitting anything). No machine code, no listing entries — just label addresses + an aggregate `locCtr`. Errors raised here come from bad labels, malformed directives, and out-of-range operands.

**Source:** `src/core/assembler.js:635-770`, dispatched from `[performPass]`
**See also:** [performPass], [Pass 2 — code emission], [locCtr]

#### Pass 2 — code emission

The second traversal, with `locCtr` reset to `[loadPoint]` and `[outputBuffer]` reset to `[]`. Re-tokenizes each line, dispatches to `[handleDirective]` or `[handleInstruction]`, and accumulates emitted words into `outputBuffer` + per-line entries into `[listing]`. Operand resolution can now look up labels in `[symbolTable]` (built in pass 1), so forward references just work.

**Source:** `src/core/assembler.js:644-645, 752-755, 760-768`
**See also:** [performPass], [Pass 1 — symbol table build], [outputBuffer], [listing]

#### `performPass`

The single method that drives both passes. Branches on `[pass]` to skip code emission (pass 1) or actually emit (pass 2) at the lowest level — most of the per-line tokenize / dispatch / locCtr-bump logic is shared between passes. Called twice from `[assembleSource]` with the `pass` field toggled between calls.

**Source:** `src/core/assembler.js:635-770`
**See also:** [Pass 1 — symbol table build], [Pass 2 — code emission]

#### `loadPoint` discipline at pass-1 start

`[loadPoint]` is explicitly set to `[defaultLoadPoint]` (= 0) at the top of pass 1. Without this reset, a program that uses `.org N` (jumping `locCtr` forward) would compute `[programSize] = locCtr - loadPoint` incorrectly on a re-run of the same `[Assembler]` instance. The reset matters because reusable in-process callers (`[assembleSource]`) may run the same instance multiple times.

**Source:** `src/core/assembler.js:640-642`
**See also:** [loadPoint], [programSize], [.org / .orig]

#### `outputBuffer` reset at pass-2 start

`[outputBuffer]` is set to `[]` at the top of pass 2. Pass 1 doesn't emit, so the buffer is empty at that point regardless; but pass 2 needs a clean slate before re-walking the source. This reset means the same `[Assembler]` instance can be reused across runs.

**Source:** `src/core/assembler.js:644-645`
**See also:** [outputBuffer], [Pass 2 — code emission]

#### 65536-word maximum address space

Hard cap. After each line is processed in either pass, `locCtr` is checked against `65536`; exceeding it triggers `[error]` with `"Program too big"`. Reflects LCC's 16-bit word-addressable memory model — the executable can't have more code or data than will fit in `mem[0..65535]`.

**Source:** `src/core/assembler.js:747-750`
**See also:** [locCtr]

#### Trailing empty-line removal

At the end of pass 2, if the last entry in `[listing]` has a `sourceLine` that trims to empty, it's popped. The code comment annotates this as `"possible bug / strange lcc behavior"` — the rule was reverse-engineered from the original LCC's output and may not be deliberate behavior on that side. Worth folding into the oracle parity research.

**Source:** `src/core/assembler.js:766-768`
**See also:** [listing], [Pass 2 — code emission]

#### Listing entry — assembly path shape

For lines processed by the normal two-pass `.a` flow, each `[listing]` entry has shape `{lineNum, locCtr, sourceLine, codeWords, label, mnemonic, operands, comment}`. `codeWords` is the array of machine words emitted by this line (often one, sometimes more for `.string` / `.zero`); `label`, `mnemonic`, `operands` are the tokenized form. Consumed by `[buildReportArtifacts]` and by `[sourceMap]` construction.

**Source:** `src/core/assembler.js:654-665, 734-755`
**See also:** [listing], [Listing entry — raw .hex / .bin path shape]

#### Listing entry — raw `.hex` / `.bin` path shape

For lines processed by `[parseHexFile]` or `[parseBinFile]`, the shape is `{lineNum, locCtr, sourceLine, macWord, comment}` — no tokenization, no label / mnemonic / operands, and code is a single `macWord` (the parsed value) rather than a `codeWords` array. The same `[listing]` array holds both shapes; downstream code branches on which field is present.

**Source:** `src/core/assembler.js:782-788, 854-860`
**See also:** [listing], [Listing entry — assembly path shape], [parseHexFile], [parseBinFile]

#### `;` as comment delimiter

Anywhere on a line, everything from `;` to end-of-line is a comment. `[performPass]` extracts the comment substring (everything after the first `;`) into the listing entry's `comment` field, then strips it from the line before tokenisation. Same convention in `[parseHexFile]` and `[parseBinFile]`. There is no block-comment form.

**Source:** `src/core/assembler.js:668-678, 791-803, 863-875`
**See also:** [Source-line processing], [tokenizeLine]

#### Source-line processing pipeline

The fixed sequence in `[performPass]`: capture `originalLine` and `currentLine`, validate length, extract comment, strip comment + trim, tokenize, peel off optional label, peel off mnemonic, send the rest to `[handleDirective]` (mnemonic starts with `.`) or `[handleInstruction]`. Empty post-strip lines still produce a listing entry in pass 2 (so the listing reports show blank source lines aligned with the original file).

**Source:** `src/core/assembler.js:648-756`
**See also:** [performPass], [handleDirective], [handleInstruction]

#### Mnemonic routing (`.` vs other)

After tokenisation, the mnemonic is lowercased. If it starts with `.`, `[handleDirective]` runs (directives manage their own locCtr bumps); otherwise `[handleInstruction]` runs (which always bumps `locCtr` by 1 — every instruction is exactly one 16-bit word). This single-character dispatch is the boundary between "directive vocabulary" and "instruction vocabulary."

**Source:** `src/core/assembler.js:723, 738-745`
**See also:** [handleDirective], [handleInstruction], [Pass 1 — symbol table build]

#### `currentLine` / `currentListingEntry`

Two error-message context handles maintained as side effects of the source-line loop. `currentLine` is the original (pre-strip) source for the line being processed; `currentListingEntry` is the in-progress entry. `[error]` formats `currentLine` into the standard `"Error on line N of file:\n    <line>\n<message>"` wording, so the user sees the literal source that failed.

**Source:** `src/core/assembler.js:651, 665, 2276`
**See also:** [error], [performPass]

#### `.hex` file format

One 4-nibble hexadecimal word per source line. The assembler treats each line as `<comment? ; …> <0-3 whitespace> <4 hex digits>`: comments are stripped (`;` delimiter), all whitespace (including internal) is removed via `s.replace(/\s+/g, '')`, then the regex `^[0-9A-Fa-f]+$` plus a length-equals-4 check validates. Parsed words land in `[outputBuffer]` and the per-line listing.

**Source:** `src/core/assembler.js:772-842`
**See also:** [parseHexFile], [.bin file format], [Listing entry — raw .hex / .bin path shape]

#### `parseHexFile`

The bespoke parser for `.hex` files. Runs entirely separately from the two-pass assembly flow — it has no labels, no directives, no instructions. Just a per-line "read 4 nibbles → 1 word" loop. Behaviour deviations from the oracle (empty-file error, line-length cap) are noted inline in the code.

**Source:** `src/core/assembler.js:772-842`
**See also:** [.hex file format], [parseBinFile]

#### `.bin` file format

One 16-bit binary word per source line — 16 literal `0`/`1` characters. Same comment / whitespace rules as `[.hex file format]`. Validation regex is `^[01]+$` plus length-equals-16. Parsed words land in `[outputBuffer]` and the per-line listing.

**Source:** `src/core/assembler.js:844-914`
**See also:** [parseBinFile], [.hex file format]

#### `parseBinFile`

Sibling of `[parseHexFile]` for the `.bin` extension. Same shape, same line-by-line loop, same listing-entry shape. The only differences are `parseInt(line, 2)` instead of `parseInt(line, 16)`, the `^[01]+$` regex, and 16-char length check.

**Source:** `src/core/assembler.js:844-914`
**See also:** [.bin file format], [parseHexFile]

#### Empty-`.hex` / Empty-`.bin` exit-code-0

Custom LCC.js behaviour (does not match the original LCC as of 12/2024): if `parseHexFile` or `parseBinFile` finishes the source with `locCtr === 0`, it raises `"Empty file"` and exits with status 0. The annotation in the code is explicit about this being a divergence — a follow-up parity decision is open.

**Source:** `src/core/assembler.js:833-837, 905-909`
**See also:** [.hex file format], [.bin file format], ["Empty file" exit-code-0]

#### Raw-file abort messages

`parseHexFile` and `parseBinFile` raise distinct error wordings to make malformed raw input visible:

- `"Error: line N in .hex file is not purely hexadecimal: '...'"` (regex mismatch)
- `"Error: line N in .hex file does not have exactly 4 nibbles: '...'"` (length mismatch)
- `"Error: line N in .bin file is not purely binary: '...'"` (regex mismatch)
- `"Error: line N in .bin file does not have exactly 16 bits: '...'"` (length mismatch)

All four go through `[abortAssembly]`, so they CLI-exit (or throw under `throwOnAssemblyError`) immediately rather than accumulating in `[errors]`.

**Source:** `src/core/assembler.js:812-817, 884-889`
**See also:** [parseHexFile], [parseBinFile], [abortAssembly]

### (c) — populated by #130

#### `tokenizeLine`

Hand-written single-pass tokenizer. Walks each character, splitting on whitespace and `,` while honouring two special states: inside a quoted string (the delimiter char is part of the token; only the matching close delimiter ends it) and after a backslash inside a string (the next char is consumed verbatim regardless of what it is). The trailing colon on a label token is kept attached — `label:` becomes one token, not two. Returns an array of opaque string tokens; semantic interpretation happens in `[handleDirective]` / `[handleInstruction]`.

**Source:** `src/core/assembler.js:916-971`
**See also:** [Tokenization splitting rules], [parseString], [handleDirective], [handleInstruction]

#### Tokenization splitting rules

Tokens are split on either whitespace **or** `,` (so `add r0,r1,r2` and `add r0 r1 r2` produce identical token arrays). `:` is *not* a split character: it remains attached to the preceding token, so `label:` is one token. `+` and `-` are not split characters either — `label+5` is one token (resolved later by `[parseLabelWithOffset]`), `label + 5` is three (resolved by the per-mnemonic three-operand fallback).

**Source:** `src/core/assembler.js:925-948`
**See also:** [tokenizeLine], [parseLabelWithOffset]

#### String delimiters (`"` and `'`)

Both single and double quotes start a string literal in the tokenizer. The opening delimiter is recorded so the matching close delimiter is the only one that ends the literal — `"don't"` is one token containing an apostrophe. The delimiter chars are **preserved in the token**; downstream `[parseString]` strips them when interpreting content.

**Source:** `src/core/assembler.js:925-927, 958-962`
**See also:** [tokenizeLine], [parseString], [isStringLiteral]

#### String escape sequences

`[parseString]` handles a small fixed set inside string content: `\n`, `\t`, `\r`, `\\`, `\"`. Anything else (e.g. `\f`, `\b`, `\0`) triggers `"Unknown escape sequence: \X"` — non-fatal, raised through `[error]` rather than `[abortAssembly]`. A backslash at end-of-string content triggers `"Missing terminating quote"`.

**Source:** `src/core/assembler.js:981-1015`
**See also:** [parseString], [Tokenization splitting rules]

#### `parseString`

The post-tokenize string interpreter. Strips the surrounding delimiter chars and walks the content character-by-character, expanding escape sequences. Distinct from `[tokenizeLine]`'s string handling: the tokenizer only finds the bounds of the string literal, leaving escape expansion to this method. Called from `.string` / `.stringz` / `.asciz` directive handlers.

**Source:** `src/core/assembler.js:981-1015`
**See also:** [String escape sequences], [.string / .stringz / .asciz]

#### `isStringLiteral`

Quick regex check (`/^"(.*)"$/.test(s) || /^'(.*)'$/.test(s)`) that tests whether a token is a quoted string literal. Used by `.string`-family directives before they try to call `[parseString]`; failure raises `"Missing terminating quote"`.

**Source:** `src/core/assembler.js:977-979`
**See also:** [parseString], [.string / .stringz / .asciz]

#### `handleDirective`

The directive dispatcher. Switches on the mnemonic (already lowercased) and routes each `.` directive to its inline implementation. Synonym groups (`.org` / `.orig`, `.blkw` / `.space` / `.zero`, etc.) share a `case`. Unknown directives raise `"Invalid operation"` — same wording as the equivalent instruction-level failure.

**Source:** `src/core/assembler.js:1017-1226`
**See also:** [handleInstruction], [performPass]

#### `.start`

Records the entry-point label into `[startLabel]`. The address (`[startAddress]`) is resolved after pass 2, since the operand may forward-reference a label that hasn't been seen yet. One operand; must pass `[isValidLabel]`.

**Source:** `src/core/assembler.js:1020-1032`
**See also:** [startLabel], [startAddress], ['S' start address record]

#### `.org` / `.orig`

Synonym pair: set `[locCtr]` forward to a fixed address. Operand is a numeric literal in range `0..0xFFFF`; below or above triggers `"Bad number"`; lower than current `locCtr` triggers `"Backward address on .org"` (LCC.js convention — forward-only). In pass 1, `locCtr` is just bumped; in pass 2, the gap is filled with zero words via `[writeMachineWord]` so the listing reflects the empty range.

**Source:** `src/core/assembler.js:1033-1063`
**See also:** [locCtr], [programSize], [writeMachineWord]

#### `.globl` / `.global`

Synonym pair: export a label so the linker sees it. Adds the label to `[globalLabels]`, records its address in `[symbolTable]` (if not already there), and trips `[isObjectModule]` so the output extension switches to `.o`. One operand; must be a valid label.

**Source:** `src/core/assembler.js:1064-1085`
**See also:** [globalLabels], [isObjectModule], ['G' global record]

#### `.extern`

Import an external label. Adds the label to `[externLabels]` and trips `[isObjectModule]`. Note: does **not** add the label to `[symbolTable]` — `.extern` labels are placeholders the linker will resolve, not local definitions.

**Source:** `src/core/assembler.js:1086-1099`
**See also:** [externLabels], [externalReferences], [isObjectModule]

#### `.blkw` / `.space` / `.zero`

Three-way synonym group: reserve N zero-initialized words. N must be in range `1..(65536 - locCtr)` — both ends of the range are checked. Custom LCC.js behaviour: the negativity / zero check is not present in the original LCC as of 12/2024. In pass 2, writes N zero words via `[writeMachineWord]`; in pass 1, just bumps `[locCtr]`.

**Source:** `src/core/assembler.js:1100-1125`
**See also:** [writeMachineWord], [locCtr]

#### `.fill` / `.word`

Synonym pair: emit one 16-bit word. Operand can be a literal number, a single-token label expression (`label`, `label+N`, `label-N` — handled by `[parseLabelWithOffset]`), or a three-token expression (`label + N`, joined manually). The known parsing gap is `label +N` (two tokens with whitespace before `+`) — the `+N` is silently dropped. Local-symbol label-arithmetic expressions also push an `'A'` adjustment entry via `[handleAdjustmentEntry]`. Offset range is `-32768..65535`; the emitted value is masked with `0xFFFF` before write.

**Source:** `src/core/assembler.js:1126-1183`
**See also:** [parseLabelWithOffset], [evaluateOperand], [adjustmentEntries]

#### `.stringz` / `.asciz` / `.string`

Three-way synonym group: emit a null-terminated string. The operand must be a quoted string literal (single or double quotes); fails `[isStringLiteral]` triggers `"Missing terminating quote"`, missing the opening quote triggers `"String constant missing leading quote"`. Each character is emitted as a **full 16-bit word** (not a byte), reflecting LCC's word-addressable memory model; the null terminator is also a 16-bit word.

**Source:** `src/core/assembler.js:1184-1221`
**See also:** [parseString], [Word-per-character convention]

#### Word-per-character convention

LCC's memory is word-addressable, not byte-addressable: each address holds one 16-bit word. `.string` follows this — every character in a string literal becomes one full 16-bit word with the ASCII codepoint in the low 8 bits. So `.string "AB"` allocates three words (A, B, null), not two bytes plus null. Consumers (SOUT in the interpreter) read until they hit a zero word, not a zero byte.

**Source:** `src/core/assembler.js:1212-1219`
**See also:** [.stringz / .asciz / .string], [SOUT (interpreter)](interpreter.md#executetrap-trap-dispatch-table)

#### `handleInstruction`

The instruction dispatcher. In pass 1, simply bumps `[locCtr]` by 1 (LCC is **strictly one 16-bit word per instruction**) — no encoding happens. In pass 2, switches on the mnemonic (lowercased) and calls one of the per-instruction `assemble*` encoders (`[assembleADD]`, `[assembleBR]`, etc.) defined in section (d). Final step is to call `[writeMachineWord]` with the returned word. Unknown mnemonics raise `"Invalid operation"`.

**Source:** `src/core/assembler.js:1228-1397`
**See also:** [Pass 1 — symbol table build], [Pass 2 — code emission], [writeMachineWord]

#### One-instruction-equals-one-word

A foundational LCC invariant: every instruction encodes to exactly one 16-bit machine word, no exceptions. There are no multi-word instructions, no instruction prefixes, no variable-length encodings. This is why pass 1 can compute every label address without knowing what mnemonic each line will resolve to — bumping `[locCtr]` by 1 per non-directive line is always correct.

**Source:** `src/core/assembler.js:1229-1232`
**See also:** [Pass 1 — symbol table build], [handleInstruction]

#### Instruction mnemonic categories

For navigation: the dispatched mnemonics fall into seven natural groups:

- **Branches:** `br` / `bral`, `brz` / `bre`, `brnz` / `brne`, `brn`, `brp`, `brlt`, `brgt`, `brc` (all routed to `[assembleBR]`)
- **Arithmetic:** `add`, `sub`, `cmp`, `mul`, `div`, `rem`, `not`, `sext`
- **Logic / shifts / rotates:** `and`, `or`, `xor`, `srl`, `sra`, `sll`, `rol`, `ror`
- **Move:** `mov` / `mvi` (immediate) / `mvr` (register) — three mnemonics, one encoder
- **Stack:** `push`, `pop`
- **Memory:** pc-relative `ld` / `st` / `lea` / `cea`; base+offset6 `ldr` / `str`
- **Flow:** `call` / `jsr` / `bl` (direct, pcoffset11); `jsrr` / `blr` (register-indirect); `jmp`, `ret`

Each group is documented in detail in section (d).

**Source:** `src/core/assembler.js:1237-1396`
**See also:** Section (d) per-instruction encoders

#### Trap dispatch in `handleInstruction`

The trap-vector mnemonics (`halt`, `nl`, `dout`, etc.) are handled inline in `[handleInstruction]` rather than dispatched to a separate encoder — most just call `[assembleTrap]` with their literal vector byte. Two exceptions: `halt` is encoded as raw `OP_TRAP` (vector 0x00 + zero `sr` field), and `nl` is special-cased to literal `0xF001` (bypasses `[assembleTrap]` entirely, even though it would produce the same result via vector 0x01).

**Source:** `src/core/assembler.js:1343-1388`
**See also:** [assembleTrap]

#### Trap vector table

The trap vectors hardcoded in `[handleInstruction]`'s switch — every LCC trap has a single-byte vector:

| Vector | Mnemonic | Purpose |
|---|---|---|
| 0x00 | `halt` | stop execution |
| 0x01 | `nl` | print newline |
| 0x02 | `dout` | signed decimal output |
| 0x03 | `udout` | unsigned decimal output |
| 0x04 | `hout` | hex output |
| 0x05 | `aout` | ASCII char output |
| 0x06 | `sout` | string output |
| 0x07 | `din` | signed decimal input |
| 0x08 | `hin` | hex input |
| 0x09 | `ain` | ASCII char input |
| 0x0A | `sin` | string input |
| 0x0B | `m` | memory display (debug) |
| 0x0C | `r` | register display (debug) |
| 0x0D | `s` | stack display (debug) |
| 0x0E | `bp` | software breakpoint |

The same table is consumed on the interpreter side — see [executeTRAP](interpreter.md#executetrap-trap-dispatch-table).

**Source:** `src/core/assembler.js:1343-1388`
**See also:** [executeTRAP (interpreter)](interpreter.md#executetrap-trap-dispatch-table)

#### `"Invalid operation"`

The default-case error wording for both `[handleDirective]` and `[handleInstruction]`. Fired when a mnemonic doesn't match any known directive or instruction. Same wording for both deliberately — from the user's perspective, "I typed `.foob`" and "I typed `xxor`" are the same shape of error.

**Source:** `src/core/assembler.js:1222-1224, 1388-1389`
**See also:** [handleDirective], [handleInstruction]

#### `writeMachineWord`

The single-word emit primitive. Only does anything in pass 2: appends `word & 0xFFFF` to `[outputBuffer]` and also pushes the same word into `[currentListingEntry]`'s `codeWords` array. The mask guarantees the buffer always contains 16-bit values regardless of what arithmetic the caller did.

**Source:** `src/core/assembler.js:1399-1406`
**See also:** [outputBuffer], [currentListingEntry], [Listing entry — assembly path shape]

#### `isOperator`

One-liner: `op === '+' || op === '-'`. Used by `[handleDirective]`'s `.word` and `.fill` cases to distinguish whether the second token is a `+`/`-` joining a label with a literal offset (three-token form: `label + N`), vs an actual operand.

**Source:** `src/core/assembler.js:2046-2048`
**See also:** [.fill / .word], [parseLabelWithOffset]

#### `parseLabelWithOffset`

Regex-based parser for the single-token label-arithmetic form: `label`, `label+N`, `label-N`, or `label - N` (whitespace permitted between sign and digits). Returns `{label, offset}` if the input matches the pattern, otherwise `null`. Used by `.word` / `.fill` / load / store directives to recognize when an operand combines a symbolic name with a literal offset.

**Source:** `src/core/assembler.js:2050-2083`
**See also:** [.fill / .word], [evaluateOperand], [Tokenization splitting rules]

### (d) — populated by #131

_To be filled in._

### (e) — populated by #132

_To be filled in._
