# Today I Learned — 2026-06-03 (BANANA-1)

Date: 2026-06-03
Context: BANANA session — #526 (migrate exact-string `toThrow` assertions to
typed-error classes). Found mid-implementation when 127 tests broke at once.

---

## `assembler.main()` deliberately opts out of typed errors

When you call `assembler.main(['file.a'])` in a test, errors do **not** come
back as `AssemblerError`. They come back as plain `Error`.

The reason is one line in `assembler.js`:

```js
this.assembleSource(sourceCode, {
  throwOnAssemblyError: false,   // ← the CLI wrapper opts out
  ...
});
```

`assembleSource()` defaults `throwOnAssemblyError` to `true` — so unit tests
that call `assembleSource()` directly do get `AssemblerError`. But `main()`
overrides it to `false`, which routes every error through `fatalExit()` →
`throw new Error(message)` in test mode. Plain `Error`, not `AssemblerError`.

**Why it matters for tests.** The goal in #526 was to replace 146 exact-string
`toThrow('Bad number')` assertions with typed-class ones. That works for unit
tests using `assembleSource()` — but integration tests using `main()` will
always fail `toThrow(AssemblerError)` because the type is wrong. The practical
fix: bare `.toThrow()` for `main()` callers (still verifies an error fires,
just doesn't type-check it), typed assertions only for pure-API callers.

**The architectural question this raises** is open as #539: should `main()` be
changed so its errors propagate as typed errors, making integration tests fully
assertable? Options range from changing the `throwOnAssemblyError` default to
adding a test-facing seam. The current design is deliberate — `main()` is a
CLI wrapper and translates typed errors to `cliErrorExit` — but it leaves
integration tests unable to distinguish `AssemblerError` from any other throw.

**Quick diagnostic.** If you're writing a test and `toThrow(AssemblerError)`
fails with `Received constructor: Error`, check whether you're calling `main()`
or `assembleSource()`. The former always gives you `Error`; the latter gives you
`AssemblerError` (or the specific typed subclass).
