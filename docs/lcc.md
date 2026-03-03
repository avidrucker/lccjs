# LCC Orchestrator Module

`src/core/lcc.js` is the top-level CLI orchestrator for the standard LCC.js toolchain. It coordinates assembly, linking, execution, and report generation based on the input file type.

## Role

Unlike `assembler.js` and `interpreter.js`, `lcc.js` is not intended to be the main pure reusable seam. Its job is orchestration.

Primary responsibilities:

- parse CLI options
- choose the correct toolchain path based on input type
- create and coordinate `Assembler`, `Interpreter`, and `Linker` instances
- enable report generation when appropriate
- resolve `name.nnn` only when reports are being written
- preserve current CLI-facing behavior

## Current Routing Behavior

`handleSingleFile(...)` currently routes as follows:

- `.hex` and `.bin`
  - assemble
  - then execute
- `.e`
  - execute directly
- first argument `.o`
  - link object files
- `.a` or other textual source
  - assemble
  - then execute only if the assembler produced `.e`

Preserved wrapper behavior:

- `.a` sources that assemble to `.o` are not executed
- linking object files does not require `name.nnn`
- reports are only built when the wrapper is actually writing them

## Main Methods

- `main(args)`
- `parseArguments(args)`
- `handleSingleFile(infile)`
- `linkObjectFiles(objectFiles)`
- `assembleFile()`
- `executeFile(includeSourceCode, includeComments)`
- `resolveUserName(inputFileName = this.inputFileName)`
- `buildReportArtifacts(includeSourceCode, includeComments, now)`

## Error Boundary

`lcc.js` is intentionally wrapper-oriented.

Current error helpers:

- `cliErrorExit(...)`
- `cliWrappedErrorExit(...)`

Current boundary:

- `lcc.js` owns console output and exit behavior
- lower-level reusable APIs are expected to throw typed errors
- `lcc.js` catches wrapper-facing failures and maps them to current CLI behavior

## Report and `name.nnn` Behavior

Current preserved behavior:

- `name.nnn` is only needed when `.lst` / `.bst` files are being written
- `name.nnn` resolution is cwd-based to match oracle behavior
- the wrapper can build reports using shared `src/utils/reportArtifacts.js`
- report naming and writing are wrapper-only concerns

## CLI Options

`lcc.js` currently accepts and routes these switches:

- `-d`
- `-m`
- `-r`
- `-f`
- `-x`
- `-t`
- `-nostats`
- `-h`
- `-o <outfile>`
- `-l<hexloadpoint>`

Some option behavior is already covered well by tests; some still need additional cleanup and documentation verification.

## Internal Dependencies

`lcc.js` coordinates:

- [assembler.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/src/core/assembler.js)
- [interpreter.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/src/core/interpreter.js)
- [linker.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/src/core/linker.js)
- [reportArtifacts.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/src/utils/reportArtifacts.js)
- [fileArtifacts.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/src/utils/fileArtifacts.js)
- [name.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/src/utils/name.js)

## Current Status

`lcc.js` is already relatively thin compared with `assembler.js` and `interpreter.js`, and that is the intended direction.

Still open:

- some option behavior needs deeper verification/documentation
- linker output-location behavior still needs clearer definition
- `lcc.js` should stay orchestration-only as deeper core decomposition continues

## Related Tests

- [lcc.unit.spec.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/tests/new/lcc.unit.spec.js)
- [lcc.integration.spec.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/tests/new/lcc.integration.spec.js)
- [lcc.oracle.e2e.spec.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/tests/new/lcc.oracle.e2e.spec.js)
