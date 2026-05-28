# Assembler Glossary

Glossary of LCC-specific terms used in `src/core/assembler.js`.

The original spike (#108) has been decomposed into 5 sub-spikes, each covering a
coherent section of the file. The write phase (#111) consolidates the
inventoried terms into definitions once all 5 spikes have closed.

<!-- @todo #122:60m/WRITER Spike (d): inventory LCC-specific terms in per-instruction encoders (lines 1408-1980). See #122 -->
<!-- @todo #123:60m/WRITER Spike (e): inventory LCC-specific terms in operand parsing helpers (lines 1985-2290). See #123 -->
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
- `.bst` (report sibling) <!-- @todo #126:30m/WRITER research .bst format / purpose (read reportArtifacts.js, distinguish from .lst). See #126 -->

**`.e` / `.o` file format:**
<!-- @todo #124:30m/ARC design glossary entry shape — one consolidated entry vs per-marker split. See #124 -->
- `'o'` intro header byte (ASCII signature)
- Second intro header (extension hook — `'p'` for LCC+ `.ep`)
- Header entry types (typed records, sorted by address): `'S'`, `'G'`, `'E'`, `'e'`, `'V'`, `'A'` <!-- @todo #125:30m/WRITER differentiate 'E' / 'e' / 'V' (check linker.js for consumer semantics). See #125 -->
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

_To be filled in._

### (e) Operand parsing helpers — populated by #123

_To be filled in._

---

## Definitions (populated by write #111)

_To be filled in after all 5 spikes complete._
