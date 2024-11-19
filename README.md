**All assembler, interpreter, and lcc test suites are currently passing at 100%!**

# LCC.js
LCC.js is a JavaScript implementation of a simple assembler, linker, and interpreter for a virtual assembly language and machine architecture inspired by educational projects like the Low Cost Computer (LCC) by Professor Anthony Dos Reis. The main goal of LCC.js is to provide a learning tool for understanding the fundamentals of assembly language programming, machine code generation, and instruction execution in a high-level programming language environment.

## Goals
- **Educational Purpose**: Serve as a learning resource for students and enthusiasts to understand how assemblers and interpreters work at a fundamental level.
- **JavaScript Implementation**: Leverage the ubiquity and accessibility of JavaScript to make the tool widely available without the need for specialized compilers, libraries, or environments (GLIBC, I'm looking at you).
- **Feature Parity with Original LCC**: Aim to replicate the functionality of the original LCC assembler, linker, and interpreter while providing modern conveniences and coding practices.
- **Cross-Platform Compatibility**: Ensure that the tool works consistently across different operating systems (Windows, macOS, Linux) by using Node.js (no more "It doesn't work for my architecture.").

## Differences from LCC
- **Programming Language**: LCC.js is implemented in JavaScript using Node.js, whereas the original LCC is was implemented in C.
- **Platform Independence**: Runs on any platform that supports Node.js, eliminating the need for platform-specific binaries or compilers.
- **Ease of Use**: Simplifies execution by using command-line scripts without the need for compilation steps.

## Components
- **lcc.js**: Main program that combines assembling and interpreting. **Recommended** way to build and run your assembly code.
- **Assembler (assembler.js)**: Translates `.a` assembly language source code into executable files with a `.e` extension. Also generates `.o` object files from object modules.
- **Linker (linker.js)**: Combines multiple `.o` object files into a single executable `.e` file for execution.
- **Interpreter (interpreter.js)**: Executes the `.e` files generated by the assembler/linker, simulating the behavior of the virtual machine architecture.

## Usage Instructions

### Prerequisites

- **Node.js**: Ensure that Node.js is installed on your system. You can download it from [nodejs.org](https://nodejs.org/).

### Compiling and Running Source Code with lcc.js (Recommended)

To assemble and execute an assembly language source file (e.g., `program.a`) in one step:

```bash
node lcc.js program.a
```

This command will assemble `program.a` to produce an executable file `program.e`, execute it, and also generate `.lst` and `.bst` report files.

#### Example
Compile and run `demoB.a`:

```bash
node lcc.js demoB.a
```

### Assembling Source Code Separately
To assemble an assembly language source file without executing it:

```bash
node assembler.js program.a
```

This command will produce an executable file named `program.e` in the same directory.

#### Example
Assemble a1test.a:

```bash
node assembler.js a1test.a
```

### Running the Interpreter
To execute the assembled machine code file using the interpreter:

```bash
node interpreter.js program.e
```

#### Example
Run a1test.e:

```bash
node interpreter.js a1test.e
```

## File Descriptions
### lcc.js
- **Purpose**: The main program that orchestrates assembling and interpreting. It determines the file type based on the extension and performs the appropriate actions.
- **Usage**: node lcc.js <input_file>
- **Features**:
  - Automatically assembles .a files and then executes them.
  - Can execute pre-assembled .e~~, .hex, or .bin~~ files.
  - Generates .lst and .bst files with detailed listings and outputs.
### assembler.js
- **Purpose**: Reads assembly language source files, processes them in two passes to handle symbol definitions and instructions, and outputs machine code executable files.
- **Usage**: node assembler.js <source_file>
- **Features**:
  - Handles labels, directives (e.g., .zero, .word), and instructions.
  - Performs error checking with detailed messages and line numbers.
  - Writes machine code directly to the output file during Pass 2.
### interpreter.js
- **Purpose**: Loads machine code executable files into memory and simulates the execution of instructions on a virtual machine architecture.
- **Usage**: node interpreter.js <executable_file>
- **Features**:
  - Simulates registers, memory, and flags (negative, zero, carry, overflow).
  - Supports a set of instructions including arithmetic, logical, control flow, and trap routines.
  - Outputs the results of the executed program to the console.
### linker.js
- **Purpose**: Combines multiple object files into a single executable file for execution.
- **Usage**: node linker.js <object_file1> <object_file2> ... <object_fileN>
- **Features**:
  - Merges object files into a single executable file.
  - Resolves external references and updates addresses.
  - Generates a combined executable file for the interpreter to execute.

## Understanding the Architecture
The virtual machine architecture includes:

- **Registers**: Eight general-purpose registers (r0 to r7), each 16 bits wide.
- **Memory**: 65,536 words of memory (16-bit words).
- **Instruction Set**: A set of instructions with opcodes for operations like ADD, AND, LD, ST, BR, JMP, etc.
- **Flags**: Negative (N), Zero (Z), Carry (C), and Overflow (V) flags affected by certain operations.

## Extending LCC.js
You can extend LCC.js by:

- **Adding New Instructions**: Modify the assembler and interpreter to recognize and handle new opcodes and instruction formats.
- **Enhancing Error Handling**: Improve the feedback provided to users when assembly or runtime errors occur.
- **Building a Debugger**: Implement features to step through instructions, inspect registers and memory, and set breakpoints.
- **Expand the Test Suite**: Create additional test cases to cover edge cases and ensure the correctness of the implementation.

## Conclusion
LCC.js provides a practical way to explore low-level programming concepts using high-level languages. By assembling and interpreting assembly code, users can gain insights into how compilers and processors handle code execution, making it a valuable educational tool.

## License
This project is provided for educational purposes and does not include any warranty. Use it at your own risk.

## Disclaimer
This project is not affiliated with or endorsed by Professor Anthony Dos Reis or any educational institution. It is an independent effort to create a learning resource for assembly language programming.

## Contact
For questions or contributions, please open an issue or submit a pull request on the project's repository.