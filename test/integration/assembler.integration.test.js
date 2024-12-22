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

// A helper to mock out "fs.readFileSync" so we can feed our own
// source code content into the assembler:
function mockSourceFile(fileName, content) {
  fs.readFileSync.mockImplementation((requestedFileName, encoding) => {
    if (requestedFileName === fileName && encoding === 'utf-8') {
      return content;
    }
    throw new Error(`Unexpected file read: ${requestedFileName}`);
  });
}

// A helper to mock "fs.openSync":
function mockOpenSync(success = true) {
  if (success) {
    fs.openSync.mockImplementation((outFileName, mode) => {
      // Return a dummy file descriptor
      return 123;
    });
  } else {
    fs.openSync.mockImplementation(() => {
      throw new Error('Cannot open output file');
    });
  }
}

// A helper to mock "fs.writeSync":
function mockWriteSync() {
  fs.writeSync.mockImplementation((fd, bufferOrString, ...args) => {
    // no-op or store the bufferOrString somewhere
  });
}

// A helper to mock "fs.closeSync":
function mockCloseSync() {
  fs.closeSync.mockImplementation((fd) => {
    // no-op
  });
}

describe('Assembler', () => {
  let assembler;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

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
    const fileName = 'empty.a';
    mockSourceFile(fileName, '');
    mockOpenSync(true);
    mockWriteSync();
    mockCloseSync();

    // Pass the file as argument
    expect(() => {
      assembler.main([fileName]);
    }).toThrow('Empty file');
    // Because with no instructions, pass1 might not find a .start label, etc.
    // Or if your assembler is okay with an empty file, it may differ:
    //
    // If your assembler is truly okay with an empty file, you might
    // expect no throw. For example, you could do:
    //
    // expect(() => {
    //   assembler.main([fileName]);
    // }).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // 4. Test assembling a minimal program (demoA)
  // -------------------------------------------------------------------------
  test('4. should assemble demoA.a with no errors', () => {
    const fileName = 'demoA.a';
    const source = `
      ; demoA.a: simple test
      mov r0, 5
      dout r0
      nl
      halt
    `;
    mockSourceFile(fileName, source);
    mockOpenSync(true);
    mockWriteSync();
    mockCloseSync();

    // We expect no throw for a valid file:
    expect(() => {
      assembler.main([fileName]);
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
    const fileName = 'binaryExample.bin';
    const source = `
      0001000000000010 ; this is a 16-bit binary line
      0011100000000101 ; another 16-bit binary line
    `;
    mockSourceFile(fileName, source);
    mockOpenSync(true);
    mockWriteSync();
    mockCloseSync();

    expect(() => {
      assembler.main([fileName]);
    }).not.toThrow();

    // The lines should have been parsed into two words:
    expect(assembler.outputBuffer.length).toBe(2);
    // We can also verify the numeric values if desired:
    expect(assembler.outputBuffer[0]).toBe(parseInt('0001000000000010', 2));
    expect(assembler.outputBuffer[1]).toBe(parseInt('0011100000000101', 2));
  });

  test('5b. should throw if .bin file line is not 16 bits', () => {
    const fileName = 'badBinary.bin';
    const source = `
      0101001001 ; only 10 bits
    `;
    mockSourceFile(fileName, source);
    mockOpenSync(true);
    mockWriteSync();
    mockCloseSync();

    expect(() => {
      assembler.main([fileName]);
    }).toThrow('does not have exactly 16 bits');
  });

  test('5c. should throw if .bin file has non-binary characters', () => {
    const fileName = 'badBinary2.bin';
    const source = `
      0101001001001XYZ
    `;
    mockSourceFile(fileName, source);
    mockOpenSync(true);
    mockWriteSync();
    mockCloseSync();

    expect(() => {
      assembler.main([fileName]);
    }).toThrow('is not purely binary');
  });

  // -------------------------------------------------------------------------
  // 6. Test .hex file parsing
  // -------------------------------------------------------------------------
  test('6a. should assemble a .hex file (each line exactly 4 hex digits)', () => {
    const fileName = 'hexExample.hex';
    const source = `
      1A2F ; 16-bit value in hex
      FFFF
    `;
    mockSourceFile(fileName, source);
    mockOpenSync(true);
    mockWriteSync();
    mockCloseSync();

    expect(() => {
      assembler.main([fileName]);
    }).not.toThrow();

    // Should have 2 words in output buffer:
    expect(assembler.outputBuffer.length).toBe(2);
    expect(assembler.outputBuffer[0]).toBe(0x1A2F);
    expect(assembler.outputBuffer[1]).toBe(0xFFFF);
  });

  test('6b. should throw if .hex file line is not 4 hex digits', () => {
    const fileName = 'badHex.hex';
    const source = `
      1A2 ; only 3 hex digits
    `;
    mockSourceFile(fileName, source);
    mockOpenSync(true);
    mockWriteSync();
    mockCloseSync();

    expect(() => {
      assembler.main([fileName]);
    }).toThrow('does not have exactly 4 nibbles');
  });

  test('6c. should throw if .hex file has invalid hex characters', () => {
    const fileName = 'badHex2.hex';
    const source = `
      X123
    `;
    mockSourceFile(fileName, source);
    mockOpenSync(true);
    mockWriteSync();
    mockCloseSync();

    expect(() => {
      assembler.main([fileName]);
    }).toThrow('is not purely hexadecimal');
  });

  // -------------------------------------------------------------------------
  // 7. Test an example that uses .word, .zero, .string, etc. (like demoB)
  // -------------------------------------------------------------------------
  test('7. should handle directives such as .word, .string, .zero without errors', () => {
    const fileName = 'demoB.a';
    const source = `
      ld r0, x
      add r0, r0, 2
      dout r0
      halt
ask:  .string "What's your first name? "
buffer1: .zero 10
x: .word 5
    `;
    mockSourceFile(fileName, source);
    mockOpenSync(true);
    mockWriteSync();
    mockCloseSync();

    expect(() => {
      assembler.main([fileName]);
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
  test('8. should throw if a referenced label is never defined or declared .extern', () => {
    const fileName = 'undefinedLabel.a';
    const source = `
      ld r0, missingLabel
      halt
    `;
    mockSourceFile(fileName, source);
    mockOpenSync(true);
    mockWriteSync();
    mockCloseSync();

    expect(() => {
      assembler.main([fileName]);
    }).toThrow('Undefined label');
  });

  // -------------------------------------------------------------------------
  // 9. Test .start directive and label resolution
  // -------------------------------------------------------------------------
  test('9. should throw if .start label is undefined', () => {
    const fileName = 'badStart.a';
    const source = `
      .start main
      halt
    `;
    mockSourceFile(fileName, source);
    mockOpenSync(true);
    mockWriteSync();
    mockCloseSync();

    // Pass 2 will complain that main is undefined
    expect(() => {
      assembler.main([fileName]);
    }).toThrow('Undefined label');
  });

  test('should resolve .start label if defined', () => {
    const fileName = 'goodStart.a';
    const source = `
      .start main
    main:
      halt
    `;
    mockSourceFile(fileName, source);
    mockOpenSync(true);
    mockWriteSync();
    mockCloseSync();

    expect(() => {
      assembler.main([fileName]);
    }).not.toThrow();
    expect(assembler.startLabel).toBe('main');
    expect(assembler.startAddress).toBeDefined();
    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 10. Test global and .o object-file generation
  // -------------------------------------------------------------------------
  test.skip('should produce .o file when .global is used', () => {
    const fileName = 'testObject.a';
    const source = `
      .global foo
      mov r0, 123
      halt
foo:  .word 456
    `;
    mockSourceFile(fileName, source);
    mockOpenSync(true);
    mockWriteSync();
    mockCloseSync();

    expect(() => {
      assembler.main([fileName]);
    }).not.toThrow();

    // Assembler should have flagged "isObjectModule = true" and changed
    // the output file name to .o
    expect(assembler.isObjectModule).toBe(true);
    expect(path.extname(assembler.outputFileName)).toBe('.o');
  });

  // -------------------------------------------------------------------------
  // 11. Testing instructions with immediate out-of-range
  // -------------------------------------------------------------------------
  test('should throw if an immediate is out of range for an instruction (e.g. add)', () => {
    const fileName = 'outOfRange.a';
    const source = `
      mov r0, 5
      ; add immediate takes a 5-bit imm, i.e. -16..15
      add r0, r0, 100 ; out of range
      halt
    `;
    mockSourceFile(fileName, source);
    mockOpenSync(true);
    mockWriteSync();
    mockCloseSync();

    expect(() => {
      assembler.main([fileName]);
    }).toThrow('Immediate value out of range');
  });

  // -------------------------------------------------------------------------
  // 12. Testing division by zero? (No direct assembler error, but a good example)
  // -------------------------------------------------------------------------
  test('should assemble demoN.a (division by zero) successfully (no assembler error)', () => {
    const fileName = 'demoN.a';
    const source = `
      mov r0, 3
      mov r1, 0
      div r0, r1
      dout r0
      halt
    `;
    mockSourceFile(fileName, source);
    mockOpenSync(true);
    mockWriteSync();
    mockCloseSync();

    // Even though at runtime this might cause an exception,
    // the assembler itself won't necessarily throw. So we expect no error:
    expect(() => {
      assembler.main([fileName]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 13. Testing a label with offset
  // -------------------------------------------------------------------------
  test('should properly handle label with offset in instruction operand', () => {
    const fileName = 'labelOffset.a';
    const source = `
      mydata: .word 100
      ld r0, mydata + 2
      halt
    `;
    mockSourceFile(fileName, source);
    mockOpenSync(true);
    mockWriteSync();
    mockCloseSync();

    expect(() => {
      assembler.main([fileName]);
    }).not.toThrow();
    expect(assembler.errorFlag).toBe(false);

    // We expect that "mydata" is at loc=0, so "mydata+2" => address 2,
    // which might appear in the final machine code for "ld r0, 2" or something
  });

  // -------------------------------------------------------------------------
  // 14. Test an entire multi-line example that does pass 1 and pass 2 properly
  // -------------------------------------------------------------------------
  test('should assemble a short multi-line example with labels and instructions', () => {
    const fileName = 'multiLine.a';
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
    mockSourceFile(fileName, source);
    mockOpenSync(true);
    mockWriteSync();
    mockCloseSync();

    expect(() => {
      assembler.main([fileName]);
    }).not.toThrow();
    expect(assembler.errorFlag).toBe(false);
    // Should have a non-empty listing and outputBuffer:
    expect(assembler.listing.length).toBeGreaterThan(0);
    expect(assembler.outputBuffer.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 15. Test passing a label to an instruction that doesn't take labels
  // -------------------------------------------------------------------------
  test('should throw an error when passing a non-ascii, non-numeric (i.e. a label) to mov instruction', () => {
    const fileName = 'badMov.a';
    const source = `
      mov r0, notAValidCharOrNumber
      halt
      notAValidCharOrNumber: .string "hello"
    `;
    mockSourceFile(fileName, source);
    mockOpenSync(true);
    mockWriteSync();
    mockCloseSync();

    expect(() => {
      assembler.main([fileName]);
    }).toThrow('Bad number');
  });

  // -------------------------------------------------------------------------
  // 16. Test opening a file that doesn't exist
  // -------------------------------------------------------------------------
  test('should throw an error when opening a file that does not exist', () => {
    const fileName = 'doesNotExist.a';

    // Mock fs.openSync to throw an error
    fs.openSync.mockImplementation(() => {
      throw new Error(`ENOENT: no such file or directory, open '${fileName}'`);
    });

    expect(() => {
      assembler.main([fileName]);
    }).toThrow('Cannot open input file doesNotExist.a');
  });

  // -------------------------------------------------------------------------
  // 17. Test extern and .o object-file generation
  // -------------------------------------------------------------------------
  test.skip('should produce .o file when .extern is used', () => {
    //// TODO: implement this test case by providing the necessary name.nnn file mock
    const fileName = 'testObject2.a';
    const source = `
      .extern bar
      ld r0, bar
      halt
    `;
    mockSourceFile(fileName, source);
    mockOpenSync(true);
    mockWriteSync();
    mockCloseSync();

    expect(() => {
      assembler.main([fileName]);
    }).not.toThrow();

    // Assembler should have flagged "isObjectModule = true" and changed
    // the output file name to .o
    expect(assembler.isObjectModule).toBe(true);
    expect(path.extname(assembler.outputFileName)).toBe('.o');
  });

  // -------------------------------------------------------------------------
  // 18. Test invalid label char detection
  // -------------------------------------------------------------------------
  test('should throw an error when using an invalid label name', () => {
    const fileName = 'invalidLabel.a';
    const source = `
      mov r0, 5
      halt
    5invalidLabel: .word 10
    `;
    mockSourceFile(fileName, source);
    mockOpenSync(true);
    mockWriteSync();
    mockCloseSync();

    expect(() => {
      assembler.main([fileName]);
    }).toThrow('Bad label');
  });

  // -------------------------------------------------------------------------
  // 19. Test duplicate label detection
  // -------------------------------------------------------------------------
  test('should throw an error when using a duplicate label name', () => {
    const fileName = 'duplicateLabel.a';
    const source = `
      mov r0, 5
      halt
    myLabel: .word 10
    myLabel: .word 20
    `;
    mockSourceFile(fileName, source);
    mockOpenSync(true);
    mockWriteSync();
    mockCloseSync();

    expect(() => {
      assembler.main([fileName]);
    }).toThrow('Duplicate label');
  });
});
