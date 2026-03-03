# Assembler Module

`src/core/assembler.js` is the LCC.js assembler. It serves two roles:

- a CLI/file-oriented wrapper for `.a`, `.bin`, and `.hex` inputs
- a reusable in-memory assembler API used by tests and higher-level orchestration

## Public Roles

### CLI role

Direct CLI entrypoint:

```bash
node ./src/core/assembler.js program.a
node ./src/core/assembler.js program.hex
node ./src/core/assembler.js program.bin
```

Wrapper responsibilities:

- validate CLI usage and input extension expectations
- read source files from disk
- write `.e` or `.o` output files
- write `.lst` and `.bst` report files when applicable
- resolve `name.nnn` only when reports are being written
- map wrapper failures to console output and exit behavior

### Pure API role

Main reusable entrypoints:

- `assembleSource(sourceCode, options)`
- `toOutputBuffer(secondIntroHeader = '')`
- `buildReportArtifacts(userName, includeComments = false, now)`

Pure API guarantees:

- no file reads
- no file writes
- no `name.nnn` lookup
- no prompt / stdin interaction
- typed failures instead of CLI exits

## Main In-Memory API

### `assembleSource(sourceCode, options)`

Assembles source text completely in memory.

Common options:

- `inputFileName`
- `outputFileName`
- `buildReports`
- `userName`
- `includeComments`
- `now`
- `throwOnAssemblyError`

Current default behavior for reusable callers:

- `throwOnAssemblyError` defaults to `true`
- failures throw `AssemblerError`

Returned shape includes:

- `inputFileName`
- `outputFileName`
- `isObjectModule`
- `startAddress`
- `loadPoint`
- `symbolTable`
- `listing`
- `outputBuffer`
- `outputBytes`
- `reports`

### `toOutputBuffer(...)`

Serializes the current assembled state to executable or object-module bytes without writing a file.

### `buildReportArtifacts(...)`

Builds `.lst` and `.bst` content in memory using the shared report helper in `src/utils/reportArtifacts.js`.

## Internal Architecture

The assembler is still a large class, but the current design already separates some concerns:

- report generation uses `src/utils/reportArtifacts.js`
- file artifact naming and writing use `src/utils/fileArtifacts.js`
- typed errors live in `src/utils/errors.js`
- `assembleSource(...)` is the main reusable seam
- `main(...)` is the wrapper entrypoint

The assembler remains stateful across a run. `resetAssemblyState()` clears per-run state so the same instance can be reused safely.

## Error Boundary

Typed reusable-path error:

- `AssemblerError`

Boundary behavior:

- pure API path throws `AssemblerError`
- wrapper path uses CLI error handling helpers and exits

The bridging helper is:

- `abortAssembly(message, code)`

That helper throws in reusable mode and exits in wrapper mode.

## Current Preserved Behaviors

These behaviors are intentionally preserved and currently covered by tests:

- `.a`, `.bin`, and `.hex` are valid direct inputs
- non-`.a` textual assembly is rejected by direct `assembler.js`
- `.ap` is rejected with guidance to use `assemblerPlus.js`
- duplicate labels are errors
- undefined labels are errors
- label names are case-sensitive
- raw source lines over 300 characters are rejected
- `.global` / `.extern` can trigger `.o` output
- object-module flow writes `.o`, `.lst`, and `.bst`
- `.org` currently supports forward gaps with zero fill
- backward `.org` is rejected

## Known Research / Parity Gaps

These are still open and should not be treated as fully settled behavior:

- exact original-LCC 300-character line semantics
- whether comments count toward that limit in oracle LCC
- whether original LCC has a separate true label-length limit
- whether `.orig` should be supported as a synonym for `.org`
- whether LCC.js should match oracle’s exact 1-byte `o` artifact on `.org` failure

## Related Files

- [assembler.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/src/core/assembler.js)
- [reportArtifacts.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/src/utils/reportArtifacts.js)
- [fileArtifacts.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/src/utils/fileArtifacts.js)
- [errors.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/src/utils/errors.js)
- [assembler.unit.spec.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/tests/new/assembler.unit.spec.js)
- [assembler.cli.integration.spec.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/tests/new/assembler.cli.integration.spec.js)
