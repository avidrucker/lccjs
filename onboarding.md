
# Onboarding Guide for LCC.js Project

## **1. Engaging Introduction**

### **What is LCC.js?**

**LCC.js** is a JavaScript implementation of a simple assembler, linker, and interpreter for a virtual assembly language and machine architecture. It's inspired by educational projects like the Low-Cost Computer (LCC) by Professor Anthony Dos Reis. The project aims to provide a learning tool for understanding the fundamentals of assembly language programming, machine code generation, and instruction execution within a high-level language environment.

**Key Project Goals:**

- **Educational Focus**: Designed to help users learn how assemblers and interpreters work.
- **JavaScript-Based**: Accessible through Node.js, making it cross-platform and easy to use.
- **Simplicity**: Focuses on core concepts without overwhelming complexity.

---

## **2. High-Level Overview**

### **Simplified Architecture Diagram**

```

     Assembly Code (.a files)
           |
           v
+----------------------+
|      assembler.js    |
|  (Assembler Module)  |
+----------+-----------+
           |
      Executable (.e files)
           |
           v
+----------------------+
|    interpreter.js    |
| (Interpreter Module) |
+----------+-----------+
           |
    Program Outputs:
    - Console Output
    - Listing Files (.lst, .bst)
```

### **Workflow Steps**

1. **Write Assembly Code**: You start by writing assembly code in a `.a` file.

2. **Assemble the Code**: The assembler (`assembler.js`) translates the assembly code into an executable (`.e` file).

3. **Execute the Code**: The interpreter (`interpreter.js`) reads the executable and simulates its execution, producing the program's output.

4. **Combined Operation with lcc.js**: The `lcc.js` script automates the assembling and execution steps, acting as a convenient interface.

---

## **3. Deep Dive into Components**

### **a. lcc.js**

**Role**: Acts as the main orchestrator that combines assembling and interpreting into a single step.

**Functionality**:

- **Input Handling**: Accepts a source file and determines its type based on the extension.
- **Assembling**: If the input is an assembly `.a` file, it invokes `assembler.js` to assemble it.
- **Interpreting**: After assembling (or if the input is an executable `.e` file), it invokes `interpreter.js` to execute the code.
- **Output Generation**: Produces listing files (`.lst` and `.bst`) containing detailed information about the assembly and execution.

**Why Start with lcc.js?**

- **User-Friendly**: Simplifies the process by combining multiple steps.
- **Real-World Simulation**: Mimics how compilers and interpreters work together in actual programming environments.

### **b. assembler.js**

**Role**: Translates assembly language source code into hex encoded executable files.

**Functionality**:

- **Two-Pass Assembly**:
  - **Pass 1**: Scans the code to build a symbol table of labels and addresses.
  - **Pass 2**: Generates executable hex code using the symbol table.
- **Error Checking**: Validates syntax, detects undefined symbols, and reports errors with line numbers.
- **Output Generation**: Creates `.e` executable files and supports generating `.o` object files for linking (more about linking in further onboarding).

**Key Concepts**:

- **Symbol Table**: A data structure that maps labels to memory addresses.
- **Directives and Instructions**: Handles assembly directives (e.g., `.word`, `.string` - used to define data such as numbers, chars, strings, and arrays) and translates instructions to "opcodes" (operation codes such as `0` for the `add` instruction, `1` for `load`, etc..)

### **c. interpreter.js**

**Role**: Simulates the execution of machine code on a virtual machine architecture.

**Functionality**:

- **Memory and Registers**: Simulates memory and CPU registers.
- **Instruction Execution**: Implements the instruction set, including arithmetic, logic, control flow, and I/O operations.
- **Input/Output Handling**: Manages user input and program output.
- **Debugging Features**: Can be extended to include debugging capabilities like step execution (not yet implemented as of 11/21/2024) and state inspection.

**Key Concepts**:

- **Virtual Machine**: An emulated computing environment that executes machine code instructions.
- **Instruction Set Architecture (ISA)**: Defines the supported instructions and their binary representations.

---

## **4. Build and Execution Process**

### **Step-by-Step Guide**

1. **Writing the Code**: Create an assembly language source file (e.g., `example.a`).

2. **Assembling the Code**:

   - **Option 1**: Use `lcc.js` to assemble and execute in one step:
     ```bash
     node lcc.js example.a
     ```
   - **Option 2**: Assemble separately using `assembler.js`:
     ```bash
     node assembler.js example.a
     ```
     This generates `example.e`.

3. **Executing the Code**:

   - If you assembled separately, execute using `interpreter.js`:
     ```bash
     node interpreter.js example.e
     ```

4. **Viewing Output and Listings**:

   - **Program Output**: Displayed in the console during execution.
   - **Listing Files**: `.lst` and `.bst` files provide detailed information about the assembly and execution process.

---

## **5. Areas for Improvement and Contribution**

### **Current Limitations**

- **Linker Test Suite Not Implemented**: The `linker.js` module is functional but not yet have any tests to ensure its reliability.
- **Incomplete Instruction Set**: Some instructions and features are not yet implemented.
- **Error Handling**: Can be enhanced for better user feedback. Some errors are not yet caught, and error behavior (stderr, exit codes) is inconsistent.
- **Debugging Tools**: Debugging is not yet supported. A symbolic debugger would be a valuable addition, and is planned for future development.

### **Opportunities for Contribution**

- **Implementing the Linker Test Suite**: Help develop `linker.test.js` to support the testing of linking multiple object `.o` files into a single `.e` file that matches the LCC `.e` file creation output behavior.
- **Extending the Instruction Set**: Add support for additional instructions (e.g., multiplication, shift left logical, etc..)
- **Improving Documentation**: Enhance the README and code comments for better clarity.
- **Building a Debugger**: Create tools for stepping through code, inspecting memory, and setting breakpoints.
- **Testing**: Expand the test suite to cover more cases and ensure reliability.

---

## **6. Hands-On Experience**

### **Running Example Programs**

- **Provided Demos**: Start with provided example files in the `demos` directory.
- **Experimentation**: Modify the examples or write new ones to see how changes affect the program.
- **Debugging Practice**: Intentionally introduce errors to see how the assembler and interpreter respond.
