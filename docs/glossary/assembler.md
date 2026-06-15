# Assembler Glossary

LCC-specific vocabulary used in `src/core/assembler.js` — the two-pass
assembler: its object-file format, per-instruction encoders, and operand
parsing. See [README](./README.md) for entry conventions and the other
module glossaries.

Entries are grouped into five areas: **(a)** assembly state, output &
object-file format · **(b)** labels, the two-pass model & raw-file parsing ·
**(c)** tokenization & directive/instruction dispatch · **(d)** instruction
encoding & per-mnemonic encoders · **(e)** operand & immediate evaluation.

---

## Definitions

### (a) Assembly state, output & object-file format

#### `locCtr` (location counter)

The next free word address. Bumped by every code-emitting directive (`.word`/`.string`/`.zero`/`.fill`/…) and every instruction. Pass 1 uses `locCtr` to record each label's address in `[symbolTable]`; pass 2 uses it as the destination for `[outputBuffer]` writes via `[writeMachineWord]`. Reset to `[loadPoint]` at the start of each pass.

**Source:** `assembler.js` — `locCtr` (field)
**See also:** [loadPoint], [programSize], [writeMachineWord]

#### `loadPoint` / `defaultLoadPoint` / `listingLoadPoint`

Three closely related fields that exist to keep three different "load point" concepts from contaminating each other:

- `defaultLoadPoint` — the project-wide constant default (always 0). All reset sites use this so the default has a single source of truth.
- `loadPoint` — the assembly-time `locCtr` start. Normally 0; explicitly set to `locCtr` at the beginning of pass 1 so that `[programSize] = locCtr - loadPoint` is correct even when a program starts at a non-zero `locCtr` via `.org`.
- `listingLoadPoint` — the **display-only** offset from the `-l<hex>` CLI flag. Added to `locCtr` when rendering listing addresses so the listing shows the intended runtime memory layout. **Does not** affect encoded machine code or the `.e` file.

**Source:** `assembler.js` — `loadPoint` (field), `defaultLoadPoint` (field), `listingLoadPoint` (field)
**See also:** [locCtr], [programSize], [.lst / .bst report](#bst--lst)

#### `programSize`

The size of the assembled program in words, computed at the end of pass 2 as `locCtr - loadPoint`. Included in the listing reports' program-statistics block. Distinct from "highest address used" — `programSize` is the span between `[loadPoint]` and the final `[locCtr]`, not the count of bytes actually written.

**Source:** `assembler.js` — `programSize` (field)
**See also:** [locCtr], [loadPoint]

#### `startLabel` / `startAddress`

`startLabel` holds the string operand of the `.start` directive (or `null` if absent); `startAddress` holds its resolved address after pass 2. Resolution is deferred because `.start`'s argument may be a forward reference. If `.start` was never given, `startAddress` defaults to 0. Both are consumed by `[buildOutputFileChunks]` to emit the `'S'` header entry.

**Source:** `assembler.js` — `startLabel` (field), `startAddress` (field)
**See also:** [`.e` / `.o` file format], [`'S'` start address record]

#### `pass`

The current assembly pass — `1` (symbol-table build) or `2` (code emission). The same `[performPass]` method runs twice, with this field switching its behaviour. Some directives also branch on `pass` directly (e.g. `.zero` only writes words in pass 2).

**Source:** `assembler.js` — `pass` (field)
**See also:** [performPass], [outputBuffer]

#### `errorFlag`

Sticky flag flipped to true whenever `[error]` is called; checked at the end of each pass to decide whether to abort the run. Lets the assembler continue scanning a single line to find multiple unrelated problems while still failing the run as a whole. (Effectively unused when `REPORT_MULTI_ERRORS = false`, but kept in place for the multi-error future.)

**Source:** `assembler.js` — `errorFlag` (field)
**See also:** [REPORT_MULTI_ERRORS], [error], [failAssembly]

#### `isObjectModule`

True when the source uses any of `.global`/`.globl`/`.extern`. Causes the output extension to be `.o` instead of `.e` and triggers the post-pass-2 `.lst`/`.bst` report generation in `main()`. The flag is set the first time one of those directives runs; it is *not* checked back to `false` if all such directives are later removed.

**Source:** `assembler.js` — `isObjectModule` (field)
**See also:** [globalLabels], [externLabels], [main]

#### `throwOnAssemblyError`

Per-call switch on `[assembleSource]` that controls failure semantics: when `true`, `[abortAssembly]` throws a typed `[AssemblerError]` instead of calling `process.exit`. Tests and in-process wrappers set this to `true`; the CLI entry leaves it `false`.

**Source:** `assembler.js` — `throwOnAssemblyError` (field)
**See also:** [AssemblerError], [abortAssembly], [assembleSource]

#### `sourceMap`

`{addressToLine: Map<addr, {lineNumber, sourceLine}>, allLines: string[]}` — built after pass 2 from the `[listing]` entries that emitted code. Forwarded to the interpreter so debug / trace output can render `addr:   <source text>` instead of raw hex. Built only for `.a` files; `null` for `.bin`/`.hex`/object modules.

**Source:** `assembler.js` — `sourceMap` (field)
**See also:** [listing], [interpreter sourceMap](interpreter.md#sourcemap)

#### `symbolTable`

The label → `locCtr` map populated in pass 1. Consumed in pass 2 by every operand-resolution path (`[evaluateOperand]`, label-arithmetic, `.start` resolution). Local definitions only — external labels are tracked separately in `[externLabels]`.

**Source:** `assembler.js` — `symbolTable` (field)
**See also:** [labels], [evaluateOperand], [GTable (linker)](linker.md#gtable)

#### `labels`

A `Set` of label strings used purely for **duplicate-label detection** during pass 1. Distinct from `[symbolTable]`: `labels` is just for "have I seen this name?" while `symbolTable` is the actual name → address mapping. Duplicates trigger the `"Duplicate label"` error.

**Source:** `assembler.js` — `labels` (field)
**See also:** [symbolTable], [isValidLabel]

#### `globalLabels`

Set of labels that should be exported in the output `.o`. Populated by `.global` / `.globl`; serialized as `'G'` header entries by `[buildOutputFileChunks]`. Setting any global also trips `[isObjectModule]` so the output extension switches to `.o`.

**Source:** `assembler.js` — `globalLabels` (field)
**See also:** [isObjectModule], [`'G'` global record], [externLabels]

#### `externLabels`

Set of labels declared with `.extern` — the symbols the linker will be asked to resolve. The presence of a label here changes operand-resolution semantics: `[evaluateOperand]` returns the placeholder (`0 + offset`) and records an `[externalReferences]` entry instead of erroring on "undefined label".

**Source:** `assembler.js` — `externLabels` (field)
**See also:** [externalReferences], [globalLabels], [evaluateOperand]

#### `externalReferences`

Array of `{label, type, address}` records — one per place in the code that references an `.extern` label. The `type` is one of `'e'` / `'E'` / `'V'` (see [externalReferences entry types]) and tells the linker which fix-up encoding to apply. Serialized as the matching header entry types by `[buildOutputFileChunks]`.

**Source:** `assembler.js` — `externalReferences` (field)
**See also:** [externLabels], [externalReferences entry types]

#### externalReferences entry types

Three single-letter type tags that distinguish how the linker should patch the referencing word:

- `'e'` (lowercase) — `[ld]` / `[st]` / `[lea]` / branch instructions; fix-up rewrites the low 9 bits with a `pcoffset9`.
- `'E'` (uppercase) — `[bl]`; fix-up rewrites the low 11 bits with a `pcoffset11`.
- `'V'` (uppercase) — `.word label`; fix-up adds the resolved address to the existing word (no masking).

The capitalisation matches the type byte that appears in the `.o` file header. Selected at emit time via the `usageType` argument to `[evaluateOperand]`.

**Source:** `assembler.js` — `handleExternalReference()`, `evaluateOperand()`; grep `type: usageType`
**See also:** [externalReferences], [ETable / eTable / VTable (linker)](linker.md#etable--etable--vtable)

#### `adjustmentEntries`

Array of addresses that need linker-side relocation when the containing module is concatenated onto another module. A word becomes an adjustment entry whenever `.word label+N` (or a similar label-arithmetic form) references a **local** symbol — the offset survives concatenation but the base must be shifted. Serialized as `'A'` header entries.

**Source:** `assembler.js` — `adjustmentEntries` (field)
**See also:** [`'A'` adjustment record], [ATable (linker)](linker.md#atable)

#### `sourceLines`

The raw source split into an array of lines (one per `\n`). Re-iterated by `[performPass]` for pass 1 then pass 2. Populated by `[assembleSource]` from its `sourceCode` argument.

**Source:** `assembler.js` — `sourceLines` (field)
**See also:** [assembleSource], [performPass]

#### `outputBuffer`

Array of 16-bit machine words emitted by pass 2. Each `[writeMachineWord]` call appends one entry. At the end of assembly, `[buildOutputFileChunks]` packs the buffer into UInt16LE bytes for the output file. Reset to `[]` at the start of pass 2.

**Source:** `assembler.js` — `outputBuffer` (field)
**See also:** [writeMachineWord], [buildOutputFileChunks]

#### `listing`

Per-line metadata accumulated across pass 2. Each entry is `{lineNum, locCtr, sourceLine, codeWords, label, mnemonic, operands, comment}` (for assembly source) or `{lineNum, locCtr, sourceLine, macWord, comment}` (for raw `.hex`/`.bin`). Feeds the `.lst` / `.bst` reports via `[buildReportArtifacts]` and the `[sourceMap]` build.

**Source:** `assembler.js` — `listing` (field)
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

**Source:** `assembler.js` — `parseBinFile()`, `parseHexFile()`; grep `path.extname`, `assemblerPlus.js`
**See also:** [parseBinFile], [parseHexFile], [.bst / .lst report]

#### `.bst` / `.lst` report

Sibling report files built by the shared `generateBSTLSTContent` generator (`src/utils/genStats.js`), called from three entrypoints: the assembler standalone CLI (only when producing a `.o` object module), the interpreter standalone CLI (when `generateStats` is true), and `lcc.js` after a combined assemble-then-run.

Content varies by entrypoint:

- **Assembler-only path** — includes a source-code column but **no** output section or program statistics (instructions executed, program size, max stack size, load point). Statistics require an interpreter instance.
- **Interpreter-only path** — includes a memory-dump code section (`Loc   Code`, no source text, because the interpreter has no access to the original assembly source) **plus** the output block and program statistics.
- **`lcc.js` combined path** — merges both: source-annotated code section (from `assembler.listing`) together with runtime output and statistics. This is the path encountered in normal `.a`→`.e` workflows.

The only difference between `.lst` and `.bst` is the machine-code column encoding: `.lst` uses 4 hex digits per word; `.bst` uses 16 binary digits in 4-bit groups (e.g. `0001 1111 0000 0001`). Both are generated in one pass — `generateBSTLSTContent` is called twice with `isBST` as the sole toggle.

**Source:** `assembler.js` — `buildReportArtifacts()`; `genStats.js` — `generateBSTLSTContent()`
**See also:** [listing], [.e / .o file format], [interpreter `main` CLI orchestration](interpreter.md#main-cli-orchestration)

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

**Source:** `assembler.js` — `buildOutputFileChunks()`, `toOutputBuffer()`, `writeOutputFile()`
**See also:** [interpreter loadExecutableBuffer](interpreter.md#executable-loading-executebuffer--loadexecutablebuffer--loadexecutablefile), [parseObjectModuleBuffer (linker)](linker.md#parseobjectmodulebuffer)

#### `'o'` intro header byte

The literal byte `0x6f` ("o") at offset 0. Both the linker and the interpreter use it as a quick sanity check before attempting any further parsing — anything else triggers `"is not in lcc format"` / `"not a linkable file"`.

**Source:** `assembler.js` — `buildOutputFileChunks()`, grep `Buffer.from('o'`
**See also:** [.e / .o file format]

#### Second intro header byte

An optional second byte after `'o'`, passed through `[buildOutputFileChunks]`'s `secondIntroHeader` argument. Lets extensions add their own marker without re-defining the rest of the format. LCC+ uses `'p'` here; vanilla LCC does not write one.

**Source:** `assembler.js` — `buildOutputFileChunks()`, grep `secondIntroHeader`
**See also:** [.e / .o file format]

#### `'S'` start address record

Emitted when `[startLabel]` and `[startAddress]` are both set. Three bytes: `'S' <UInt16LE address>`. The interpreter and linker each consume this to determine the program's entry point. At most one `'S'` per linked output — the linker raises `[Multiple-entry-points error]` if it sees two.

**Source:** `assembler.js` — `buildOutputFileChunks()`, grep `type: 'S'`
**See also:** [startLabel / startAddress], [.e / .o file format]

#### `'G'` global record

Emitted for every label in `[globalLabels]`. Variable-length: `'G' <UInt16LE address> <label string> 0x00`. Lets the linker build its global-symbol table.

**Source:** `assembler.js` — `buildOutputFileChunks()`, grep `type: 'G'`
**See also:** [globalLabels], [GTable (linker)](linker.md#gtable)

#### `'E'` / `'e'` / `'V'` external reference records

One header entry per `[externalReferences]` array element. The type byte distinguishes the fix-up encoding (see [externalReferences entry types]). Layout matches `'G'`: `<type> <UInt16LE address> <label string> 0x00`. The linker reads the type byte to decide which mask + arithmetic to apply during fix-up.

**Source:** `assembler.js` — `buildOutputFileChunks()`, grep `Collect external references`
**See also:** [externalReferences entry types], [ETable / eTable / VTable (linker)](linker.md#etable--etable--vtable)

#### `'A'` adjustment record

Three bytes: `'A' <UInt16LE address>`. Tells the linker "the word at `address` is a label-arithmetic value that needs the module-start offset added on relocation." Emitted for each entry in `[adjustmentEntries]` plus once per `'V'` (the linker also wants to know the V-fix-up site is relocatable).

**Source:** `assembler.js` — `buildOutputFileChunks()`, grep `type: 'A'`
**See also:** [adjustmentEntries], [ATable (linker)](linker.md#atable)

#### `'C'` code-section marker

The single byte that separates the header block from the code block. Encountering `'C'` while reading the header tells the consumer "no more typed entries — what follows is `programSize` × UInt16LE machine words". Written unconditionally by `[buildOutputFileChunks]`.

**Source:** `assembler.js` — `buildOutputFileChunks()`, grep `Buffer.from('C'`
**See also:** [.e / .o file format]

#### UInt16LE word encoding

Every 16-bit address and every machine code word in the `.e` / `.o` file uses little-endian byte order. Matches both `Buffer.readUInt16LE`/`writeUInt16LE` on the consumer side and the LCC tradition of treating word addresses as base-2¹⁶.

**Source:** `assembler.js` — `buildOutputFileChunks()`, grep `writeUInt16LE`
**See also:** [.e / .o file format]

#### Null-terminated label strings

In every label-bearing header entry (`'G'` / `'E'` / `'e'` / `'V'`), the label name follows the address as ASCII bytes and is terminated by a single `0x00`. The consumer reads until null to recover the label string. Empty labels are not allowed (no directive that emits these entries accepts an empty operand).

**Source:** `assembler.js` — `buildOutputFileChunks()`, grep `writeUInt8(0,`
**See also:** [`'G'` global record], [`'E'` / `'e'` / `'V'` external reference records]

#### `AssemblerError`

The typed error class used by every assembler failure path. Wrapping failures in a known type lets test runs and in-process wrappers catch them specifically (instead of conflating with arbitrary `Error`s), and lets the same code path either throw or `process.exit` based on the `[throwOnAssemblyError]` switch.

**Source:** `assembler.js` — `createAssemblyError()`, grep `new AssemblerError`; `errors.js` — `AssemblerError` (class)
**See also:** [throwOnAssemblyError], [abortAssembly], [createAssemblyError]

#### `REPORT_MULTI_ERRORS`

Module-level boolean (currently `false`) that controls whether the assembler reports just the first error or accumulates and reports many. False matches the original LCC's one-error-at-a-time behaviour; the multi-error path exists but is intentionally off pending oracle parity research.

**Source:** `assembler.js` — `REPORT_MULTI_ERRORS` (const)
**See also:** [error], [failAssembly]

#### 300-character source line length limit

Hard limit on raw source line length, enforced by `[validateLineLength]` before any tokenisation. Exceeding it triggers `"Line exceeds maximum length of 300 characters"`. Counts include the comment, pending oracle research on the exact original-LCC behaviour.

**Source:** `assembler.js` — `validateLineLength()`, grep `length > 300`
**See also:** [validateLineLength]

#### `validateLineLength`

The 300-character check, called once per source line by `[performPass]` (and by `[parseHexFile]` / `[parseBinFile]`) before any other parsing. Throws via `[abortAssembly]` so it fails the run immediately rather than recording into `[errors]`.

**Source:** `assembler.js` — `validateLineLength()`
**See also:** [300-character source line length limit]

#### `createAssemblyError`

Helper that constructs an `[AssemblerError]` with `message` and `exitCode` properties. Used by `[abortAssembly]` to manufacture the error object before throwing — keeps `process.exit` and `throw` paths producing structurally identical errors.

**Source:** `assembler.js` — `createAssemblyError()`
**See also:** [AssemblerError], [abortAssembly]

#### `abortAssembly`

Single termination point. Branches on `[throwOnAssemblyError]`: throw a typed `[AssemblerError]` when true (test / in-process callers), or fall through to `fatalExit` (which calls `process.exit` in real CLI mode, throws under Jest's `it`) when false.

**Source:** `assembler.js` — `abortAssembly()`
**See also:** [AssemblerError], [throwOnAssemblyError], [fatalExit]

#### `"Empty file"` exit-code-0

Special case: when pass 1 finishes with `locCtr === 0` (no code or data was emitted), the assembler reports `"Empty file"` and exits with **status 0**, not 1. This matches the original LCC's treatment of an empty assembly as not-quite-an-error. Distinct from the empty-`.hex`/empty-`.bin` checks, which are noted as custom LCC.js behaviour that does not match the oracle.

**Source:** `assembler.js` — `assembleSource()`, grep `Empty file`
**See also:** [parseHexFile], [parseBinFile]

#### `"Errors encountered during Pass 1/2"`

The user-facing message printed when either pass ends with `[errorFlag]` set. Concrete failures are already reported on the lines they occurred; this aggregate message signals "halting because of the above". The pass number distinguishes early vs late failure for the user.

**Source:** `assembler.js` — `assembleSource()`, grep `Errors encountered during Pass`
**See also:** [errorFlag], [abortAssembly]

#### CLI orchestration (`main`)

The CLI entry point. Reads the input file, calls `[assembleSource]`, then calls `[writeOutputFile]`. When `[isObjectModule]` is true, it also reads the user name via `[nameHandler]` and writes the `.lst` / `.bst` report files via `[writeReportFiles]`. Honours the pre-set `inputFileName` so `lcc.js` can drive the assembler without re-parsing CLI args.

**Source:** `assembler.js` — `main()`
**See also:** [assembleSource], [writeOutputFile], [buildReportArtifacts]

#### `"Assembling X"` / `"Starting assembly pass 1/2"`

Status output lines printed to stdout during the run. `"Assembling <file>"` appears for `.bin` and `.hex` inputs (LCC.js-custom — the oracle does not print this); `"Starting assembly pass 1"` and `"Starting assembly pass 2"` appear for `.a` assembly. Used by integration tests as a coarse progress signal.

**Source:** `assembler.js` — `assembleSource()`, grep `Starting assembly pass`
**See also:** [main], [performPass]

#### `"Output file X needs linking"` / `"lst file = X"` / `"bst file = Y"`

Object-module-only status output. Printed by `[main]` when `[isObjectModule]` is true, in this order: the `.o` filename, then the `.lst` filename, then the `.bst` filename. Mirrors the original LCC's wording exactly so test golden files can be reused.

**Source:** `assembler.js` — `main()`, grep `needs linking`, `lst file =`
**See also:** [main], [.bst / .lst report]

#### `userName` (from `nameHandler`)

Identity string from `~/name.nnn` (created on first run by `nameHandler.createNameFile`). Inserted at the top of every `.lst` / `.bst` report (right after the `LCC.js Assemble/Link/Interpret/Debug Ver` line). Read lazily — only when reports are about to be written.

**Source:** `assembler.js` — `userName` (param); `createAssemblyResult()`, `buildReportArtifacts()`; grep `userName`
**See also:** [main], [.bst / .lst report]

#### `assembleSource`

Reusable in-memory entry point: takes source code as a string plus options, performs both passes, and returns an `[createAssemblyResult]` structure. Tests and pure-API callers use this instead of `[main]` so they can run the assembler without touching the filesystem.

**Source:** `assembler.js` — `assembleSource()`
**See also:** [createAssemblyResult], [main], [performPass]

#### `createAssemblyResult`

Snapshots the post-pass-2 state into a structured object: `inputFileName`, `outputFileName`, `isObjectModule`, `startAddress`, `loadPoint`, deep copies of `symbolTable`/`listing`/`outputBuffer`, the rendered output bytes, optional reports, and the `sourceMap`. Lets callers consume assembled output without depending on instance mutation.

**Source:** `assembler.js` — `createAssemblyResult()`
**See also:** [assembleSource], [buildReportArtifacts]

#### `buildOutputFileChunks`

Produces the array of `Buffer` chunks that make up the `.e` / `.o` file. Writes `'o'`, then the optional `secondIntroHeader`, then the typed header entries (sorted by address), then `'C'`, then the code as UInt16LE words. Returning chunks instead of a single concatenated buffer lets callers stream them to disk or concatenate them in memory.

**Source:** `assembler.js` — `buildOutputFileChunks()`
**See also:** [.e / .o file format], [toOutputBuffer], [writeOutputFile]

#### `toOutputBuffer`

In-memory variant of file-writing: concatenates the chunks returned by `[buildOutputFileChunks]` into a single `Buffer`. Used by `[createAssemblyResult]` to surface the assembled bytes to API callers.

**Source:** `assembler.js` — `toOutputBuffer()`
**See also:** [buildOutputFileChunks], [createAssemblyResult]

#### `writeOutputFile`

Filesystem variant of `[toOutputBuffer]`: opens the output file, writes the same chunks `[buildOutputFileChunks]` produced, closes the handle. Used by `[main]` (CLI path); pure-API callers use `[toOutputBuffer]` instead.

**Source:** `assembler.js` — `writeOutputFile()`
**See also:** [buildOutputFileChunks], [main]

#### `constructOutputFileName`

Default output filename rule: strip the input file's extension and replace with the new extension via `constructSiblingFileName`. So `foo.a` becomes `foo.e` or `foo.o`. Called once after pass 1 (initial `.e`), and again after pass 2 if `[isObjectModule]` flipped (re-named to `.o`).

**Source:** `assembler.js` — `constructOutputFileName()`
**See also:** [main], [assembleSource]

#### `buildReportArtifacts`

Builds the `.lst` and `.bst` content strings in memory without touching the filesystem. Delegates to the shared `src/utils/reportArtifacts.js` (also used by the interpreter for post-run reports). Returns `{lstContent, bstContent}`; the caller decides whether to write them to disk.

**Source:** `assembler.js` — `buildReportArtifacts()`; `reportArtifacts.js` — `buildReportArtifacts()`
**See also:** [.bst / .lst report], [main], [interpreter buildReportArtifacts](interpreter.md#main-cli-orchestration)

---

### (b) Labels, the two-pass model & raw-file parsing

#### Label syntax

A label is `[A-Za-z_$@][A-Za-z0-9_$@]*` (one alphabetic / `_` / `$` / `@` head character, then any number of those plus digits). The trailing colon in a definition is optional — both `label:` and `label` are accepted at column 0, since `[isValidLabelDef]` treats either form (and any line without column-0 whitespace) as a label-bearing line. The `$` / `@` characters exist for compiler-mangled identifiers (`@L0`, `@M0`, `@s0_x`, `@A@set$ii`, `@f$ri`); LCC.js doesn't restrict their use to compiler-generated code.

**Source:** `assembler.js` — `isValidLabelDef()`, `isValidLabel()`
**See also:** [isValidLabel], [isValidLabelDef], [labels]

#### `isValidLabelDef`

A two-condition heuristic: a line starts with a label if **either** the first token ends with `:` **or** the original line's first character isn't whitespace. The "no whitespace at column 0" branch is what makes the assembler accept old-style labels without colons — a convention preserved for parity with the original LCC.

**Source:** `assembler.js` — `isValidLabelDef()`
**See also:** [Label syntax], [isValidLabel], [performPass]

#### `isValidLabel`

Pure regex check (`^[A-Za-z_$@][A-Za-z0-9_$@]*$`) used after `[isValidLabelDef]` has spotted a label-bearing line. Catches malformed labels (digits at the head, illegal characters) and triggers the `"Bad label"` error.

**Source:** `assembler.js` — `isValidLabel()`
**See also:** [Label syntax], [isValidLabelDef]

#### Mid-line label detection

A consequence of `[isValidLabelDef]`'s rules: when a line has column-0 whitespace, the first token is *not* treated as a label, even if it would otherwise be a valid identifier. This lets the assembler parse mnemonics directly without ambiguity — `   add r0, r1, r2` is unambiguously an instruction line, not a label `add` followed by garbage.

**Source:** `assembler.js` — `isValidLabelDef()`, grep `isWhitespace(originalLine[0])`
**See also:** [isValidLabelDef], [performPass]

#### `@`-prefixed labels (compiler-mangled)

LCC's compiler emits identifiers like `@L0`, `@M0`, `@s0_x`, `@f$ri`, `@A@set$ii` for branch targets, string literals, static locals, and C++ name-mangled symbols respectively. The assembler doesn't distinguish them from any other label — the `@` prefix is just there to keep compiler-generated names from colliding with user-written ones. Treat them as plain labels in any analysis.

**Source:** `assembler.js` — `isValidLabel()`, grep `[A-Za-z_$@]` (regex permits `@`)
**See also:** [Label syntax]

#### `$` in label names (C++ name-mangling separator)

The `$` character is permitted in label names primarily so LCC's C++ frontend can emit mangled names like `@f$ri` (function `f` taking `int&`) or `@A@set$ii` (method `A::set(int, int)`). LCC.js doesn't enforce a specific mangling scheme — it just allows `$` in identifiers and lets the compiler use it however.

**Source:** `assembler.js` — `isValidLabel()`, grep `[A-Za-z_$@]` (regex permits `$`)
**See also:** [Label syntax], [@-prefixed labels (compiler-mangled)]

#### Duplicate label detection

Performed in pass 1 only, via the `[labels]` set. If a label has already been added to the set when a definition is encountered, `[error]` is called with `"Duplicate label"`. Pass 2 doesn't re-check — it trusts pass 1 to have caught all duplicates and only updates `[symbolTable]` on first sight.

**Source:** `assembler.js` — `performPass()`, grep `this.labels.has(label)`
**See also:** [labels], [symbolTable]

#### `"Bad label"` / `"Duplicate label"`

The two label-specific error wordings. `"Bad label"` fires whenever `[isValidLabel]` rejects an identifier (illegal characters, leading digit). `"Duplicate label"` fires on the second pass-1 sighting of a name. Both are raised through `[error]` and so trip `[errorFlag]`.

**Source:** `assembler.js` — `performPass()`, grep `'Bad label'`, `'Duplicate label'`
**See also:** [isValidLabel], [Duplicate label detection], [errorFlag]

#### Pass 1 — symbol table build

The first traversal of `[sourceLines]`. Reads each line, tokenizes, records any label at `locCtr` into `[symbolTable]` + `[labels]`, then increments `locCtr` by whatever the directive or instruction would emit (without actually emitting anything). No machine code, no listing entries — just label addresses + an aggregate `locCtr`. Errors raised here come from bad labels, malformed directives, and out-of-range operands.

**Source:** `assembler.js` — `performPass()`, grep `this.pass === 1`
**See also:** [performPass], [Pass 2 — code emission], [locCtr]

#### Pass 2 — code emission

The second traversal, with `locCtr` reset to `[loadPoint]` and `[outputBuffer]` reset to `[]`. Re-tokenizes each line, dispatches to `[handleDirective]` or `[handleInstruction]`, and accumulates emitted words into `outputBuffer` + per-line entries into `[listing]`. Operand resolution can now look up labels in `[symbolTable]` (built in pass 1), so forward references just work.

**Source:** `assembler.js` — `performPass()`, grep `this.pass === 2`
**See also:** [performPass], [Pass 1 — symbol table build], [outputBuffer], [listing]

#### `performPass`

The single method that drives both passes. Branches on `[pass]` to skip code emission (pass 1) or actually emit (pass 2) at the lowest level — most of the per-line tokenize / dispatch / locCtr-bump logic is shared between passes. Called twice from `[assembleSource]` with the `pass` field toggled between calls.

**Source:** `assembler.js` — `performPass()`
**See also:** [Pass 1 — symbol table build], [Pass 2 — code emission]

#### `loadPoint` discipline at pass-1 start

`[loadPoint]` is explicitly set to `[defaultLoadPoint]` (= 0) at the top of pass 1. Without this reset, a program that uses `.org N` (jumping `locCtr` forward) would compute `[programSize] = locCtr - loadPoint` incorrectly on a re-run of the same `[Assembler]` instance. The reset matters because reusable in-process callers (`[assembleSource]`) may run the same instance multiple times.

**Source:** `assembler.js` — `performPass()`, grep `this.loadPoint = this.defaultLoadPoint`
**See also:** [loadPoint], [programSize], [.org / .orig]

#### `outputBuffer` reset at pass-2 start

`[outputBuffer]` is set to `[]` at the top of pass 2. Pass 1 doesn't emit, so the buffer is empty at that point regardless; but pass 2 needs a clean slate before re-walking the source. This reset means the same `[Assembler]` instance can be reused across runs.

**Source:** `assembler.js` — `performPass()`, grep `this.outputBuffer = []`
**See also:** [outputBuffer], [Pass 2 — code emission]

#### 65536-word maximum address space

Hard cap. After each line is processed in either pass, `locCtr` is checked against `65536`; exceeding it triggers `[error]` with `"Program too big"`. Reflects LCC's 16-bit word-addressable memory model — the executable can't have more code or data than will fit in `mem[0..65535]`.

**Source:** `assembler.js` — `performPass()`, grep `this.locCtr > 65536`
**See also:** [locCtr]

#### Trailing empty-line removal

At the end of pass 2, if the last entry in `[listing]` has a `sourceLine` that trims to empty, it's popped. The code comment annotates this as `"possible bug / strange lcc behavior"` — the rule was reverse-engineered from the original LCC's output and may not be deliberate behavior on that side. Worth folding into the oracle parity research.

**Source:** `assembler.js` — `performPass()`, grep `this.listing.pop()`
**See also:** [listing], [Pass 2 — code emission]

#### Listing entry — assembly path shape

For lines processed by the normal two-pass `.a` flow, each `[listing]` entry has shape `{lineNum, locCtr, sourceLine, codeWords, label, mnemonic, operands, comment}`. `codeWords` is the array of machine words emitted by this line (often one, sometimes more for `.string` / `.zero`); `label`, `mnemonic`, `operands` are the tokenized form. Consumed by `[buildReportArtifacts]` and by `[sourceMap]` construction.

**Source:** `assembler.js` — `performPass()`, grep `const listingEntry = {` (assembly path)
**See also:** [listing], [Listing entry — raw .hex / .bin path shape]

#### Listing entry — raw `.hex` / `.bin` path shape

For lines processed by `[parseHexFile]` or `[parseBinFile]`, the shape is `{lineNum, locCtr, sourceLine, macWord, comment}` — no tokenization, no label / mnemonic / operands, and code is a single `macWord` (the parsed value) rather than a `codeWords` array. The same `[listing]` array holds both shapes; downstream code branches on which field is present.

**Source:** `assembler.js` — `parseHexFile()`, `parseBinFile()`, grep `const listingEntry = {`
**See also:** [listing], [Listing entry — assembly path shape], [parseHexFile], [parseBinFile]

#### `;` as comment delimiter

Anywhere on a line, everything from `;` to end-of-line is a comment. `[performPass]` extracts the comment substring (everything after the first `;`) into the listing entry's `comment` field, then strips it from the line before tokenisation. Same convention in `[parseHexFile]` and `[parseBinFile]`. There is no block-comment form.

**Source:** `assembler.js` — `performPass()`, grep `line.indexOf(';')`
**See also:** [Source-line processing], [tokenizeLine]

#### Source-line processing pipeline

The fixed sequence in `[performPass]`: capture `originalLine` and `currentLine`, validate length, extract comment, strip comment + trim, tokenize, peel off optional label, peel off mnemonic, send the rest to `[handleDirective]` (mnemonic starts with `.`) or `[handleInstruction]`. Empty post-strip lines still produce a listing entry in pass 2 (so the listing reports show blank source lines aligned with the original file).

**Source:** `assembler.js` — `performPass()` (source-line loop)
**See also:** [performPass], [handleDirective], [handleInstruction]

#### Mnemonic routing (`.` vs other)

After tokenisation, the mnemonic is lowercased. If it starts with `.`, `[handleDirective]` runs (directives manage their own locCtr bumps); otherwise `[handleInstruction]` runs (which always bumps `locCtr` by 1 — every instruction is exactly one 16-bit word). This single-character dispatch is the boundary between "directive vocabulary" and "instruction vocabulary."

**Source:** `assembler.js` — `performPass()`, grep `mnemonic.startsWith('.')`
**See also:** [handleDirective], [handleInstruction], [Pass 1 — symbol table build]

#### `currentLine` / `currentListingEntry`

Two error-message context handles maintained as side effects of the source-line loop. `currentLine` is the original (pre-strip) source for the line being processed; `currentListingEntry` is the in-progress entry. `[error]` formats `currentLine` into the standard `"Error on line N of file:\n    <line>\n<message>"` wording, so the user sees the literal source that failed.

**Source:** `assembler.js` — `currentLine` (field), `currentListingEntry` (field)
**See also:** [error], [performPass]

#### `.hex` file format

One 4-nibble hexadecimal word per source line. The assembler treats each line as `<comment? ; …> <0-3 whitespace> <4 hex digits>`: comments are stripped (`;` delimiter), all whitespace (including internal) is removed via `s.replace(/\s+/g, '')`, then the regex `^[0-9A-Fa-f]+$` plus a length-equals-4 check validates. Parsed words land in `[outputBuffer]` and the per-line listing.

**Source:** `assembler.js` — `parseHexFile()`, grep `4 nibbles`
**See also:** [parseHexFile], [.bin file format], [Listing entry — raw .hex / .bin path shape]

#### `parseHexFile`

The bespoke parser for `.hex` files. Runs entirely separately from the two-pass assembly flow — it has no labels, no directives, no instructions. Just a per-line "read 4 nibbles → 1 word" loop. Behaviour deviations from the oracle (empty-file error, line-length cap) are noted inline in the code.

**Source:** `assembler.js` — `parseHexFile()`
**See also:** [.hex file format], [parseBinFile]

#### `.bin` file format

One 16-bit binary word per source line — 16 literal `0`/`1` characters. Same comment / whitespace rules as `[.hex file format]`. Validation regex is `^[01]+$` plus length-equals-16. Parsed words land in `[outputBuffer]` and the per-line listing.

**Source:** `assembler.js` — `parseBinFile()`, grep `16 bits`
**See also:** [parseBinFile], [.hex file format]

#### `parseBinFile`

Sibling of `[parseHexFile]` for the `.bin` extension. Same shape, same line-by-line loop, same listing-entry shape. The only differences are `parseInt(line, 2)` instead of `parseInt(line, 16)`, the `^[01]+$` regex, and 16-char length check.

**Source:** `assembler.js` — `parseBinFile()`
**See also:** [.bin file format], [parseHexFile]

#### Empty-`.hex` / Empty-`.bin` exit-code-0

Custom LCC.js behaviour (does not match the original LCC as of 12/2024): if `parseHexFile` or `parseBinFile` finishes the source with `locCtr === 0`, it raises `"Empty file"` and exits with status 0. The annotation in the code is explicit about this being a divergence — a follow-up parity decision is open.

**Source:** `assembler.js` — `parseHexFile()`, `parseBinFile()`, grep `abortAssembly('Empty file', 0)`
**See also:** [.hex file format], [.bin file format], ["Empty file" exit-code-0]

#### Raw-file abort messages

`parseHexFile` and `parseBinFile` raise distinct error wordings to make malformed raw input visible:

- `"Error: line N in .hex file is not purely hexadecimal: '...'"` (regex mismatch)
- `"Error: line N in .hex file does not have exactly 4 nibbles: '...'"` (length mismatch)
- `"Error: line N in .bin file is not purely binary: '...'"` (regex mismatch)
- `"Error: line N in .bin file does not have exactly 16 bits: '...'"` (length mismatch)

All four go through `[abortAssembly]`, so they CLI-exit (or throw under `throwOnAssemblyError`) immediately rather than accumulating in `[errors]`.

**Source:** `assembler.js` — `parseHexFile()`, `parseBinFile()`, grep `not purely`
**See also:** [parseHexFile], [parseBinFile], [abortAssembly]

### (c) Tokenization & directive/instruction dispatch

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

### (d) Instruction encoding & per-mnemonic encoders

#### 16-bit instruction word field layout

Every LCC instruction encodes to exactly one 16-bit word divided into fixed-width fields:

| Bits | Field | Used by |
|---|---|---|
| 15-12 | `opcode` nibble (4 bits) | every instruction (selects top-level dispatch) |
| 11-9 | `dr` / `sr` / condition `cc` (3 bits) | destination or source register; branch condition |
| 8-6 | `sr1` / `baser` (3 bits) | first source register; base register for `ldr`/`str`/`jmp`/`blr` |
| 5 | form bit | 0 = register-form (`sr2` in bits 2-0); 1 = immediate-form (`imm5` in bits 4-0). Only ADD / SUB / AND / CMP |
| 4-0 | `imm5` / `sr2` / `ct` / eopcode-low | varies by instruction |

The same field positions are decoded on the interpreter side — see [step / decoded instruction fields](interpreter.md#step--decoded-instruction-fields).

**Source:** `src/core/assembler.js:23-43` (opcode constants), per-instruction encoders below
**See also:** [Immediate field widths and ranges], [Opcode dispatch table (interpreter)](interpreter.md#opcode-dispatch-table)

#### Immediate field widths and ranges

LCC uses five different immediate-field widths depending on the instruction:

| Name | Width | Range | Used by |
|---|---|---|---|
| `imm5` | 5-bit signed | -16..15 | ADD / SUB / AND / CMP immediate forms; CEA (pseudo → ADD) |
| `imm9` | 9-bit signed | -256..255 | MVI / MOV |
| `offset6` | 6-bit signed | -32..31 | LDR / STR / JMP / RET / BLR |
| `pcoffset9` | 9-bit signed | -256..255 | BR / LD / ST / LEA |
| `pcoffset11` | 11-bit signed | -1024..1023 | BL only |
| `ct` | 4-bit unsigned | 0..15 | shift count for SRL / SRA / SLL / ROL / ROR |

Range checks: `imm5` / `imm9` / `offset6` / `pcoffset9` / `pcoffset11` go through `[evaluateImmediate]` with strict min/max bounds; `ct` uses `[evaluateImmediateNaive]` for SRL / SLL / ROL / ROR but the strict version for SRA.

**Source:** per-instruction encoders + `src/core/assembler.js:2239-2265`
**See also:** [evaluateImmediate], [evaluateImmediateNaive]

#### PC-relative target arithmetic

The pcoffset fields all use the same formula: `pcoffsetN = address - locCtr - 1`. The `-1` accounts for the fact that the LCC interpreter has already advanced PC past the instruction word being executed by the time the offset is applied, so the effective branch target is "this instruction + 1 + offset". Out-of-range offsets are caught at assembly time with `"pcoffsetN out of range"` errors.

**Source:** `src/core/assembler.js:1471, 1730, 1771, 1812, 1839`
**See also:** [pcoffset9 in interpreter executeBR](interpreter.md#executebr), [Immediate field widths and ranges]

#### Extended-opcode group (`OP_EXT = 0xA000`)

Opcode 10 is multiplexed across 14 sub-instructions via a 4-bit `eopcode` in the low bits. Lets LCC fit shifts, rotates, stack ops, and multi-precision arithmetic into a single opcode slot:

| eopcode | Mnemonic | Notes |
|---|---|---|
| 0 | PUSH | `sr` in bits 11-9 |
| 1 | POP | `dr` in bits 11-9 |
| 2 | SRL | naive `ct` |
| 3 | SRA | strict `ct` 0..15 |
| 4 | SLL | naive `ct` |
| 5 | ROL | naive `ct` |
| 6 | ROR | naive `ct` |
| 7 | MUL | |
| 8 | DIV | encoded as raw `0xa008` (not `OP_EXT \| 8`) |
| 9 | REM | |
| A | OR | |
| B | XOR | |
| C | MVR | register-to-register move |
| D | SEXT | sign-extend |

DIV's `0xa008` is intentional — it bypasses the usual `OP_EXT | eopcode` build because the encoder uses a hardcoded literal. The result is identical, just stylistically inconsistent.

**Source:** `src/core/assembler.js:38, 1532-1668` (encoders), `src/core/interpreter.js:1071-1175` (decoder)
**See also:** [executeCase10 (interpreter)](interpreter.md#executecase10-extended-opcode-dispatch)

#### Pseudo-instructions

Five mnemonics encode to a different machine instruction than their name suggests:

| Pseudo | Actual encoding | Why |
|---|---|---|
| `mov dr, imm9` | `mvi dr, imm9` (opcode 13) | mov-with-immediate has no native opcode; reuses MVI |
| `mov dr, sr` | `mvr dr, sr` (eopcode 12 in OP_EXT) | mov-between-registers has no native opcode; reuses MVR |
| `cea dr, imm5` | `add dr, fp, imm5` | "compute effective address" of a stack-frame local — the **fp-relative** analogue of `lea` (which is **PC-relative**, for statics/labels). `cea r0, -3` → `r0 = &(local at fp-3)`. Because it's just an ADD with `fp` as base, the immediate is `imm5` (−16..15), **not** a pcoffset9. (Validated against cuh63 6.3 — #152.) |
| `ret` | `jmp lr` (`baser = r7`) | RET is just an indirect jump through the link register |
| `bral` | `br` with cc=7 (always) | "branch unconditional, always-link"; same encoding as `br` |

Each one exists because the source mnemonic is convenient for assembly programmers even though the machine doesn't need a separate opcode for it.

**Source:** `src/core/assembler.js:1504-1509, 1820-1846, 1902-1910, 1922-1969`
**See also:** [assembleCEA], [assembleRET], [assembleMOV], [Register conventions]

#### External-label fixup asymmetries

Three encoders honor `[externLabels]` and emit external-reference records when the operand resolves to an undefined symbol; three others don't. The asymmetry is structural, not a bug:

- **Honor externals** — `[assembleLD]` (emits `'e'`), `[assembleBL]` (emits `'E'`)
- **Don't honor externals** — `[assembleST]`, `[assembleLEA]` (would fail with `"Bad label"`)

The asymmetry exists because `ST`/`LEA` to an external symbol doesn't have a sensible runtime semantic — you can't reasonably store to an unresolved symbol or take its address before linking. `LD` and `BL` make sense (load-from / call-to an external target). The `'A'` adjustment-entry mechanism is also asymmetric: it fires only for **local** label+offset references; external references use `'e'` / `'E'` / `'V'` instead.

**Source:** `src/core/assembler.js:1723-1735, 1832-1844`
**See also:** [externLabels], [externalReferences entry types]

#### `assembleCMP`

Encodes CMP — set flags from `sr1 - <sr2|imm5>` without writing a destination. Register form: `1000 000 sr1 0 00 sr2`. Immediate form: `1000 000 sr1 1 imm5` (bit 5 set). The `dr` bits are zeroed because CMP discards the result.

**Source:** `src/core/assembler.js:1408-1428`
**See also:** [Immediate field widths and ranges], [executeCMP (interpreter)](interpreter.md#executeadd--executesub--executecmp)

#### `assembleBR`

Encodes all branches. Looks up a 3-bit condition code from a small table (`brz/bre=0`, `brnz/brne=1`, `brn=2`, `brp=3`, `brlt=4`, `brgt=5`, `brc=6`, `br/bral=7`), packs it into bits 11-9, then computes the pcoffset9 target offset. Out-of-range branches trigger `"pcoffset9 out of range"`.

**Source:** `src/core/assembler.js:1430-1478`
**See also:** [PC-relative target arithmetic], [executeBR (interpreter)](interpreter.md#executebr)

#### `assembleADD` / `assembleSUB` / `assembleAND`

The three-operand arithmetic / logic triplet. Same shape: `<opcode> dr sr1 <0 00 sr2 | 1 imm5>`. Each encoder reads `dr`, `sr1`, then inspects the third operand: if `[isRegister]`, encodes the register form (bit 5 = 0, `sr2` in bits 2-0); otherwise treats it as an `imm5` literal (bit 5 = 1, `0x0020` set).

**Source:** `src/core/assembler.js:1480-1502, 1511-1530, 1670-1689`
**See also:** [Immediate field widths and ranges], [isRegister]

#### `assembleCEA`

Encodes the `cea dr, imm5` pseudo-instruction by reusing `[assembleADD]`: passes `['fp', imm5]` as the source operand pair, so it produces an `add dr, fp, imm5`. Useful for computing stack-frame addresses (`cea r0, -4` lands `r0 = fp + (-4)`).

**Source:** `src/core/assembler.js:1504-1509`
**See also:** [Pseudo-instructions], [assembleADD]

#### `assemblePUSH` / `assemblePOP`

Both encoded via the extended-opcode group (`OP_EXT`). PUSH: `1010 sr 0000 00000` — eopcode 0, sr in bits 11-9. POP: `1010 dr 0000 00001` — eopcode 1, dr in bits 11-9. The destination/source semantic is just the field name; the machine treats them as opcode-decode demuxers, not separate field types.

**Source:** `src/core/assembler.js:1532-1548`
**See also:** [Extended-opcode group (OP_EXT)]

#### Shift / rotate encoders (`assembleSRL` / `assembleSRA` / `assembleSLL` / `assembleROL` / `assembleROR`)

All five take `sr` (the register to shift) and `ct` (a 4-bit shift count in bits 8-5). If `ct` is omitted at the assembly level, it defaults to 1. Eopcode distinguishes: SRL=2, SRA=3, SLL=4, ROL=5, ROR=6. The strict-vs-naive split: **SRA** uses `[evaluateImmediate]` with range 0..15 (out-of-range fails); the other four use `[evaluateImmediateNaive]` (no range check — the result is masked into bits 8-5 by the encoder).

**Source:** `src/core/assembler.js:1560-1668`
**See also:** [Extended-opcode group (OP_EXT)], [evaluateImmediate], [evaluateImmediateNaive]

#### `assembleDIV` / `assembleMUL` / `assembleREM`

Three-register multi-precision arithmetic. All take `dr` (destination, bits 11-9) and `sr1` (first source, bits 8-6). DIV: encoded as raw `0xa008` (eopcode 8). MUL: eopcode 7. REM: eopcode 9. DIV / REM by zero is detected at runtime, not assembly time — the encoders just lay down the bits and the interpreter handles divide-by-zero with `"Floating point exception"`.

**Source:** `src/core/assembler.js:1550-1558, 1572-1590`
**See also:** [Extended-opcode group (OP_EXT)], [executeCase10 (interpreter)](interpreter.md#executecase10-extended-opcode-dispatch)

#### `assembleOR` / `assembleXOR` / `assembleSEXT`

Three-register logic and sign-extend. OR: eopcode A. XOR: eopcode B. SEXT: eopcode D. Same `OP_EXT | dr | sr1 | eopcode` shape. SEXT's runtime behavior depends on a quirky parity-table for small field selectors — see [executeSEXT (interpreter)](interpreter.md#executesext--sext_parity_table).

**Source:** `src/core/assembler.js:1592-1620`
**See also:** [Extended-opcode group (OP_EXT)]

#### `assembleLD` / `assembleST` / `assembleLEA`

PC-relative memory access trio. Same operand shape as `[.fill / .word]`: `<reg>, <expr>` where `<expr>` is `label`, `label+N`, `label - N`, or a literal. The encoder resolves the address via `[evaluateOperand]`, computes `pcoffset9 = address - locCtr - 1`, and packs it into the low 9 bits with the appropriate opcode. `assembleLD` honors `[externLabels]` (emits an `'e'` external reference); `assembleST` and `assembleLEA` do not — see [External-label fixup asymmetries].

**Source:** `src/core/assembler.js:1691-1818`
**See also:** [PC-relative target arithmetic], [External-label fixup asymmetries]

#### `assembleBL`

Direct call: `0100 1 pcoffset11`. The `bit11 = 1` distinguishes BL from BLR at the same base opcode (4). The pcoffset11 range is ±1024 — wider than pcoffset9 because subroutine targets can be further from the call site than typical branches. Honors `[externLabels]` (emits an `'E'` external reference for unresolved targets).

**Source:** `src/core/assembler.js:1820-1847`
**See also:** [PC-relative target arithmetic], [External-label fixup asymmetries], [executeBLorBLR (interpreter)](interpreter.md#executeblorblr--executejmp)

#### `assembleBLR`

Register-indirect call: `0100 000 baser offset6`. The `bit11 = 0` distinguishes BLR from BL. Used for calls through function pointers — base register holds the target address; offset6 is added to it. Common pattern: `blr lr` to return-and-recall, though `ret` is more idiomatic.

**Source:** `src/core/assembler.js:1849-1860`
**See also:** [assembleBL], [Pseudo-instructions]

#### `assembleLDR` / `assembleSTR`

Base+offset memory access pair. LDR: `0110 dr baser offset6` (load). STR: `0111 sr baser offset6` (store). Used for stack-frame access and array indexing — `ldr r0, fp, -4` reads four bytes below the frame pointer. `offset6` is a strict-range immediate (-32..31).

**Source:** `src/core/assembler.js:1862-1884`
**See also:** [Immediate field widths and ranges]

#### `assembleJMP` / `assembleRET`

Indirect-jump primitives. JMP: `1100 000 baser offset6` — unconditional jump to `r[baser] + offset6`. RET: same encoding with `baser = 7` (= lr), so the jump goes wherever the linker register points. The CLI parses `ret` as a separate mnemonic for ergonomics, but at the machine level it's just a JMP through r7.

**Source:** `src/core/assembler.js:1886-1910`
**See also:** [Pseudo-instructions], [executeJMP (interpreter)](interpreter.md#executeblorblr--executejmp)

#### `assembleNOT`

Bitwise complement: `1001 dr sr1 111111`. The low 6 bits are all 1s — that's not a meaningful sr2 field, just historical encoding padding. The decode side (`[executeNOT]`) ignores them; the assembler emits them for `.lst` / `.bst` parity with the original LCC.

**Source:** `src/core/assembler.js:1912-1920`
**See also:** [executeNOT (interpreter)](interpreter.md#executenot)

#### `assembleMOV`

Multi-mnemonic encoder — handles `mov`, `mvi`, and `mvr`. For `mov dr, X`, the encoder peeks at `X`: if `[isRegister]`, emits MVR (eopcode 12 in OP_EXT); otherwise treats `X` as a 9-bit signed immediate and emits MVI. Explicit `mvi` / `mvr` mnemonics let the user force one encoding when they want to. Oracle parity note: the oracle rejects negative immediates to `mov` (OB-001) but LCC.js accepts them — Charlie confirmed `mov dr, imm` is just a pseudo for `mvi dr, imm9`.

**Source:** `src/core/assembler.js:1922-1970`
**See also:** [Pseudo-instructions]

#### `assembleTrap`

Trap encoder: `1111 sr 0 trapvec` where `trapvec` is the 8-bit trap number. Default `sr = r0` if no operand is given (most traps don't actually use a source register — the source-register field is just a vestigial holding pen). Called from `[handleInstruction]`'s trap-vector cases for everything except `halt` (raw `OP_TRAP`) and `nl` (special-cased to `0xF001`).

**Source:** `src/core/assembler.js:1972-1982`
**See also:** [Trap vector table], [Trap dispatch in handleInstruction]

#### Error wording catalog (section d)

Concrete wordings raised by per-instruction encoders:

- **Missing-operand family:** `"Missing operand"`, `"Missing register"`, `"Missing number"` — distinguished by which slot is missing
- **Bad-form family:** `"Bad number"`, `"Bad label"`, `"Bad register"`, `"Bad operand--not a valid label"` — operand has the wrong shape
- **Resolution failures:** `"Undefined label"` — operand-as-label didn't find a `[symbolTable]` entry
- **Dispatch fall-throughs:** `"Invalid operation"`, `"Invalid mnemonic: <m>"` — unknown directive / instruction
- **Range overflows:** `"pcoffset9 out of range"`, `"pcoffset9 out of range for ld"`, `"pcoffset9 out of range for st"`, `"pcoffset11 out of range"` — target too far from `locCtr`

The slight variation in pcoffset9 wording (with/without "for X") reflects where the error is raised — `[assembleBR]`'s wording is the bare form, `[assembleLD]` and `[assembleST]` append "for ld" / "for st" so the user knows which encoder rejected the operand.

**Source:** per-instruction encoders, lines 1408-1980
**See also:** [error]

#### Oracle parity notes

Two LCC.js-vs-oracle deviations annotated in the per-instruction encoder code:

- **Cuh63 6.3 `jmp` with no operand** — formerly thought to segfault on the oracle; current behaviour is `"Missing operand"` on both sides.
- **OB-001** — oracle rejects negative immediates to `mov` (treats them as illegal); LCC.js accepts them because `mov dr, imm` is a pseudo for `mvi dr, imm` and `mvi`'s `imm9` is signed. Charlie confirmed the LCC.js interpretation is correct.

These notes live in the encoder source rather than a separate ADR because they're highly localised — a future re-reader of `assembleMOV` benefits more from seeing the rationale inline than from a "see ADR-007" footnote.

**Source:** `src/core/assembler.js:1889-1891, 1937-1939`
**See also:** [assembleMOV], [assembleJMP]

#### Register conventions referenced by encoders

Two registers have symbolic aliases honored by the per-instruction encoders:

- `lr` = `r7` (link register; baked into `[assembleRET]`)
- `fp` = `r5` (frame pointer; baked into `[assembleCEA]`)

A third (`sp` = `r6`) is used by `[assemblePUSH]` and `[assemblePOP]` at runtime but doesn't appear in the encoders — push/pop are register-only and the stack pointer is implicit. The symbolic-to-numeric translation itself lives in `[getRegister]` (section e), not here.

**Source:** `src/core/assembler.js:1508, 1903`
**See also:** [getRegister], [executeBLorBLR (interpreter)](interpreter.md#executeblorblr--executejmp)

### (e) Operand & immediate evaluation

#### `getRegister`

The symbolic-to-numeric translator for register operands. Accepts `r0..r7` and the three aliases `fp` / `sp` / `lr` (case-insensitive), returning the numeric register index (0-7). Maps `fp` → 5, `sp` → 6, `lr` → 7. Rejects anything else with `"Bad register"`. This is where the assembly-level "stack pointer" abstraction becomes "register 6" — every per-instruction encoder calls this on its register operands.

**Source:** `assembler.js` — `getRegister()`
**See also:** [isRegister], [Register conventions referenced by encoders]

#### `isRegister`

Boolean predicate: matches `/^(r[0-7]|fp|sp|lr)$/i` against the operand string. Used by encoders to distinguish register operands from immediate or label operands without committing to a parse — e.g. `[assembleADD]` calls `isRegister` on the third operand to decide between register-form (`r2`) and immediate-form (`imm5`).

**Source:** `assembler.js` — `isRegister()`
**See also:** [getRegister], [assembleADD]

#### Symbolic register aliases

LCC accepts three symbolic register names everywhere a numeric register would work:

- `fp` (frame pointer) → `r5`
- `sp` (stack pointer) → `r6`
- `lr` (link register) → `r7`

The translation happens in `[getRegister]`. Code emitted by the LCC C compiler uses these symbolic names extensively (every function prologue / epilogue references `fp` and `sp`); hand-written assembly can mix-and-match. The assembler treats `fp` and `r5` as identical at the machine-code level.

**Source:** `assembler.js` — `getRegister()`, grep `regStr === "fp"`
**See also:** [getRegister]

#### `isCharLiteral`

Boolean predicate for single-quoted character literals: matches `/^'(?:\\.|[^\\])'$/`. The regex allows either a single non-backslash character or a backslash-prefixed escape, all enclosed in straight single quotes. Used by `[parseNumber]` and `[parseCharLiteral]` to recognise when an operand is a character literal rather than a numeric or symbolic value.

**Source:** `assembler.js` — `isCharLiteral()`
**See also:** [parseCharLiteral], [parseNumber]

#### `parseCharLiteral`

Converts a character-literal token into its ASCII codepoint integer. Strips the surrounding quotes; if the remaining content is one character, returns its `charCodeAt(0)`. If it starts with `\`, expands the escape (`\n`, `\t`, `\r`, `\\`, `\'`, `\"`) and returns the resulting char's codepoint. Unknown escapes raise `"Invalid escape sequence: \X"`; malformed content raises `"Invalid character literal: '<X>'"`.

**Source:** `assembler.js` — `parseCharLiteral()`
**See also:** [isCharLiteral], [parseNumber]

#### `parseNumber`

The number-parsing front door. Dispatches on operand shape:

- Char literal → `[parseCharLiteral]`'s codepoint
- `0x` / `0X` prefix → base-16 `parseInt`
- Otherwise → base-10 `parseInt`

Returns the parsed value or `NaN` on failure. **Negative hex literals are explicitly unsupported** — `-0x10` won't parse, and the code comment annotates this intentional limitation. The decimal path *does* accept negative literals because `parseInt` handles a leading `-` natively.

**Source:** `assembler.js` — `parseNumber()`
**See also:** [parseCharLiteral], [isValidHexNumber]

#### `isOperator`

One-liner: `op === '+' || op === '-'`. The only "operators" the assembler recognises in operand expressions. Used by directive handlers (`.word`, `.fill`) to detect the three-token form `label + N` versus the single-operand form.

**Source:** `assembler.js` — `isOperator()`
**See also:** [parseLabelWithOffset], [.fill / .word]

#### `parseLabelWithOffset`

Regex parser for the `label±N` single-token form: `^([A-Za-z_$@][A-Za-z0-9_$@]*)\s*([+\-]\s*\d+)?$`. Returns `{label, offset}` or `null` if the operand doesn't match. Accepts `label`, `label+N`, `label-N`, and the whitespace variants `label + N` and `label - N` (only the inner whitespace between sign and digits — not on either side of the label). Used by `[evaluateOperand]` to handle label-arithmetic operands.

**Source:** `assembler.js` — `parseLabelWithOffset()`
**See also:** [evaluateOperand], [Tokenization splitting rules]

#### `*` location-counter operand

The `*` character, when it appears where an operand is expected, refers to the current value of `[locCtr]` (i.e. the address of the *next* word the assembler will emit). Supports `*+N` and `*-N` arithmetic for nearby addresses. Resolved by `[evaluateOperand]` after all other operand-form checks fall through. Classified as `'star'` by `[determineOperandType]` — a distinct syntactic category, even though semantically it's just a number.

**Source:** `assembler.js` — `evaluateOperand()`, grep `operand[0] === '*'`
**See also:** [evaluateOperand], [determineOperandType], [locCtr]

#### `evaluateOperand`

The operand-resolver. Tries four interpretations in order:

1. Pure number (via `[parseNumber]`) → return it
2. Label-with-offset (via `[parseLabelWithOffset]`) → look up `label` in `[symbolTable]` or `[externLabels]`, return `address + offset`
3. Plain label (no offset) → same lookup path
4. `*`-operand → return `locCtr` (with optional `±N`)

External labels return a placeholder (`0 + offset`) and trigger `[handleExternalReference]` with the `usageType` parameter (`'e'` / `'E'` / `'V'`) telling the linker how to fix up later. Error progression on failure: `"Bad number"` (invalid hex) → `"Bad label"` (invalid label syntax) → `"Undefined label"` (valid syntax but no definition and not external) → `"Unspecified label error for: <X>"` (defensive default).

**Source:** `assembler.js` — `evaluateOperand()`
**See also:** [parseNumber], [parseLabelWithOffset], [handleExternalReference], [`*` location-counter operand]

#### `usageType` parameter

The single-letter type tag passed into `[evaluateOperand]` to tell the linker how to fix up an external reference if the operand turns out to be unresolved. Values are `'e'` (pcoffset9 fixup — for LD / ST / LEA / BR), `'E'` (pcoffset11 fixup — for BL), `'V'` (full 16-bit value fixup — for `.word`). Each per-instruction encoder picks the right type when calling `evaluateOperand`. See [externalReferences entry types] for the matching consumer-side semantics.

**Source:** `assembler.js` — `evaluateOperand()`, `handleExternalReference()`; grep `usageType` for call sites
**See also:** [evaluateOperand], [externalReferences entry types], [handleExternalReference]

#### `determineOperandType`

Syntactic-only operand classifier. Returns one of four strings: `'char'`, `'star'`, `'num'`, `'label'`. Does **no semantic resolution** — `'label'` just means "operand looks like a label-shaped token," not "this label is defined." Currently unused in practice; intended as foundation for future per-mnemonic operand-type schemas once oracle research clarifies which type mismatches the original LCC accepts or rejects. See `core-behavior-matrix.md` § "Operand type checking".

**Source:** `assembler.js` — `determineOperandType()`
**See also:** [evaluateOperand]

#### `handleExternalReference`

Records an external reference into `[externalReferences]` for later serialization. Stores `{label, type, address: locCtr}` and dedups by `(label, type)` so the same external label referenced multiple times at the same encoding only produces one header entry. Callers (mostly `[evaluateOperand]`) guard with `externLabels.has(label)` before calling — the function assumes the label is already known external.

**Source:** `assembler.js` — `handleExternalReference()`
**See also:** [externalReferences], [externLabels], [evaluateOperand]

#### `evaluateImmediate` (strict)

Range-checked immediate evaluator. Takes `(valueStr, min, max, type)`. Parses the value via `[parseNumber]`; if outside `[min, max]`, raises `"<type> out of range"`. Used by encoders that genuinely cannot encode out-of-range immediates (e.g. `imm5` is only 5 bits wide, so values above 15 must be rejected before they're masked into garbage).

**Source:** `assembler.js` — `evaluateImmediate()`
**See also:** [evaluateImmediateNaive], [Immediate field widths and ranges]

#### `evaluateImmediateNaive`

Unchecked immediate evaluator. Takes `valueStr`, returns the parsed number masked with `0xFFFF`. Used for shift counts where bits 8-5 are 4 wide and out-of-range values are intentionally allowed to wrap into nonsense (the user gets garbage, not an error). The name is deliberately less ergonomic than the strict version — the naive path is the rare exception.

**Source:** `assembler.js` — `evaluateImmediateNaive()`
**See also:** [evaluateImmediate], [Extended-opcode group (OP_EXT)]

#### `isNumLiteral`

Predicate: true if the operand is a character literal **OR** a valid number **OR** a valid hex literal. Used by `.word` / `.fill` to decide whether the second token is a literal value (versus a label-arithmetic operator). Note that `isNumLiteral` accepts character literals — `.word 'A'` is valid and emits a word with the ASCII codepoint.

**Source:** `assembler.js` — `isNumLiteral()`
**See also:** [isValidHexNumber], [parseNumber]

#### `isValidHexNumber`

Regex check: `^0x[0-9A-Fa-f]+$`. Distinguished from `parseNumber`'s hex path in that this is just the *syntactic* shape, with no implicit-base inference. Used by `[evaluateOperand]`'s error progression to differentiate `"Bad number"` (token *looks* like hex but doesn't parse) from `"Bad label"` (token has illegal label characters).

**Source:** `assembler.js` — `isValidHexNumber()`
**See also:** [parseNumber], [isNumLiteral]

#### `failAssembly`

The "compatible-with-multi-error" failure path. Calls `[error]` to log the failure (which itself may abort if `[REPORT_MULTI_ERRORS]` is false), and then explicitly calls `[abortAssembly]` if `REPORT_MULTI_ERRORS` is true. The double-handling exists so the codebase can be flipped to multi-error mode in the future without touching every callsite — they just call `failAssembly` and the global flag chooses the behaviour.

**Source:** `assembler.js` — `failAssembly()`
**See also:** [error], [abortAssembly], [REPORT_MULTI_ERRORS]

#### `error`

The single error-reporting funnel. Formats the message into the standard `"Error on line N of file:\n    <line>\n<message>"` shape, writes it to `console.error`, appends it to `[errors]`, sets `[errorFlag]` true. If `REPORT_MULTI_ERRORS` is false (current default — matches original LCC), it also calls `[abortAssembly]` to exit immediately. Every other module / encoder funnels through this method, so a single point edits the error format for the whole assembler.

**Source:** `assembler.js` — `error()`
**See also:** [failAssembly], [errorFlag], [REPORT_MULTI_ERRORS]

#### LCC error message format

Every assembler error renders in the standard three-line LCC shape:

```
Error on line <lineNum> of <inputFileName>:
    <currentLine>
<message>
```

The middle indented line echoes the literal source the assembler was processing when the failure occurred (from `[currentLine]`), so the user sees the exact text they wrote — not a tokenized or normalized version. Matches the original LCC's wording byte-for-byte so golden tests can be reused.

**Source:** `assembler.js` — `formatAssemblerError()`, grep `Error on line ${this.lineNum} of`
**See also:** [error], [currentLine / currentListingEntry]

#### Module export + CLI auto-instantiation

The bottom-of-file boilerplate that lets `assembler.js` work both as a library (`require('./assembler.js')`) and as a CLI tool (`node assembler.js foo.a`). The CLI path is gated by `require.main === module`, the standard Node idiom for "are we the entry script?"; when true, it instantiates an `Assembler` and calls `[main]`. Library callers can use `[assembleSource]` directly without ever touching `main`.

**Source:** `assembler.js` — module footer; grep `module.exports = Assembler`, `require.main === module`
**See also:** [main], [assembleSource]
