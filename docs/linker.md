**Linker.js Overview**

`linker.js` is a Node.js-based linker designed for the LCC.js toolchain. Its primary role is to combine multiple object modules produced by the assembler (`assembler.js`) into a single executable file. The linker resolves symbol references, manages global and external symbols, and ensures that all addresses are correctly adjusted to produce a cohesive and runnable program.

---

### **Functionality**

1. **Command-Line Interface:**
   - **Usage:** `node linker.js [-o outputfile.e] <object module 1> <object module 2> ...`
   - **Options:**
     - `-o <outputfile.e>`: Specifies the name of the output executable file. Defaults to `link.e` if not provided.
   - **Input:** Accepts multiple object module files as input.

2. **Object Module Processing:**
   - **File Validation:** Ensures each input file starts with the `'o'` signature, indicating a valid linkable object module.
   - **Header Parsing:** Reads and interprets header entries such as:
     - `'S'`: Start address of the program.
     - `'G'`: Global symbols with their corresponding addresses.
     - `'E'`, `'e'`, `'V'`: External references with varying address widths.
     - `'A'`: Local references within the module.
   - **Machine Code Extraction:** Extracts the machine code from each object module after the headers.

3. **Symbol Resolution:**
   - **Global Symbol Table (`GTable`):** Maintains a mapping of global symbols to their resolved addresses.
   - **External Reference Tables (`ETable`, `eTable`, `VTable`):** Tracks external symbols that need to be resolved across different modules.
   - **Local Reference Table (`ATable`):** Handles local symbol references within individual modules.

4. **Address Adjustment:**
   - **External References:** Resolves external symbols by updating their addresses based on the global symbol table.
   - **Local References:** Adjusts addresses for local references to ensure they point to the correct memory locations within the combined executable.

5. **Executable Creation:**
   - **Header Construction:** Compiles necessary header entries (`'S'`, `'G'`, `'A'`) into the executable file.
   - **Machine Code Integration:** Appends the combined and adjusted machine code from all object modules into the executable.
   - **File Writing:** Outputs the final executable file with the specified or default name.

6. **Error Handling:**
   - **Duplicate Symbols:** Detects and reports multiple definitions of the same global symbol.
   - **Undefined References:** Identifies external symbols that are referenced but not defined in any input modules.
   - **File Integrity:** Validates the structure and contents of input object modules, ensuring they adhere to the expected format.

---

### **Purpose**

The primary purpose of `linker.js` is to unify multiple object modules into a single executable program. By resolving symbol references and adjusting memory addresses, the linker ensures that the final executable is coherent and ready for execution. This process is essential for building complex programs that are modularized into separate assembly files, facilitating better organization and maintainability.

---

### **Major Components**

1. **Class: `Linker`**
   
   - **Properties:**
     - `mca`: Machine Code Array that holds the combined machine code from all object modules.
     - `GTable`: Global symbol table mapping labels to their resolved addresses.
     - `ETable`, `eTable`, `VTable`: Tables for tracking different types of external references requiring resolution.
     - `ATable`: Table for managing local symbol references within modules.
     - `start`: The starting address of the executable program.
     - `objectModules`: Array holding parsed object modules for processing.
     - `inputFiles`: List of input object module filenames.
     - `outputFileName`: Name of the resulting executable file.

   - **Key Methods:**
     - `main(args)`: Parses command-line arguments, identifies input and output files, and initiates the linking process.
     - `readObjectModule(filename)`: Reads and parses an individual object module file, extracting headers and machine code.
     - `link(filenames, outputFileName)`: Coordinates the overall linking process by processing each module, resolving symbols, adjusting addresses, and creating the executable.
     - `processModule(module)`: Handles the headers of an object module, updating symbol tables and appending machine code.
     - `adjustExternalReferences()`: Resolves external symbols by updating their addresses based on the global symbol table.
     - `adjustLocalReferences()`: Adjusts addresses for local symbol references within modules.
     - `createExecutable()`: Constructs the final executable file by writing headers and combined machine code.
     - `error(message)`: Logs error messages and flags errors to halt the linking process if necessary.

2. **Utility Modules:**
   
   - **`../utils/genStats.js`:** (Not directly used in `linker.js` but commonly part of toolchains for generating statistics and listings.)
   - **`../utils/name.js`:** (Also not directly referenced but may handle naming conventions or related functionalities.)

3. **Execution Flow:**
   
   - **Initialization:** An instance of the `Linker` class is created, and the `main()` method is invoked with command-line arguments.
   - **Input Parsing:** Command-line arguments are parsed to determine input object modules and the desired output executable filename.
   - **Module Reading:** Each input object module is read, validated, and parsed to extract headers and machine code.
   - **Symbol Processing:** Global symbols are recorded, and external references are tracked for resolution.
   - **Address Adjustment:** External and local references are resolved by updating addresses in the machine code.
   - **Executable Generation:** The final executable file is created by writing the necessary headers and the combined machine code.
   - **Error Reporting:** Throughout the process, errors such as duplicate symbols or undefined references are detected and reported, halting the process to ensure the integrity of the executable.

---

### **Key Features**

- **Comprehensive Symbol Management:** Efficiently handles global and external symbols, ensuring all references are correctly resolved in the final executable.
- **Robust Error Detection:** Identifies common linking errors like duplicate symbol definitions and unresolved external references, providing clear error messages.
- **Flexible Command-Line Interface:** Allows users to specify output filenames and input object modules seamlessly through command-line options.
- **Modular Design:** Organized structure with clear separation of concerns, facilitating maintenance and potential future enhancements.
- **Executable Integrity:** Ensures the resulting executable adheres to the expected format, making it compatible with the interpreter (`interpreter.js`) for execution.

---

### **Usage**

To link multiple object modules into a single executable, use the following command structure:

```bash
node linker.js [-o outputfile.e] <object module 1> <object module 2> ...
```

- **Parameters:**
  - `-o outputfile.e`: (Optional) Specifies the name of the output executable file. If omitted, defaults to `link.e`.
  - `<object module 1> <object module 2> ...`: List of input object module filenames to be linked.

**Example:**

```bash
node linker.js -o program.e module1.o module2.o module3.o
```

This command links `module1.o`, `module2.o`, and `module3.o` into a single executable named `program.e`.

---

### **Conclusion**

`linker.js` is a crucial component of the LCC.js toolchain, enabling the assembly of complex programs by merging multiple object modules into a unified executable. Its effective symbol resolution, error handling, and flexible interface ensure that developers can build robust and reliable programs with ease. By maintaining the integrity of the executable and facilitating seamless integration with other tools like the interpreter, `linker.js` plays a vital role in the assembly programming workflow.