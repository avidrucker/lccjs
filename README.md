# **LCC.js & LCC+js - An Educational Assembler and Interpreter**

## **Overview**

**LCC.js** is a JavaScript-based assembler and interpreter for a simple 16-bit virtual machine architecture. Inspired by educational projects like the Low-Cost Computer (LCC), it provides a platform for learning assembly language programming and understanding how high-level code translates to machine operations.

Building on LCC.js, **LCC+js** introduces an extended assembly instruction set and real-time execution features for more interactive, game-oriented applications. This extension adds new instructions (e.g., for non-blocking input, screen manipulation, and timed delays) and separate `.ap` / `.ep` file formats, making it possible to write assembly-based terminal games or simulations.

## **Table of Contents**

1. [Features](#features)  
2. [Getting Started](#getting-started)  
   - [Prerequisites](#prerequisites)  
   - [Installation](#installation)  
3. [Usage](#usage)  
   - [Assembling and Running Code with lcc.js](#assembling-and-running-code-with-lccjs)  
   - [Using assembler.js and interpreter.js Separately](#using-assemblerjs-and-interpreterjs-separately)  
   - [LCC+js Assembly and Execution](#lccjs-assembly-and-execution)  
4. [Understanding the Components](#understanding-the-components)  
   - [lcc.js](#lccjs)  
   - [assembler.js](#assemblerjs)  
   - [interpreter.js](#interpreterjs)  
   - [linker.js](#linkerjs)  
   - [assemblerplus.js & interpreterplus.js (LCC+js)](#assemblerplusjs--interpreterplusjs-lccjs)  
   - [disassembler.js & linkerStepsPrinter.js](#disassemblerjs--linkerstepsprinterjs)  
   - [Directory Structure](#directory-structure)  
5. [Testing](#testing)  
6. [Architecture Details](#architecture-details)  
   - [Registers and Memory](#registers-and-memory)  
   - [Instruction Set (LCC.js & LCC+js)](#instruction-set-lccjs--lccjs)  
7. [Contributing](#contributing)  
   - [Areas for Improvement](#areas-for-improvement)  
   - [How to Contribute](#how-to-contribute)  
8. [License](#license)  
9. [Contact](#contact)  

---

## **Features**

- **Educational Focus**: Ideal for learning the basics of assembly language and virtual machine architectures.  
- **Cross-Platform**: Runs anywhere Node.js is available.  
- **Modular Design**: Separate components for assembling, linking, interpreting, plus extended “plus” modules for advanced use.  
- **Real-Time Extensions (LCC+js)**: Non-blocking input, screen clearing, timed delays, and other game-oriented features.  
- **Extensible**: Straightforward to add new instructions or behaviors.

---

## **Getting Started**

### **Prerequisites**

- **Node.js**: Download and install from [nodejs.org](https://nodejs.org/).

### **Installation**

Clone the repository:

```bash
git clone git@github.com:avidrucker/lccjs.git
cd lccjs
```  

Setup aliases on UNIX systems:  

```bash
chmod u+x alias.sh  
./alias.sh  
source ~/.bashrc
```

---

## **Usage**

### **Assembling and Running Code with lcc.js**

For a standard `.a` assembly file:

```bash
node ./src/core/lcc.js path/to/yourfile.a
```

- **lcc.js** automatically detects file type, assembles the source, and interprets the resulting `.e` executable.

### **Using assembler.js and interpreter.js Separately**

- **Assemble** a `.a` file:

  ```bash
  node ./src/core/assembler.js path/to/yourfile.a
  ```

  This generates a `.e` or `.o` file (depending on directives) in the same folder.

- **Interpret** the produced executable:

  ```bash
  node ./src/core/interpreter.js path/to/yourfile.e
  ```

### **LCC+js Assembly and Execution**

For **LCC+js** features (non-blocking input, screen manipulation, real-time instructions, etc.):

1. **AssemblerPlus** processes `.ap` files, generating `.ep` executables:
   ```bash
   node ./src/plus/assemblerplus.js path/to/yourfile.ap
   ```
2. **InterpreterPlus** runs the resulting `.ep`:
   ```bash
   node ./src/plus/interpreterplus.js path/to/yourfile.ep
   ```
3. **LccPlus** (combined) for one-step assembly and execution:
   ```bash
   node ./src/plus/lccplus.js path/to/yourfile.ap
   ```

These tools introduce extended instructions like `clear`, `sleep`, `nbain`, and more. See [Instruction Set (LCC.js & LCC+js)](#instruction-set-lccjs--lccjs) for details.

---

## **Understanding the Components**

### **lcc.js**
- **Purpose**: A high-level command-line tool that orchestrates assembly, linking, and execution.  
- **Functionality**: 
  - Automatically detects file types (`.a` or `.o`, etc.).  
  - Assembles `.a` files, interprets `.e` files.  
  - Provides a simple CLI for a one-step workflow.

### **assembler.js**
- **Purpose**: Translates `.a` assembly code into machine code (.e or .o).  
- **Key Features**:
  - **Two-Pass Assembly**: Builds symbol table (pass 1) and generates code (pass 2).  
  - **Symbol Table and Directives**: Handles labels, `.start`, `.globl`, `.word`, etc.  
  - **Error Reporting**: Provides errors and warnings if assembly issues occur.

### **interpreter.js**
- **Purpose**: Executes `.e` machine code on a simulated 16-bit virtual machine.  
- **Key Features**:
  - **Registers & Memory**: Manages an 8-register set and 65,536 words of memory.  
  - **Instruction Decoding**: Implements the standard LCC.js instruction set (arithmetic, logic, control flow, I/O via TRAP).  
  - **Execution Cap**: Defaults to 500,000 instructions to prevent infinite loops.

### **linker.js**
- **Purpose**: Combines multiple object files (`.o`) into a single executable (`.e`).  
- **Key Features**:
  - **Symbol Resolution**: Merges global and external symbols.  
  - **Adjusts Addresses**: Ensures references and offsets are correct in the final combined output.

### **assemblerplus.js & interpreterplus.js (LCC+js)**
- **Purpose**: Extend LCC.js for real-time, interactive applications (games, demos).  
- **New Instructions**:
  - `clear`, `sleep`, `nbain`, `cursor`, `srand`, `rand`, `millis`, `resetc`, etc.  
  - Allows partial screen clearing, non-blocking input, timed delays, etc.
- **File Extensions**:
  - `.ap` → **AssemblerPlus** → `.ep`  
  - `.ep` → **InterpreterPlus** → runs advanced instructions in real time.
- **Non-Blocking Execution**: The interpreter uses an event loop for continuous stepping and immediate keystroke handling.

### **disassembler.js & linkerStepsPrinter.js (Extra)**
- **`disassembler.js`**: Takes an `.e` file and disassembles machine code back to a textual instruction representation—useful for debugging.  
- **`linkerStepsPrinter.js`**: Outputs the step-by-step linking process to help visualize how symbols and references are resolved.

### **Directory Structure**

- **`core/`**: Contains primary modules for LCC.js (assembler.js, interpreter.js, etc.).  
- **`utils/`**: Utility scripts for generating listings/statistics, name handling, and other shared functionality.  
- **`plus/`**: Modules for **LCC+js** (assemblerplus.js, interpreterplus.js, lccplus.js) adding extended features.  
- **`test/`**: Houses all test files—both integration tests and end-to-end (e2e).  
- **`extra/`**: Holds additional tools like `disassembler.js` and `linkerStepsPrinter.js`.

---

## **Testing**

Extensive end-to-end (e2e) and integration tests have been implemented for **assembler.js**, **linker.js**, **interpreter.js**, and **lcc.js**—covering a wide range of functionality. Further edge cases can always be added to improve coverage.

Run all tests:

```bash
npm test
```

Run a specific test file:

```bash
npx jest test/integration/assembler.integration.test.js
```

While there are still opportunities for additional test cases (especially unit tests), the current suite provides strong coverage across the main features.

---

## **Architecture Details**

### **Registers and Memory**
- **Registers**: 8 (r0–r7), with special roles for `sp` (r6), `fp` (r5), and `lr` (r7).  
- **Memory**: 65,536 words (16-bit each).

### **Instruction Set (LCC.js & LCC+js)**

**LCC.js** includes:
- **Arithmetic**: `ADD`, `SUB`, `MUL`, `DIV`, `REM`  
- **Logical**: `AND`, `OR`, `XOR`, `NOT`  
- **Data Movement**: `MOV`, `LD`, `ST`, `LEA`, `LDR`, `STR`, `PUSH`, `POP`  
- **Control Flow**: `BR` (`brz`, `brn`, etc.), `JMP`, `JSR`, `RET`, `BL`, `BLR`  
- **I/O (TRAP)**: `AOUT`, `DOUT`, `HOUT`, `SOUT`, `AIN`, `DIN`, `HIN`, `SIN`, etc.

**LCC+js** introduces **extended instructions** (via **assemblerplus.js** & **interpreterplus.js**):
- **Non-Blocking Input**: `nbain`  
- **Screen Clearing**: `clear`, partial reset with `resetc`  
- **Timed Delay**: `sleep`  
- **Cursor Control**: `cursor` (hide/show)  
- **Randomness**: `srand`, `rand` (seed-based random generation)  
- **Milliseconds**: `millis` (retrieve current time mod 1000)

---

## **Contributing**

### **Areas for Improvement**

1. **Debugging Tools**: Symbolic debugger or additional introspection features.  
2. **More LCC+js Demos**: Additional example programs showing real-time features.  
3. **Edge-Case Test Coverage**: Adding more specialized test scenarios to further solidify reliability.  
4. **Performance Optimization**: Improving execution speed and memory usage.  
5. **Documentation**: Continually refining and expanding docs.

### **How to Contribute**

1. **Fork** the repository.  
2. **Create a branch** for your feature or fix.  
3. **Submit a Pull Request** with a clear explanation of changes.

---

## **License**

This project is open-source under the [MIT License](LICENSE).

---

## **Contact**

For questions or feedback, please open an issue or submit a pull request.