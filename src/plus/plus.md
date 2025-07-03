assemblerplus.js

Subclasses the core assembler to support .ap (LCC+) files. Implements special handling for new pseudo-instructions (clear, sleep, nbain, cursor, srand, rand, millis, resetc) and enforces a .lccplus directive for output validity. Overrides handleInstruction, handleDirective, and writeOutputFile to inject extended opcodes and metadata into .ep binaries.

interpreterplus.js

Subclasses the core interpreter to run .ep LCC⁺ executables. Adds non-blocking keyboard input, trap handlers for new pseudo-instructions (clear, sleep, nbain, cursor, srand, millis, resetc), and a linear congruential RNG. Provides a cooperative loop to process instructions in batches, enabling responsive I/O during simulation.

lccplus.js

Provides a one-shot CLI driver for LCC⁺ workflows. Automatically assembles .ap source files into .ep executables using AssemblerPlus and immediately runs them with InterpreterPlus. Also supports direct interpretation of .ep files. Validates input extensions and orchestrates the end-to-end pipeline.
