# LCC.js

LCC.js is a JavaScript implementation of the LCC assembler / linker / interpreter toolchain for a simple 16-bit educational machine. The project now supports both file-oriented CLI usage and in-memory programmatic usage, with a growing test suite and oracle-driven parity work against the original LCC.

## What This Repo Contains

- `src/core`
  - `assembler.js`: assembles `.a`, `.bin`, and `.hex`
  - `interpreter.js`: executes `.e`
  - `linker.js`: links `.o` files into `.e`
  - `lcc.js`: top-level orchestrator for assemble / link / execute flows
- `src/utils`
  - shared report generation, file artifact helpers, typed errors, `name.nnn` handling, and analysis utilities
- `src/plus`
  - LCC+ variants for the extended `.ap` / `.ep` toolchain
- `tests/new`
  - current unit, integration, oracle/e2e, and research-marked tests
- `experiments`
  - focused oracle experiments for ambiguous or parity-sensitive behavior such as `.org`, `bp`, and `sext`

## Current Architecture

The core refactor has already established a clean split between reusable logic and CLI wrappers.

Current reusable in-memory APIs:

- `Assembler#assembleSource(sourceText, options)`
- `Assembler#toOutputBuffer()`
- `Assembler#buildReportArtifacts(userName, includeComments, now)`
- `Interpreter#executeBuffer(buffer, options)`
- `Interpreter#buildReportArtifacts(userName, inputFileName, now)`
- `Linker#parseObjectModuleBuffer(buffer, filename)`

Current wrapper entrypoints:

- `node ./src/core/assembler.js file.a`
- `node ./src/core/interpreter.js file.e`
- `node ./src/core/linker.js file1.o file2.o`
- `node ./src/core/lcc.js file.a`

The design goal is:

- pure APIs throw typed errors
- wrappers own console output, exit behavior, and file I/O
- report generation is centralized
- `name.nnn` is a wrapper/report concern, not a pure execution concern

## Installation

Requirements:

- Node.js

Install dependencies:

```bash
npm install
```

## CLI Usage

### `lcc.js`

Assemble and run an assembly program:

```bash
node ./src/core/lcc.js demos/demoA.a
```

Run an executable directly:

```bash
node ./src/core/lcc.js demos/demoA.e
```

Link object modules:

```bash
node ./src/core/lcc.js module1.o module2.o
node ./src/core/lcc.js -o custom.e module1.o module2.o
```

Supported options currently include:

- `-d`
- `-m`
- `-r`
- `-f`
- `-x`
- `-t`
- `-l<hexloadpoint>`
- `-o <outfile>`
- `-h`
- `-nostats`

### `assembler.js`

```bash
node ./src/core/assembler.js demos/demoA.a
node ./src/core/assembler.js somefile.hex
node ./src/core/assembler.js somefile.bin
```

Output is written beside the input file as `.e` or `.o`. Object-module assembly also writes `.lst` and `.bst`.

### `interpreter.js`

```bash
node ./src/core/interpreter.js demos/demoA.e
node ./src/core/interpreter.js demos/demoA.e -nostats
```

When stats are enabled, the wrapper writes sibling `.lst` and `.bst` files.

### `linker.js`

```bash
node ./src/core/linker.js module1.o module2.o
node ./src/core/linker.js -o program.e module1.o module2.o
```

If no output file is provided, the default is `link.e`.

## Programmatic Usage

### Assemble in memory

```js
const Assembler = require('./src/core/assembler');

const assembler = new Assembler();
const result = assembler.assembleSource(`
  mov r0, 5
  dout r0
  halt
`, {
  inputFileName: 'demoA.a',
  buildReports: true,
  userName: 'Drucker, Avi',
});

console.log(result.outputBytes);
console.log(result.reports.lst);
```

`assembleSource(...)` returns structured data including:

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

### Execute in memory

```js
const Interpreter = require('./src/core/interpreter');

const interpreter = new Interpreter();
const result = interpreter.executeBuffer(executableBuffer, {
  inputFileName: 'demoA.e',
  inputBuffer: 'hello\n',
  buildReports: true,
  userName: 'Drucker, Avi',
});

console.log(result.output);
console.log(result.instructionsExecuted);
```

`executeBuffer(...)` returns structured runtime state including:

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

## Testing

Primary test suite:

```bash
npm test
```

Other useful commands:

```bash
npm run test:all
npm run test:legacy
npm run test:oracle
```

Current test organization under `tests/new` includes:

- unit tests for pure helpers and pure APIs
- integration tests for wrapper behavior and file artifacts
- oracle/e2e tests for compatibility checks
- research-marked tests for ambiguous behavior still under investigation

Examples:

```bash
npm test -- --runTestsByPath tests/new/assembler.unit.spec.js
npm test -- --runTestsByPath tests/new/lcc.oracle.e2e.spec.js
```

## Oracle Parity Work

The repo contains oracle-driven research tooling under `experiments/`.

Use it when behavior is ambiguous or not yet fully matched:

- `.org`
- `bp`
- `sext`
- debugger-related behavior
- other original-LCC drift questions

See:

- [experiments/README.md](./experiments/README.md)
- [experiments/results.md](./experiments/results.md)
- [experiments/debugger-results.md](./experiments/debugger-results.md)

## `name.nnn` Behavior

LCC.js now matches oracle behavior here:

- `name.nnn` is resolved from the current working directory
- it is only required when `.lst` / `.bst` reports are actually being written
- pure in-memory APIs do not require `name.nnn`

This matters for CLI use, tests, and oracle comparisons.

## Current Status

The codebase is mid-refactor, but already in a usable state.

Implemented and stable enough to rely on:

- in-memory assembly and execution seams
- centralized report generation
- centralized file artifact helpers
- typed error classes for pure reusable paths
- categorized assembler integration coverage
- oracle-backed research workflow

Still actively being refined:

- deeper decomposition of `src/core/assembler.js`
- deeper decomposition of `src/core/interpreter.js`
- remaining linker boundary cleanup and modularity work
- exact oracle parity for some behaviors such as `sext`
- full symbolic debugger parity

## Known Parity / Research Areas

Areas that still require active research or refinement:

- exact oracle `sext` semantics
- final `bp` parity and debugger interaction details
- some original-LCC edge cases around line-length parsing
- some linker output-location behavior
- whether to match oracle’s exact artifact behavior on certain assembly failures

The current source of truth for active behavior contracts is:

- [docs/core-behavior-matrix.md](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/docs/core-behavior-matrix.md)

## Additional Docs

- [docs/assembler.md](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/docs/assembler.md)
- [docs/interpreter.md](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/docs/interpreter.md)
- [docs/lcc.md](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/docs/lcc.md)
- [docs/linker.md](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/docs/linker.md)
- [src/core/core.md](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/src/core/core.md)
- [src/utils/utils.md](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/src/utils/utils.md)

## License

MIT
