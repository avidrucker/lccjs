/**
 * @file assembler.integeration.test.js
 * Integration tests for assembler.js using Jest
 * 
 * These tests are meant to test the assembler's core functionalities
 * without creating any real files. Instead, we mock the filesystem
 * to provide the assembler with source code content and to capture
 * the Assembler object's state after running the assembler. This is
 * particularly useful for replicating the various error conditions.
 */

const fs = require('fs');
const path = require('path');
const Assembler = require('../../src/core/assembler');

// Mock filesystem so we don't actually read/write real files:
jest.mock('fs');

describe('Assembler', () => {
  let assembler;

  // A "virtual FS" object that holds filenames and contents (string or Buffer).
  // We will rebuild this for each test.
  let virtualFs;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Reinitialize our virtual FS for each test
    virtualFs = {};

    // Mock fs.existsSync:
    fs.existsSync.mockImplementation((filePath) => {
      return Object.prototype.hasOwnProperty.call(virtualFs, filePath);
    });

    // Mock fs.readFileSync:
    fs.readFileSync.mockImplementation((filePath, encoding) => {
      if (!Object.prototype.hasOwnProperty.call(virtualFs, filePath)) {
        throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      }
      const content = virtualFs[filePath];
      // If it's a string and encoding is 'utf8' or 'utf-8', return it as a string
      if (typeof content === 'string') {
        if (encoding === 'utf8' || encoding === 'utf-8') return content;
        // If no encoding, return a Buffer
        return Buffer.from(content, 'utf8');
      }
      // Otherwise, if it's a Buffer, just return it
      if (Buffer.isBuffer(content)) {
        return content;
      }
      // If none of the above, throw an error or handle it
      throw new Error(`Unexpected content type for '${filePath}'`);
    });

    // Mock fs.writeFileSync:
    fs.writeFileSync.mockImplementation((filePath, data, options) => {
      // Convert data to string if it's a Buffer
      if (Buffer.isBuffer(data)) {
        virtualFs[filePath] = data;
      } else if (typeof data === 'string') {
        // If encoding is 'utf8', store directly as a string
        if (options && options.encoding === 'utf8') {
          virtualFs[filePath] = data;
        } else {
          // Otherwise, store as Buffer
          virtualFs[filePath] = Buffer.from(data, 'utf8');
        }
      } else {
        throw new Error(`Invalid data type in writeFileSync for '${filePath}'`);
      }
    });

    // **Mock fs.openSync, fs.writeSync, and fs.closeSync**
    fs.openSync.mockImplementation((filePath, flags) => {
      if (flags === 'w') {
        // Initialize the file content in virtualFs
        virtualFs[filePath] = '';
      }
      return filePath; // Use filePath as a mock file descriptor
    });

    fs.writeSync.mockImplementation((fd, buffer, offset, length, position) => {
      // `fd` is the filePath in this mock
      if (!virtualFs.hasOwnProperty(fd)) {
        throw new Error(`Invalid file descriptor: ${fd}`);
      }
      if (Buffer.isBuffer(buffer)) {
        virtualFs[fd] += buffer.toString('utf-8');
      } else if (typeof buffer === 'string') {
        virtualFs[fd] += buffer;
      } else {
        // Handle other possible buffer types if necessary
        virtualFs[fd] += String(buffer);
      }
    });

    fs.closeSync.mockImplementation((fd) => {
      // In this mock, no action is needed on close
      // The content has already been written to virtualFs
    });

    // Create a new Assembler instance for each test
    assembler = new Assembler();
  });

  // -------------------------------------------------------------------------
  // 1. Basic sanity checks
  // -------------------------------------------------------------------------
  test('1. should instantiate without errors', () => {
    expect(assembler).toBeDefined();
    expect(assembler.errorFlag).toBe(false);
    expect(assembler.outputBuffer.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 2. Test handling of invalid CLI arguments
  // -------------------------------------------------------------------------
  test('2. should fail if no filename is provided (not test mode)', () => {
    // In test mode, an error is thrown. We want to confirm we see the right error.
    // We'll simulate "not test mode" by manually setting isTestMode to false
    // but that can be tricky, as the assembler uses a direct global check. 
    // Instead, we rely on the fact that in test mode, it *throws* an error
    // upon "fatalExit".
    //
    // So we can check it by calling main with empty arguments:
    expect(() => {
      assembler.main([]);
    }).toThrow('Usage: assembler.js <input filename>');
  });

  // -------------------------------------------------------------------------
  // 3. Test assembling an **empty file**
  // -------------------------------------------------------------------------
  test('3. should attempt to assemble an empty .a file without crashing', () => {
    const aFilePath = 'empty.a';
    virtualFs[aFilePath] = '';

    // Pass the file as argument
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Empty file');
  });

  // -------------------------------------------------------------------------
  // 4. Test assembling a minimal program (demoA)
  // -------------------------------------------------------------------------
  test('4. should assemble demoA.a with no errors', () => {
    const aFilePath = 'demoA.a';
    const source = `
      ; demoA.a: simple test
      mov r0, 5
      dout r0
      nl
      halt
    `;
    virtualFs[aFilePath] = source;

    // We expect no throw for a valid file:
    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    // After assembling, we can check that certain internal states
    // are set as expected:
    expect(assembler.errorFlag).toBe(false);
    // For example, we can check that instructions got generated
    expect(assembler.outputBuffer.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 5. Test .bin file parsing
  // -------------------------------------------------------------------------
  test('5a. should assemble a correctly written .bin file (each line 16 bits)', () => {
    const binFilePath = 'binaryExample.bin';
    const source = `
      0001000000000010 ; this is a 16-bit binary line
      0011100000000101 ; another 16-bit binary line
    `;
    virtualFs[binFilePath] = source;

    expect(() => {
      assembler.main([binFilePath]);
    }).not.toThrow();

    // The lines should have been parsed into two words:
    expect(assembler.outputBuffer.length).toBe(2);
    // We can also verify the numeric values if desired:
    expect(assembler.outputBuffer[0]).toBe(parseInt('0001000000000010', 2));
    expect(assembler.outputBuffer[1]).toBe(parseInt('0011100000000101', 2));
  });

  test('5b. should throw if .bin file line is not 16 bits', () => {
    const binFilePath = 'badBinary.bin';
    const source = `
      0101001001 ; only 10 bits
    `;
    virtualFs[binFilePath] = source;


    expect(() => {
      assembler.main([binFilePath]);
    }).toThrow('does not have exactly 16 bits');
  });

  test('5c. should throw if .bin file has non-binary characters', () => {
    const binFilePath = 'badBinary2.bin';
    const source = `
      0101001001001XYZ
    `;
    virtualFs[binFilePath] = source;

    expect(() => {
      assembler.main([binFilePath]);
    }).toThrow('is not purely binary');
  });

  // -------------------------------------------------------------------------
  // 6. Test .hex file parsing
  // -------------------------------------------------------------------------
  test('6a. should assemble a .hex file (each line exactly 4 hex digits)', () => {
    const hexFilePath = 'hexExample.hex';
    const source = `
      1A2F ; 16-bit value in hex
      FFFF
    `;
    virtualFs[hexFilePath] = source;

    expect(() => {
      assembler.main([hexFilePath]);
    }).not.toThrow();

    // Should have 2 words in output buffer:
    expect(assembler.outputBuffer.length).toBe(2);
    expect(assembler.outputBuffer[0]).toBe(0x1A2F);
    expect(assembler.outputBuffer[1]).toBe(0xFFFF);
  });

  test('6b. should throw if .hex file line is not 4 hex digits', () => {
    const hexFilePath = 'badHex.hex';
    const source = `
      1A2 ; only 3 hex digits
    `;
    virtualFs[hexFilePath] = source;

    expect(() => {
      assembler.main([hexFilePath]);
    }).toThrow('does not have exactly 4 nibbles');
  });

  test('6c. should throw if .hex file has invalid hex characters', () => {
    const hexFilePath = 'badHex2.hex';
    const source = `
      X123
    `;
    virtualFs[hexFilePath] = source;

    expect(() => {
      assembler.main([hexFilePath]);
    }).toThrow('is not purely hexadecimal');
  });

  // -------------------------------------------------------------------------
  // 7. Test an example that uses .word, .zero, .string, etc. (like demoB)
  // -------------------------------------------------------------------------
  test('7. should handle directives such as .word, .string, .zero without errors', () => {
    const aFilePath = 'demoB.a';
    const source = `
      ld r0, x
      add r0, r0, 2
      dout r0
      halt
ask:  .string "What's your first name? "
buffer1: .zero 10
x: .word 5
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    // We can check that the assembler created an output buffer that
    // includes the data for the string "What's your first name? "
    // plus a null terminator, plus 10 zeros, plus the word 5, etc.
    //
    // We'll just check that it didn't error. For deeper verification,
    // you could look at `assembler.listing` or `assembler.outputBuffer`.
    expect(assembler.errorFlag).toBe(false);
    expect(assembler.outputBuffer.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 8. Test handling of undefined labels
  // -------------------------------------------------------------------------
  test('8. should throw if a referenced label (from an instruction) is never defined or declared .extern', () => {
    const aFilePath = 'undefinedLabel.a';
    const source = `
      ld r0, missingLabel
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Undefined label');
  });

  // -------------------------------------------------------------------------
  // 9. Test .start directive and label resolution
  // -------------------------------------------------------------------------
  test('9a. should throw if .start label is undefined', () => {
    const aFilePath = 'badStart.a';
    const source = `
      .start main
      halt
    `;
    virtualFs[aFilePath] = source;

    // Pass 2 will complain that main is undefined
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Undefined label');
  });

  test('9b. should resolve .start label if defined', () => {
    const aFilePath = 'goodStart.a';
    const source = `
      .start main
    main:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
    expect(assembler.startLabel).toBe('main');
    expect(assembler.startAddress).toBeDefined();
    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 10. Test global and .o object-file generation
  // -------------------------------------------------------------------------
  test('10. should produce .o file when .global is used', () => {
    const aFilePath = 'testObject.a';
    const source = `
      .global foo
      mov r0, 123
      halt
foo:  .word 456
    `;
    virtualFs[aFilePath] = source;
    virtualFs['name.nnn'] = 'Cheese\n';

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    // Assembler should have flagged "isObjectModule = true" and changed
    // the output file name to .o
    expect(assembler.isObjectModule).toBe(true);
    expect(path.extname(assembler.outputFileName)).toBe('.o');
  });

  // -------------------------------------------------------------------------
  // 11. Testing instructions with immediate out-of-range
  // -------------------------------------------------------------------------
  test('11. should throw if an immediate is out of range for an instruction (e.g. sub)', () => {
    const aFilePath = 'outOfRange.a';
    const source = `
      mov r0, 5
      ; sub immediate takes a 5-bit imm, i.e. -16..15
      sub r0, r0, 100 ; out of range
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('imm5 out of range');
  });

  // -------------------------------------------------------------------------
  // 12. Testing division by zero? (No direct assembler error, but a good example)
  // -------------------------------------------------------------------------
  test('12. should assemble demoN.a (division by zero) successfully (no assembler error)', () => {
    const aFilePath = 'demoN.a';
    const source = `
      mov r0, 3
      mov r1, 0
      div r0, r1
      dout r0
      halt
    `;
    virtualFs[aFilePath] = source;

    // Even though at runtime this might cause an exception,
    // the assembler itself won't necessarily throw. So we expect no error:
    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 13. Testing a label with offset
  // -------------------------------------------------------------------------
  test('13. should properly handle label with offset in instruction operand', () => {
    const aFilePath = 'labelOffset.a';
    const source = `
      mydata: .word 100
      ld r0, mydata + 2
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
    expect(assembler.errorFlag).toBe(false);

    // We expect that "mydata" is at loc=0, so "mydata+2" => address 2,
    // which might appear in the final machine code for "ld r0, 2" or something
  });

  // -------------------------------------------------------------------------
  // 14. Test an entire multi-line example that does pass 1 and pass 2 properly
  // -------------------------------------------------------------------------
  test('14. should assemble a short multi-line example with labels and instructions', () => {
    const aFilePath = 'multiLine.a';
    const source = `
      .start main

main:
      mov r0, 10
loop:
      cmp r0, 0
      bre end
      dout r0
      nl
      sub r0, r0, 1
      br loop
end:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
    expect(assembler.errorFlag).toBe(false);
    // Should have a non-empty listing and outputBuffer:
    expect(assembler.listing.length).toBeGreaterThan(0);
    expect(assembler.outputBuffer.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 15. Test passing a label to an instruction that doesn't take labels
  // -------------------------------------------------------------------------
  test('15. should throw an error when passing a non-ascii, non-numeric, non-literal (i.e. a label) to mov instruction', () => {
    const aFilePath = 'badMov.a';
    const source = `
      mov r0, notAValidCharOrNumber
      halt
      notAValidCharOrNumber: .string "hello"
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  // -------------------------------------------------------------------------
  // 16. Test opening a file that doesn't exist
  // -------------------------------------------------------------------------
  test('16. should throw an error when opening a file that does not exist', () => {
    const aFilePath = 'doesNotExist.a';

    // Mock fs.openSync to throw an error
    fs.openSync.mockImplementation(() => {
      throw new Error(`ENOENT: no such file or directory, open '${aFilePath}'`);
    });

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Cannot open input file doesNotExist.a');
  });

  // -------------------------------------------------------------------------
  // 17. Test extern and .o object-file generation
  // -------------------------------------------------------------------------
  test('17. should produce .o file when .extern is used', () => {
    //// TODO: implement this test case by providing the necessary name.nnn file mock
    const aFilePath = 'testObject2.a';
    const source = `
      .extern bar
      ld r0, bar
      halt
    `;
    virtualFs[aFilePath] = source;
    virtualFs['name.nnn'] = 'Cheese\n';

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    // Assembler should have flagged "isObjectModule = true" and changed
    // the output file name to .o
    expect(assembler.isObjectModule).toBe(true);
    expect(path.extname(assembler.outputFileName)).toBe('.o');
  });

  // -------------------------------------------------------------------------
  // 18. Test invalid label char detection
  // -------------------------------------------------------------------------
  test('18. should throw an error when using an invalid label name', () => {
    const aFilePath = 'invalidLabel.a';
    const source = `
      mov r0, 5
      halt
    5invalidLabel: .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad label');
  });

  // -------------------------------------------------------------------------
  // 19. Test duplicate label detection
  // -------------------------------------------------------------------------
  test('19. should throw an error when using a duplicate label name', () => {
    const aFilePath = 'duplicateLabel.a';
    const source = `
      mov r0, 5
      halt
    myLabel: .word 10
    myLabel: .word 20
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Duplicate label');
  });

  // -------------------------------------------------------------------------
  // 20. Test not passing mov a 2nd operand
  // -------------------------------------------------------------------------
  test('20. should throw an error when not passing a 2nd operand to mov', () => {
    const aFilePath = 'noSecondOperand.a';
    const source = `
      mov r0
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing number');
  });

  // -------------------------------------------------------------------------
  // 21. Test not passing anything to mov
  // -------------------------------------------------------------------------
  test('21. should throw an error when not passing anything to mov', () => {
    const aFilePath = 'noOperands.a';
    const source = `
      mov
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  // -------------------------------------------------------------------------
  // 22. Test not passing a valid literal (but instead a label) to mov
  // -------------------------------------------------------------------------
  test('22. should throw an error when passing a label (instead of a literal) to mov', () => {
    const aFilePath = 'labelToMov.a';
    const source = `
      mov r0, myLabel
      halt
    myLabel: .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  // -------------------------------------------------------------------------
  // 23. Test passing extra args to mov
  // -------------------------------------------------------------------------
  test('23. should not throw an error when passing extra arguments to mov', () => {
    const aFilePath = 'extraArgsToMov.a';
    const source = `
      mov r0, 5, 10
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // 24. Test passing a label instead of a register to mov
  // -------------------------------------------------------------------------
  test('24. should throw an error when passing a label instead of a register to mov', () => {
    const aFilePath = 'labelToMov2.a';
    const source = `
      mov myLabel, 5
      halt
    myLabel: .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  // -------------------------------------------------------------------------
  // 25. Test passing an invalid register to mvi
  // -------------------------------------------------------------------------
  test('25. should throw an error when passing an invalid register to mvi', () => {
    const aFilePath = 'invalidRegisterToMvi.a';
    const source = `
      mvi r8, 5
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  // -------------------------------------------------------------------------
  // 26. Test passing a register instead of a literal to mvi
  // -------------------------------------------------------------------------
  test('26. should throw an error when passing a register instead of a literal to mvi', () => {
    const aFilePath = 'registerToMvi.a';
    const source = `
      mvi r0, r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  // -------------------------------------------------------------------------
  // 27. Test referencing a label (in a .word) that isn't declared
  // -------------------------------------------------------------------------
  test('27. should throw an error when referencing a label that is not declared', () => {
    const aFilePath = 'undeclaredLabel.a';
    const source = `l
      halt
x: .word y
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Undefined label');
  });

  // -------------------------------------------------------------------------
  // 28. Test passing multiple arguments to a .word directive
  // -------------------------------------------------------------------------
  test('28. should not throw an error when passing multiple arguments to a .word directive', () => {
    const aFilePath = 'multipleArgsToWord.a';
    const source = `
    halt
x: .word 5, 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // 29. Test passing a literal (non-label) to a ld instruction
  // -------------------------------------------------------------------------
  test('29. should not throw an error when passing a literal to a ld instruction', () => {
    // Note: This behavior (passing of non-labels to ld as the 2nd argument) is allowed in the 
    //       original LCC as of 12/2024, but it seems like it should be disallowed.
    const aFilePath = 'literalToLd.a';
    const source = `
      ld r0, 5
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // 30. Test adding two registers
  // -------------------------------------------------------------------------
  test('30. should not throw an error when adding two registers', () => {
    const aFilePath = 'addRegisters.a';
    const source = `
      add r0, r1, r2
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // 31. Test adding a register and a literal
  // -------------------------------------------------------------------------
  test('31. should not throw an error when adding a register and a literal', () => {
    const aFilePath = 'addRegisterLiteral.a';
    const source = `
      add r0, r1, 5
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // 32. Test adding a literal and a register
  // -------------------------------------------------------------------------
  test('32. should throw an error when adding a literal and a register', () => {
    const aFilePath = 'addLiteralRegister.a';
    const source = `
      add r0, 5, r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow("Bad register");
  });

  // -------------------------------------------------------------------------
  // 33. Test adding a register and a label
  // -------------------------------------------------------------------------
  test('33. should throw an error when adding a register and a label', () => {
    const aFilePath = 'addRegisterLabel.a';
    const source = `
      add r0, r1, myLabel
      halt
    myLabel: .word 5
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow("Bad number");
  });

  // -------------------------------------------------------------------------
  // 34. Test adding a number that is out of range
  // -------------------------------------------------------------------------
  test('34. should throw an error when adding a number that is out of range', () => {
    const aFilePath = 'addOutOfRange.a';
    const source = `
      add r0, r1, 300
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow("imm5 out of range");
  });
});
