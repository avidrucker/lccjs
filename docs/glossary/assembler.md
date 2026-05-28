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

_To be filled in._

### (c) — populated by #130

_To be filled in._

### (d) — populated by #131

_To be filled in._

### (e) — populated by #132

_To be filled in._
