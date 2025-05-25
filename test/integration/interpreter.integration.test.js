/**
 * @file interpreter.integration.test.js
 *
 * Demonstrates how to properly mock the name.nnn file creation and usage.
 */

const fs = require('fs');
const path = require('path');
const Interpreter = require('../../src/core/interpreter');

jest.mock('fs');

describe('Interpreter Integration Tests', () => {
  let interpreter;

  // A "virtual FS" object that holds filenames and contents (string or Buffer).
  // We will rebuild this for each test.
  let virtualFs;

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'warn').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });
    jest.spyOn(console, 'info').mockImplementation(() => { });
    jest.spyOn(process.stdout, 'write').mockImplementation(() => { });
  });

  afterAll(() => {
    console.log.mockRestore();
    console.warn.mockRestore();
    console.error.mockRestore();
    console.info.mockRestore();
    process.stdout.write.mockRestore();
  });

  beforeEach(() => {
    // Reset all mocks
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
      // If it's a string and encoding is 'utf8', return it as a string
      if (typeof content === 'string') {
        if (encoding === 'utf8') return content;
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

    const nameFilePath = 'name.nnn';
    virtualFs[nameFilePath] = 'Cheese\n';

    interpreter = new Interpreter();
  });

  test('1. Should read existing name.nnn file (Cheese) and run minimal .e file', () => {
    // We'll call our .e file 'demoA.e' and the name file 'name.nnn'
    // Provide minimal valid .e bytes: starts with 'o'(0x6F), then 'C'(0x43), then a 'halt' (0xF0,0x00)
    const eFilePath = 'demoA.e';

    // Put these in the virtual FS so "existsSync" sees them:
    // 1) the .e file -> as a Buffer
    virtualFs[eFilePath] = Buffer.from([0x6F, 0x43, 0x00, 0xF0]);
    // 2) the name.nnn -> as a string "Cheese\n", which is created in the beforeEach

    // Now run the interpreter
    expect(() => {
      interpreter.main([eFilePath]);
    }).not.toThrow();

    // The interpreter should have read the name file successfully
    // (No prompt, because file existed.)
    // And the program is just "halt", so no real output
    expect(interpreter.output).toBe('');
  });

  // TODO: convert this to an e2e test
  test.skip('2. Should create name.nnn if it does not exist (simulate user name = "MilkyWay")', () => {
    const eFilePath = 'someFile.e';
    const nameFilePath = 'name.nnn';
    delete virtualFs[nameFilePath]; // deletes name.nnn so it does not exist

    // We'll put a minimal .e file in the virtual FS (the program just halts):
    virtualFs[eFilePath] = Buffer.from([0x6F, 0x43, 0x00, 0xF0]);
    // But do NOT define `virtualFs[nameFilePath]`, so the file doesn't exist

    // Next, we must also mock the user input that name.js tries to read
    // from stdin if the .nnn file does not exist.
    // In your `name.js`, it calls readLineFromStdin() => fs.readSync(...).
    // We can mock fs.readSync or we can do a trick with a buffer. For simplicity:
    let readBuffer = Buffer.from('MilkyWay\n', 'utf8');
    let readOffset = 0;
    fs.readSync.mockImplementation((fd, buffer, offset, length, position) => {
      if (readOffset >= readBuffer.length) {
        return 0; // EOF
      }
      buffer[0] = readBuffer[readOffset];
      readOffset++;
      return 1;
    });

    // Now run the interpreter
    expect(() => {
      interpreter.main([eFilePath]);
    }).not.toThrow();

    // Because the .nnn did not exist, the code should have prompted for a name,
    // read "MilkyWay", and created name.nnn with that content.
    expect(virtualFs[nameFilePath]).toBe('MilkyWay\n');

    // Program output is still empty, because we just halted.
    expect(interpreter.output).toBe('');
  });

  test('3. Should interpret a typical demoA.e with name.nnn existing', () => {
    const eFilePath = 'demoA.e';
    // Provide typical hex: 6F43 (header) + 05D0 (mov r0,5) + 02F0 (dout r0) + 01F0 (nl) + 00F0 (halt)
    const demoABytes = [0x6F, 0x43, 0x05, 0xD0, 0x02, 0xF0, 0x01, 0xF0, 0x00, 0xF0];
    virtualFs[eFilePath] = Buffer.from(demoABytes);

    // Run
    interpreter.main([eFilePath]);

    // Output should be "5\n"
    expect(interpreter.output).toBe('5\n');
  });

  // -----------------------------------------------------------------------------
  // 4. Test handling of no arguments => usage message
  // -----------------------------------------------------------------------------
  test('4. should fail if no filename is provided', () => {

    expect(() => {
      interpreter.main([]);
    }).toThrow('Usage: node interpreter.js <input filename> [options]');
  });

  // -----------------------------------------------------------------------------
  // 5. Test handling of a .e file that does not exist
  // -----------------------------------------------------------------------------
  test('5. should fail if the .e file does not exist', () => {
    const nonExistentFile = 'doesNotExist.e';
    // No file is placed in virtualFs, so it doesn't exist
    expect(() => {
      interpreter.main([nonExistentFile]);
    }).toThrow(`Cannot open input file ${nonExistentFile}`);
  });

  // -----------------------------------------------------------------------------
  // 6. Test handling of invalid signature in .e file (missing 'o')
  // -----------------------------------------------------------------------------
  test('6. should fail if the .e file does not start with "o" (0x6F)', () => {
    const eFilePath = 'badSignature.e';
    // Let’s say we start with 0x41 instead of 0x6F
    const demoABytes = [0x41, 0x43, 0x05, 0xD0, 0x02, 0xF0, 0x01, 0xF0, 0x00, 0xF0];
    virtualFs[eFilePath] = Buffer.from(demoABytes);

    // mockEFileWithName(fileName, hexString, 'Invalid Signature\n');

    expect(() => {
      interpreter.main([eFilePath]);
    }).toThrow(`${eFilePath} is not in lcc format`); // `${fileName} is not a valid LCC executable file: missing 'o' signature`
  });

  // -----------------------------------------------------------------------------
  // 7. A minimal valid .e file (demoA.e) => expect "5\n"
  // -----------------------------------------------------------------------------
  test('7. should run a minimal valid .e file and produce correct output', () => {
    const eFilePath = 'demoA.e';
    // 'oC', mov r0,5, dout r0, nl, halt
    const demoABytes = [0x6F, 0x43, 0x05, 0xD0, 0x02, 0xF0, 0x01, 0xF0, 0x00, 0xF0];
    virtualFs[eFilePath] = Buffer.from(demoABytes);

    expect(() => {
      interpreter.main([eFilePath]);
    }).not.toThrow();

    // "mov r0,5" => r0=5 => "dout r0" => "5", "nl" => newline
    expect(interpreter.output).toBe('5\n');
  });

  // -----------------------------------------------------------------------------
  // 8. Test unknown option should throw
  // -----------------------------------------------------------------------------
  test('8. should fail on unknown option', () => {
    const eFilePath = 'demoA.e';
    const test5Bytes = [0x6F, 0x43, 0x00, 0xF0]; // just 'oC' + halt
    virtualFs[eFilePath] = Buffer.from(test5Bytes);

    expect(() => {
      interpreter.main([eFilePath, '-Z']);
    }).toThrow('Bad command line switch: -Z'); // Unknown option
  });

  // -----------------------------------------------------------------------------
  // 9. Test the -L (load point) option
  // -----------------------------------------------------------------------------
  test('9. should accept -L and parse hex loadPoint properly', () => {
    const eFilePath = 'demoA.e';
    const test6Bytes = [0x6F, 0x43, 0x00, 0xF0]; // just 'oC' + halt
    virtualFs[eFilePath] = Buffer.from(test6Bytes);

    expect(() => {
      interpreter.main([eFilePath, '-L 0030']);
    }).not.toThrow();

    // Confirm it set loadPoint = 0x30
    expect(interpreter.loadPoint).toBe(0x30);
  });

  // TODO: convert this to an e2e test
  // -----------------------------------------------------------------------------
  // 10. Simulate infinite loop => after 500000 instructions => throws possible loop
  // -----------------------------------------------------------------------------
  test.skip('10. should stop if instructionsExecuted exceed 500000', () => {
    const eFilePath = 'infiniteLoop.e';
    // Suppose a program that loops forever.
    const test10Bytes = [0x6F, 0x43, 0x02, 0xF0]; // just 'oC' + dout r0
    virtualFs[eFilePath] = Buffer.from(test10Bytes);

    expect(() => {
      interpreter.main([eFilePath]);
    }).toThrow('Possible infinite loop');
  });

  // -----------------------------------------------------------------------------
  // 11. Test a file that does: mov r0,42; dout r0; halt => outputs "42"
  // -----------------------------------------------------------------------------
  test('11. should run a file that performs DOUT and HALT correctly', () => {
    const eFilePath = 'simpleDout.e';
    // 6F43 => 'oC'
    // 2AD0 => mov r0,42 (example)
    // 02F0 => dout r0
    // 00F0 => halt
    const test11Bytes = [0x6F, 0x43, 0x2A, 0xD0, 0x02, 0xF0, 0x00, 0xF0];
    virtualFs[eFilePath] = Buffer.from(test11Bytes);

    expect(() => {
      interpreter.main([eFilePath]);
    }).not.toThrow();

    expect(interpreter.output).toBe('42');
  });

  // TODO: remove this test, as it is not a valid test case
  // -----------------------------------------------------------------------------
  // 12. (Potentially) referencing an undefined label at runtime => 
  //     Typically the interpreter expects a fully assembled .e, 
  //     so "undefined label" might not occur. This might be an assembler-level error. 
  //     We'll simulate a jump to a nonsense address to see if interpreter complains.
  // -----------------------------------------------------------------------------
  test.skip('12. should fail if code tries to jump to an invalid address (simulate undefined label)', () => {
    const eFilePath = 'undefinedLabel.e';
    // 'oC' + something that jumps to address 0x270F + halt
    // e.g. 0xC000 270F => This is purely hypothetical; your interpreter might differ.
    const test12Bytes = [0x6F, 0x43, 0xC0, 0x00, 0x27, 0x0F, 0x00, 0xF0];
    virtualFs[eFilePath] = Buffer.from(test12Bytes);

    // Adjust the expected error message to match your interpreter's runtime error
    expect(() => {
      interpreter.main([eFilePath]);
    }).toThrow('Runtime Error:');
  });

  // -----------------------------------------------------------------------------
  // 13. Test multiple .e files each with name.nnn 
  //     We'll demonstrate running them separately in one test
  // -----------------------------------------------------------------------------
  test('13. should handle multiple .e files', () => {
    const file1 = 'prog1.e';
    const test13Bytes1 = [0x6F, 0x43, 0x05, 0xD0, 0x00, 0xF0]; // mov r0,5 => halt
    virtualFs[file1] = Buffer.from(test13Bytes1);

    const file2 = 'prog2.e';
    const test13Bytes2 = [0x6F, 0x43, 0x0A, 0xD0, 0x02, 0xF0, 0x00, 0xF0]; // mov r0,10 => dout r0 => halt
    virtualFs[file2] = Buffer.from(test13Bytes2);

    // Run first
    expect(() => {
      interpreter.main([file1]);
    }).not.toThrow();
    expect(interpreter.output).toBe(''); // no DOUT

    // Re-init interpreter for second
    interpreter = new Interpreter();
    interpreter.generateStats = true;

    expect(() => {
      interpreter.main([file2]);
    }).not.toThrow();
    // DOUT r0 => "10"
    expect(interpreter.output).toBe('10');
  });

  // -----------------------------------------------------------------------------
  // 14. Test a program that performs DIN => we mock user input
  // -----------------------------------------------------------------------------
  test('14. should handle DIN by providing input via inputBuffer', () => {
    const eFilePath = 'inputProgram.e';
    // 6F43 07F2 01D0 02F2 00F0
    const test14Bytes = [0x6F, 0x43, 0x07, 0xF2, 0x01, 0xD0, 0x02, 0xF2, 0x00, 0xF0];
    virtualFs[eFilePath] = Buffer.from(test14Bytes);
    //  07F2 => din r1
    //  01D0 => mov r0, 1
    //  02F2 => dout r1
    //  00F0 => halt

    // Provide an input line in interpreter's inputBuffer
    interpreter.inputBuffer = '42\n';

    expect(() => {
      interpreter.main([eFilePath]);
    }).not.toThrow();

    // We expect output "42\n42" because the program stores the input 
    // in the output and then prints it again to the output 
    expect(interpreter.output).toBe('42\n42');
  });

  // -----------------------------------------------------------------------------
  // 15. Test handling of TRAP HALT
  // -----------------------------------------------------------------------------
  test('15. should halt correctly when TRAP HALT is executed', () => {
    const eFilePath = 'haltProgram.e';
    // 'oC' + 00F0 => TRAP #0 => halt
    virtualFs[eFilePath] = Buffer.from([0x6F, 0x43, 0x00, 0xF0]);

    expect(() => {
      interpreter.main([eFilePath]);
    }).not.toThrow();

    expect(interpreter.running).toBe(false);
    expect(interpreter.output).toBe('');
  });

  // -----------------------------------------------------------------------------
  // 16. Multiple TRAPs: mov r0,5 => dout => nl => halt => expect "5\n"
  // -----------------------------------------------------------------------------
  test('16. should handle multiple TRAPs correctly', () => {
    const eFilePath = 'multipleTraps.e';
    // mov r0,5 => 05D0, dout => 02F0, nl => 01F0, halt => 00F0
    virtualFs[eFilePath] = Buffer.from([0x6F, 0x43, 0x05, 0xD0, 0x02, 0xF0, 0x01, 0xF0, 0x00, 0xF0]);

    expect(() => {
      interpreter.main([eFilePath]);
    }).not.toThrow();

    expect(interpreter.output).toBe('5\n');
  });

  // -----------------------------------------------------------------------------
  // 17. Program that manipulates memory: e.g. store, load, etc.
  // -----------------------------------------------------------------------------
  test('17. should execute a program that manipulates memory correctly', () => {
    const eFilePath = 'memoryManipulation.e';
    //     mov r0, 123
    //     st r0, x  
    //     ld r1, y
    //     dout r1 
    //     halt 
    // x: .word 7
    // y: .word 35
    // 6F43 7BD0 0330 0322 02F2 00F0 0700 2300
    virtualFs[eFilePath] = Buffer.from([0x6F, 0x43, 0x7B, 0xD0, 0x03, 0x30, 0x03, 0x22,
      0x02, 0xF2, 0x00, 0xF0, 0x07, 0x00, 0x23, 0x00]);

    expect(() => {
      interpreter.main([eFilePath]);
    }).not.toThrow();

    // The program presumably does "dout r2" => "35"
    expect(interpreter.r[1]).toBe(35);
    expect(interpreter.output).toBe('35');
  });

  // -----------------------------------------------------------------------------
  // 18. Test .lst and .bst generation
  // -----------------------------------------------------------------------------
  test('18. should generate .lst and .bst files when generateStats is true', () => {
    const eFilePath = 'statsProgram.e';
    virtualFs[eFilePath] = Buffer.from([0x6F, 0x43, 0x00, 0xF0]);

    // Capture writes to .lst, .bst
    const writtenFiles = {};
    fs.writeFileSync.mockImplementation((fName, content) => {
      // Save it in an object by base filename
      writtenFiles[path.basename(fName)] = content;
    });

    interpreter.generateStats = true;

    expect(() => {
      interpreter.main([eFilePath]);
    }).not.toThrow();

    const lstFile = eFilePath.replace(/\.e$/, '.lst');
    const bstFile = eFilePath.replace(/\.e$/, '.bst');

    expect(writtenFiles[lstFile]).toBeDefined();
    expect(writtenFiles[bstFile]).toBeDefined();
  });

  // -----------------------------------------------------------------------------
  // 19. Arithmetic operations
  // -----------------------------------------------------------------------------
  test('19. should correctly perform arithmetic operations', () => {
    const eFilePath = 'arithmetic.e';
    // Example: mov r0,10 => add r0,r0,5 => dout r0 => halt => expect '15'
    // mov r0, 10
    // add r0, r0, 5
    // dout r0
    // halt
    // 6F43 0AD0 2510 02F0 00F0
    virtualFs[eFilePath] = Buffer.from([0x6F, 0x43, 0x0A, 0xD0, 0x25, 0x10, 0x02, 0xF0, 0x00, 0xF0]);

    expect(() => {
      interpreter.main([eFilePath]);
    }).not.toThrow();

    expect(interpreter.output).toBe('15');
  });

  // -----------------------------------------------------------------------------
  // 20. Branching
  // -----------------------------------------------------------------------------
  test('20. should correctly handle branching instructions', () => {
    const eFilePath = 'branching.e';
    // Example: 
    //   mov r0, 3
    // loop:
    //   dout r0
    //   nl
    //   sub r0, r0, 1
    //   brnz loop
    //   halt
    // => "3\n2\n1\n"
    // 6F43 03D0 02F0 01F0 21B0 FC03 00F0
    virtualFs[eFilePath] = Buffer.from([0x6F, 0x43, 0x03, 0xD0, 0x02, 0xF0, 0x01,
      0xF0, 0x21, 0xB0, 0xFC, 0x03, 0x00, 0xF0]);

    expect(() => {
      interpreter.main([eFilePath]);
    }).not.toThrow();

    expect(interpreter.output).toBe('3\n2\n1\n');
  });

  // -----------------------------------------------------------------------------
  // 21. Stack operations
  // -----------------------------------------------------------------------------
  test('21. should correctly handle stack operations', () => {
    const eFilePath = 'stackProgram.e';
    // mov r0, 5
    // push r0
    // pop r1
    // dout r1
    // halt
    // 6F43 05D0 00A0 01A2 02F2 00F0
    virtualFs[eFilePath] = Buffer.from([0x6F, 0x43, 0x05, 0xD0, 0x00, 0xA0,
      0x01, 0xA2, 0x02, 0xF2, 0x00, 0xF0]);

    expect(() => {
      interpreter.main([eFilePath]);
    }).not.toThrow();

    // After push/pop, r1 should be 5
    expect(interpreter.r[1]).toBe(5);
    expect(interpreter.output).toBe('5');
  });

  // -----------------------------------------------------------------------------
  // 22. Test handling of division by zero
  // -----------------------------------------------------------------------------
  test('22. should throw error when dividing by zero', () => {
    const eFilePath = 'divideByZero.e';
    // mov r0, 5
    // mov r1, 0
    // div r0, r1
    // halt
    virtualFs[eFilePath] = Buffer.from([0x6F, 0x43, 0x05, 0xD0, 0x00, 0xD2, 0x48, 0xA0, 0x00, 0xF0]);

    expect(() => {
      interpreter.main([eFilePath]);
    }).toThrow('Floating point exception');
  });
});
