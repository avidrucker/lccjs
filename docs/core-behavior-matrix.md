# Core Behavior Matrix

This document records the current behavior contract for the `src/core` modules.

It is intentionally descriptive, not aspirational. Its purpose is to separate:

- behavior we actively preserve
- behavior that belongs only to CLI/file wrappers
- behavior exposed by pure in-memory APIs
- behavior that is still under oracle/parity research

## Classification Legend

- `Preserve`: current LCC.js behavior that should remain stable during refactors
- `Wrapper-only`: behavior that belongs to CLI/file-orchestration paths, not pure APIs
- `Pure API`: behavior exposed by in-memory reusable methods
- `Research`: behavior that is still ambiguous, intentionally custom, or not yet fully reconciled with original LCC

## Assembler

### Parsing and validation

- `Preserve`: direct `assembler.js` accepts `.a`, `.bin`, and `.hex`
- `Preserve`: direct `assembler.js` rejects non-`.a` textual source with `Unsupported file type`
- `Preserve`: direct `assembler.js` rejects `.ap` with the `assemblerPlus.js` guidance message
- `Preserve`: duplicate labels are errors
- `Preserve`: undefined labels are errors
- `Preserve`: label names are case-sensitive
- `Preserve`: comments-only and whitespace-only source files do not crash
- `Preserve`: line length over 300 raw characters is an error in current LCC.js
- `Preserve`: `.org` is implemented for forward gaps by padding with zero words
- `Preserve`: backward `.org` is rejected with `Backward address on .org`
- `Preserve`: invalid non-numeric `.org` operands are rejected with `Invalid number for .org directive`
- `Preserve`: repeated forward `.org` directives within range are allowed
- `Research`: original LCC behavior for the 300-character limit
- `Research`: whether original LCC has a true label-length limit distinct from the per-line limit
- `Research`: whether `.orig` should be treated as a synonym for `.org`
- `Research`: whether LCC.js should match oracle’s 1-byte `o` artifact on certain `.org` failures

### Object modules and output

- `Preserve`: `.global` / `.extern` can cause `.o` output
- `Preserve`: object-module flow writes `.o`, `.lst`, and `.bst`
- `Pure API`: `assembleSource(...)` returns structured output metadata, words, bytes, and optional reports
- `Pure API`: `toOutputBuffer()` returns serialized output bytes without writing files
- `Pure API`: `buildReportArtifacts(...)` returns report strings without writing files

### Error boundary

- `Preserve`: pure assembly paths throw typed `AssemblerError` failures
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
- `Preserve`: CLI runtime debugging is TTY-gated
- `Preserve`: `bp` is no longer treated as a fatal unimplemented trap in the CLI path
- `Pure API`: `executeBuffer(...)` executes without requiring sibling files
- `Pure API`: `executeBuffer(...)` returns structured runtime state and optional reports
- `Pure API`: `buildReportArtifacts(...)` returns report strings without writing files

### Header parsing

- `Preserve`: invalid signature is an executable-format error
- `Preserve`: incomplete `S`, `G`, and `A` entries are executable-format errors
- `Preserve`: unknown header entries are executable-format errors
- `Preserve`: `loadPoint` affects memory placement and PC calculation

### Error boundary

- `Preserve`: pure interpreter paths throw typed `InvalidExecutableFormatError` or `InterpreterRuntimeError`
- `Wrapper-only`: CLI option parsing
- `Wrapper-only`: executable file reads
- `Wrapper-only`: report file writes
- `Wrapper-only`: `name.nnn` creation only when stats are being written

### Research

- `Research`: exact oracle `bp` continuation / prompt behavior in non-interactive runs
- `Research`: exact oracle `sext` semantics
- `Research`: full symbolic debugger parity

## LCC

### Orchestration

- `Preserve`: `.hex` and `.bin` assemble then execute
- `Preserve`: `.e` executes directly
- `Preserve`: first `.o` argument routes to linking behavior
- `Preserve`: `.a` and other textual source routes through assembly
- `Preserve`: `.a` files that assemble to `.e` are then executed automatically
- `Preserve`: `.a` files that assemble to `.o` are not executed

### Report and `name.nnn` behavior

- `Preserve`: `name.nnn` is only needed when reports are actually written
- `Preserve`: linking object files does not require `name.nnn`
- `Preserve`: `name.nnn` resolution is based on the current working directory, matching oracle behavior
- `Wrapper-only`: report file naming and report writes

### Error boundary

- `Wrapper-only`: `lcc.js` remains an orchestration CLI and owns wrapper error/exit mapping

## Linker

### Current stable behavior

- `Preserve`: object modules are expected to begin with `o`
- `Preserve`: duplicate global symbols are errors
- `Preserve`: undefined external references are errors
- `Preserve`: default output file name is `link.e`
- `Preserve`: `-o` overrides the default linker output name
- `Pure API`: `parseObjectModuleBuffer(buffer, filename)` parses object-module bytes and throws typed `LinkerError` failures

### Current limitations

- `Preserve`: the main linker flow is still more wrapper-oriented than assembler/interpreter
- `Research`: output location behavior when linking object files from different directories
- `Research`: whether to add more pure seams or keep the linker mostly wrapper-oriented in the short term

## Testing Implications

The current testing strategy should continue to split coverage as follows:

- unit tests for pure helpers and pure API behavior
- integration tests for wrapper behavior and file artifacts
- oracle/e2e tests for compatibility checks
- research-marked skipped tests for ambiguous behavior
