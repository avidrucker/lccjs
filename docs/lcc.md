**LCC.js Overview**

`lcc.js` serves as the central orchestrator within the LCC.js toolchain, integrating the functionalities of the Assembler (`assembler.js`), Linker (`linker.js`), and Interpreter (`interpreter.js`). It facilitates the seamless assembly, linking, and execution of assembly programs, providing a unified command-line interface for developers. By handling various file types and command-line options, `lcc.js` streamlines the workflow from source code to executable, ensuring efficient program development and testing.

---

### **Functionality**

1. **Command-Line Interface:**
   - **Usage:** `node lcc.js <infile> [options]`
   - **Options:**
     - `-d`: Enable debugging.
     - `-m`: Display memory at the end of execution.
     - `-r`: Display registers at the end of execution.
     - `-f`: Enable full line display.
     - `-x`: Use 4-digit hexadecimal output for `HOUT` trap.
     - `-t`: Enable tracing of execution.
     - `-l<hex loadpt>`: Specify a hexadecimal load point for the program.
     - `-o <outfile.e>`: Define the name of the output executable file.
     - `-h`: Display help information.
     - `-nostats`: Disable the generation of `.lst` and `.bst` listing and statistics files.

2. **File Handling and Processing:**
   - **Input Types:**
     - **`.a` or Assembly Files:** Assembles source code into object modules or executables.
     - **`.o` Object Modules:** Links multiple object modules into a single executable.
     - **`.e` Executables:** Executes the assembled and linked program.
     - **`.hex` and `.bin`:** Handles raw machine code inputs, assembling and executing them while generating statistics.
   - **Output Types:**
     - **Executable Files (`.e`):** Final runnable programs.
     - **Listing and Statistics Files (`.lst`, `.bst`):** Provide detailed execution reports and memory usage statistics.

3. **Integration of Assembler, Linker, and Interpreter:**
   - **Assembly:** Converts assembly language source files into machine code or object modules using `assembler.js`.
   - **Linking:** Combines multiple object modules into a single executable using `linker.js`.
   - **Interpretation:** Executes the resulting executable, managing runtime operations and I/O through `interpreter.js`.

4. **Option Parsing and Execution Flow:**
   - **Argument Parsing:** Interprets command-line arguments to determine the operation mode (assemble, link, execute) and applicable options.
   - **Execution Path:**
     - **Single File Operations:** Depending on the file extension, decides whether to assemble, execute, or link.
     - **Multiple File Linking:** When multiple object modules are provided, invokes the linker to produce an executable.
     - **Statistics Generation:** Conditionally generates `.lst` and `.bst` files based on user options.

5. **Error Handling:**
   - **Validation:** Checks for correct usage, valid file types, and the presence of necessary arguments.
   - **Reporting:** Provides descriptive error messages and halts execution upon encountering critical issues.

---

### **Purpose**

The primary purpose of `lcc.js` is to streamline the assembly programming workflow within the LCC.js ecosystem by providing a unified interface for assembling, linking, and executing programs. It abstracts the complexities involved in handling different file types and processes, allowing developers to focus on writing and testing their assembly code efficiently. By integrating essential tools like the Assembler, Linker, and Interpreter, `lcc.js` ensures a cohesive and efficient development experience.

---

### **Major Components**

1. **Class: `LCC`**
   
   - **Properties:**
     - `inputFileName`: Name of the input file to be processed.
     - `outputFileName`: Name of the output executable file.
     - `options`: Object storing parsed command-line options.
     - `assembler`: Instance of the `Assembler` class for handling assembly tasks.
     - `interpreter`: Instance of the `Interpreter` class for executing programs.
     - `inputBuffer`: Buffer for handling user inputs required by certain trap routines.
     - `generateStats`: Boolean flag indicating whether to generate listing and statistics files.
     - `userName`: Managed by `nameHandler` for naming conventions.
   
   - **Key Methods:**
     - `main(args)`: Entry point that parses arguments and directs the workflow based on input types and options.
     - `parseArguments(args)`: Processes command-line arguments, setting relevant options and identifying input/output files.
     - `printHelp()`: Displays usage instructions and available options to the user.
     - `handleSingleFile(infile)`: Determines the action (assemble, execute, or link) based on the input file's extension.
     - `linkObjectFiles(objectFiles)`: Invokes the `Linker` to combine multiple object modules into an executable.
     - `assembleFile()`: Utilizes the `Assembler` to convert assembly source files into machine code or object modules.
     - `executeFile(includeSourceCode, includeComments)`: Employs the `Interpreter` to run the executable, handling I/O and generating statistics if enabled.
     - `constructOutputFileName(inputFileName)`: Generates a default output filename based on the input file's name.
   
2. **Utility Modules:**
   
   - **`../utils/name.js`:**
     - **Function:** `nameHandler.createNameFile`
     - **Purpose:** Manages naming conventions for generated files, ensuring consistency and proper association between input and output files.
   
   - **`../utils/genStats.js`:**
     - **Function:** `generateBSTLSTContent`
     - **Purpose:** Creates content for `.lst` and `.bst` files, providing detailed execution reports and memory usage statistics.

3. **Integration with Assembler, Linker, and Interpreter:**
   
   - **Assembler (`assembler.js`):** Converts assembly source files into machine code or object modules.
   - **Linker (`linker.js`):** Combines multiple object modules into a single executable, resolving symbol references.
   - **Interpreter (`interpreter.js`):** Executes the final executable, managing runtime operations and I/O interactions.

---

### **Key Features**

- **Unified Workflow:** Seamlessly integrates assembling, linking, and execution processes, reducing the need for separate tool invocations.
- **Flexible File Handling:** Supports a variety of input and output file types, catering to different stages of the development process.
- **Comprehensive Option Parsing:** Offers a range of command-line options to customize the assembly and execution behavior, including debugging, memory/register display, and statistics generation.
- **Error Detection and Reporting:** Ensures robust error handling by validating inputs and providing clear, descriptive error messages to aid in troubleshooting.
- **Statistics Generation:** Optionally produces detailed listing and statistics files (`.lst`, `.bst`) that offer insights into program execution, memory usage, and performance metrics.
- **Extensible Design:** Modular structure allows for easy maintenance and potential future enhancements, facilitating integration with other tools and utilities.

---

### **Usage**

To utilize `lcc.js`, execute it via Node.js with the appropriate input file and desired options:

```bash
node lcc.js <infile> [options]
```

- **Parameters:**
  - `<infile>`: The input file to be processed. Its action depends on the file extension:
    - **`.a` or Assembly Files:** Assembles the source code and, if applicable, executes it.
    - **`.o` Object Modules:** Links multiple object modules into a single executable.
    - **`.e` Executables:** Executes the assembled and linked program.
    - **`.hex` and `.bin`:** Assembles and executes raw machine code inputs while generating statistics.
  - **Options:**
    - `-d`: Enable debugging mode.
    - `-m`: Display memory contents at the end of execution.
    - `-r`: Display register states at the end of execution.
    - `-f`: Enable full line display in listings.
    - `-x`: Use 4-digit hexadecimal output for `HOUT` trap.
    - `-t`: Enable execution tracing.
    - `-l<hex loadpt>`: Specify a hexadecimal load point for the program.
    - `-o <outfile.e>`: Define the name of the output executable file.
    - `-h`: Display help information.
    - `-nostats`: Disable the generation of `.lst` and `.bst` listing and statistics files.

**Examples:**

1. **Assemble and Execute an Assembly File:**

   ```bash
   node lcc.js program.a
   ```

   This command assembles `program.a` into an executable (defaulting to `program.e`), executes it, and generates `.lst` and `.bst` files with execution details.

2. **Link Multiple Object Modules into an Executable:**

   ```bash
   node lcc.js -o myProgram.e module1.o module2.o module3.o
   ```

   This command links `module1.o`, `module2.o`, and `module3.o` into a single executable named `myProgram.e`.

3. **Execute a Raw Hexadecimal File with Statistics Disabled:**

   ```bash
   node lcc.js firmware.hex -nostats
   ```

   Assembles and executes `firmware.hex` without generating `.lst` and `.bst` files.

4. **Display Help Information:**

   ```bash
   node lcc.js -h
   ```

   Outputs usage instructions and available options.

---

### **Conclusion**

`lcc.js` is a pivotal component of the LCC.js toolchain, offering a streamlined and integrated environment for assembling, linking, and executing assembly programs. By consolidating essential tools and providing a versatile command-line interface, it enhances the efficiency and ease of development for assembly language programmers. Its robust handling of various file types, comprehensive option parsing, and detailed error reporting make `lcc.js` an indispensable tool for building reliable and optimized assembly applications within the LCC.js ecosystem.