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

Current boundary:

- `parseObjectModuleBuffer(...)` throws `LinkerError`
- `readObjectModule(...)` catches typed parse failures and maps them into the current linker error flow
- `main(...)` remains wrapper/CLI-oriented and uses CLI exit behavior

This means linker is partially modernized, but not yet as purely separated as assembler/interpreter.

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

- `mca`
- `GTable`
- `ETable`
- `eTable`
- `VTable`
- `ATable`
- `start`
- `gotStart`
- `objectModules`

These structures are still maintained directly inside the class rather than in extracted helper modules.

## Related Files

- [linker.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/src/core/linker.js)
- [errors.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/src/utils/errors.js)
- [linker.unit.spec.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/tests/new/linker.unit.spec.js)
- [linker.oracle.e2e.spec.js](/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/tests/new/linker.oracle.e2e.spec.js)
