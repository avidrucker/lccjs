# Programmatic API

LCC.js exposes reusable in-memory APIs for every stage of the toolchain.
The CLI wrappers (`lcc.js`, `assembler.js`, `interpreter.js`, `linker.js`) are thin shells built on top of these APIs.

## Architecture overview

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
- `node ./src/cli/lcc.js file.a`

Design goals:

- Pure APIs throw typed errors; wrappers own console output, exit behavior, and file I/O.
- Report generation is centralized.
- `name.nnn` is a wrapper/report concern, not a pure execution concern.

## Assemble in memory

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

| Field | Description |
|-------|-------------|
| `inputFileName` | Resolved input file name |
| `outputFileName` | Resolved output file name |
| `isObjectModule` | `true` if assembled to `.o` |
| `startAddress` | Entry-point address |
| `loadPoint` | Load-point address |
| `symbolTable` | Map of label → address |
| `sourceMap` | `{ addressToLine, allLines }` — for trace/debug |
| `listing` | Array of listing lines |
| `outputBuffer` | Raw `Buffer` of machine words |
| `outputBytes` | `Uint8Array` of output bytes |
| `reports` | `{ lst, bst }` report strings (if `buildReports: true`) |

## Execute in memory

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

| Field | Description |
|-------|-------------|
| `inputFileName` | Resolved input file name |
| `output` | String of all program output (stdout) |
| `mem` | Final memory array |
| `registers` | Final register file `[r0..r7]` |
| `pc` | Final program counter |
| `instructionsExecuted` | Total step count |
| `maxStackSize` | Peak stack depth observed |
| `loadPoint` | Load-point address |
| `memMax` | Highest address written |
| `headerLines` | Lines extracted from the `.e` header |
| `reports` | `{ lst, bst }` report strings (if `buildReports: true`) |

## `name.nnn` behavior

LCC.js matches oracle behavior:

- `name.nnn` is resolved from the current working directory.
- It is only required when `.lst`/`.bst` reports are actually being written.
- Pure in-memory APIs do not require `name.nnn`.
