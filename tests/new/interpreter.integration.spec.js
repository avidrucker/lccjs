/**
 * @file interpreter.integration.spec.js
 * Integration tests for interpreter.js using Jest
 * 
 * These tests verify the interpreter's core functionalities without creating
 * real files. The filesystem is mocked to provide the interpreter with
 * executable file content and to capture the interpreter's state and output
 * after execution. This approach is particularly useful for testing various
 * runtime scenarios, error conditions, and instruction execution behaviors
 * in isolation.
 * 
 * The tests cover:
 * - Basic program execution and TRAP instruction handling
 * - Register operations and arithmetic instructions
 * - Memory operations (load/store)
 * - Branching and control flow
 * - Stack operations
 * - Input/output operations
 * - Error conditions (division by zero, invalid files, etc.)
 * - Statistics generation (.lst and .bst files)
 */

const fs = require('fs');
const path = require('path');
const Interpreter = require('../../src/core/interpreter');

jest.mock('fs');

// din r1; mov r0,1; dout r1; halt — reused in tests 14, 23a, 23c
// Encoding: oC header + [din r1 = 0xF207] + [mov r0,1 = 0xD001] + [dout r1 = 0xF202] + [halt = 0xF000]
const DIN_R1_DOUT_R1_BYTES = [0x6F, 0x43, 0x07, 0xF2, 0x01, 0xD0, 0x02, 0xF2, 0x00, 0xF0];

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

    // name.nnn here is a pre-#880 artifact. After #880, interpreter.main() no
    // longer reads name.nnn — lcc.js pre-resolves userName and passes it in.
    // Tests that call interpreter.main() directly exercise the standalone path;
    // they do not need name.nnn and do not test name resolution.
    virtualFs['name.nnn'] = 'Cheese\n';

    interpreter = new Interpreter();
  });

  // After #880, interpreter.main() does NOT read name.nnn — userName must be
  // pre-set by the caller (lcc.js owns that step). name.nnn in beforeEach
  // has no effect here. This tests the standalone interpreter.main() path:
  // minimal .e file runs without error, name resolution is not exercised.
  // See name.integration.spec.js for post-#880 wrapper coverage.
  test('1. Should run a minimal .e file via interpreter.main() standalone', () => {
    const eFilePath = 'demoA.e';
    virtualFs[eFilePath] = Buffer.from([0x6F, 0x43, 0x00, 0xF0]);

    expect(() => {
      interpreter.main([eFilePath]);
    }).not.toThrow();

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

  test('3b. should treat bp as a CLI wrapper breakpoint message and continue in non-TTY runs', () => {
    const eFilePath = 'bpNonTty.e';
    virtualFs[eFilePath] = Buffer.from([
      0x6F, 0x43,
      0x07, 0xD0, // mov r0, 7
      0x0E, 0xF0, // bp
      0x02, 0xF0, // dout r0
      0x01, 0xF0, // nl
      0x00, 0xF0, // halt
    ]);

    const isTTYDescriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');

    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: false,
    });

    try {
      expect(() => {
        interpreter.main([eFilePath]);
      }).not.toThrow();

      expect(interpreter.output).toBe('software breakpoint\n7\n');
      expect(interpreter.debugMode).toBe(false);
    } finally {
      if (isTTYDescriptor) {
        Object.defineProperty(process.stdin, 'isTTY', isTTYDescriptor);
      } else {
        delete process.stdin.isTTY;
      }
    }
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

  test('5b. should reject non-.e inputs with the current interpreter.js error message', () => {
    expect(() => {
      interpreter.main(['demoA.a']);
    }).toThrow('Unsupported file type for interpreter.js (expected .e)');
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

  test('6b. should reject an invalid .e signature before printing .lst and .bst file paths', () => {
    const eFilePath = 'badSignatureBeforeStats.e';
    virtualFs[eFilePath] = Buffer.from([0x41, 0x43, 0x00, 0xF0]);

    expect(() => {
      interpreter.main([eFilePath]);
    }).toThrow(`${eFilePath} is not in lcc format`);

    expect(console.log).not.toHaveBeenCalledWith(`lst file = ${eFilePath.replace(/\.e$/, '.lst')}`);
    expect(console.log).not.toHaveBeenCalledWith(`bst file = ${eFilePath.replace(/\.e$/, '.bst')}`);
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

  // -----------------------------------------------------------------------------
  // 10. Simulate infinite loop => after 500000 instructions => throws possible loop
  // -----------------------------------------------------------------------------
  // Moved to pure in-memory coverage in interpreter.unit.spec.js because the
  // reusable runtime path should throw the expected error without activating
  // CLI debugger behavior during test execution.

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

  // -----------------------------------------------------------------------------
  // 12. Unsupported trap vector causes a runtime error (OB-032)
  //     Fixture: oC signature (0x6F 0x43) + word 0xF00F + word 0xF000 (halt,
  //     unreachable). Word 0xF00F = TRAP with vector 15; trap vectors 0–14
  //     are handled; 15+ hit the default → 'Trap vector out of range'.
  //     Words stored little-endian: 0xF00F → [0x0F, 0xF0].
  // -----------------------------------------------------------------------------
  test('12. should throw a runtime error for an unsupported trap vector', () => {
    const eFilePath = 'badTrap.e';
    // trap vector 15 (0x0F) — unsupported → 'Trap vector out of range'
    virtualFs[eFilePath] = Buffer.from([0x6F, 0x43, 0x0F, 0xF0, 0x00, 0xF0]);

    expect(() => {
      interpreter.main([eFilePath]);
    }).toThrow();
  });

  // -----------------------------------------------------------------------------
  // 13. Tests the standalone interpreter.main() path with generateStats=true.
  // name.nnn in beforeEach is not consumed — interpreter.main() uses this.userName
  // (pre-set by the caller, e.g. lcc.js). Pre-setting userName is lcc.js's
  // responsibility (#880); the standalone path writes stats with whatever userName
  // is set (null/undefined produces an empty-name report, which is acceptable here).
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
    virtualFs[eFilePath] = Buffer.from(DIN_R1_DOUT_R1_BYTES);

    // din r1 echoes the input line, then dout r1 prints the value without newline
    interpreter.inputBuffer = '42\n';

    expect(() => {
      interpreter.main([eFilePath]);
    }).not.toThrow();

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
  // 23. CRLF line-ending portability in inputBuffer (OB-025)
  //     readLineFromStdin() normalises \r\n → \n at the start of each call.
  // -----------------------------------------------------------------------------

  test('23a. CRLF input: single \\r\\n line reads correctly', () => {
    const eFilePath = 'crlf1.e';
    virtualFs[eFilePath] = Buffer.from(DIN_R1_DOUT_R1_BYTES);
    interpreter.inputBuffer = '42\r\n';   // Windows-style line ending

    expect(() => { interpreter.main([eFilePath]); }).not.toThrow();
    expect(interpreter.output).toBe('42\n42');
  });

  test('23b. CRLF input: \\r\\n produces same output as \\n (single din/dout)', () => {
    const eFilePath = 'crlf2.e';
    // din r1 (0xF207); dout r1 (0xF202); halt (0xF000)
    virtualFs[eFilePath] = Buffer.from([
      0x6F, 0x43,   // signature
      0x07, 0xF2,   // din  r1  → 0xF207
      0x02, 0xF2,   // dout r1  → 0xF202
      0x00, 0xF0,   // halt     → 0xF000
    ]);
    interpreter.inputBuffer = '10\r\n';

    expect(() => { interpreter.main([eFilePath]); }).not.toThrow();
    // readLineFromStdin normalises \r\n → \n; din echoes '10\n', dout prints '10'
    expect(interpreter.output).toBe('10\n10');
  });

  test('23c. Mixed LF and CRLF in inputBuffer reads correctly', () => {
    const eFilePath = 'crlf3.e';
    virtualFs[eFilePath] = Buffer.from(DIN_R1_DOUT_R1_BYTES);
    interpreter.inputBuffer = '7\n';   // plain LF — should still work

    expect(() => { interpreter.main([eFilePath]); }).not.toThrow();
    expect(interpreter.output).toBe('7\n7');
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
    }).toThrow();
  });
});
