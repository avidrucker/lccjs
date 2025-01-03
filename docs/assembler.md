**Assembler.js Overview**

`assembler.js` is a Node.js-based assembler tailored for the LCC.js (an assembler, linker, and interpreter and virtual architecture). It transforms assembly language source files (.a) into machine code (.e), supporting various input formats (.bin and .hex) and handling complex assembly directives and instructions. The assembler operates through a structured two-pass process to ensure accurate symbol resolution and code generation.

---

### **Functionality**

1. **Two-Pass Assembly Process:**
   - **Pass 1:**
     - **Parsing Source Lines:** Reads and tokenizes each line of the assembly source code.
     - **Symbol Table Construction:** Identifies and records labels with their corresponding addresses.
     - **Handling Labels:** Detects label definitions, ensuring no duplicates and validating label syntax.
   - **Pass 2:**
     - **Machine Code Generation:** Converts parsed instructions and directives into machine code using the symbol table.
     - **Error Detection:** Identifies and reports errors related to undefined labels, operand issues, and instruction syntax.

2. **File Handling:**
   - **Input Formats:** Supports `.a` (assembly), `.bin` (binary), and `.hex` (hexadecimal) files.
   - **Output Generation:** Produces machine code files with extensions like `.e` (executable), `.o` (object), `.lst` (listing), and `.bst` (binary statistics).
   - **Special Directives:** Handles directives such as `.start`, `.globl`/`.global`, `.extern`, `.blkw`/`.space`/`.zero`, `.fill`/`.word`, and `.stringz`/`.asciz`/`.string`.

3. **Instruction Handling:**
   - **Supported Instructions:** Includes a wide range of instructions like `add`, `sub`, `cmp`, `mov`, `push`, `pop`, `srl`, `sra`, `sll`, `rol`, `ror`, `mul`, `div`, `rem`, `or`, `xor`, `sext`, `ld`, `st`, `call`, `jsr`, `bl`, `jsrr`, `blr`, `and`, `ldr`, `str`, `jmp`, `ret`, `not`, `lea`, `cea`, `halt`, `nl`, `dout`, `udout`, `hout`, `aout`, `sout`, `din`, `hin`, `ain`, `sin`, `m`, `r`, `s`, `bp`, among others.
   - **Instruction Encoding:** Translates mnemonics and operands into corresponding 16-bit machine code words, handling registers, immediates, labels, and offsets.

4. **Error Handling:**
   - **Immediate Termination:** By default, the assembler exits upon encountering the first error to mimic original LCC behavior.
   - **Multi-Error Reporting:** Can be configured to report multiple errors simultaneously by adjusting the `REPORT_MULTI_ERRORS` flag.
   - **Detailed Error Messages:** Provides contextual error messages indicating the line number, file name, and specific issue.

5. **Utilities and Support:**
   - **Symbol Management:** Maintains symbol tables, global and external labels, and handles symbol resolution.
   - **Listing Generation:** Creates detailed listing files (`.lst` and `.bst`) that include source code, machine code, and statistics.
   - **Immediate Evaluation:** Parses and validates immediate values, ensuring they fall within permissible ranges.
   - **Register Handling:** Supports standard and alias register names (e.g., `fp`, `sp`, `lr` mapped to `r5`, `r6`, `r7`).

---

### **Purpose**

The primary purpose of `assembler.js` is to serve as an assembler within the LCC.js ecosystem, converting human-readable assembly code into executable machine code. It ensures accurate translation by handling complex assembly constructs, managing symbols and labels, and providing robust error detection and reporting. Additionally, it supports the generation of auxiliary files essential for linking and debugging, enhancing the overall development workflow.

---

### **Major Components**

1. **Class: `Assembler`**
   - **Properties:**
     - `symbolTable`: Maps symbols (labels) to their memory addresses.
     - `locCtr`: Location counter tracking the current address during assembly.
     - `lineNum`: Current line number being processed.
     - `sourceLines`: Array holding all lines of the input source file.
     - `errorFlag`: Indicates if any errors have been encountered.
     - `pass`: Current assembly pass (1 or 2).
     - `labels`: Set to track and prevent duplicate label definitions.
     - `errors`: Array collecting error messages.
     - `outputBuffer`: Buffer holding the generated machine code words.
     - `inputFileName` & `outputFileName`: Manage input and output file names.
     - `listing`: Stores detailed information about each source line for listing files.
     - Additional properties for handling program size, start address, object modules, global and external labels, external references, and adjustment entries.

   - **Methods:**
     - **Initialization & Execution:**
       - `main(args)`: Entry point; processes command-line arguments, reads input files, and orchestrates the two-pass assembly.
       - `performPass()`: Executes the current assembly pass, processing each line accordingly.
     - **File Parsing:**
       - `parseBinFile()`: Handles `.bin` files by reading binary strings and converting them to machine words.
       - `parseHexFile()`: Processes `.hex` files by reading hexadecimal strings and converting them to machine words.
     - **Tokenization & Parsing:**
       - `tokenizeLine(line)`: Splits a line into tokens, respecting string literals and ignoring comments.
       - `isValidLabelDef(tokens, originalLine)`, `isValidLabel(label)`: Validates label definitions and syntax.
       - `parseLabelWithOffset(operand)`: Extracts labels and their optional offsets from operands.
       - `parseNumber(valueStr)`: Parses numeric and character literals.
     - **Directive & Instruction Handling:**
       - `handleDirective(mnemonic, operands)`: Processes assembly directives, adjusting the location counter and managing symbols.
       - `handleInstruction(mnemonic, operands)`: Translates assembly instructions into machine code.
       - Specific `assemble` methods for each supported instruction (e.g., `assembleADD`, `assembleSUB`, `assembleBR`, etc.).
     - **Symbol & Operand Evaluation:**
       - `evaluateOperand(operand, usageType)`: Resolves operands, handling labels, offsets, and external references.
       - `evaluateImmediate(valueStr, min, max, type)`, `evaluateImmediateNaive(valueStr)`: Validates and processes immediate values.
     - **Register Handling:**
       - `getRegister(regStr)`: Converts register strings (e.g., `r1`, `sp`) to their numeric equivalents.
       - `isRegister(regStr)`: Checks if a string is a valid register name.
     - **Output Generation:**
       - `writeOutputFile(secondIntroHeader)`: Writes the assembled machine code and headers to the output file.
       - `constructOutputFileName(inputFileName, extension)`: Generates output file names based on input names and desired extensions.
     - **Error Handling:**
       - `error(message)`: Logs errors, updates error flags, and manages termination based on the error reporting configuration.
     - **Utility Functions:**
       - `isWhitespace(char)`, `isStringLiteral(str)`, `parseString(str)`, `isCharLiteral(str)`, `parseCharLiteral(str)`, `isOperator(op)`, `isValidHexNumber(str)`, `isNumLiteral(operand)`: Various helper functions for parsing and validation.

2. **Utility Modules:**
   - **`../utils/genStats.js`:** Provides the `generateBSTLSTContent` function for creating listing and binary statistics files.
   - **`../utils/name.js`:** Handles naming conventions, such as creating `.name` files associated with input files.

3. **Execution Flow:**
   - **Initialization:** An instance of `Assembler` is created and its `main()` method is invoked if the script is run directly.
   - **File Processing:** Depending on the input file extension (`.a`, `.bin`, `.hex`), the assembler processes the file accordingly, either performing a two-pass assembly or parsing binary/hexadecimal data directly.
   - **Symbol Resolution:** Throughout Pass 1, symbols are collected, and during Pass 2, these symbols are used to generate accurate machine code.
   - **Output Generation:** After successful assembly, machine code and auxiliary files are written to disk, ready for linking or execution.

4. **Error Management:**
   - **Crucial for Reliability:** The assembler ensures that any issues in the source code, such as undefined labels, invalid instructions, or operand errors, are promptly reported with clear messages.
   - **Test Mode Compatibility:** In test environments (e.g., Jest), errors throw exceptions instead of exiting the process, facilitating automated testing.

---

### **Key Features**

- **Flexible Input Handling:** Supports multiple input formats, allowing users to assemble traditional assembly files or raw binary/hexadecimal data.
- **Comprehensive Instruction Set:** Covers a wide range of instructions, ensuring compatibility with diverse assembly language constructs.
- **Robust Symbol Management:** Accurately tracks and resolves symbols across multiple passes, preventing common assembly errors.
- **Detailed Listings:** Generates comprehensive listing files that aid in debugging and verification of the assembly process.
- **Extensible Design:** Modular structure with utility functions and clear separation of concerns, facilitating future enhancements or integrations.

---

### **Usage**

To use `assembler.js`, run it via Node.js with the appropriate input file:

```bash
node assembler.js <input_filename>
```

- **Supported Input Extensions:**
  - `.a`: Assembly files processed through a two-pass assembly.
  - `.bin`: Raw binary files parsed directly into machine code.
  - `.hex`: Hexadecimal files parsed directly into machine code.

- **Output Files:**
  - `.e`: Executable or main output file containing machine code.
  - `.o`: Object files for linking (when using `.a` input with global/external directives).
  - `.lst` & `.bst`: Listing and binary statistics files for detailed assembly reports.

**Example:**

```bash
node assembler.js program.a
```

This command assembles `program.a` into `program.e`, and if applicable, generates `program.o`, `program.lst`, and `program.bst`.

---

### **Conclusion**

`assembler.js` is a versatile and robust assembler designed for the LCC.js environment, capable of handling a wide array of assembly language features and input formats. Its structured two-pass approach ensures accurate symbol resolution and machine code generation, while comprehensive error handling and listing generation facilitate a smooth assembly process for developers.