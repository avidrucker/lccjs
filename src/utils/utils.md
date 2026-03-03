# Utility Modules

The `src/utils` directory contains shared support modules used by the core toolchain, plus a few standalone inspection tools.

These utilities fall into two groups:

- architectural support used directly by `src/core`
- standalone analysis/debugging helpers for developers

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

- typed errors
- file artifact handling
- report generation
- `name.nnn` handling

This separation keeps the wrapper/core boundary easier to maintain and test.

## Related Docs

- [README.md](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/README.md)
- [src/core/core.md](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/src/core/core.md)
- [docs/core-behavior-matrix.md](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/docs/core-behavior-matrix.md)
