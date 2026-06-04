'use strict';

const Assembler  = require('../core/assembler');
const Interpreter = require('../core/interpreter');

/**
 * Assemble LCC source code in memory.
 *
 * @param {string} src - LCC assembly source text.
 * @returns {{ ok: true, binary: Buffer } | { ok: false, errors: string }}
 */
function assemble(src) {
  const asm = new Assembler();
  try {
    const result = asm.assembleSource(src, { inputFileName: 'input.a', throwOnAssemblyError: true });
    return { ok: true, binary: result.outputBytes };
  } catch (err) {
    return { ok: false, errors: err.message };
  }
}

/**
 * Run an LCC executable buffer in memory.
 *
 * @param {Buffer} binary - Executable produced by assemble().binary.
 * @param {{ stdin?: string[] }} [opts]
 *   opts.stdin — pre-supplied input lines fed to AIN/DIN/SIN traps.
 *   Interactive reads beyond the supplied lines have undefined behavior.
 * @returns {{ stdout: string, exitCode: number }}
 */
function run(binary, opts = {}) {
  const inputBuffer = (opts.stdin ?? []).join('\n');
  const interp = new Interpreter();
  try {
    const result = interp.executeBuffer(binary, { inputFileName: 'input.e', inputBuffer });
    return { stdout: result.output, exitCode: 0 };
  } catch (err) {
    return { stdout: interp.output, exitCode: 1 };
  }
}

module.exports = { assemble, run };
