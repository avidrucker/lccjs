'use strict';

const Assembler  = require('../core/assembler');
const Interpreter = require('../core/interpreter');
const { formatLccSource } = require('../utils/formatter');

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
    const errors = asm.errors && asm.errors.length
      ? asm.errors.join('\n')
      : err.message;
    return { ok: false, errors };
  }
}

/**
 * Run an LCC executable buffer in memory.
 *
 * @param {Buffer} binary - Executable produced by assemble().binary.
 * @param {{ stdin?: string[], pauseOnInput?: boolean, maxSteps?: number }} [opts]
 *   opts.stdin        — pre-supplied input lines fed to DIN/HIN/AIN/SIN traps.
 *   opts.pauseOnInput — when true, returns a sentinel instead of blocking when
 *                       stdin lines are exhausted; call result.resume(moreInput)
 *                       to continue execution.
 *   opts.maxSteps     — instruction step cap (0 = unlimited).
 *                       When hit: execution stops, maxStepsReached is true, exitCode is 2.
 * @returns {{ stdout: string, stderr?: string, exitCode: number, maxStepsReached: boolean }
 *         | { status: 'waiting-for-input', trapType: string,
 *             resume: (moreInput: string) => ... }}
 */
function run(binary, opts = {}) {
  const { stdin = [], pauseOnInput = false, maxSteps = 0 } = opts;

  // When pauseOnInput is true AND pre-supplied stdin is provided, run in two
  // stages so preResumeOutputLength is captured at the first input boundary,
  // making displayWithSeparator behave consistently with the interactive path.
  if (pauseOnInput && stdin.length > 0) {
    const interp = new Interpreter();
    try {
      const first = interp.executeBuffer(binary, { inputFileName: 'input.e', inputBuffer: '', pauseOnInput: true, maxSteps });
      if (first && first.status === 'waiting-for-input') {
        const preResumeOutputLength = interp.output.length;
        const second = interp.resume(stdin.join('\n') + '\n');
        if (second && second.status === 'waiting-for-input') {
          // Batch stdin exhausted before all input traps — surface for interactive continuation
          return { status: 'waiting-for-input', trapType: second.trapType, partialOutput: interp.output, resume: makeResume(interp) };
        }
        return { stdout: interp.output, preResumeOutputLength, exitCode: second && second.maxStepsReached ? 2 : 0, maxStepsReached: !!(second && second.maxStepsReached) };
      }
      // Program completed before reaching any input trap
      return { stdout: first.output, exitCode: first.maxStepsReached ? 2 : 0, maxStepsReached: !!first.maxStepsReached };
    } catch (err) {
      return { stdout: interp.output, stderr: getErrorMessage(err), exitCode: 1, maxStepsReached: false };
    }
  }

  const inputBuffer = stdin.join('\n') + (stdin.length ? '\n' : '');
  const interp = new Interpreter();
  try {
    const result = interp.executeBuffer(binary, { inputFileName: 'input.e', inputBuffer, pauseOnInput, maxSteps });
    if (result && result.status === 'waiting-for-input') {
      return { status: 'waiting-for-input', trapType: result.trapType, partialOutput: interp.output, resume: makeResume(interp) };
    }
    return { stdout: result.output, exitCode: result.maxStepsReached ? 2 : 0, maxStepsReached: !!result.maxStepsReached };
  } catch (err) {
    return { stdout: interp.output, stderr: getErrorMessage(err), exitCode: 1, maxStepsReached: false };
  }
}

function getErrorMessage(err) {
  return err && err.message ? err.message : String(err || 'unknown runtime error');
}

function makeResume(interp) {
  const preResumeOutputLength = interp.output.length;
  return function resume(moreInput = '') {
    try {
      const result = interp.resume(moreInput.endsWith('\n') ? moreInput : moreInput + '\n');
      if (result && result.status === 'waiting-for-input') {
        return { status: 'waiting-for-input', trapType: result.trapType, partialOutput: interp.output, resume: makeResume(interp) };
      }
      return { status: 'done', stdout: interp.output, preResumeOutputLength, exitCode: 0 };
    } catch (err) {
      return { status: 'done', stdout: interp.output, stderr: getErrorMessage(err), preResumeOutputLength, exitCode: 1 };
    }
  };
}

module.exports = { assemble, run, formatLccSource };
