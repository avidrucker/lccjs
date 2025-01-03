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

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
  });

  afterAll(() => {
    console.log.mockRestore();
    console.warn.mockRestore();
    console.error.mockRestore();
    console.info.mockRestore();
    process.stdout.write.mockRestore();
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

  // -------------------------------------------------------------------------
  // 35. Test branch instruction (brz) with valid arguments
  // -------------------------------------------------------------------------
  test('35. should assemble brz instruction with valid label', () => {
    const aFilePath = 'brzValid.a';
    const source = `
      brz end
      halt
    end:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
    // Optionally, verify the output buffer contains the correct machine code
    // This depends on the implementation details
  });

  // -------------------------------------------------------------------------
  // 36. Test branch instruction (brz) missing label operand
  // -------------------------------------------------------------------------
  test('36. should throw error for brz instruction missing label operand', () => {
    const aFilePath = 'brzMissingLabel.a';
    const source = `
      brz
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  // -------------------------------------------------------------------------
  // 37. Test branch instruction (brz) with invalid condition code
  // -------------------------------------------------------------------------
  test('37. should throw error for brz instruction with invalid condition code', () => {
    const aFilePath = 'brzInvalidCC.a';
    const source = `
      brz123 end
      halt
    end:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Invalid operation');
  });

  // -------------------------------------------------------------------------
  // 38. Test branch instruction (brz) with undefined label
  // -------------------------------------------------------------------------
  test('38. should throw error for brz instruction with undefined label', () => {
    const aFilePath = 'brzUndefinedLabel.a';
    const source = `
      brz missingLabel
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Undefined label');
  });

  // -------------------------------------------------------------------------
  // 39. Test branch instruction (brz) with extra operands (should ignore extras)
  // -------------------------------------------------------------------------
  test('39. should assemble brz instruction with extra operands without throwing error', () => {
    const aFilePath = 'brzExtraOperands.a';
    const source = `
      brz end extra
      halt
    end:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 40. Test branch instruction (brz) with label offset without spaces
  // -------------------------------------------------------------------------
  test('40. should assemble brz instruction with label offset without spaces', () => {
    const aFilePath = 'brzLabelOffsetNoSpace.a';
    const source = `
          brz end+2
          halt
    end:  dout r0
    end2: hout r0
    end3: halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
    // Optionally, verify the pcoffset9 is correctly calculated
  });

  // -------------------------------------------------------------------------
  // 41. Test branch instruction (brz) with label offset with spaces
  // -------------------------------------------------------------------------
  test('41. should assemble brz instruction with label offset with spaces', () => {
    const aFilePath = 'brzLabelOffsetWithSpace.a';
    const source = `
      brz end + 2
      halt
    end:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
    // Optionally, verify the pcoffset9 is correctly calculated
  });

  // -------------------------------------------------------------------------
  // 42. Test branch instruction (brz) with label and invalid offset
  // -------------------------------------------------------------------------
  test('42. should throw error for brz instruction with label and invalid offset', () => {
    const aFilePath = 'brzInvalidOffset.a';
    const source = `
      brz end + label
      halt
    end:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  // -------------------------------------------------------------------------
  // 43. Test branch instruction (brz) with label offset out of bounds
  // -------------------------------------------------------------------------
  test('43. should throw error for brz instruction with label offset out of bounds', () => {
    const aFilePath = 'brzOffsetOutOfBounds.a';
    const source = `
      brz end + 255
      halt
    end: halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('pcoffset9 out of range');
  });

  // -------------------------------------------------------------------------
  // 44. Test load instruction (ld) with valid label
  // -------------------------------------------------------------------------
  test('44. should assemble ld instruction with valid label', () => {
    const aFilePath = 'ldValid.a';
    const source = `
      ld r1, data
      halt
    data:
      .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 45. Test load instruction (ld) missing operand
  // -------------------------------------------------------------------------
  test('45. should throw error for ld instruction missing operand', () => {
    const aFilePath = 'ldMissingOperand.a';
    const source = `
      ld r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  // -------------------------------------------------------------------------
  // 46. Test load instruction (ld) with invalid operand type
  // -------------------------------------------------------------------------
  // test('46. should throw error for ld instruction with invalid operand type', () => {
  //   // This test is commented out because the current LCC implementation appears to
  //   // allow immediate literals as the second operand to ld. This is likely a bug.
  //   const aFilePath = 'ldInvalidOperand.a';
  //   const source = `
  //     ld r1, 123
  //     halt
  //   `;
  //   virtualFs[aFilePath] = source;

  //   // Assuming ld expects a label or address, but not an immediate literal
  //   expect(() => {
  //     assembler.main([aFilePath]);
  //   }).toThrow('Bad number');
  // });

  // -------------------------------------------------------------------------
  // 47. Test load instruction (ld) with extra operands (should ignore extras)
  // -------------------------------------------------------------------------
  test('47. should assemble ld instruction with extra operands without throwing error', () => {
    const aFilePath = 'ldExtraOperands.a';
    const source = `
      ld r1, data, extra
      halt
data: .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 48. Test load instruction (ld) with label offset without spaces
  // -------------------------------------------------------------------------
  test('48. should assemble ld instruction with label offset without spaces', () => {
    const aFilePath = 'ldLabelOffsetNoSpace.a';
    const source = `
      ld r1, data+2
      halt
    data:
      .word 10
      .word 20
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
    // Optionally, verify pcoffset9 calculation
  });

  // -------------------------------------------------------------------------
  // 49. Test load instruction (ld) with label offset with spaces
  // -------------------------------------------------------------------------
  test('49. should assemble ld instruction with label offset with spaces', () => {
    const aFilePath = 'ldLabelOffsetWithSpace.a';
    const source = `
      ld r1, data + 2
      halt
    data:
      .word 10
      .word 20
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
    // Optionally, verify pcoffset9 calculation
  });

  // -------------------------------------------------------------------------
  // 50. Test load instruction (ld) with label and invalid offset
  // -------------------------------------------------------------------------
  test('50. should throw error for ld instruction with label and invalid offset', () => {
    const aFilePath = 'ldInvalidOffset.a';
    const source = `
      ld r1, data + label
      halt
    data:
      .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  // -------------------------------------------------------------------------
  // 51. Test store instruction (st) with valid register and label
  // -------------------------------------------------------------------------
  test('51. should assemble st instruction with valid register and label', () => {
    const aFilePath = 'stValid.a';
    const source = `
      st r2, data
      halt
    data:
      .word 20
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 52. Test store instruction (st) missing operand
  // -------------------------------------------------------------------------
  test('52. should throw error for st instruction missing operand', () => {
    const aFilePath = 'stMissingOperand.a';
    const source = `
      st r2
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  // -------------------------------------------------------------------------
  // 53. Test store instruction (st) with invalid operand type
  // -------------------------------------------------------------------------
  // test('53. should throw error for st instruction with invalid operand type', () => {
  //   // This is another example of a test that is commented out because the current
  //   // LCC implementation appears to allow immediate literals as the second operand
  //   const aFilePath = 'stInvalidOperand.a';
  //   const source = `
  //     st r2, 50
  //     halt
  //   `;
  //   virtualFs[aFilePath] = source;

  //   // Assuming st expects a label or address, not an immediate
  //   expect(() => {
  //     assembler.main([aFilePath]);
  //   }).toThrow('Bad number');
  // });

  // -------------------------------------------------------------------------
  // 54. Test store instruction (st) with extra operands (should ignore extras)
  // -------------------------------------------------------------------------
  test('54. should assemble st instruction with extra operands without throwing error', () => {
    const aFilePath = 'stExtraOperands.a';
    const source = `
      st r2, data, extra
      halt
    data:
      .word 20
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 55. Test store instruction (st) with label offset without spaces
  // -------------------------------------------------------------------------
  test('55. should assemble st instruction with label offset without spaces', () => {
    const aFilePath = 'stLabelOffsetNoSpace.a';
    const source = `
      st r2, data+3
      halt
    data:
      .word 20
      .word 30
      .word 40
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
    // Optionally, verify pcoffset9 calculation
  });

  // -------------------------------------------------------------------------
  // 56. Test store instruction (st) with label offset with spaces
  // -------------------------------------------------------------------------
  test('56. should assemble st instruction with label offset with spaces', () => {
    const aFilePath = 'stLabelOffsetWithSpace.a';
    const source = `
      st r2, data + 3
      halt
    data:
      .word 20
      .word 30
      .word 40
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
    // Optionally, verify pcoffset9 calculation
  });

  // -------------------------------------------------------------------------
  // 57. Test store instruction (st) with label and invalid offset
  // -------------------------------------------------------------------------
  test('57. should throw error for st instruction with label and invalid offset', () => {
    const aFilePath = 'stInvalidOffset.a';
    const source = `
      st r2, data + offset
      halt
    data:
      .word 20
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  // -------------------------------------------------------------------------
  // 58. Test store instruction (st) with label offset out of bounds
  // -------------------------------------------------------------------------
  test('58. should throw error for st instruction with label offset out of bounds', () => {
    const aFilePath = 'stOffsetOutOfBounds.a';
    const source = `
      st r2, data + 300
      halt
    data:
      .word 20
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('pcoffset9 out of range for st');
  });

  // -------------------------------------------------------------------------
  // 59. Test multiply instruction (mul) with valid arguments
  // -------------------------------------------------------------------------
  test('59. should assemble mul instruction with valid registers', () => {
    const aFilePath = 'mulValid.a';
    const source = `
      mul r3, r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 60. Test multiply instruction (mul) missing operands
  // -------------------------------------------------------------------------
  test('60. should throw error for mul instruction missing operands', () => {
    const aFilePath = 'mulMissingOperands.a';
    const source = `
      mul r3
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  // -------------------------------------------------------------------------
  // 61. Test multiply instruction (mul) with invalid operand types
  // -------------------------------------------------------------------------
  test('61. should throw error for mul instruction with invalid operand types', () => {
    const aFilePath = 'mulInvalidOperands.a';
    const source = `
      mul r3, 5
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming mul expects three registers, not an immediate
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  // -------------------------------------------------------------------------
  // 62. Test multiply instruction (mul) with extra operands (should ignore extras)
  // -------------------------------------------------------------------------
  test('62. should assemble mul instruction with extra operands without throwing error', () => {
    const aFilePath = 'mulExtraOperands.a';
    const source = `
      mul r3, r1, r2
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 63. Test divide instruction (div) with valid arguments
  // -------------------------------------------------------------------------
  test('63. should assemble div instruction with valid registers', () => {
    const aFilePath = 'divValid.a';
    const source = `
      div r4, r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 64. Test divide instruction (div) with immediate instead of register
  // -------------------------------------------------------------------------
  test('64. should throw error for div instruction with immediate instead of register', () => {
    const aFilePath = 'divImmediate.a';
    const source = `
      div r4, 10
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  // -------------------------------------------------------------------------
  // 65. Test divide instruction (div) with missing operands
  // -------------------------------------------------------------------------
  test('65. should throw error for div instruction missing operands', () => {
    const aFilePath = 'divMissingOperands.a';
    const source = `
      div r4
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  // -------------------------------------------------------------------------
  // 66. Test divide instruction (div) with extra operands (should ignore extras)
  // -------------------------------------------------------------------------
  test('66. should assemble div instruction with extra operands without throwing error', () => {
    const aFilePath = 'divExtraOperands.a';
    const source = `
      div r4, r1, r2
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 67. Test subtract instruction (sub) with invalid operand types
  // -------------------------------------------------------------------------
  test('67. should throw error for sub instruction with label instead of register', () => {
    const aFilePath = 'subLabelInsteadRegister.a';
    const source = `
      sub r0, myLabel, r1
      halt
    myLabel: .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  // -------------------------------------------------------------------------
  // 68. Test jump instruction (jmp) with valid base register
  // -------------------------------------------------------------------------
  test('68. should assemble jmp instruction with valid base register', () => {
    const aFilePath = 'jmpValid.a';
    const source = `
      jmp r3
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 69. Test jump instruction (jmp) with invalid base register
  // -------------------------------------------------------------------------
  test('69. should throw error for jmp instruction with invalid base register', () => {
    const aFilePath = 'jmpInvalidRegister.a';
    const source = `
      jmp 10
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  // -------------------------------------------------------------------------
  // 70. Test jump instruction (jmp) with missing operands
  // -------------------------------------------------------------------------
  test('70. should throw error for jmp instruction missing operands', () => {
    const aFilePath = 'jmpMissingOperand.a';
    const source = `
      jmp
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  // -------------------------------------------------------------------------
  // 71. Test jump instruction (jmp) with extra operands (should ignore extras)
  // -------------------------------------------------------------------------
  test('71. should assemble jmp instruction with extra operands without throwing error', () => {
    const aFilePath = 'jmpExtraOperands.a';
    const source = `
      jmp r3, 5, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 72. Test return instruction (ret) with valid usage
  // -------------------------------------------------------------------------
  test('72. should assemble ret instruction with no operands', () => {
    const aFilePath = 'retValid.a';
    const source = `
      ret
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 73. Test return instruction (ret) with extra operands (should ignore extras)
  // -------------------------------------------------------------------------
  test('73. should assemble ret instruction with extra operands without throwing error', () => {
    const aFilePath = 'retExtraOperands.a';
    const source = `
      halt
      ret 10, extra
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 74. Test return instruction (ret) with invalid operand
  // -------------------------------------------------------------------------
  test('74. should throw error for ret instruction with invalid operand', () => {
    const aFilePath = 'retInvalidOperand.a';
    const source = `
      ret r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  // -------------------------------------------------------------------------
  // 75. Test move instruction (mvi) with valid immediate
  // -------------------------------------------------------------------------
  test('75. should assemble mvi instruction with valid immediate', () => {
    const aFilePath = 'mviValid.a';
    const source = `
      mvi r2, 100
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 76. Test move instruction (mvi) with immediate out of bounds
  // -------------------------------------------------------------------------
  test('76. should throw error for mvi instruction with immediate out of bounds', () => {
    const aFilePath = 'mviImmediateOutOfBounds.a';
    const source = `
      mvi r2, 500
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('mvi immediate out of range');
  });

  // -------------------------------------------------------------------------
  // 77. Test move instruction (mvi) with missing operands
  // -------------------------------------------------------------------------
  test('77. should throw error for mvi instruction missing operands', () => {
    const aFilePath = 'mviMissingOperands.a';
    const source = `
      mvi r2
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing number');
  });

  // -------------------------------------------------------------------------
  // 78. Test move instruction (mvi) with invalid operand types
  // -------------------------------------------------------------------------
  test('78. should throw error for mvi instruction with invalid operand types', () => {
    const aFilePath = 'mviInvalidOperands.a';
    const source = `
      mvi r2, label
      halt
    label:
      .word 50
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  // -------------------------------------------------------------------------
  // 79. Test move instruction (mvi) with extra operands (should ignore extras)
  // -------------------------------------------------------------------------
  test('79. should assemble mvi instruction with extra operands without throwing error', () => {
    const aFilePath = 'mviExtraOperands.a';
    const source = `
      mvi r2, 100, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 80. Test load effective address instruction (lea) with valid label
  // -------------------------------------------------------------------------
  test('80. should assemble lea instruction with valid label', () => {
    const aFilePath = 'leaValid.a';
    const source = `
      lea r3, buffer
      halt
    buffer:
      .string "Hello"
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 81. Test load effective address instruction (lea) missing operand
  // -------------------------------------------------------------------------
  test('81. should throw error for lea instruction missing operand', () => {
    const aFilePath = 'leaMissingOperand.a';
    const source = `
      lea r3
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  // -------------------------------------------------------------------------
  // 82. Test load effective address instruction (lea) with invalid operand type
  // -------------------------------------------------------------------------
  test('82. should throw error for lea instruction with invalid operand type', () => {
    const aFilePath = 'leaInvalidOperand.a';
    const source = `
      lea r3, "cheese"
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming lea expects a label, not an immediate
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad label');
  });

  // -------------------------------------------------------------------------
  // 83. Test load effective address instruction (lea) with extra operands (should ignore extras)
  // -------------------------------------------------------------------------
  test('83. should assemble lea instruction with extra operands without throwing error', () => {
    const aFilePath = 'leaExtraOperands.a';
    const source = `
      lea r3, buffer, extra
      halt
    buffer:
      .string "Hello"
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 84. Test jump register instruction (blr) with valid base register
  // -------------------------------------------------------------------------
  test('84. should assemble blr instruction with valid base register', () => {
    const aFilePath = 'blrValid.a';
    const source = `
      blr r4
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 85. Test jump register instruction (blr) with invalid base register
  // -------------------------------------------------------------------------
  test('85. should throw error for blr instruction with invalid base register', () => {
    const aFilePath = 'blrInvalidRegister.a';
    const source = `
      blr r8
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  // -------------------------------------------------------------------------
  // 86. Test jump register instruction (blr) with missing operands
  // -------------------------------------------------------------------------
  test('86. should throw error for blr instruction missing operands', () => {
    const aFilePath = 'blrMissingOperand.a';
    const source = `
      blr
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  // -------------------------------------------------------------------------
  // 87. Test jump register instruction (blr) with extra operands (should ignore extras)
  // -------------------------------------------------------------------------
  test('87. should assemble blr instruction with extra operands without throwing error', () => {
    const aFilePath = 'blrExtraOperands.a';
    const source = `
      blr r4, 5, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 88. Test compare instruction (cmp) with valid registers
  // -------------------------------------------------------------------------
  test('88. should assemble cmp instruction with valid registers', () => {
    const aFilePath = 'cmpValid.a';
    const source = `
      cmp r1, r2
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 89. Test compare instruction (cmp) with immediate out of bounds
  // -------------------------------------------------------------------------
  test('89. should throw error for cmp instruction with immediate out of bounds', () => {
    const aFilePath = 'cmpImmediateOutOfBounds.a';
    const source = `
      cmp r1, 20
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming imm5 for cmp must be between -16 and 15
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('imm5 out of range');
  });

  // -------------------------------------------------------------------------
  // 90. Test compare instruction (cmp) with invalid operand types
  // -------------------------------------------------------------------------
  test('90. should throw error for cmp instruction with invalid operand types', () => {
    const aFilePath = 'cmpInvalidOperands.a';
    const source = `
      cmp r1, label
      halt
    label:
      .word 10
    `;
    virtualFs[aFilePath] = source;

    // Assuming cmp expects register or immediate, not label
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  // -------------------------------------------------------------------------
  // 91. Test and instruction (and) with valid operands
  // -------------------------------------------------------------------------
  test('91. should assemble and instruction with valid registers', () => {
    const aFilePath = 'andValid.a';
    const source = `
      and r1, r2, r3
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 92. Test and instruction (and) with immediate out of bounds
  // -------------------------------------------------------------------------
  test('92. should throw error for and instruction with immediate out of bounds', () => {
    const aFilePath = 'andImmediateOutOfBounds.a';
    const source = `
      and r1, r2, 20
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming imm5 for and must be between -16 and 15
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('imm5 out of range');
  });

  // -------------------------------------------------------------------------
  // 93. Test and instruction (and) with invalid operand types
  // -------------------------------------------------------------------------
  test('93. should throw error for and instruction with invalid 1st operand', () => {
    const aFilePath = 'andInvalidOperands.a';
    const source = `
      and r1, label, r3
      halt
label: .word 10
    `;
    virtualFs[aFilePath] = source;

    // and expects 2 registers, followed by another register or immediate, and not labels
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  // -------------------------------------------------------------------------
  // 94. Test and instruction (and) with extra operands (should ignore extras)
  // -------------------------------------------------------------------------
  test('94. should assemble and instruction with extra operands without throwing error', () => {
    const aFilePath = 'andExtraOperands.a';
    const source = `
      and r1, r2, r3, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 95. Test string directive (.string) with valid string
  // -------------------------------------------------------------------------
  test('95. should assemble .string directive with valid string', () => {
    const aFilePath = 'stringValid.a';
    const source = `
      .string "Hello, World!"
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
    // Optionally, verify that the string is correctly encoded with null terminator
  });

  // -------------------------------------------------------------------------
  // 96. Test string directive (.string) with missing closing quote
  // -------------------------------------------------------------------------
  test('96. should throw error for .string directive with missing closing quote', () => {
    const aFilePath = 'stringMissingQuote.a';
    const source = `
    halt
    .string "Hello, World!
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing terminating quote');
  });

  // -------------------------------------------------------------------------
  // 97. Test string directive (.string) with invalid escape sequence
  // -------------------------------------------------------------------------
  test('97. should throw error for .string directive with invalid escape sequence', () => {
    const aFilePath = 'stringInvalidEscape.a';
    const source = `
    halt
    .string "Hello World!\\"
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing terminating quote');
  });

  // -------------------------------------------------------------------------
  // 98. Test string directive (.string) with extra operands (should ignore extras)
  // -------------------------------------------------------------------------
  test('98. should assemble .string directive with extra operands without throwing error', () => {
    const aFilePath = 'stringExtraOperands.a';
    const source = `
      .string "Hello, World!", extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
    // Optionally, verify that the extra operand is ignored
  });

  // -------------------------------------------------------------------------
  // 99. Test word directive (.word) with valid number
  // -------------------------------------------------------------------------
  test('99. should assemble .word directive with valid number', () => {
    const aFilePath = 'wordValid.a';
    const source = `
      .word 100
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 100. Test word directive (.word) with invalid number format
  // -------------------------------------------------------------------------
  test('100. should throw error for .word directive with invalid number format', () => {
    const aFilePath = 'wordInvalidNumber.a';
    const source = `
      .word 0xGHI
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number'); // validated as correct error message
  });

  // -------------------------------------------------------------------------
  // 101. Test word directive (.word) with missing operand
  // -------------------------------------------------------------------------
  test('101. should throw error for .word directive missing operand', () => {
    const aFilePath = 'wordMissingOperand.a';
    const source = `
      .word
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  // -------------------------------------------------------------------------
  // 102. Test word directive (.word) with label that is undefined
  // -------------------------------------------------------------------------
  test('102. should throw error for .word directive with undefined label', () => {
    const aFilePath = 'wordUndefinedLabel.a';
    const source = `
      .word missingLabel
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Undefined label');
  });

  // -------------------------------------------------------------------------
  // 103. Test word directive (.word) with label and offset out of bounds
  // -------------------------------------------------------------------------
  test('103. should throw error for .word directive with label offset out of bounds', () => {
    const aFilePath = 'wordOffsetOutOfBounds.a';
    const source = `
    halt
data1: .word data2 + 65536
data2: .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  // -------------------------------------------------------------------------
  // 104. Test zero directive (.zero) with valid size
  // -------------------------------------------------------------------------
  test('104. should assemble .zero directive with valid size', () => {
    const aFilePath = 'zeroValid.a';
    const source = `
      .zero 10
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
    // Optionally, verify that 10 words are allocated and set to zero
  });

  // -------------------------------------------------------------------------
  // 105. Test zero directive (.zero) with invalid size (non-numeric)
  // -------------------------------------------------------------------------
  test('105. should throw error for .zero directive with non-numeric size', () => {
    const aFilePath = 'zeroNonNumeric.a';
    const source = `
      .zero ten
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  // -------------------------------------------------------------------------
  // 106. Test zero directive (.zero) with missing operand
  // -------------------------------------------------------------------------
  test('106. should throw error for .zero directive missing operand', () => {
    const aFilePath = 'zeroMissingOperand.a';
    const source = `
      .zero
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  // -------------------------------------------------------------------------
  // 107. Test zero directive (.zero) with negative size
  // -------------------------------------------------------------------------
  test('107. should throw error for .zero directive with negative size', () => {
    // Note: As of 12/2024, the LCC implementation does not check for negative sizes
    // and will allow the .zero directive to proceed with a negative size.
    // The following 'Bad number' error is a "custom" LCC.js behavior currently.
    const aFilePath = 'zeroNegativeSize.a';
    const source = `
      .zero -5
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  // -------------------------------------------------------------------------
  // 108. Test start directive (.start) with valid label
  // -------------------------------------------------------------------------
  test('108. should assemble .start directive with valid label', () => {
    const aFilePath = 'startValid.a';
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
  // 109. Test start directive (.start) with undefined label
  // -------------------------------------------------------------------------
  test('109. should throw error for .start directive with undefined label', () => {
    const aFilePath = 'startUndefinedLabel.a';
    const source = `
      .start main
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Undefined label');
  });

  // -------------------------------------------------------------------------
  // 110. Test start directive (.start) with missing operand
  // -------------------------------------------------------------------------
  test('110. should throw error for .start directive missing operand', () => {
    const aFilePath = 'startMissingOperand.a';
    const source = `
      .start
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  // -------------------------------------------------------------------------
  // 111. Test global directive (.global) with valid variable
  // -------------------------------------------------------------------------
  test('111. should assemble .global directive with valid variable', () => {
    const aFilePath = 'globalValid.a';
    const source = `
      .global var1
      mov r0, 5
      halt
    var1: .word 10
    `;
    virtualFs[aFilePath] = source;
    virtualFs['name.nnn'] = 'Cheese\n';

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.globalLabels.has('var1')).toBe(true);
    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 112. Test global directive (.global) with invalid variable name
  // -------------------------------------------------------------------------
  test('112. should throw error for .global directive with invalid variable name', () => {
    const aFilePath = 'globalInvalidName.a';
    const source = `
      .global 1var
      mov r0, 5
      halt
    `;
    virtualFs[aFilePath] = source;
    virtualFs['name.nnn'] = 'Cheese\n';

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad operand--not a valid label');
  });

  // -------------------------------------------------------------------------
  // 113. Test global directive (.global) with missing operand
  // -------------------------------------------------------------------------
  test('113. should throw error for .global directive missing operand', () => {
    const aFilePath = 'globalMissingOperand.a';
    const source = `
      .global
      mov r0, 5
      halt
    `;
    virtualFs[aFilePath] = source;
    virtualFs['name.nnn'] = 'Cheese\n';

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  // -------------------------------------------------------------------------
  // 114. Test extern directive (.extern) with valid variable
  // -------------------------------------------------------------------------
  test('114. should assemble .extern directive with valid variable', () => {
    const aFilePath = 'externValid.a';
    const source = `
      .extern externalVar
      ld r1, externalVar
      halt
    `;
    virtualFs[aFilePath] = source;
    virtualFs['name.nnn'] = 'Cheese\n';

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.externLabels.has('externalVar')).toBe(true);
    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 115. Test extern directive (.extern) with invalid variable name
  // -------------------------------------------------------------------------
  test('115. should throw error for .extern directive with invalid variable name', () => {
    const aFilePath = 'externInvalidName.a';
    const source = `
      .extern $var!
      ld r1, $var!
      halt
    `;
    virtualFs[aFilePath] = source;
    virtualFs['name.nnn'] = 'Cheese\n';

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad operand--not a valid label');
  });

  // -------------------------------------------------------------------------
  // 116. Test extern directive (.extern) with missing operand
  // -------------------------------------------------------------------------
  test('116. should throw error for .extern directive missing operand', () => {
    const aFilePath = 'externMissingOperand.a';
    const source = `
      .extern
      ld r1, externalVar
      halt
    `;
    virtualFs[aFilePath] = source;
    virtualFs['name.nnn'] = 'Cheese\n';

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  // -------------------------------------------------------------------------
  // 117. Test org directive (.org) with valid address
  // -------------------------------------------------------------------------
  test.skip('117. should assemble .org directive with valid address', () => {
    const aFilePath = 'orgValid.a';
    const source = `
      .org 1000
      mov r0, 5
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.locCtr).toBe(1000);
    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 118. Test org directive (.org) with invalid address (non-numeric)
  // -------------------------------------------------------------------------
  test.skip('118. should throw error for .org directive with non-numeric address', () => {
    const aFilePath = 'orgNonNumeric.a';
    const source = `
      .org address
      mov r0, 5
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Invalid number for .org directive');
  });

  // -------------------------------------------------------------------------
  // 119. Test org directive (.org) with missing operand
  // -------------------------------------------------------------------------
  test.skip('119. should throw error for .org directive missing operand', () => {
    const aFilePath = 'orgMissingOperand.a';
    const source = `
      .org
      mov r0, 5
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  // -------------------------------------------------------------------------
  // 120. Test org directive (.org) with address out of bounds
  // -------------------------------------------------------------------------
  test.skip('120. should throw error for .org directive with address out of bounds', () => {
    const aFilePath = 'orgOutOfBounds.a';
    const source = `
      .org 70000
      mov r0, 5
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming maximum locCtr is 65535
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Address out of bounds for .org directive');
  });

  // -------------------------------------------------------------------------
  // 121. Test undefined directive
  // -------------------------------------------------------------------------
  test('121. should throw error for undefined directive', () => {
    const aFilePath = 'undefinedDirective.a';
    const source = `
      .undefinedDirective
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Invalid operation');
  });

  // -------------------------------------------------------------------------
  // 122. Test add instruction (add) with label instead of register
  // -------------------------------------------------------------------------
  test('122. should throw error for add instruction with label instead of register', () => {
    const aFilePath = 'addLabelInsteadRegister.a';
    const source = `
      add r0, r1, label
      halt
    label:
      .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  // -------------------------------------------------------------------------
  // 123. Test nop-like instruction (assuming 'nop' is not defined)
  // -------------------------------------------------------------------------
  test('123. should throw error for undefined mnemonic', () => {
    const aFilePath = 'undefinedMnemonic.a';
    const source = `
      nop
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Invalid operation');
  });

  // -------------------------------------------------------------------------
  // 124. Test instruction with too many characters in label
  // -------------------------------------------------------------------------
  test.skip('124. should throw error for label exceeding maximum length', () => {
    // Note: It may not be correct to say there is a maximum label length - 
    //       there might just be a cap on the length of a line of code
    const aFilePath = 'longLabel.a';
    const longLabel = 'a'.repeat(300);
    const source = `
      ${longLabel}: .word 10
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Label exceeds maximum length');
  });

  // -------------------------------------------------------------------------
  // 125. Test instruction with unsupported operand format (e.g., indirect)
  // -------------------------------------------------------------------------
  test('125. should throw error for instruction with unsupported operand format', () => {
    const aFilePath = 'unsupportedOperandFormat.a';
    const source = `
      ld r1, [cheese]
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming indirect addressing ([r2]) is not supported
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad label');
  });

  // -------------------------------------------------------------------------
  // 126. Test mvi instruction with invalid string instead of literal
  // -------------------------------------------------------------------------
  test('126. should throw error for mvi instruction with string instead of literal', () => {
    const aFilePath = 'mviStringInsteadLiteral.a';
    const source = `
      mvi r1, "Hello"
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  // -------------------------------------------------------------------------
  // 127. Test add instruction with negative immediate
  // -------------------------------------------------------------------------
  test('127. should assemble add instruction with valid negative immediate', () => {
    const aFilePath = 'addNegativeImmediate.a';
    const source = `
      add r0, r1, -5
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming negative immediates are allowed within range
    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 128. Test add instruction with immediate out of negative bounds
  // -------------------------------------------------------------------------
  test('128. should throw error for add instruction with immediate below negative bound', () => {
    const aFilePath = 'addImmediateBelowBound.a';
    const source = `
      add r0, r1, -20
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming imm5 must be >= -16
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('imm5 out of range');
  });

  // -------------------------------------------------------------------------
  // 129. Test assembly of a line exceeding maximum character limit
  // -------------------------------------------------------------------------
  test.skip('129. should throw error for line exceeding 300 characters', () => {
    const aFilePath = 'longLine.a';
    const longLine = 'a'.repeat(301);
    const source = `
      ${longLine}
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Line exceeds maximum length of 300 characters');
  });

  // -------------------------------------------------------------------------
  // 130. Test string directive (.string) with multi-character literal
  // -------------------------------------------------------------------------
  test('130. should throw error for .string directive with multi-character literal', () => {
    const aFilePath = 'stringMultiChar.a';
    const source = `
      .string 'ab'
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('String constant missing leading quote');
  });

  // -------------------------------------------------------------------------
  // 131. Test pop instruction (pop) with valid destination register
  // -------------------------------------------------------------------------
  test('131. should assemble pop instruction with valid destination register', () => {
    const aFilePath = 'popValid.a';
    const source = `
      pop r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 132. Test pop instruction (pop) with invalid register
  // -------------------------------------------------------------------------
  test('132. should throw error for pop instruction with invalid register', () => {
    const aFilePath = 'popInvalidRegister.a';
    const source = `
      pop r8
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  // -------------------------------------------------------------------------
  // 133. Test pop instruction (pop) with missing operand
  // -------------------------------------------------------------------------
  test('133. should throw error for pop instruction missing operand', () => {
    const aFilePath = 'popMissingOperand.a';
    const source = `
      pop
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  // -------------------------------------------------------------------------
  // 134. Test pop instruction (pop) with extra operands (should ignore extras)
  // -------------------------------------------------------------------------
  test('134. should assemble pop instruction with extra operands without throwing error', () => {
    const aFilePath = 'popExtraOperands.a';
    const source = `
      pop r1, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 135. Test push instruction (push) with valid source register
  // -------------------------------------------------------------------------
  test('135. should assemble push instruction with valid source register', () => {
    const aFilePath = 'pushValid.a';
    const source = `
      push r2
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 136. Test push instruction (push) with invalid register
  // -------------------------------------------------------------------------
  test('136. should throw error for push instruction with invalid register', () => {
    const aFilePath = 'pushInvalidRegister.a';
    const source = `
      push r8
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  // -------------------------------------------------------------------------
  // 137. Test push instruction (push) with missing operand
  // -------------------------------------------------------------------------
  test('137. should throw error for push instruction missing operand', () => {
    const aFilePath = 'pushMissingOperand.a';
    const source = `
      push
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  // -------------------------------------------------------------------------
  // 138. Test push instruction (push) with extra operands (should ignore extras)
  // -------------------------------------------------------------------------
  test('138. should assemble push instruction with extra operands without throwing error', () => {
    const aFilePath = 'pushExtraOperands.a';
    const source = `
      push r2, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

   // -------------------------------------------------------------------------
  // 139. Test word directive (.word) with label and offset NOT out of bounds
  // -------------------------------------------------------------------------
  test('139. should not throw an error for .word directive with label offset in bounds', () => {
    const aFilePath = 'wordOffsetOutOfBounds.a';
    const source = `
    halt
data1: .word data2 + 65535
data2: .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // 140. Test instruction with invalid shift count
  // -------------------------------------------------------------------------
  test('140. should throw no error for srl instruction with shift count that goes out of range', () => {
    // Note: This seems like a bug in the LCC.js implementation, but it is currently (as of 12/2024)
    // the LCC behavior to accept shift counts that go out of range.
    const aFilePath = 'srlInvalidShiftCount.a';
    const source = `
      srl r1, 16
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // 141. Test instruction with invalid shift type
  // -------------------------------------------------------------------------
  test('141. should throw error for invalid shift type in srl instruction', () => {
    const aFilePath = 'srlInvalidShiftType.a';
    const source = `
      srl r1, invalidShiftType
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  // -------------------------------------------------------------------------
  // 142. Test instruction (sll) with valid shift count
  // -------------------------------------------------------------------------
  test('142. should assemble sll instruction with valid shift count', () => {
    const aFilePath = 'sllValid.a';
    const source = `
      sll r1, 5
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 143. Test instruction (sll) with missing shift count (defaults to 1)
  // -------------------------------------------------------------------------
  test('143. should assemble sll instruction with missing shift count', () => {
    const aFilePath = 'sllMissingShiftCount.a';
    const source = `
      sll r1
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming missing shift count defaults to 1
    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 144. Test instruction (sll) with shift count out of range
  // -------------------------------------------------------------------------
  test('144. should throw no error for sll instruction with shift count out of range', () => {
    const aFilePath = 'sllShiftCountOutOfRange.a';
    const source = `
      sll r1, 20
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming shift count must be <= 15
    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // 145. Test instruction (rol) with valid operands
  // -------------------------------------------------------------------------
  test('145. should assemble rol instruction with valid operands', () => {
    const aFilePath = 'rolValid.a';
    const source = `
      rol r2, 3
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 146. Test instruction (rol) with out of range shift count
  // -------------------------------------------------------------------------
  test('146. should throw no error for rol instruction with out of range shift count', () => {
    const aFilePath = 'rolInvalidShiftCount.a';
    const source = `
      rol r2, 16
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming shift count must be <= 15
    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // 147. Test instruction (ror) with valid operands
  // -------------------------------------------------------------------------
  test('147. should assemble ror instruction with valid operands', () => {
    const aFilePath = 'rorValid.a';
    const source = `
      ror r3, 2
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 148. Test instruction (ror) with invalid operand types
  // -------------------------------------------------------------------------
  test('148. should throw error for ror instruction with invalid operand types', () => {
    const aFilePath = 'rorInvalidOperands.a';
    const source = `
      ror r3, label
      halt
    label:
      .word 5
    `;
    virtualFs[aFilePath] = source;

    // Assuming ror expects a valid shift count (numeric)
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  // -------------------------------------------------------------------------
  // 149. Test instruction (ror) with missing shift count (defaults to 1)
  // -------------------------------------------------------------------------
  test('149. should assemble ror instruction with missing shift count', () => {
    const aFilePath = 'rorMissingShiftCount.a';
    const source = `
      ror r3
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming missing shift count defaults to 1
    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 150. Test instruction (rol) with invalid operand format
  // -------------------------------------------------------------------------
  test('150. should throw error for rol instruction with invalid operand format', () => {
    const aFilePath = 'rolInvalidOperandFormat.a';
    const source = `
      rol r2, cheese
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  // -------------------------------------------------------------------------
  // 151. Test jump and link instruction (bl) with valid label
  // -------------------------------------------------------------------------
  test('151. should assemble bl instruction with valid label', () => {
    const aFilePath = 'blValid.a';
    const source = `
      bl function
      halt
    function:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
    expect(assembler.isObjectModule).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 152. Test jump and link instruction (bl) with undefined label
  // -------------------------------------------------------------------------
  test('152. should throw error for bl instruction with undefined label', () => {
    const aFilePath = 'blUndefinedLabel.a';
    const source = `
      bl missingFunction
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Undefined label');
  });

  // -------------------------------------------------------------------------
  // 153. Test jump and link instruction (bl) with extra operands (should ignore extras)
  // -------------------------------------------------------------------------
  test('153. should assemble bl instruction with extra operands without throwing error', () => {
    const aFilePath = 'blExtraOperands.a';
    const source = `
      bl function, extra
      halt
    function:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 154. Test jump and link instruction (bl) with invalid operand type
  // -------------------------------------------------------------------------
  test('154. should throw error for bl instruction with invalid operand type', () => {
    const aFilePath = 'blInvalidOperand.a';
    const source = `
      bl 100
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming bl expects a label, not an immediate
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad label');
  });

  // -------------------------------------------------------------------------
  // 155. Test load register instruction (ldr) with valid operands
  // -------------------------------------------------------------------------
  test('155. should assemble ldr instruction with valid operands', () => {
    const aFilePath = 'ldrValid.a';
    const source = `
      ldr r1, r2, 4
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 156. Test load register instruction (ldr) with invalid base register
  // -------------------------------------------------------------------------
  test('156. should throw error for ldr instruction with invalid base register', () => {
    const aFilePath = 'ldrInvalidBaseRegister.a';
    const source = `
      ldr r1, r8, 4
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  // -------------------------------------------------------------------------
  // 157. Test load register instruction (ldr) with invalid offset
  // -------------------------------------------------------------------------
  test('157. should throw error for ldr instruction with invalid offset', () => {
    const aFilePath = 'ldrInvalidOffset.a';
    const source = `
      ldr r1, r2, 100
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming offset6 must be within -32 to 31
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('offset6 out of range');
  });

  // -------------------------------------------------------------------------
  // 158. Test load register instruction (ldr) with missing operands
  // -------------------------------------------------------------------------
  test('158. should throw error for ldr instruction missing operands', () => {
    const aFilePath = 'ldrMissingOperands.a';
    const source = `
      ldr r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  // -------------------------------------------------------------------------
  // 159. Test load register instruction (ldr) with extra operands (should ignore extras)
  // -------------------------------------------------------------------------
  test('159. should assemble ldr instruction with extra operands without throwing error', () => {
    const aFilePath = 'ldrExtraOperands.a';
    const source = `
      ldr r1, r2, 4, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 160. Test load register instruction (ldr) with label (unsupported)
  // -------------------------------------------------------------------------
  test('160. should throw error for ldr instruction with label', () => {
    const aFilePath = 'ldrLabel.a';
    const source = `
      ldr r1, r2, label
      halt
    label:
      .word 10
    `;
    virtualFs[aFilePath] = source;

    // Assuming ldr expects a numeric offset, not label
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  // -------------------------------------------------------------------------
  // 161. Test assembler with empty file containing only comments
  // -------------------------------------------------------------------------
  test('161. should attempt to assemble a file with only comments without errors', () => {
    const aFilePath = 'onlyComments.a';
    const source = `
      ; This is a comment
      ; Another comment line
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Empty file');
  });

  // -------------------------------------------------------------------------
  // 162. Test instruction (mvr) with valid operands
  // -------------------------------------------------------------------------
  test('162. should assemble mvr instruction with valid registers', () => {
    const aFilePath = 'mvrValid.a';
    const source = `
      mvr r1, r2
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 163. Test instruction (mvr) with invalid operand type
  // -------------------------------------------------------------------------
  test('163. should throw error for mvr instruction with invalid operand type', () => {
    const aFilePath = 'mvrInvalidOperand.a';
    const source = `
      mvr r1, 100
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming mvr expects a register, not an immediate
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  // -------------------------------------------------------------------------
  // 164. Test instruction (mvr) with missing operands
  // -------------------------------------------------------------------------
  test('164. should throw error for mvr instruction missing operands', () => {
    const aFilePath = 'mvrMissingOperands.a';
    const source = `
      mvr r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  // -------------------------------------------------------------------------
  // 165. Test instruction (mvr) with extra operands (should ignore extras)
  // -------------------------------------------------------------------------
  test('165. should assemble mvr instruction with extra operands without throwing error', () => {
    const aFilePath = 'mvrExtraOperands.a';
    const source = `
      mvr r1, r2, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 166. Test instruction (sext) with valid operands
  // -------------------------------------------------------------------------
  test('166. should assemble sext instruction with valid operands', () => {
    const aFilePath = 'sextValid.a';
    const source = `
      sext r3, r1
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 167. Test instruction (sext) with invalid operand type
  // -------------------------------------------------------------------------
  test('167. should throw error for sext instruction with invalid operand type', () => {
    const aFilePath = 'sextInvalidOperand.a';
    const source = `
      sext r3, 10
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming sext expects a register, not an immediate
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  // -------------------------------------------------------------------------
  // 168. Test instruction (sext) with missing operands
  // -------------------------------------------------------------------------
  test('168. should throw error for sext instruction missing operands', () => {
    const aFilePath = 'sextMissingOperands.a';
    const source = `
      sext r3
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  // -------------------------------------------------------------------------
  // 169. Test instruction (sext) with extra operands (should ignore extras)
  // -------------------------------------------------------------------------
  test('169. should assemble sext instruction with extra operands without throwing error', () => {
    const aFilePath = 'sextExtraOperands.a';
    const source = `
      sext r3, r1, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 170. Test halt instruction with extra operands (should ignore extras)
  // -------------------------------------------------------------------------
  test('170. should assemble halt instruction with extra operands without throwing error', () => {
    const aFilePath = 'haltExtraOperands.a';
    const source = `
      halt extra
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 171. Test trap instruction (dout) with invalid register
  // -------------------------------------------------------------------------
  test('171. should throw error for dout trap instruction with invalid register', () => {
    const aFilePath = 'doutInvalidRegister.a';
    const source = `
      dout r8
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  // -------------------------------------------------------------------------
  // 172. Test trap instruction (dout) with missing operand (defaults to r0)
  // -------------------------------------------------------------------------
  test('172. should assemble dout trap instruction with missing operand (defaults to r0)', () => {
    const aFilePath = 'doutMissingOperand.a';
    const source = `
      dout
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming dout defaults to r0 when operand is missing
    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 173. Test trap instruction (dout) with label instead of register
  // -------------------------------------------------------------------------
  test('173. should throw error for dout trap instruction with label instead of register', () => {
    const aFilePath = 'doutLabelInsteadRegister.a';
    const source = `
      dout label
      halt
    label:
      .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  // -------------------------------------------------------------------------
  // 174. Test undefined directive with missing dot
  // -------------------------------------------------------------------------
  test('174. should throw error for directive without leading dot', () => {
    const aFilePath = 'directiveNoDot.a';
    const source = `
      word 10
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Invalid operation');
  });

  // -------------------------------------------------------------------------
  // 175. Test assembly with multiple .extern declarations for the same label
  // -------------------------------------------------------------------------
  test('175. should throw not error for multiple .extern declarations of the same label', () => {
    // Note: This could be an error case, but it is currently (as of 12/2024) the LCC behavior
    // to allow multiple .extern declarations for the same label.
    const aFilePath = 'multipleExterns.a';
    const source = `
      .extern bar
      .extern bar
      ld r0, bar
      halt
    `;
    virtualFs[aFilePath] = source;
    virtualFs['name.nnn'] = 'Cheese\n';

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // 176. Test instruction (jmp) with label offset without spaces
  // -------------------------------------------------------------------------
  test('176. should assemble jmp instruction with offset', () => {
    const aFilePath = 'jmpLabelOffsetNoSpace.a';
    const source = `
      jmp r0, 5
      dout r0
      dout r0
      dout r0
      dout r0
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 177. Test instruction (jmp) with no offset
  // -------------------------------------------------------------------------
  test('177. should assemble jmp instruction with no offset', () => {
    const aFilePath = 'jmpLabelOffsetWithSpace.a';
    const source = `
      jmp r0
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 178. Test instruction (jmp) with label
  // -------------------------------------------------------------------------
  test('178. should throw error for jmp instruction with label', () => {
    const aFilePath = 'jmpInvalidOffset.a';
    const source = `
      jmp loop
      halt
    loop:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  // -------------------------------------------------------------------------
  // 179. Test instruction (jmp) with offset out of bounds
  // -------------------------------------------------------------------------
  test('179. should throw error for jmp instruction with offset out of bounds', () => {
    const aFilePath = 'jmpOffsetOutOfBounds.a';
    const source = `
      jmp r0, 300
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('offset6 out of range');
  });

  // -------------------------------------------------------------------------
  // 180. Test branch always instruction (br) with valid label
  // -------------------------------------------------------------------------
  test('180. should assemble br instruction with valid label', () => {
    const aFilePath = 'brValid.a';
    const source = `
      br loop
      halt
    loop:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 181. Test branch always instruction (br) with undefined label
  // -------------------------------------------------------------------------
  test('181. should throw error for br instruction with undefined label', () => {
    const aFilePath = 'brUndefinedLabel.a';
    const source = `
      br missingLoop
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Undefined label');
  });

  // -------------------------------------------------------------------------
  // 182. Test branch instruction (br) with label offset out of bounds
  // -------------------------------------------------------------------------
  test('182. should throw error for br instruction with label offset out of bounds', () => {
    const aFilePath = 'brOffsetOutOfBounds.a';
    const source = `
      br loop + 1500
      halt
    loop:
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming pcoffset11 must be between -1024 and 1023
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('pcoffset9 out of range');
  });

  // -------------------------------------------------------------------------
  // 183. Test instruction (ret) with extra operands (should ignore extras)
  // -------------------------------------------------------------------------
  test('183. should assemble ret instruction with extra operands without throwing error', () => {
    const aFilePath = 'retExtraOperands.a';
    const source = `
      ret 10 50
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 184. Test instruction (ret) with invalid operand type
  // -------------------------------------------------------------------------
  test('184. should throw error for ret instruction with invalid operand type', () => {
    const aFilePath = 'retInvalidOperand.a';
    const source = `
      ret r1
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming ret expects no operands or specific operands
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  // -------------------------------------------------------------------------
  // 185. Test instruction (lea) with label offset out of bounds
  // -------------------------------------------------------------------------
  test('185. should throw error for lea instruction with label offset out of bounds', () => {
    const aFilePath = 'leaOffsetOutOfBounds.a';
    const source = `
      lea r3, buffer + 300
      halt
buffer: .word 10
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('pcoffset9 out of range');
  });

  // -------------------------------------------------------------------------
  // 186. Test instruction (xor) with valid operands
  // -------------------------------------------------------------------------
  test('186. should assemble xor instruction with valid registers', () => {
    const aFilePath = 'xorValid.a';
    const source = `
      xor r1, r2, r3
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 187. Test instruction (xor) with non-register immediate value
  // -------------------------------------------------------------------------
  test('187. should throw error for xor instruction with non-register immediate value', () => {
    const aFilePath = 'xorImmediateOutOfBounds.a';
    const source = `
      xor r1, 20
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  // -------------------------------------------------------------------------
  // 188. Test instruction (xor) with invalid operand types
  // -------------------------------------------------------------------------
  test('188. should throw error for xor instruction with invalid operand types', () => {
    const aFilePath = 'xorInvalidOperands.a';
    const source = `
      xor r1, label
      halt
    label:
      .word 10
    `;
    virtualFs[aFilePath] = source;

    // Assuming xor expects registers or immediate, not label
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  // -------------------------------------------------------------------------
  // 189. Test instruction (xor) with extra operands (should ignore extras)
  // -------------------------------------------------------------------------
  test('189. should assemble xor instruction with extra operands without throwing error', () => {
    const aFilePath = 'xorExtraOperands.a';
    const source = `
      xor r1, r2, r3, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 190. Test assembler with line exceeding maximum character limit
  // -------------------------------------------------------------------------
  test.skip('190. should throw error for line exceeding maximum character limit', () => {
    // This test is currently paused because, while it appears the LCC has a charater per line
    // limit, it is unclear precisely what the limit is (it seems to be around 300 chars)
    // and its behavior when the limit is exeeded does not seem to be consistent (as of 12/2024)
    const aFilePath = 'exceedMaxLine.a';
    const longLine = 'a'.repeat(301);
    const source = `
      mov r0, 5 ; ${longLine}
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Line exceeds maximum length of 300 characters');
  });

  // -------------------------------------------------------------------------
  // 191. Test instruction (not) with valid operands
  // -------------------------------------------------------------------------
  test('191. should assemble not instruction with valid operands', () => {
    const aFilePath = 'notValid.a';
    const source = `
      not r1, r2
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 192. Test instruction (not) with invalid operand type
  // -------------------------------------------------------------------------
  test('192. should throw error for not instruction with invalid operand type', () => {
    const aFilePath = 'notInvalidOperand.a';
    const source = `
      not r1, 5
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming not expects exactly two registers
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  // -------------------------------------------------------------------------
  // 193. Test instruction (not) with missing operand
  // -------------------------------------------------------------------------
  test('193. should throw error for not instruction missing operand', () => {
    const aFilePath = 'notMissingOperand.a';
    const source = `
      not r1
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming not expects two operands
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  // -------------------------------------------------------------------------
  // 194. Test instruction (not) with extra operands (should ignore extras)
  // -------------------------------------------------------------------------
  test('194. should assemble not instruction with extra operands without throwing error', () => {
    const aFilePath = 'notExtraOperands.a';
    const source = `
      not r1, r2, extra
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 195. Test instruction (jmp) with label that looks like a reserved keyword
  // -------------------------------------------------------------------------
  test('195. should throw no error for br instruction with label that might seem like a reserved keyword', () => {
    const aFilePath = 'jmpReservedLabel.a';
    const source = `
      br halt
      halt:
        halt
    `;
    virtualFs[aFilePath] = source;

    // The take-away here is that there are no reserved keywords in the LCC assembly language
    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // 196. Test instruction (add) with maximum positive immediate
  // -------------------------------------------------------------------------
  test('196. should assemble add instruction with maximum positive immediate', () => {
    const aFilePath = 'addMaxPositiveImmediate.a';
    const source = `
      add r0, r1, 15
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming imm5 upper bound is 15
    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 197. Test instruction (add) with maximum negative immediate
  // -------------------------------------------------------------------------
  test('197. should assemble add instruction with maximum negative immediate', () => {
    const aFilePath = 'addMaxNegativeImmediate.a';
    const source = `
      add r0, r1, -16
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming imm5 lower bound is -16
    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 198. Test instruction (add) with immediate below negative bound
  // -------------------------------------------------------------------------
  test('198. should throw error for add instruction with immediate below negative bound', () => {
    const aFilePath = 'addImmediateBelowBound.a';
    const source = `
      add r0, r1, -17
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('imm5 out of range');
  });

  // -------------------------------------------------------------------------
  // 199. Test instruction (add) with immediate above positive bound
  // -------------------------------------------------------------------------
  test('199. should throw error for add instruction with immediate above positive bound', () => {
    const aFilePath = 'addImmediateAboveBound.a';
    const source = `
      add r0, r1, 16
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('imm5 out of range');
  });

  // -------------------------------------------------------------------------
  // 200. Test instruction (add) with invalid number format (hex)
  // -------------------------------------------------------------------------
  test('200. should throw error for add instruction with invalid hexadecimal immediate', () => {
    const aFilePath = 'addInvalidHexImmediate.a';
    const source = `
      add r0, r1, 0xG
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  // -------------------------------------------------------------------------
  // 201. Test giving blr a non-numeric 2nd argument
  // -------------------------------------------------------------------------
  test('201. should throw error for blr instruction with non-numeric 2nd argument', () => {
    const aFilePath = 'blrNonNumericSecondArg.a';
    const source = `
      blr r1, cheese
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  // -------------------------------------------------------------------------
  // 202. Test giving blr a non-register 1st argument
  // -------------------------------------------------------------------------
  test('202. should throw error for blr instruction with non-register 1st argument', () => {
    const aFilePath = 'blrNonRegisterFirstArg.a';
    const source = `
      blr cheese
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad register');
  });

  // -------------------------------------------------------------------------
  // 203. Test giving .string no arguments
  // -------------------------------------------------------------------------
  test('203. should throw error for .string directive with no arguments', () => {
    const aFilePath = 'stringNoArgs.a';
    const source = `
      halt
      .string
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  // -------------------------------------------------------------------------
  // 204. Test load register instruction (ldr) with implicit operand
  // -------------------------------------------------------------------------
  test('204. should throw no error for ldr instruction implicit operand', () => {
    const aFilePath = 'ldrImplicitOperand.a';
    const source = `
      ldr r1, r2
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // 205. Test load register instruction (ldr) with label and offset (unsupported)
  // -------------------------------------------------------------------------
  test('205. should throw error for ldr instruction with label and offset', () => {
    const aFilePath = 'ldrLabelOffset.a';
    const source = `
      ldr r1, r2, label + 5
      halt
    label:
      .word 10
    `;
    virtualFs[aFilePath] = source;

    // Assuming ldr expects a numeric offset, not label
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

  // -------------------------------------------------------------------------
  // 206. Test instruction (sext) with missing operands
  // -------------------------------------------------------------------------
  test('206. should throw error for sext instruction missing operands', () => {
    const aFilePath = 'sextMissingOperands.a';
    const source = `
      sext
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  // -------------------------------------------------------------------------
  // 207. Test instruction (mvr) with missing operands
  // -------------------------------------------------------------------------
  test('207. should throw error for mvr instruction missing operands', () => {
    const aFilePath = 'mvrMissingOperands.a';
    const source = `
      mvr
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing register');
  });

  // -------------------------------------------------------------------------
  // 208. Test different case, same spelling of labels
  // -------------------------------------------------------------------------
  test('208. should throw no error for different case, same spelling of labels', () => {
    const aFilePath = 'differentCaseSameLabel.a';
    const source = `
     halt
x:   .word 10
X:   .word 15
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 209. Test .string directive with escape newline char inside
  // -------------------------------------------------------------------------
  test('209. should assemble .string directive with escaped newline char', () => {
    const aFilePath = 'stringEscapeNewline.a';
    const source = `
    lea r0, x
    sout r0
    halt
x: .string "Hello,\\nworld!"
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // 210. Test offset with missing number
  // -------------------------------------------------------------------------
  test('210. should throw error for offset with missing number', () => {
    const aFilePath = 'offsetMissingNumber.a';
    const source = `
    lea r0, x +
    halt
x: .word 10
    `;

    virtualFs[aFilePath] = source;
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing number');
  });

  // -------------------------------------------------------------------------
  // 211. Test lea with no arguments
  // -------------------------------------------------------------------------
  test('211. should throw error for lea with no arguments', () => {
    const aFilePath = 'leaNoArgs.a';
    const source = `
    lea
    halt
    `;

    virtualFs[aFilePath] = source;
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  // -------------------------------------------------------------------------
  // 212. Test .word with operator but no operand
  // -------------------------------------------------------------------------
  test('212. should throw error for .word with operator but no operand', () => {
    const aFilePath = 'wordNoOperand.a';
    const source = `
    halt
x: .word +
    `;

    virtualFs[aFilePath] = source;
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Missing operand');
  });

  // -------------------------------------------------------------------------
  // 213. Test .zero with invalid argument
  // -------------------------------------------------------------------------
  test('213. should throw error for .zero with invalid argument', () => {
    const aFilePath = 'zeroInvalidArg.a';
    const source = `
    halt
x: .zero +
`;

    virtualFs[aFilePath] = source;
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad number');
  });

});