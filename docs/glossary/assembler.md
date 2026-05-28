# Assembler Glossary

Glossary of LCC-specific terms used in `src/core/assembler.js`.

The original spike (#108) has been decomposed into 5 sub-spikes, each covering a
coherent section of the file. The write phase (#111) consolidates the
inventoried terms into definitions once all 5 spikes have closed.

<!-- @todo #111:60m/WRITER Write definitions for each inventoried term; LCC-specific angle only. Blocked by spikes (a)-(e). See #111 -->

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

## Definitions (populated by write #111)

_To be filled in after all 5 spikes complete._
