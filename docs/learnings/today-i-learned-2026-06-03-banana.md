# Today I Learned — 2026-06-03 (BANANA)

A day of toolchain plumbing: fixing a silent failure in the close script (#551),
promoting test-coverage items to proper child issues (#220/#557), and shipping
the `-v`/`--verbose` flag (#15). Two non-obvious architecture lessons came out of it.

---

## 1. `assembler.error()` has two output channels, and they carry different things

When the assembler hits a bad line, `error()` does two things in sequence:

```
console.error(fullContextMessage)   ← immediately prints to stderr
abortAssembly(shortMessage)         ← throws AssemblerError(shortMessage)
```

The `console.error` line carries everything useful: file name, line number, the
raw source line, and the error message. The thrown error carries only the short
message (e.g. `"Undefined label"`). These two channels diverge, and which one the
user actually sees depends on the execution path:

- **CLI mode** (`assembler.main()`): `throwOnAssemblyError` is false, so
  `abortAssembly` calls `process.exit()`. The `console.error` output reaches the
  terminal; the catch block in `lcc.js` never fires. Users see the full context.

- **Test / pure-seam mode** (`assembleSource()` with `throwOnAssemblyError: true`):
  `abortAssembly` throws. Jest swallows the `console.error`. The test receives the
  short `AssemblerError` message. Tests assert on the thrown text, not the printed text.

This asymmetry matters for verbose mode. Adding `verboseModeOn` to *lcc.js* alone
wouldn't work — `console.error` is called directly inside `assembler.error()`, before
control ever returns to the CLI. The flag has to live on the `Assembler` instance itself
so `error()` can check it when deciding how much context to print.

That insight drove the `formatAssemblerError()` helper: a single method that takes the
error message and returns either the compact string or the source-line-annotated one,
depending on `this.verboseModeOn`. All error sites call `error()` → `formatAssemblerError()`;
none of them need to know about verbose mode directly.

**The general lesson:** when a module mixes "print directly to stderr" with "throw for
callers to catch," adding a display mode flag requires placing it on the module instance,
not just in the caller. The direct-print path bypasses any caller-level configuration.

---

## 2. "If large enough" is a trap qualifier on tracker tickets

The orchestration assignment for #220 said: "file a child issue *if the chosen item is
large enough*." That conditional almost caused the issue-filing step to be skipped for
what looked like a quick test-coverage task.

The correct rule has no size threshold. Tracker tickets (the ones that say "stays open
until the children resolve") always produce a concrete child issue before work starts —
not because the item is large, but because that's how the tracker pattern works. The
child issue is where velocity is logged, where the `@todo` marker lives, and where the
work is discoverable. A sub-item done without a child issue produces invisible work.

The symptom to watch for: an assignment that says "file an issue if X" for a tracker
sub-item. That's a red flag. Remove the qualifier, file the issue, then do the work.

This is now RULES.md Rule 12, filed as #559.

---

## What landed

| Artifact | Change |
|---|---|
| [#551](https://github.com/avidrucker/lccjs/issues/551) | `close.js`: changed `stdio: 'ignore'` → `['ignore', 'inherit', 'inherit']` and added `\|\| echo '[close] warning...'` so deferred teardown failures are visible. |
| [#557](https://github.com/avidrucker/lccjs/issues/557) | Child issue filed for LCC/linker routing edge-case tests; 3 new tests added (linker.unit, linker.integration, lcc.unit). Closed with #220. |
| [#559](https://github.com/avidrucker/lccjs/issues/559) | RULES.md Rule 12: always file a child issue for tracker sub-items unconditionally. |
| [#15](https://github.com/avidrucker/lccjs/issues/15) | `-v`/`--verbose` flag added to lcc.js; `verboseModeOn` + `formatAssemblerError()` on Assembler; verbose PC+registers on interpreter `raiseRuntimeError()`; 11 new tests. |
| [#564](https://github.com/avidrucker/lccjs/issues/564) | Filed: enrich verbose error messages with source classification prefix, found/expected arg types, and sourceMap-resolved line numbers. |
| [#572](https://github.com/avidrucker/lccjs/issues/572) | This TIL. |
