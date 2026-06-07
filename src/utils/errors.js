/**
 * Shared typed error classes for reusable assembler, interpreter, and linker paths.
 *
 * These error types provide a stable boundary between pure programmatic APIs
 * and the file-oriented CLI wrappers. Reusable in-memory methods throw these
 * errors directly, while wrapper entrypoints translate them into the existing
 * console output and process-exit behavior expected by integration and e2e
 * callers.
 */
class LccError extends Error {
  // `options.explainKey` (optional) is a stable catalog key consumed by the
  // --explain render seams (#1096). Single-argument construction is unchanged,
  // so existing `new AssemblerError(msg)` callers are unaffected.
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    if (options && options.explainKey) {
      this.explainKey = options.explainKey;
    }
  }
}

class InvalidExecutableFormatError extends LccError {}

class InterpreterRuntimeError extends LccError {}

class AssemblerError extends LccError {}

class LinkerError extends LccError {}

// Thrown by the test-runner spec loader (loadTestSpec) on malformed JSON or a
// spec that is missing/ill-typed required fields. Keeps the pure loader seam
// free of console output / process.exit (#1090).
class TestSpecError extends LccError {}

// Thrown by the test-runner core (runTestSpec) on a harness-level failure that
// is not a per-case test result — e.g. the spec's program file does not exist.
// The CLI maps this to exit code 2 ("your harness is broken"), distinct from a
// failing test case (exit 1). See docs/research/1044-yaml-test-runner-scope.md §5 (#1091).
class TestRunnerError extends LccError {}

// Not an error — a non-local exit used to suspend execution when
// inputBuffer is exhausted and pauseOnInput is enabled.
class InputPauseSignal {
  constructor(trapType) {
    this.trapType = trapType;
  }
}

module.exports = {
  LccError,
  AssemblerError,
  LinkerError,
  TestSpecError,
  TestRunnerError,
  InvalidExecutableFormatError,
  InterpreterRuntimeError,
  InputPauseSignal,
};
