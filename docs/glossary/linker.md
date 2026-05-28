# Linker Glossary

Glossary of LCC-specific terms used in `src/core/linker.js`.

<!-- @todo #113:60m/WRITER Write definitions for each inventoried term; LCC-specific angle only. Blocked by #110. See #113 -->

Parent: #107 · See [README](./README.md) for entry conventions.

---

## Candidate term inventory (populated by spike #110)

`linker.js` is the smallest core file (~365L) so 3 sections cover it. The
write phase (#113) consolidates these into definitions.

### (a) Linker state & object-module parse

**Data tables (per-link state):**
- `mca` — **M**achine **C**ode **A**rray; the concatenated machine words from all linked modules (becomes the final `.e` code section)
- `mcaIndex` — current write position in `mca`; doubles as the "module-start base" when registering header entries from a freshly-loaded module
- `GTable` — **G**lobal symbol table; `label → final mca address`
- `ETable` — **E**xternal references with **11-bit** pc-offset fixups (for `bl` instructions; ±1024 range)
- `eTable` — **e**xternal references with **9-bit** pc-offset fixups (for `ld` / `st` / `lea` / `br`; ±256 range)
- `VTable` — external references needing a **full 16-bit value** fixup (for `.word label`)
- `ATable` — Adjustment / local-reference entries; each carries `{address, moduleStart}` for relocation
- `start` — final mca address of the `'S'`-entry-resolved entry point
- `gotStart` — boolean, set on first `'S'` entry seen; second `'S'` → "Multiple entry points" error
- `objectModules` — parsed-module list
- `inputFiles` — CLI-provided filenames
- `outputFileName` — `.e` output path

**Object-module parse (`parseObjectModuleBuffer`):**
- Same `.o` format the assembler emits — see assembler glossary section (a) for `'o'`/`'S'`/`'G'`/`'E'`/`'e'`/`'V'`/`'A'`/`'C'` layout
- `module = { headers: [{type, address, [label]}], code: [<UInt16LE>...] }` — parsed module shape
- Per-entry-type byte-layout validation; errors: `"Invalid <T> entry"`, `"Unknown header entry <T> in file <f>"`
- `"<file> not a linkable file"` — when leading `'o'` signature is missing
- `readObjectModule(filename)` — file-handle wrapper around `parseObjectModuleBuffer`; re-throws `LinkerError`s after logging
- `parseObjectModuleBuffer` is exposed as the pure seam (input: buffer, output: parsed module struct)

### (b) Link pipeline & fixup math

**Pipeline (`link(filenames, outputFileName)`):**
1. `resetState()` — clear all per-link tables
2. For each filename — `readObjectModule(f)` + print `"Linking <f>"`
3. For each parsed module — `processModule(m)` (register headers into the right table, then append code to mca)
4. `adjustExternalReferences()` — resolve `ETable` / `eTable` / `VTable` against `GTable`
5. `adjustLocalReferences()` — apply A-entry module-start offsets
6. `createExecutable()` — serialize result and write to disk

**Per-module header registration (`processModule`):**
- `'S'` → set `start = header.address + mcaIndex`; trip `gotStart`; second `'S'` → `"Multiple entry points"` error
- `'G'` → record into `GTable[label] = header.address + mcaIndex`; duplicate → `"More than one global declaration for <label>"`
- `'E'` / `'e'` / `'V'` → push `{address: header.address + mcaIndex, label}` into the matching table
- `'A'` → push `{address: header.address + mcaIndex, moduleStart: mcaIndex}` (the module-start is needed at fix-up time)
- Default → `"Invalid header entry: <T>"`
- After headers: append `module.code` words to `mca`, bumping `mcaIndex`

**External-reference fixup (`adjustExternalReferences`):**
- ETable (11-bit pc-offset for `bl`): `offset = (mca[ref.address] + Gaddr - ref.address - 1) & 0x7ff`; preserve top 5 bits (opcode + `b11`) via `& 0xf800`
- eTable (9-bit pc-offset for `ld`/`st`/`lea`/`br`): same shape but 9-bit mask `0x1ff` / 7-bit opcode-keep mask `0xfe00`
- VTable (full-value `.word label`): `mca[ref.address] += Gaddr` (no shifting, no masking — replaces a placeholder word with the resolved 16-bit address)
- Missing global → `"<label> is an undefined external reference"` error

**Local-reference fixup (`adjustLocalReferences`):**
- For each `A` entry: `mca[ref.address] += ref.moduleStart` — accounts for the address shift introduced when the entry's module was appended to `mca`

### (c) Output `.e` writing, CLI orchestration, error model

**Output `.e` serialization (`createExecutable`):**
- Order written: `'o'` signature → `'S'` entry (if `gotStart`) → all `'G'` entries → `'A'` entries derived from `VTable` (each VTable entry produces an output `'A'` so the runtime knows there's a fix-up site) → original `'A'` entries from `ATable` → `'C'` code marker → `mca` words as UInt16LE
- Each label-bearing entry: type byte + UInt16LE address + null-terminated label string
- Status output: `"Creating executable file <X>"`

**Default output-name rules (oracle research, 2026-05-26):**
- Standalone CLI invocation: `linktest.e` (matches the oracle standalone `linker` binary)
- Oracle's `lcc` binary: defaults to `link.e` (different from standalone); `lcc.js` always passes explicit `outputFileName` to avoid this fallback
- Both oracle tools use **CWD**, not the dir of the first `.o` file (issue #3 explored the latter; would diverge from oracle, so not adopted)
- See `core-behavior-matrix.md` § "Linker output location and default name"

**CLI orchestration (`main`):**
- Usage: `node linker.js [-o outputfile.e] <object module 1> <object module 2> ...`
- Errors: `"Missing output file name after -o"`, `"Error: No input object modules specified"`
- Status: `"Linking <file>"` per input; `"Creating executable file <X>"`

**Error model:**
- `LinkerError` (typed error from `utils/errors`)
- `error(message)` — log to stderr then `throw new LinkerError(message)`
- Specific messages: `"Multiple entry points"`, `"More than one global declaration for <label>"`, `"<label> is an undefined external reference"`, `"Invalid <T> entry"`, `"Unknown header entry <T> in file <f>"`, `"<file> not a linkable file"`

**Pure seam (typed-error refactor, recent):**
- `parseObjectModuleBuffer(buffer, filename)` — input: buffer + filename, output: parsed module struct; throws `LinkerError` for any parse failure
- Allows tests + future wrappers to consume buffers without the filesystem step

---

## Definitions (populated by write #113)

_To be filled in after the spike completes._
