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
- expose a small pure seam through `parseObjectModuleBuffer(...)`

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

- [README.md](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/README.md)
- [docs/core-behavior-matrix.md](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/docs/core-behavior-matrix.md)
- [docs/assembler.md](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/docs/assembler.md)
- [docs/interpreter.md](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/docs/interpreter.md)
- [docs/linker.md](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/docs/linker.md)
- [docs/lcc.md](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/docs/lcc.md)
