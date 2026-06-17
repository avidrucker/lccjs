# Core Modules

The `src/core` directory contains the main LCC.js toolchain modules:

- `assembler.js`
- `interpreter.js`
- `linker.js`
- `lcc.js`

These modules are the primary implementation of the standard LCC.js workflow.

## Module Roles

### `assembler.js`

Responsible for translating source input into machine-code output.

Current responsibilities:

- assemble `.a` source files
- parse `.bin` and `.hex` inputs
- generate `.e` or `.o` output
- support in-memory assembly through `assembleSource(...)`

#### `assembleSource()` per-call config contract

Per-run configuration must be passed as `assembleSource(source, options)` **options**, not
pre-set on the instance. The relevant fields are:

- `inputFileName`, `outputFileName`
- `listingLoadPoint` — the `-l<hex>` display offset (#1238)
- `verboseModeOn`, `explainModeOn`, `userName` (#1277)
- `onProgress` — the pass-banner sink (#1397)

**Why setting them on the instance first is silently wiped:** `assembleSource()` calls
`resetAssemblyState()` as its first step, which clears every per-run field. The seam then
re-applies the caller-provided values from `options` *after* the reset. So a field assigned
to the instance before the call is cleared before the passes run; an omitted option means
"this run has none" (default off / `0` / `null`), never a value inherited from a prior
assembly on the same instance. The CLI path (`main()`) threads these through the options for
exactly this reason.

The instance fields still exist and are read during/after assembly — e.g.
`formatAssemblerError` reads `this.explainModeOn`, and `main()`'s object-module report
consumes `this.userName` after `assembleSource()` returns — but it is the option, applied
after the reset, that puts the right value there. Single point of truth for the field list:
`resetAssemblyState()` (#1423).

### `interpreter.js`

Responsible for executing `.e` executables on the simulated LCC machine.

Current responsibilities:

- load and validate executable images
- execute instructions and traps
- enforce runtime protections such as infinite-loop detection
- support in-memory execution through `executeBuffer(...)`

### `linker.js`

Responsible for combining one or more `.o` object modules into a single `.e` executable.

Current responsibilities:

- parse object-module headers and code
- resolve global and external references
- adjust addresses and create a final executable
- expose pure seams: `parseObjectModuleBuffer(...)` (one `.o` buffer → module) and
  `linkObjectModules(buffers, options) → { outputBytes }` (link `.o` buffers → `.e` image),
  both throwing typed `LinkerError`; the CLI wrapper (`link`/`main`) owns file I/O,
  progress logs, and exit codes

### `lcc.js`

Responsible for orchestrating the standard end-to-end workflow.

Current responsibilities:

- choose assemble / link / execute behavior from input type
- coordinate the assembler, linker, and interpreter
- own top-level CLI option parsing
- own report-writing orchestration

## Current Architectural Direction

The core modules are being refactored toward a clearer boundary:

- reusable in-memory APIs throw typed errors
- CLI/wrapper paths own console output, exit behavior, and file I/O
- shared concerns such as report generation and artifact naming live in `src/utils`

At the moment:

- `assembler.js` and `interpreter.js` already have meaningful pure seams
- `linker.js` has begun that transition but is still more wrapper-oriented
- `lcc.js` remains intentionally orchestration-focused rather than becoming a pure library surface

## Related Docs

- [README.md](../../README.md)
- [docs/core-behavior-matrix.md](../../docs/core-behavior-matrix.md)
- [docs/assembler.md](../../docs/assembler.md)
- [docs/interpreter.md](../../docs/interpreter.md)
- [docs/linker.md](../../docs/linker.md)
- [docs/lcc.md](../../docs/lcc.md)
