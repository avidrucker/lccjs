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
 * @param {{ stdin?: string[], pauseOnInput?: boolean }} [opts]
 *   opts.stdin        — pre-supplied input lines fed to DIN/HIN/AIN/SIN traps.
 *   opts.pauseOnInput — when true, returns a sentinel instead of blocking when
 *                       stdin lines are exhausted; call result.resume(moreInput)
 *                       to continue execution.
 * @returns {{ stdout: string, exitCode: number }
 *         | { status: 'waiting-for-input', trapType: string,
 *             resume: (moreInput: string) => ... }}
 */
function run(binary, opts = {}) {
  const { stdin = [], pauseOnInput = false } = opts;
  const inputBuffer = stdin.join('\n') + (stdin.length ? '\n' : '');
  const interp = new Interpreter();
  try {
    const result = interp.executeBuffer(binary, { inputFileName: 'input.e', inputBuffer, pauseOnInput });
    if (result && result.status === 'waiting-for-input') {
      return { status: 'waiting-for-input', trapType: result.trapType, resume: makeResume(interp) };
    }
    return { stdout: result.output, exitCode: 0 };
  } catch (err) {
    return { stdout: interp.output, exitCode: 1 };
  }
}

function makeResume(interp) {
  return function resume(moreInput = '') {
    try {
      const result = interp.resume(moreInput.endsWith('\n') ? moreInput : moreInput + '\n');
      if (result && result.status === 'waiting-for-input') {
        return { status: 'waiting-for-input', trapType: result.trapType, resume: makeResume(interp) };
      }
      return { status: 'done', stdout: interp.output, exitCode: 0 };
    } catch (err) {
      return { status: 'done', stdout: interp.output, exitCode: 1 };
    }
  };
}

module.exports = { assemble, run };
