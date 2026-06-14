# Design: `linker.js` pure seam — `linkObjectModules(buffers, options)`

**Ticket:** #1224 (ARCHITECT, `area:architecture`). Decomposed from #1206.
**Status:** Design only. Implementation is #1274 (DEV, blocked-by #1224).
**Author:** DRAGONFRUIT.

This doc names (1) the seam signature and return shape, (2) the error discipline,
(3) the wrapper/seam responsibility split, and (4) the migration sketch — and records
the rejected alternatives. The falsifiable spine of the design is the disabled test
`tests/new/linker.seam.spec.js` (`test.failing`), which #1274 makes pass.

---

## 1. Current state (corrected)

`src/core/linker.js` is **not** seam-less. It already exposes one pure seam:

- `parseObjectModuleBuffer(buffer, filename)` — `linker.js:74`. Pure: takes a `.o` buffer,
  returns `{ headers, code }`, throws `LinkerError` on a bad signature/header. Documented
  as a pure-seam example in **CLAUDE.md** and **`src/core/core.md:45`**.

What is missing is the **top-level link-orchestration seam**. The public surface is still
the `Linker` class (`linker.js:368`), and the orchestration path interleaves link logic
with ~11 `console.*` / `process.exit` / `fs` calls:

| Site | Call | Concern |
|---|---|---|
| `linker.js:147` | `fs.readFileSync` (in `readObjectModule`) | input I/O |
| `linker.js:175` | `console.log('Linking …')` | progress output |
| `linker.js:190` | `console.log('Creating executable …')` | progress output |
| `linker.js:300–350` | `fs.openSync`/`writeSync`/`closeSync` (in `createExecutable`) | output I/O |
| `linker.js:357` | `console.error` (in `error`) | error output |
| `linker.js:50–68` | `cliErrorExit` (in `main`) | arg parsing + exit |

The link *algorithm* itself — `processModule`, `adjustExternalReferences`,
`adjustLocalReferences`, and the byte layout inside `createExecutable` — is already pure
arithmetic over in-memory state. The transition is therefore an **extract-and-rewire**, not
a rewrite: pull the I/O to the edges and expose the middle.

## 2. Decision — signature and return shape

```js
linkObjectModules(buffers, options = {}) → { outputBytes }
```

- `buffers`: an array of `Buffer`s, each the raw contents of one `.o` object module
  (already read from disk by the caller).
- `options`: reserved for parity with `assembleSource`/`executeBuffer`
  (e.g. `outputFileName` for messages the *wrapper* prints; the seam itself needs none today).
- Returns the result of a `createLinkResult()` builder: `{ outputBytes }`, where
  `outputBytes` is the `.e` executable as an in-memory `Buffer`.

**Why `outputBytes`, not the seeded `{ buffer, errors }`:** the assembler's pure result is
built by `createAssemblyResult()` → `{ outputBytes, reports, sourceMap }` (`assembler.js:365`).
Both the assembler and the linker *produce a binary artifact*, so the linker mirrors the
assembler's field name exactly. A `createLinkResult()` builder mirrors the
`createAssemblyResult()` / `createExecutionResult()` pattern (interpreter, `interpreter.js`),
keeping all three seams structurally identical. The result is an object (not a bare `Buffer`)
so fields can be added later (e.g. a symbol map) without breaking callers — same reasoning
the assembler/interpreter already follow.

## 3. Decision — error discipline: throw, do not return

The seam **throws `LinkerError`** (`src/utils/errors.js`) on any link failure (bad signature,
malformed header, duplicate global symbol, unresolved external). It does **not** return an
`errors` array.

**Why throw, not collect:** this mirrors what both the existing seams and the linker's own
internals already do:

- `assembleSource` throws `AssemblerError` (its `throwOnAssemblyError` defaults to `true`).
- `parseObjectModuleBuffer` and `Linker.error()` already **throw `LinkerError`** today.
- The current `link()` has no "accumulate errors and continue" semantics — the first bad
  module aborts. Returning an `errors` array would invent a failure mode the linker does not
  have and that no caller expects.

The CLI wrapper catches `LinkerError` and translates it to the existing `console.error` +
non-zero exit (`cliExit` helpers), exactly as the assembler wrapper does. The seam stays
silent — no `console.*`.

> A `throwOnLinkError: false` option (parity with `throwOnAssemblyError`) was considered and
> **rejected for now** (YAGNI): the linker has no partial-success path to expose. It can be
> added later without breaking the signature if a use case appears.

## 4. Wrapper / seam responsibility split

| Responsibility | Owner after refactor |
|---|---|
| Parse argv, `-o` handling, usage errors | CLI wrapper (`main`) — unchanged |
| `fs.readFileSync` each input `.o` → `Buffer` | CLI wrapper |
| `console.log('Linking <file>')` progress | CLI wrapper |
| Parse each buffer (`parseObjectModuleBuffer`) | **seam** (calls it directly; bypasses `readObjectModule`, which `console.error`s) |
| `processModule`, `adjustExternalReferences`, `adjustLocalReferences` | **seam** (already pure) |
| Build `.e` bytes in memory (`buildExecutableBuffer`) | **seam** |
| Throw `LinkerError` on failure | **seam** |
| `console.log('Creating executable …')` progress | CLI wrapper |
| `fs.writeFileSync(outputFileName, outputBytes)` | CLI wrapper |
| Catch `LinkerError` → `console.error` + exit | CLI wrapper |

Net: the seam consumes `Buffer`s and produces a `Buffer`, throwing typed errors. Every
`console.*` / `fs.*` / `process.exit` stays in the wrapper.

## 5. Migration sketch (mirrors the assembler refactor)

1. **Extract `buildExecutableBuffer()` from `createExecutable()`.** Keep the identical byte
   layout (`'o'`, optional `'S'`, `'G'` entries, `'A'` entries, `'C'`, code words) but write
   into in-memory `Buffer`s and `Buffer.concat()` them instead of `fs.writeSync` to a
   descriptor. `createExecutable()` becomes a one-liner the wrapper keeps:
   `fs.writeFileSync(this.outputFileName, this.buildExecutableBuffer())` — **CLI behavior and
   output bytes are byte-for-byte unchanged.**
2. **Add `linkObjectModules(buffers, options)`.** `resetState()`, parse each buffer via
   `parseObjectModuleBuffer` into `this.objectModules`, run the existing
   `processModule`/`adjust*` pipeline, then
   `return this.createLinkResult({ outputBytes: this.buildExecutableBuffer() })`. No
   `console.*`, no `fs.*`.
3. **Rewire `link(filenames, outputFileName)`** (the wrapper) to: `fs.readFileSync` each file
   → buffers (emitting the `'Linking <file>'` log per file), call
   `this.linkObjectModules(buffers, …)`, emit `'Creating executable …'`, then
   `fs.writeFileSync(outputFileName, result.outputBytes)`. Wrap in `try/catch (LinkerError)`
   → `this.error()`/`console.error` + exit, mirroring the assembler wrapper.
4. **Export.** Expose `linkObjectModules` as an instance method on `Linker`
   (mirroring `Assembler.prototype.assembleSource`); `module.exports = Linker` is unchanged.

Each step is independently verifiable against the existing specs.

## 6. The contract, as a test (the real deliverable)

`tests/new/linker.seam.spec.js` encodes the contract with `test.failing` (per
`docs/project-gotchas.md` §5: `test.failing` for a confirmed gap with an open fix ticket —
here #1274 — *not* `test.skip`, which is for by-design incompatibility only). The specs:

- link two in-memory `.o` buffers → `{ outputBytes }` is a `Buffer` beginning with the `'o'`
  executable signature (`0x6f`);
- throw `LinkerError` on a buffer with a bad signature.

They run today and **fail** (the method is unimplemented), so `test.failing` reports green.
When #1274 implements the seam they will **pass**, which flips `test.failing` to a *failure* —
the signal to delete the annotation and adopt them as ordinary regression tests. No `fs`
mocking is needed: passing buffers directly is the whole point of the seam, and a future
implementation that reached for `fs` would be visibly wrong.

## 7. Constraints honored

- **Node-only, no runtime deps** — pure buffer arithmetic.
- **Typed errors** from `src/utils/errors.js` (`LinkerError`).
- **No behavior change** to the linker CLI: `buildExecutableBuffer()` preserves the exact
  byte layout, so `linker.integration.spec.js`, `linker.unit.spec.js`,
  `linking.bdd.spec.js`, and the oracle e2e specs (#531, #171) stay green. Verifying that is
  part of #1274's "done when."

## 8. Follow-up

- **#1274** (DEV, blocked-by #1224): implement `linkObjectModules` + `buildExecutableBuffer`,
  un-`failing` the seam specs, keep the full suite green.
- Update `core.md:45` to list `linkObjectModules(...)` alongside `parseObjectModuleBuffer(...)`
  once #1274 lands (folded into #1274's scope).
