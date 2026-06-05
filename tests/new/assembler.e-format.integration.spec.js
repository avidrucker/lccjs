/**
 * @file assembler.e-format.integration.spec.js
 *
 * Verify the distinction between .e file format (oC preamble + little-endian words)
 * and .hex file format (raw 16-bit word values, one per line). (#756)
 *
 * Risk: a fixture author who copies raw .e bytes into a .hex file silently gets wrong
 * machine code (word 0x6F43 has opcode 6, LDR, not opcode 13, MVI). This mistake was
 * caught by inspection during #747; these tests are the automated guard.
 */

const Assembler = require('../../src/core/assembler');
const Interpreter = require('../../src/core/interpreter');
const { setupAssemblerIntegrationHarness } = require('../helpers/assemblerIntegrationHarness');

jest.mock('fs');

describe('.e file format: oC preamble and LE word encoding (#756)', () => {
  let assembler;
  let virtualFs;
  const { getAssembler, getVirtualFs } = setupAssemblerIntegrationHarness(Assembler);

  beforeEach(() => {
    assembler = getAssembler();
    virtualFs = getVirtualFs();
  });

  // ---------------------------------------------------------------------------
  // 1. .e preamble: assembled output starts with oC (0x6F 0x43), not a raw word
  // ---------------------------------------------------------------------------
  test('assembled .e file begins with oC preamble (0x6F 0x43); first machine word is LE at offset 2', () => {
    // mov r0, 5 (D005 LE) / dout r0 (F002 LE) / nl (F001 LE) / halt (F000 LE)
    virtualFs['simple.a'] = '    mov r0, 5\n    dout r0\n    nl\n    halt\n';

    assembler.main(['simple.a']);

    const eBuffer = virtualFs['simple.e'];
    expect(Buffer.isBuffer(eBuffer)).toBe(true);
    expect(eBuffer[0]).toBe(0x6F); // 'o' — preamble byte 1
    expect(eBuffer[1]).toBe(0x43); // 'C' — preamble byte 2
    // 0xD005 (mov r0, 5) stored little-endian: low byte 0x05 at offset 2, high byte 0xD0 at offset 3
    expect(eBuffer[2]).toBe(0x05);
    expect(eBuffer[3]).toBe(0xD0);
  });

  // ---------------------------------------------------------------------------
  // 2. .hex format: raw word values, NOT .e bytes — assembles and runs correctly
  // ---------------------------------------------------------------------------
  test('.hex with raw word values (D005 F002 F001 F000) assembles to correct outputBuffer and runs to produce "5\\n"', () => {
    // .hex lines are raw 16-bit word values — NOT the preamble+LE bytes of a .e file.
    // Wrong: '6F43\n05D0\n...' (copying .e bytes) → word 0x6F43 has opcode 6 (LDR), silent wrong code.
    // Correct: 'D005\nF002\nF001\nF000\n' (raw instruction words)
    virtualFs['correct.hex'] = 'D005\nF002\nF001\nF000\n';
    virtualFs['name.nnn'] = 'Cheese\n';

    assembler.main(['correct.hex']);

    // outputBuffer holds the 16-bit instruction words
    expect(assembler.outputBuffer[0]).toBe(0xD005); // mov r0, 5
    expect(assembler.outputBuffer[1]).toBe(0xF002); // dout r0
    expect(assembler.outputBuffer[2]).toBe(0xF001); // nl
    expect(assembler.outputBuffer[3]).toBe(0xF000); // halt

    // The assembler wrote correct.e (oC preamble + LE words) into virtualFs.
    // Running it confirms the .hex → .e → execution round-trip produces the right output.
    const interpreter = new Interpreter();
    interpreter.main(['correct.e']);

    expect(interpreter.output).toBe('5\n');
  });
});
