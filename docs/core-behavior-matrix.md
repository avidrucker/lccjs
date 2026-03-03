# Core Behavior Matrix

This document records the current behavior contract for the `src/core` modules during the wave-2 refactor.

It is intentionally descriptive, not aspirational. Its purpose is to separate:

- behavior we actively preserve
- behavior that is wrapper-only
- behavior that is pure-API-only
- behavior that is ambiguous and still needs research

## Classification Legend

- `Preserve`: current LCC.js behavior that should remain stable during refactors
- `Wrapper-only`: behavior that belongs to CLI/file-orchestration paths, not pure APIs
- `Pure API`: behavior exposed by in-memory reusable methods
- `Research`: behavior known to be ambiguous, inconsistent, or not yet reconciled with original LCC

## Assembler

### Parsing and validation

- `Preserve`: `assembler.js` accepts `.a`, `.bin`, and `.hex` as direct inputs
- `Preserve`: direct `assembler.js` rejects non-`.a` textual assembly inputs with `Unsupported file type`
- `Preserve`: direct `assembler.js` rejects `.ap` inputs with the `assemblerPlus.js` guidance message
- `Preserve`: duplicate labels are errors
- `Preserve`: undefined labels are errors
- `Preserve`: line length over 300 characters is an error in current LCC.js
- `Preserve`: label names are case-sensitive
- `Preserve`: comments-only files do not crash
- `Research`: original LCC behavior for the 300-character limit
- `Research`: whether original LCC has a true label-length limit distinct from the per-line limit
- `Research`: `.org` / `.orig` semantics and parity

### Object modules and output

- `Preserve`: `.global` / `.extern` can cause `.o` output
- `Preserve`: object-module flow writes `.o`, `.lst`, and `.bst`
- `Pure API`: `assembleSource(...)` returns structured output metadata, words, bytes, and optional reports
- `Pure API`: `toOutputBuffer()` returns serialized output bytes without writing files
- `Pure API`: `buildReportArtifacts(...)` returns report strings without writing files

### Wrapper boundaries

- `Wrapper-only`: CLI argument validation and usage output
- `Wrapper-only`: source file reads
- `Wrapper-only`: output file writes
- `Wrapper-only`: `name.nnn` lookup/creation when report artifacts are written

## Interpreter

### Executable loading and runtime

- `Preserve`: direct `interpreter.js` only accepts `.e` inputs
- `Preserve`: invalid `.e` signature is rejected before `.lst` / `.bst` paths are printed
- `Preserve`: division by zero reports `Floating point exception`
- `Preserve`: unsupported trap vectors are runtime errors
- `Preserve`: infinite-loop detection is active
- `Preserve`: pure in-memory execution does not enter debug mode automatically
- `Pure API`: `executeBuffer(...)` executes without requiring sibling files
- `Pure API`: `executeBuffer(...)` returns structured runtime state and optional reports
- `Pure API`: `buildReportArtifacts(...)` returns report strings without writing files

### Header parsing

- `Preserve`: invalid signature is an executable-format error
- `Preserve`: incomplete `S`, `G`, and `A` entries are executable-format errors
- `Preserve`: unknown header entries are executable-format errors
- `Preserve`: `loadPoint` affects memory placement and PC calculation

### Wrapper boundaries

- `Wrapper-only`: CLI option parsing
- `Wrapper-only`: executable file reads
- `Wrapper-only`: report file writes
- `Wrapper-only`: `name.nnn` creation only when stats are being written
- `Wrapper-only`: TTY-gated debug behavior in the CLI path

## LCC

### Orchestration

- `Preserve`: `.hex` and `.bin` assemble then execute
- `Preserve`: `.e` executes directly
- `Preserve`: first `.o` argument routes to linking behavior
- `Preserve`: `.a` and other textual source routes through assembly
- `Preserve`: `.a` files that assemble to `.e` are then executed automatically
- `Preserve`: `.a` files that assemble to `.o` are not executed

### Report/name behavior

- `Preserve`: `name.nnn` is only needed when reports are actually written
- `Preserve`: linking object files does not require `name.nnn`
- `Wrapper-only`: report file naming and report writes

## Linker

### Current stable behavior

- `Preserve`: object modules are expected to begin with `o`
- `Preserve`: duplicate global symbols are errors
- `Preserve`: undefined external references are errors
- `Preserve`: default output file name is `link.e`
- `Preserve`: `-o` overrides the default linker output name

### Current limitations

- `Research`: output location behavior when linking object files from different directories
- `Research`: whether additional pure seams should be introduced or linker should remain mostly wrapper-oriented in the short term

## Testing implications

The current testing strategy should continue to split coverage as follows:

- unit tests for pure helpers and pure API behavior
- integration tests for wrapper behavior and file artifacts
- oracle/e2e tests for compatibility checks
- research-marked skipped tests for ambiguous behavior
