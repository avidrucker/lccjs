# Utility Modules

The `src/utils` directory contains shared support modules used by the core toolchain, plus a few standalone inspection tools.

These utilities fall into two groups:

- architectural support used directly by `src/core`
- standalone analysis/debugging helpers for developers

> This file is the **per-module** reference. For the **concern-by-concern** view
> — how these modules (plus shared mechanisms like the pure-seam boundary and the
> core↔plus seam) fit together as the project's cross-cutting concerns — see
> [`docs/cross-cutting-concerns.md`](../../docs/cross-cutting-concerns.md).

## Shared Architectural Utilities

### `errors.js`

Defines shared typed error classes for reusable in-memory APIs.

Current error types include:

- `LccError`
- `AssemblerError`
- `InterpreterRuntimeError`
- `InvalidExecutableFormatError`
- `LinkerError`

Purpose:

- give pure APIs a stable failure contract
- keep wrapper/CLI exit behavior separate from reusable logic

### `fileArtifacts.js`

Provides shared file-artifact helpers used by wrappers.

Current responsibilities:

- sibling output filename construction
- shared text/binary file reads and writes
- report-file writing helpers

Purpose:

- prevent repeated file-naming and file-writing logic in `assembler.js`, `interpreter.js`, and `lcc.js`

### `reportArtifacts.js`

Provides shared in-memory report generation for `.lst` and `.bst`.

Purpose:

- centralize report-content construction
- support deterministic report generation through injectable `now`
- let pure APIs generate reports without touching the filesystem

This helper is used by assembler-, interpreter-, and lcc-driven report paths.

### `genStats.js`

Contains the lower-level formatting logic used to generate listing/statistics content.

Purpose:

- render `.lst` / `.bst` output from assembler/interpreter state
- provide the formatting machinery used by `reportArtifacts.js`

### `name.js`

Handles `name.nnn` lookup and creation.

Current behavior:

- resolves `name.nnn` from the current working directory
- prompts for a name if the file is missing
- stores the name for use in `.lst` / `.bst` report headers

This cwd-based behavior matches the current oracle LCC behavior.

### `cliExit.js`

Shared CLI exit/error scaffolding for the **wrapper** side of the pure-seam
boundary: `isTestMode`, `fatalExit`, `cliErrorExit`, `cliWrappedErrorExit`.

Purpose:

- keep the exit contract consistent across assembler, interpreter, linker, lcc,
  ilcc, and the plus subclasses (edit it in one place, not eight)
- under Jest, `isTestMode` flips `fatalExit` from `process.exit` to a thrown
  Error so the test harness survives

### `errors.js` companion — the diagnostics surface

Three pure, I/O-free data/lookup modules render the toolchain's errors:

### `explanations.js`

The `--explain` catalog: student-friendly explanations keyed by a stable
`explainKey` set at the throw site (not by matching rendered message text).
Pure data + lookup. (#1096–#1100)

### `errorIds.js`

The append-only error-ID registries (`ASM_ERROR_IDS` / `INT_ERROR_IDS` /
`LNK_ERROR_IDS`; ids like `asm-NNN`), keyed by normalized message and surfaced
under `--show-err-id`. A published API — never renumber or reuse a retired id; a
coverage-guard test asserts every assembler error literal resolves here. (#1553, #1480)

### `suggest.js`

`levenshtein` + `suggestClosest` — the nearest valid token within an edit-distance
bound, used for "Did you mean?" suffixes on errors like "Bad label".

### `flagDiagnostics.js`

Per-flag warnings for CLI flags LCCjs knowingly handles differently from the
oracle (e.g. `-f` is a no-op). Full rationale lives in
[`docs/parity_deviations.md`](../../docs/parity_deviations.md). (#1371)

### `labelUtils.js`

`isValidLabelDefinition` — mirrors `assembler.js`'s label-validation rules so
other callers can test a line without the full assembler. Keep in lockstep with
the assembler grammar (#870).

### `formatter.js`

`formatLccSource` — normalizes LCC assembly source (labels to column 0, indented
bodies, trailing-whitespace stripped). Backs the playground formatter.

## Standalone Inspection Utilities

### `hexDisplay.js`

Displays a `.e` or `.o` file as a hex-oriented dump for inspection.

Useful for:

- debugging file contents
- inspecting headers and code bytes
- comparing artifacts during development

### `picture.js`

Displays a `.e` or `.o` file in a more structure-oriented textual format.

Useful for:

- quickly inspecting header entries
- understanding object/executable layout
- debugging file structure more readably than a raw hex dump

## How `src/utils` Fits the Current Architecture

The current architectural goal is:

- `src/core` owns assembly, execution, linking, and orchestration behavior
- `src/utils` owns shared support concerns that should not be duplicated across core modules

In practice, `src/utils` now holds the shared pieces for:

- typed errors + wrapper-side CLI exit scaffolding
- the error diagnostics surface (`--explain`, error ids, "did you mean?", flag deviations)
- file artifact handling
- report generation
- `name.nnn` handling
- shared assembler helpers (label validation, source formatting)

This separation keeps the wrapper/core boundary easier to maintain and test.

## Related Docs

- [README.md](../../README.md)
- [docs/cross-cutting-concerns.md](../../docs/cross-cutting-concerns.md) — concern-by-concern companion to this file
- [src/core/core.md](../../src/core/core.md)
- [docs/core-behavior-matrix.md](../../docs/core-behavior-matrix.md)
