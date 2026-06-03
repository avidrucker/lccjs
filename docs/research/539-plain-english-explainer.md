# Plain-English explainer: #539 findings

**Date:** 2026-06-03  
**Companion to:** `539-main-typed-error-propagation.md`  
**Issue:** #539 — ARC: decide whether main() wrappers should propagate typed errors

---

## What was the problem?

When tests call `assembler.main()`, errors come back as a generic `Error` instead
of the specific `AssemblerError` type — so tests can't tell *what kind* of thing
went wrong.

Think of it like a smoke alarm that just beeps. You know *something* is wrong, but
not whether it's a fire, a dead battery, or steam from your shower. The current
integration tests are like that: `.toThrow()` tells you "something threw," but not
"an assembly error threw." A bug that causes the *wrong kind* of error — say, a
file-system crash instead of a syntax error — would still pass the test.

## Why was it happening?

There are two ways to call the assembler in this codebase:

1. **`assembleSource()`** — the clean, programmatic API. Throws `AssemblerError` by
   default. Used by unit tests. ✓
2. **`assembler.main()`** — the CLI entry point. Deliberately suppresses `AssemblerError`
   and falls back to a plain `Error` instead. ✗

`main()` suppresses the typed error because it was designed as a CLI wrapper — in
real use (not tests), it just calls `process.exit()`, so the error *type* never
mattered to the shell. But 230+ integration tests call `main()` and are stuck with
the dumb smoke alarm.

The suppression was a single line:

```js
// assembler.main() — the override that caused the problem
this.assembleSource(sourceCode, {
  throwOnAssemblyError: false,  // ← overrides the pure API's "true" default
});
```

## Why does it matter?

A test that asserts `.toThrow()` passes whether the assembler crashes with a syntax
error, a missing file, or an unexpected internal exception. The test proves "something
went wrong" — not "the right thing went wrong." As the test suite grows, this makes
bugs harder to catch: an assembler that throws the wrong error for the wrong reason
would still pass 230 tests.

## What is the fix?

Remove the `throwOnAssemblyError: false` override in `assembler.main()`. Because
`AssemblerError` extends the built-in `Error`, every existing bare `.toThrow()` test
still passes — they now just receive a *more specific* error. Tests can then be
upgraded incrementally to assert `.toThrow(AssemblerError)`.

The outer `lcc.js` wrapper already catches any throw from `assembler.main()` and
converts it to a plain exit — so production behavior (exit codes, console output)
is completely unchanged.

## What are we not fixing yet?

`interpreter.main()` has the same conceptual problem but different internal
plumbing — no equivalent `throwOnError` flag exists there. That's a separate,
smaller-scope ticket to keep changes reviewable.

## Where to read the full analysis

`docs/research/539-main-typed-error-propagation.md` — option-by-option breakdown
with code excerpts, test counts, and the recommended implementation steps.
