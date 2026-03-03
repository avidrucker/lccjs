# Interpreter Module

`src/core/interpreter.js` is the LCC.js interpreter for `.e` executables. It supports both direct CLI execution and reusable in-memory execution.

## Public Roles

### CLI role

Direct CLI entrypoint:

```bash
node ./src/core/interpreter.js program.e
node ./src/core/interpreter.js program.e -nostats
```

Wrapper responsibilities:

- parse CLI options
- read `.e` files from disk
- validate file type for direct CLI usage
- run the interpreter
- write `.lst` and `.bst` when stats are enabled
- resolve `name.nnn` only when reports are being written
- own console output and exit behavior

### Pure API role

Main reusable entrypoints:

- `executeBuffer(buffer, options)`
- `loadExecutableBuffer(buffer)`
- `buildReportArtifacts(userName, inputFileName = this.inputFileName, now)`

Pure API guarantees:

- no file reads
- no file writes
- no `name.nnn` lookup
- no required sibling files
- no interactive debugger entry during normal in-memory execution
- typed failures instead of CLI exits

## Main In-Memory API

### `executeBuffer(buffer, options)`

Executes an LCC executable image entirely in memory.

Common options:

- `inputFileName`
- `loadPoint`
- `inputBuffer`
- `buildReports`
- `userName`
- `now`
- `allowDebugOnInfiniteLoop`

Current reusable defaults:

- in-memory execution does not enter interactive debugger mode automatically
- runtime failures throw typed errors

Returned shape includes:

- `inputFileName`
- `output`
- `mem`
- `registers`
- `pc`
- `instructionsExecuted`
- `maxStackSize`
- `loadPoint`
- `memMax`
- `headerLines`
- `reports`

### `loadExecutableBuffer(buffer)`

Parses an executable image and loads it into interpreter memory without touching the filesystem.

### `buildReportArtifacts(...)`

Builds `.lst` and `.bst` report strings in memory using the shared report helper.

## Runtime and Debug Boundary

The interpreter distinguishes clearly between reusable execution and wrapper CLI behavior.

Typed reusable-path errors:

- `InvalidExecutableFormatError`
- `InterpreterRuntimeError`

Preserved behavior:

- invalid executable headers fail as executable-format errors
- division by zero reports `Floating point exception`
- infinite-loop detection is active
- pure in-memory execution does not enter debug mode automatically
- CLI runtime debugging is gated by TTY and wrapper configuration

Important current rule:

- `allowRuntimeDebugging` is wrapper/CLI-oriented
- in-memory execution should stop with an error instead of dropping into the debugger

## Current Preserved Behaviors

- direct `interpreter.js` only accepts `.e`
- invalid `.e` signature is rejected before `.lst` / `.bst` paths are printed
- `loadPoint` affects memory placement and PC calculation
- `inputBuffer` can drive `sin` in pure tests and reusable execution
- report generation is optional and in-memory capable
- `name.nnn` is only relevant when the wrapper writes reports

## `bp` and Debugger Status

The debugger behavior is only partially implemented.

Current state:

- `bp` is no longer treated as an always-fatal unimplemented trap
- CLI behavior is debugger-oriented
- in-memory behavior remains non-interactive

Still open:

- full oracle parity for `bp`
- exact non-interactive oracle continuation behavior
- final symbolic debugger feature completeness

## Internal Architecture

The interpreter is still a large stateful class, but the architecture already has useful seams:

- `executeBuffer(...)` is the main reusable execution seam
- `loadExecutableBuffer(...)` is the pure loader seam
- `main(...)` is the CLI wrapper
- report generation uses `src/utils/reportArtifacts.js`
- typed errors live in `src/utils/errors.js`

## Known Research / Parity Gaps

- exact oracle `sext` semantics
- full debugger parity
- some details of `bp` prompt/continuation behavior in oracle LCC

## Related Files

- [interpreter.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/src/core/interpreter.js)
- [reportArtifacts.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/src/utils/reportArtifacts.js)
- [errors.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/src/utils/errors.js)
- [interpreter.unit.spec.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/tests/new/interpreter.unit.spec.js)
- [interpreter.integration.spec.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/tests/new/interpreter.integration.spec.js)
- [interpreter.oracle.e2e.spec.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/tests/new/interpreter.oracle.e2e.spec.js)
