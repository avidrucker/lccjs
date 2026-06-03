/**
 * @file linker.integration.spec.js
 *
 * Integration tests for the full assemble → .o → link → .e → run pipeline.
 *
 * These tests verify that real source strings assembled via assembleSource()
 * produce .o buffers that the linker can correctly resolve and that the
 * resulting .e buffer runs to the expected output in the interpreter.
 *
 * The file system is mocked so no real disk I/O occurs:
 *  - assembled .o bytes are stored in the virtual FS under their module name
 *  - linker.link() reads from / writes to the same virtual FS
 *  - interpreter.executeBuffer() runs the .e buffer in-memory
 *
 * Error-path coverage: undefined external, duplicate global, no-file-written
 * on a failed link.
 */

'use strict';

const fs = require('fs');
const Assembler   = require('../../src/core/assembler');
const Linker      = require('../../src/core/linker');
const Interpreter = require('../../src/core/interpreter');
const { LinkerError } = require('../../src/utils/errors');
const { installMockFileSystem } = require('../helpers/virtualFs');

jest.mock('fs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Assemble a source string using the pure assembleSource() seam and return
 * the raw .o (or .e) bytes.  No file I/O; the assembler uses the source
 * string directly.
 */
function assembleToBytes(source, fileName) {
  const asm = new Assembler();
  const result = asm.assembleSource(source, { inputFileName: fileName });
  return result.outputBytes;
}

/**
 * Run an .e buffer through the interpreter and return interpreter.output.
 * process.stdout.write is already silenced by the beforeAll mock below.
 */
function runBuffer(buffer) {
  const interp = new Interpreter();
  interp.executeBuffer(buffer);
  return interp.output;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Linker Integration: assemble → .o → link → .e → run', () => {
  let state;

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

  beforeEach(() => {
    jest.clearAllMocks();
    state = installMockFileSystem(fs);
  });

  // -------------------------------------------------------------------------
  // Happy path: two-module programs
  // -------------------------------------------------------------------------

  describe('happy path: two-module programs', () => {
    test('extern ld: loads an exported .word value from a second module', () => {
      // Module A references val from module B via ld (9-bit external ref).
      const srcA = `
          .extern val
          ld r0, val
          dout r0
          nl
          halt
      `;
      // Module B exports val = 42.  Linked after A: val lands at addr 4.
      // Linker resolves pcoffset9 = (4 - 0 - 1) = 3.
      const srcB = `
          .global val
val:      .word 42
      `;

      state.files['mod_a.o'] = assembleToBytes(srcA, 'mod_a.a');
      state.files['mod_b.o'] = assembleToBytes(srcB, 'mod_b.a');

      const linker = new Linker();
      linker.link(['mod_a.o', 'mod_b.o'], 'out.e');

      expect(runBuffer(state.files['out.e'])).toBe('42\n');
    });

    test('extern bl: calls an exported function in a second module, result in r0', () => {
      // Caller uses bl (11-bit external ref) to jump to getval in module B.
      // getval puts 99 in r0 and rets.  Module A: 4 words (bl@0, dout@1, nl@2,
      // halt@3).  Module B starts at addr 4.
      // Linker resolves pcoffset11 = (4 - 0 - 1) = 3.
      const srcCaller = `
          .extern getval
          bl getval
          dout r0
          nl
          halt
      `;
      const srcCallee = `
          .global getval
getval:   mov r0, 99
          ret
      `;

      state.files['caller.o'] = assembleToBytes(srcCaller, 'caller.a');
      state.files['callee.o'] = assembleToBytes(srcCallee, 'callee.a');

      const linker = new Linker();
      linker.link(['caller.o', 'callee.o'], 'linked.e');

      expect(runBuffer(state.files['linked.e'])).toBe('99\n');
    });

    test('.start in second module sets the executable entry point', () => {
      // Module A (data) exports datum = 7, no start.  Module B declares
      // .start main and loads datum via extern ld.  Linked as [data, main]:
      //   addr 0: datum (.word 7) — from mod_data
      //   addr 1: main  (ld r0, datum)  ← S entry: start = 0+1 = 1
      //   addr 2: dout r0
      //   addr 3: nl
      //   addr 4: halt
      // pcoffset9 for ld r0,datum: (0 - 1 - 1) = -2, in range.
      const srcData = `
          .global datum
datum:    .word 7
      `;
      const srcMain = `
          .start main
          .extern datum
main:     ld r0, datum
          dout r0
          nl
          halt
      `;

      state.files['data.o'] = assembleToBytes(srcData, 'data.a');
      state.files['main.o'] = assembleToBytes(srcMain, 'main.a');

      const linker = new Linker();
      linker.link(['data.o', 'main.o'], 'prog.e');

      expect(runBuffer(state.files['prog.e'])).toBe('7\n');
    });

    test('three-value cross-module add: caller loads two extern .words and sums them', () => {
      // Module A: loads two values from module B, adds them, outputs the sum.
      // a = 11, b = 31 → sum = 42.
      // Module A code: 7 instructions (ld r0,a; ld r1,b; add r0,r0,r1;
      //                                dout r0; nl; halt)
      // Module B code: 2 words (a=11, b=31).  After link [A, B]:
      //   a is at addr 6, b at addr 7.
      const srcA = `
          .extern a
          .extern b
          ld r0, a
          ld r1, b
          add r0, r0, r1
          dout r0
          nl
          halt
      `;
      const srcB = `
          .global a
          .global b
a:        .word 11
b:        .word 31
      `;

      state.files['calc_a.o'] = assembleToBytes(srcA, 'calc_a.a');
      state.files['calc_b.o'] = assembleToBytes(srcB, 'calc_b.a');

      const linker = new Linker();
      linker.link(['calc_a.o', 'calc_b.o'], 'sum.e');

      expect(runBuffer(state.files['sum.e'])).toBe('42\n');
    });

    test('mirrors the canonical s1.a/s2.a demo pair (x=9)', () => {
      // s1 loads x from s2 and prints it; s2 exports x=9.
      // s1 code: 4 words (ld, dout, nl, halt).  s2 code: 2 words (x=9, y=7).
      // x lands at addr 4; pcoffset9 = (4 - 0 - 1) = 3.
      const s1 = `
          .extern x
          ld r0, x
          dout r0
          nl
          halt
      `;
      const s2 = `
          .global x
x:        .word 9
y:        .word 7
      `;

      state.files['s1.o'] = assembleToBytes(s1, 's1.a');
      state.files['s2.o'] = assembleToBytes(s2, 's2.a');

      const linker = new Linker();
      linker.link(['s1.o', 's2.o'], 's.e');

      expect(runBuffer(state.files['s.e'])).toBe('9\n');
    });
  });

  // -------------------------------------------------------------------------
  // Error paths
  // -------------------------------------------------------------------------

  describe('error paths', () => {
    test('undefined external reference throws LinkerError', () => {
      const src = `
          .extern ghost
          ld r0, ghost
          halt
      `;

      state.files['bad.o'] = assembleToBytes(src, 'bad.a');
      expect(() => new Linker().link(['bad.o'], 'out.e')).toThrow(LinkerError);

      state.files['bad.o'] = assembleToBytes(src, 'bad.a');
      expect(() => new Linker().link(['bad.o'], 'out.e'))
        .toThrow('ghost is an undefined external reference');
    });

    test('duplicate global symbol across two modules throws LinkerError', () => {
      const src1 = `
          .global shared
shared:   .word 1
      `;
      const src2 = `
          .global shared
shared:   .word 2
      `;

      state.files['dup1.o'] = assembleToBytes(src1, 'dup1.a');
      state.files['dup2.o'] = assembleToBytes(src2, 'dup2.a');
      expect(() => new Linker().link(['dup1.o', 'dup2.o'], 'out.e')).toThrow(LinkerError);

      state.files['dup1.o'] = assembleToBytes(src1, 'dup1.a');
      state.files['dup2.o'] = assembleToBytes(src2, 'dup2.a');
      expect(() => new Linker().link(['dup1.o', 'dup2.o'], 'out.e'))
        .toThrow('More than one global declaration for shared');
    });

    test('no .e file is written to the FS when the link fails', () => {
      const src = `
          .extern missing
          ld r0, missing
          halt
      `;

      state.files['fail.o'] = assembleToBytes(src, 'fail.a');
      expect(() => new Linker().link(['fail.o'], 'fail.e')).toThrow(LinkerError);

      // createExecutable() is never reached, so no 'o' signature byte is
      // written — the output file must be absent from the virtual FS.
      expect(state.files['fail.e']).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Pipeline integrity: the .o bytes round-trip through parseObjectModuleBuffer
  // -------------------------------------------------------------------------

  describe('pipeline integrity: assembler .o bytes parse correctly', () => {
    test('parseObjectModuleBuffer round-trip: G/E/S headers survive assemble → parse', () => {
      // Verify that the raw bytes returned by assembleSource() are well-formed
      // object module buffers that parseObjectModuleBuffer() accepts and that the
      // parsed headers match what we expect from the source.
      const srcGlobal = `
          .global foo
foo:      .word 99
      `;
      const buf = assembleToBytes(srcGlobal, 'g.a');

      const linker = new Linker();
      const mod = linker.parseObjectModuleBuffer(buf, 'g.o');

      const gEntry = mod.headers.find(h => h.type === 'G' && h.label === 'foo');
      expect(gEntry).toBeDefined();
      expect(gEntry.address).toBe(0); // foo is the first word in the module
      expect(mod.code[0]).toBe(99);   // .word 99
    });

    test('parseObjectModuleBuffer rejects non-.o bytes with a typed error', () => {
      const notAnObjectModule = Buffer.from([0x00, 0x43]);
      const linker = new Linker();
      expect(() => linker.parseObjectModuleBuffer(notAnObjectModule, 'junk'))
        .toThrow(LinkerError);
    });
  });

  // -o / custom output path (#557)
  describe('custom -o output path', () => {
    test('link() with custom output name writes to that path, not the default linktest.e', () => {
      const linker = new Linker();
      jest.spyOn(linker, 'readObjectModule').mockImplementation(() => {
        linker.objectModules.push({
          headers: [{ type: 'S', address: 0 }],
          code: [0xf000],
        });
      });

      linker.link(['module.o'], 'custom-output.e');

      expect(linker.outputFileName).toBe('custom-output.e');
      expect(state.files['custom-output.e']).toBeDefined();
      expect(state.files['linktest.e']).toBeUndefined();
    });
  });
});
