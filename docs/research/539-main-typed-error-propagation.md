# Decision memo: main() typed-error propagation (#539)

**Date:** 2026-06-03  
**Agent:** APPLE  
**Parent:** #539 (ARC decision), #526 (origin)

## Recommendation

**Option B for `assembler.main()` — one-line change, safe, unblocks ~230 tests.**  
**Defer interpreter.main() — needs separate design work.**

---

## What the code actually does today

### `assembler.main()` — `throwOnAssemblyError: false`

```js
// assembler.js:622-626
this.assembleSource(sourceCode, {
  inputFileName: this.inputFileName,
  outputFileName: this.outputFileName,
  throwOnAssemblyError: false,   // ← overrides the pure API's true default
});
```

`assembleSource()` defaults to `throwOnAssemblyError: true`. `main()` overrides that to `false`, which routes all assembly errors through `abortAssembly()` → `fatalExit()` → in test mode, `throw new Error(message)` (plain `Error`, not `AssemblerError`).

### `fatalExit()` in test mode

```js
// cliExit.js
function fatalExit(message, code = 1) {
  if (isTestMode) {
    throw new Error(message);   // always plain Error, never typed
  } else {
    process.exit(code);
  }
}
```

### `lcc.js.assembleFile()` — already handles typed throws

```js
// lcc.js:307-313
try {
  assembler.main([this.inputFileName]);
} catch (error) {
  cliWrappedErrorExit(`Error assembling ${this.inputFileName}:`, error, 1);
}
```

If `assembler.main()` throws anything — typed or plain — `lcc.js` catches it and
converts it to `fatalExit()`, which in test mode becomes plain `Error` again. The
re-wrapping is already in place.

### `interpreter.main()` — no equivalent flag

`interpreter.main()` doesn't use an `throwOnError`-style flag. It explicitly calls
`cliErrorExit()` for format errors and catches `InterpreterRuntimeError` from
`executeBuffer()` to convert it to `cliErrorExit()`. Changing interpreter's `main()`
to propagate typed errors requires adding a new flag or refactoring the catch block
— a materially larger change than the assembler case.

---

## Impact on tests

- **258 bare `.toThrow()`** calls exist in the test suite today (up from ~126 when #526 was filed).
- Integration tests that call `assembler.main()` span 10 files. Representative counts:
  - `assembler.edge.integration.spec.js`: 75 bare `.toThrow()`
  - `assembler.instructions.integration.spec.js`: 67
  - `assembler.labels.integration.spec.js`: 27
  - `assembler.directives.integration.spec.js`: 27
  - ... (total ~230 in `assembler.*` integration files)
- `lcc.integration.spec.js`: 3 bare `.toThrow()` — these correctly stay bare (see below).

---

## Option analysis

### Option A — keep status quo

`assembler.main()` stays `throwOnAssemblyError: false`. Integration tests can only
use bare `.toThrow()`.

**Pro:** Zero code change, zero risk.  
**Con:** 230+ integration tests permanently unable to distinguish `AssemblerError`
from infrastructure errors (file-not-found, bad args). Masks real bugs.

**Verdict:** Architecturally defensible if `main()` is treated as a pure CLI
wrapper that never escapes typed errors. But in practice it means the integration
layer can't meaningfully assert error type — a testing gap that grows as the suite expands.

---

### Option B — `assembler.main()` propagates typed errors

Change `assembler.main()` to use the pure API's default:

```js
// assembler.js: remove or change the override
this.assembleSource(sourceCode, {
  inputFileName: this.inputFileName,
  outputFileName: this.outputFileName,
  // throwOnAssemblyError omitted → defaults to true
});
```

**Effect on `assembler.main()` direct callers:**  
Assembly errors → `AssemblerError` (extends `Error`). Bare `.toThrow()` still passes
(backward compatible). Tests can now upgrade to `.toThrow(AssemblerError)` incrementally.

**Effect on `lcc.main()` callers:**  
`assembler.main()` throws `AssemblerError` → caught by `lcc.js.assembleFile()` catch
→ `cliWrappedErrorExit()` → `fatalExit()` → plain `Error` in tests. `lcc.integration`
tests continue using bare `.toThrow()`, which is correct — `lcc.main()` is the
outermost CLI layer; its tests should not see `AssemblerError`.

**Mixed error types in `assembler.main()`:**  
Arg-parsing and file-open errors still go through `cliErrorExit()` → plain `Error` in
tests. Only errors routed through `abortAssembly()` become `AssemblerError`. This is
the same asymmetry the pure API already has (`assembleSource()` throws `AssemblerError`
for assembly failures, but callers of `assembleSource()` handle file I/O separately).
The mixed behavior is acceptable and consistent with the architecture.

**Production behavior:** unchanged. In production (non-test), `fatalExit()` calls
`process.exit()` regardless of whether the throw that triggered it was typed or plain.
The catch in `lcc.js.assembleFile()` also exits via `cliWrappedErrorExit()` in
production. No change to exit codes or console output.

**Pro:** One-line change. Backward compatible. Unblocks typed assertions in ~230 tests.
Safe — `lcc.js` catch already re-wraps. Matches the pure API's already-established behavior.  
**Con:** Mixed error types in `assembler.main()` (assembly → typed; arg/file → plain)
is a minor conceptual inconsistency. Acceptable given the architecture and the existing precedent in `assembleSource()`.

**Verdict: recommended.**

---

### Option C — hybrid `mainForTest()` seam

Expose a separate entry point that integration tests opt into, keeping production
`main()` unchanged.

**Pro:** Zero production risk.  
**Con:** `assembleSource()` already IS the pure seam for programmatic use. Adding a
third entry point adds indirection without value. Tests that currently call `main()`
with file paths would need to be migrated anyway.

**Verdict:** Unnecessary. Option B is simpler.

---

## Scope clarification: what about `interpreter.main()`?

The issue title says "main() wrappers" (plural). `interpreter.main()` is structurally
different:

- No `throwOnError` flag exists — it doesn't delegate to a pure API via a flag; it
  calls `executeBuffer()` and catches the result inline.
- Adding typed-error propagation to `interpreter.main()` requires either: (a) adding
  a flag similar to `throwOnAssemblyError`, or (b) refactoring the catch block in
  `main()` to re-throw instead of converting to `cliErrorExit()`.
- The `interpreter.integration` tests have 20 bare `.toThrow()` calls — a smaller
  surface than the assembler.

**Recommendation:** File a separate, scoped DEV ticket for `interpreter.main()`.
The assembler decision gates nothing there; decouple to keep scope manageable.

---

## Recommended next action

1. **Accept Option B for `assembler.main()`.**  
   Remove the `throwOnAssemblyError: false` override in `assembler.main()` (or delete
   the key entirely — `assembleSource()` defaults to `true`).  
   Verify with `npm test` that all existing tests pass (bare `.toThrow()` is backward
   compatible with `AssemblerError extends Error`).

2. **File a DEV follow-up** to migrate `assembler.*integration*` tests from bare
   `.toThrow()` to `.toThrow(AssemblerError)` where applicable. This is incremental
   and can be done file by file.

3. **File a separate ARC/DEV ticket for `interpreter.main()`** — different mechanism,
   different scope.

---

## Files touched by Option B

| File | Change |
|---|---|
| `src/core/assembler.js` | Remove `throwOnAssemblyError: false` from `main()` call to `assembleSource()` |
| `tests/new/assembler.*.spec.js` | No immediate change required; typed assertions become available incrementally |
