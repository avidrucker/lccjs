# Linker Glossary

LCC-specific vocabulary used in `src/core/linker.js` — how multiple `.o`
object modules are concatenated into one `.e` executable: the per-link
state tables, the link pipeline, external- and local-reference fix-up math,
and output serialization. See [README](./README.md) for entry conventions
and the other module glossaries.

---

## Definitions

### Machine Code Array (`mca`)

The linker's growing buffer of machine words concatenated from every linked object module. When `mca` is finally serialized in `[createExecutable]`, it becomes the code section after the `'C'` marker of the output `.e` file. Distinct from the assembler's `outputBuffer`: `mca` aggregates words across multiple input modules; `outputBuffer` is single-module-scoped.

**Source:** `src/core/linker.js:25, 42, 254-256`
**See also:** [mcaIndex], [createExecutable]

### `mcaIndex`

The next-write position in `[Machine Code Array (mca)]`. It does double duty: when a new object module is being registered, `mcaIndex` is *also* the "module-start base" added to every header entry's `address` (since the module's local addresses now sit at `mcaIndex .. mcaIndex + module.code.length`). For `'A'` entries it is captured separately as [`moduleStart`] so the fix-up phase can apply the same shift after other modules have been appended.

**Source:** `src/core/linker.js:26, 215, 222, 226, 232, 238, 245, 255`
**See also:** [Machine Code Array (mca)], [processModule], [moduleStart]

### `GTable`

Global symbol table for the *whole link*, mapping a label string to its final `[Machine Code Array (mca)]` address. Populated as each module's `'G'` entries are registered by `[processModule]`; consulted by every external-reference fix-up to resolve a placeholder offset/value into a concrete address. Duplicate labels across modules → `[Multiple-globals error]`.

**Source:** `src/core/linker.js:27, 218-223, 262, 272, 282`
**See also:** [processModule], [adjustExternalReferences]

### `ETable` / `eTable` / `VTable`

The three external-reference tables — one per fix-up encoding. Each entry is `{address, label}` where `address` is the (already-relocated) word position in `[Machine Code Array (mca)]` containing a placeholder, and `label` is the symbol to resolve via `[GTable]`. The capitalisation tracks the header-entry type byte the assembler emitted:

- `ETable` (uppercase `E`) — 11-bit pc-offset placeholder for `bl` (range ±1024)
- `eTable` (lowercase `e`) — 9-bit pc-offset placeholder for `ld` / `st` / `lea` / `br` (range ±256)
- `VTable` (uppercase `V`) — full 16-bit value placeholder for `.word label`

The naming mirrors the on-disk header marker bytes — see [.e / .o file format](assembler.md#e--o-file-format) for the byte-layout the assembler produces.

**Source:** `src/core/linker.js:28-30, 224-241, 259-287`
**See also:** [GTable], [adjustExternalReferences]

### `ATable`

Adjustment / local-reference entries. Each entry is `{address, moduleStart}` where `address` is the relocated word position holding a value to shift, and [`moduleStart`] is the offset the value's source module landed at when it was appended to `[Machine Code Array (mca)]`. Unlike the three external tables, `ATable` performs no symbol lookup — `[adjustLocalReferences]` just adds `moduleStart` to `mca[address]`.

**Source:** `src/core/linker.js:31, 242-246, 290-293`
**See also:** [processModule], [adjustLocalReferences], [moduleStart]

### `moduleStart`

A per-`'A'`-entry copy of `[mcaIndex]` taken at the moment the entry's module was being registered. Carried alongside the entry's address so `[adjustLocalReferences]` can apply the right offset once the link is complete — even though the live `mcaIndex` has moved on as later modules are concatenated.

**Source:** `src/core/linker.js:245-246, 291-293`
**See also:** [ATable], [adjustLocalReferences]

### `start` / `gotStart`

`start` holds the entry-point address — the final `[Machine Code Array (mca)]` location the runtime should set PC to. `gotStart` is a one-shot latch: false until the first `'S'` header entry is seen; thereafter true, so any *second* `'S'` raises `[Multiple-entry-points error]`. The pair guarantees an LCC link has at most one entry point even when multiple modules each contribute their own `.start` directive.

**Source:** `src/core/linker.js:32-33, 211-216`
**See also:** [processModule]

### `objectModules`

The list of parsed modules accumulated by `[readObjectModule]`. Each entry has the shape `{headers, code}` returned by `[parseObjectModuleBuffer]`. The list is consumed in input order by `[link]`, which feeds each one to `[processModule]` — so module concatenation order matches the CLI argument order exactly.

**Source:** `src/core/linker.js:34, 160, 189`
**See also:** [readObjectModule], [link]

### `parseObjectModuleBuffer`

Pure-seam parser for an `.o` file. Input: a `Buffer` of bytes; output: `{headers: [{type, address, [label]}], code: [<UInt16LE>...]}`. Validates the `'o'` intro byte, reads header entries until `'C'`, then reads the rest as little-endian 16-bit words. Any parse failure throws `[LinkerError]`, so the same buffer-driven parser is reusable by tests and in-process wrappers without going through `[readObjectModule]`'s filesystem path.

**Source:** `src/core/linker.js:84-153`
**See also:** [readObjectModule], [LinkerError], [.e / .o file format](assembler.md#e--o-file-format)

### `readObjectModule`

Filesystem wrapper around `[parseObjectModuleBuffer]`. Reads the named file with `fs.readFileSync`, hands the buffer to the pure seam, and pushes the resulting parsed module into `[objectModules]`. If a `[LinkerError]` escapes the parser, it is logged to stderr via `[error]` and re-thrown — test-mode callers see a typed exception without losing the stderr trail.

**Source:** `src/core/linker.js:156-167`
**See also:** [parseObjectModuleBuffer], [objectModules], [error]

### `link`

The top-level link pipeline: `resetState` → for each filename `[readObjectModule]` (with status print `"Linking <f>"`) → for each parsed module `[processModule]` → `[adjustExternalReferences]` → `[adjustLocalReferences]` → `[createExecutable]`. The order is significant: every `[GTable]` entry must be populated by `processModule` before external fix-ups look them up, and all `[Machine Code Array (mca)]` content must be in place before the executable is serialized.

**Source:** `src/core/linker.js:169-202`
**See also:** [processModule], [adjustExternalReferences], [adjustLocalReferences], [createExecutable]

### `processModule`

Registers one parsed module's headers into the appropriate per-link table, then appends its `code` words to `[Machine Code Array (mca)]`. Every header entry's `address` is rewritten to `header.address + mcaIndex` *before* it is stored, so all subsequent fix-up logic sees absolute `mca` positions rather than module-local offsets. For `'A'` entries, `[mcaIndex]` is *also* captured separately as `[moduleStart]` for the fix-up phase. Code words are written at `mca[mcaIndex++]` in order — module concatenation happens here.

**Source:** `src/core/linker.js:204-257`
**See also:** [mca][Machine Code Array (mca)], [mcaIndex], [GTable], [ETable / eTable / VTable], [ATable]

### `adjustExternalReferences`

Resolves every `[ETable / eTable / VTable]` entry against `[GTable]`. For each ref, computes the final value the placeholder word should hold:

- `ETable` — rewrites the low 11 bits with the resolved pc-offset (preserves the top 5 bits — opcode + `b11` — via `& 0xf800`).
- `eTable` — rewrites the low 9 bits (preserves the top 7 via `& 0xfe00`).
- `VTable` — adds the resolved global address directly to the word (no masking; the assembler emitted `0` as the placeholder).

A missing global at this point is fatal: `[Undefined-external-reference error]`. The same pc-offset formula `(current + Gaddr - ref.address - 1)` is used for both `ETable` and `eTable` — only the mask width differs.

**Source:** `src/core/linker.js:259-288`
**See also:** [ETable / eTable / VTable], [GTable]

### `adjustLocalReferences`

The last fix-up phase: walks `[ATable]` and adds each entry's `[moduleStart]` to `mca[ref.address]`. This corrects label-arithmetic words (`.word label+N`-style values emitted by the assembler relative to the module's own load base) — after module concatenation those base addresses have shifted, so the stored value needs the same shift applied.

**Source:** `src/core/linker.js:290-294`
**See also:** [ATable], [moduleStart]

### `createExecutable`

Serializes the final linked state to disk as a standard `.e` file: `'o'` signature → `'S'` entry (if `[gotStart]`) → all `[GTable]` entries → `'A'` entries derived from `[VTable]` (so the runtime sees a fix-up site for each full-value reference) → original `[ATable]` entries → `'C'` code marker → `[Machine Code Array (mca)]` as little-endian 16-bit words. The output of this method has the *same byte layout* as a fresh assembler-produced `.e` — there is nothing linker-specific about the file format itself.

**Source:** `src/core/linker.js:296-352`
**See also:** [.e / .o file format](assembler.md#e--o-file-format)

### Default output name (`linktest.e` vs `link.e`)

When `linker.js` is invoked standalone with no `-o` flag, the output defaults to `linktest.e` in the current working directory — matching the oracle's standalone `linker` binary. The oracle's `lcc` binary defaults to `link.e` instead; `lcc.js` always passes an explicit `outputFileName` so this fallback only ever applies to direct `linker.js` invocations. Both oracle tools use the CWD rather than the directory of the first input `.o`; using the latter was considered but rejected to preserve oracle parity.

**Source:** `src/core/linker.js:172-180`
**See also:** `core-behavior-matrix.md` § "Linker output location and default name"

### `LinkerError`

The typed error class for every linker parse / link failure. Wrapping link failures in a dedicated type lets test callers `catch` linker failures specifically without conflating them with arbitrary `Error`s, and lets future in-process wrappers route linker failures through their own handling without bouncing through `process.exit`.

**Source:** `src/core/linker.js:6` (import); `src/utils/errors.js` (definition)
**See also:** [error]

### `error` (linker)

Internal helper: prints `message` to stderr, then throws a fresh `[LinkerError]` with the same message. The double behaviour (log + throw) means a single `error('…')` call satisfies both the operator-feedback path (stderr) and the typed-exception path (catchable in tests / `[link]` callers) without the caller having to duplicate either.

**Source:** `src/core/linker.js:354-357`
**See also:** [LinkerError]

### Multiple-entry-points error

`"Multiple entry points"` — raised when a second `'S'` (start address) header entry is encountered across all linked modules. Implies the user is linking together two modules that both contain a `.start` directive; only one entry point is valid per `.e`.

**Source:** `src/core/linker.js:212-213`
**See also:** [start / gotStart], [processModule]

### Multiple-globals error

`"More than one global declaration for <label>"` — raised when a label appears in a `'G'` header entry across more than one linked module. The link tools require exactly one `.global` declaration per label for the whole link.

**Source:** `src/core/linker.js:219-220`
**See also:** [GTable], [processModule]

### Undefined-external-reference error

`"<label> is an undefined external reference"` — raised when a label declared as `.extern` in one module is not declared as `.global` in any other linked module. Caught at fix-up time, not parse time — the linker can't tell which `.extern`s are bogus until it knows the full set of globals.

**Source:** `src/core/linker.js:262-263, 272-273, 282-283`
**See also:** [adjustExternalReferences], [GTable]

### Parse-format errors

A small family of typed-error wordings from `[parseObjectModuleBuffer]` and `[readObjectModule]`:

- `"<file> not a linkable file"` — missing `'o'` intro byte
- `"Invalid <T> entry"` — truncated header entry of type `T`
- `"Unknown header entry <T> in file <f>"` — type byte not in the known set
- `"Invalid header entry: <T>"` — same problem caught later in `[processModule]`

All are thrown as `[LinkerError]`s so callers can branch on parse-vs-link failure cleanly.

**Source:** `src/core/linker.js:88, 107, 119, 134, 142, 249`
**See also:** [parseObjectModuleBuffer], [LinkerError]

### CLI errors

A small family of `cliErrorExit`-routed messages for direct `linker.js` invocations:

- `"Usage: node linker.js [-o outputfile.e] <object module 1> <object module 2> ..."` — no args
- `"Missing output file name after -o"` — `-o` with no following value
- `"Error: No input object modules specified"` — only `-o` flags, no `.o` files

Unlike `[LinkerError]`, these go straight to `process.exit(1)` (or `throw` in test mode) — they reflect operator misuse rather than link-time failures.

**Source:** `src/core/linker.js:56-82`
**See also:** [link]
