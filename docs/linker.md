# Linker Module

`src/core/linker.js` combines one or more `.o` object modules into a single `.e` executable.

The linker is currently more wrapper-oriented than the assembler and interpreter, but it now has the start of a reusable pure seam.

## Public Roles

### CLI role

Direct CLI entrypoint:

```bash
node ./src/core/linker.js module1.o module2.o
node ./src/core/linker.js -o program.e module1.o module2.o
```

Wrapper responsibilities:

- parse CLI arguments
- read `.o` files from disk
- write the final `.e`
- print linking progress / error output
- map CLI failures to exit behavior

### Pure API role

Current reusable seam:

- `parseObjectModuleBuffer(buffer, filename = '<buffer>')`

This method parses an object-module buffer in memory and throws typed `LinkerError` failures.

## Current Main Methods

- `main(args)`
- `parseObjectModuleBuffer(buffer, filename)`
- `readObjectModule(filename)`
- `link(filenames, outputFileName)`
- `processModule(module)`
- `adjustExternalReferences()`
- `adjustLocalReferences()`
- `createExecutable()`

## Error Boundary

Typed reusable-path error:

- `LinkerError`

All linker error paths now throw `LinkerError`:

- `parseObjectModuleBuffer(...)` throws `LinkerError` on malformed input
- `readObjectModule(...)` catches parse failures and re-raises via `error()`, logging before re-throw
- `processModule(...)`, `adjustExternalReferences()` — call `error()` which logs and throws
- `link(...)` is fail-closed: any `LinkerError` thrown during linking propagates to the caller
- `lcc.js` wraps `linker.link()` in a try/catch for `LinkerError`, returning cleanly to preserve OG LCC's exit-0-on-linker-error behavior
- `main(...)` (direct CLI) remains wrapper/CLI-oriented and uses CLI exit behavior

## Current Preserved Behaviors

- object modules must begin with `o`
- duplicate global symbols are errors
- undefined external references are errors
- default output file name is `link.e`
- `-o` overrides the default output name

## Current Limitations

The linker is still the least refactored core module.

Open architectural questions:

- whether to add more pure seams beyond `parseObjectModuleBuffer(...)`
- whether the linker should remain mostly wrapper-oriented in the short term
- exact output-location policy when linking object files from different directories

## Internal Data Structures

The linker currently manages:

- `machineCode` — assembled machine code words
- `moduleCurrentAddress` — allocation pointer into `machineCode` (current module base address)
- `globalSymbolTable` — global symbol definitions (label → address)
- `externalReferenceTable11` — external references with 11-bit PC-relative addresses
- `externalReferenceTable9` — external references with 9-bit PC-relative addresses
- `virtualAddressTable` — external references with full 16-bit addresses
- `addressAdjustmentTable` — module-local references needing base-address relocation
- `start` — program entry-point address
- `gotStart` — whether an entry point has been seen
- `objectModules` — parsed object modules pending processing

These structures are still maintained directly inside the class rather than in extracted helper modules.

## Related Files

- [linker.js](../src/core/linker.js)
- [errors.js](../src/utils/errors.js)
- [linker.unit.spec.js](../tests/new/linker.unit.spec.js)
- [linker.oracle.e2e.spec.js](../tests/new/linker.oracle.e2e.spec.js)
