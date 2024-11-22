# **LCC.js - An Educational Assembler and Interpreter**

## **Overview**

LCC.js is a JavaScript-based assembler and interpreter for a simple virtual machine architecture. Inspired by educational projects like the Low-Cost Computer (LCC), it provides a platform for learning assembly language programming and understanding how high-level code translates to machine operations.

## **Table of Contents**

1. [Features](#features)
2. [Getting Started](#getting-started)
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)
3. [Usage](#usage)
   - [Assembling and Running Code with lcc.js](#assembling-and-running-code-with-lccjs)
   - [Using assembler.js and interpreter.js Separately](#using-assemblerjs-and-interpreterjs-separately)
4. [Understanding the Components](#understanding-the-components)
   - [lcc.js](#lccjs)
   - [assembler.js](#assemblerjs)
   - [interpreter.js](#interpreterjs)
5. [Architecture Details](#architecture-details)
   - [Registers and Memory](#registers-and-memory)
   - [Instruction Set](#instruction-set)
6. [Contributing](#contributing)
   - [Areas for Improvement](#areas-for-improvement)
7. [License](#license)
8. [Contact](#contact)

## **Features**

- **Educational Focus**: Ideal for learning the basics of assembly language and machine architecture.
- **Cross-Platform**: Runs on any system with Node.js installed.
- **Modular Design**: Separate components for assembling, linking (planned), and interpreting.
- **Extensible**: Easy to add new instructions and features.

## **Getting Started**

### **Prerequisites**

- **Node.js**: Download and install from [nodejs.org](https://nodejs.org/).

### **Installation**

Clone the repository:

```bash
git clone git@github.com:avidrucker/lccjs.git
cd lccjs
```

## **Usage**

### **Assembling and Running Code with lcc.js**

Compile and execute an assembly language file:

```bash
node lcc.js path/to/yourfile.a
```

### **Using assembler.js and interpreter.js Separately**

**Assemble the code**:

```bash
node assembler.js path/to/yourfile.a
```

**Run the executable**:

```bash
node interpreter.js path/to/yourfile.e
```

## **Understanding the Components**

### **lcc.js**

- **Purpose**: Orchestrates the assembly and execution process.
- **Functionality**: Detects file types, assembles code if necessary, and runs the interpreter.

### **assembler.js**

- **Purpose**: Translates assembly code into machine code.
- **Key Features**:
  - Two-pass assembly process.
  - Symbol table generation.
  - Error detection and reporting.

### **interpreter.js**

- **Purpose**: Simulates execution of machine code on a virtual machine.
- **Key Features**:
  - Simulated registers and memory.
  - Implements a basic instruction set.
  - Handles I/O operations.

## **Architecture Details**

### **Registers and Memory**

- **Registers**: 8 general-purpose registers (`r0` to `r7`), including special roles for `sp` (stack pointer), `fp` (frame pointer), and `lr` (link register).
- **Memory**: 65,536 words of addressable memory.

### **Instruction Set**

- **Arithmetic Operations**: `ADD`, `SUB`, `MUL`, `DIV`.
- **Logical Operations**: `AND`, `OR`, `NOT`, `XOR`.
- **Data Movement**: `LD`, `ST`, `MOV`, `LEA`.
- **Control Flow**: `BR`, `JMP`, `JSR`, `RET`.
- **I/O Operations**: `TRAP` routines for input/output.
- **Stack Operations**: `PUSH`, `POP`.

## **Contributing**

### **Areas for Improvement**

- **Linker Test Suite**: Developing `linker.test.js` and `linkerBattery.test.js` to link multiple object files.
- **Instruction Set Expansion**: Adding more instructions like shift and rotate operations.
- **Enhanced Error Handling**: Improving error messages and diagnostics.
- **Debugging Tools**: Implementing a symbolic debugger.

### **How to Contribute**

1. **Fork the Repository**: Create your own fork of the project.
2. **Create a Branch**: Work on a new feature or fix in a separate branch.
3. **Submit a Pull Request**: When ready, submit a PR with a clear description of your changes.

## **License**

This project is open-source and available under the MIT License.

## **Contact**

For questions or feedback, please open an issue.