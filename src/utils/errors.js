/**
 * Shared typed error classes for reusable assembler and interpreter paths.
 *
 * These error types provide a stable boundary between pure programmatic APIs
 * and the file-oriented CLI wrappers. Reusable in-memory methods throw these
 * errors directly, while wrapper entrypoints translate them into the existing
 * console output and process-exit behavior expected by integration and e2e
 * callers.
 */
class LccError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

class InvalidExecutableFormatError extends LccError {}

class InterpreterRuntimeError extends LccError {}

class AssemblerError extends LccError {}

module.exports = {
  LccError,
  AssemblerError,
  InvalidExecutableFormatError,
  InterpreterRuntimeError,
};
