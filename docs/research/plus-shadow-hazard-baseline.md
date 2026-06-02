# Plus-subclass shadow hazard baseline (#425)

Static analysis of every method in `AssemblerPlus` / `InterpreterPlus` that overrides
a core method, and whether each override delegates to `super`. Run: 2026-06-01.

This is the **"before" baseline** for H2 Puzzle B (#417). Re-run after #417 closes to
confirm the hazard count dropped to 2 (the two intentional overrides: `handleDirective`
and `writeOutputFile`).

---

## AssemblerPlus (`src/plus/assemblerplus.js`)

Extends `Assembler` (`src/core/assembler.js`).

| Method | Calls super? | Classification |
|---|---|---|
| `constructor` | ✅ `super()` | intentional — adds `isLCCPlusFile` state |
| `main` | ❌ no | **shadow hazard** — full reimplementation |
| `handleInstruction` | ✅ `super.handleInstruction()` in `default` | intentional extension |
| `handleDirective` | ✅ `super.handleDirective()` in `else` | intentional extension |
| `writeOutputFile` | ✅ `super.writeOutputFile('p')` | intentional wrapper |

Non-constructor overrides: **4** · Shadow hazards: **1**

### Shadow hazard detail — `AssemblerPlus.main`

`AssemblerPlus.main()` reimplements the full two-pass CLI flow (args parsing, pass1,
pass2, startLabel resolution, `writeOutputFile()`) without calling `super.main()`. Any
change to `Assembler.main()` (new flags, error-reporting changes, new option handling)
must be manually ported to `AssemblerPlus.main()` or it silently diverges.

The duplication is intentional in the short term (LCC+ needs `.ep` extension, `.ap`
validation, no `-nostats` flag) but it's the primary maintenance surface for M7 risk.

---

## InterpreterPlus (`src/plus/interpreterplus.js`)

Extends `Interpreter` (`src/core/interpreter.js`).

| Method | Calls super? | Classification |
|---|---|---|
| `constructor` | ✅ `super()` | intentional — adds `keyQueue`, `seed`, `disableInfiniteLoopDetection` |
| `main` | ❌ no | **shadow hazard** — full reimplementation |
| `loadExecutableBuffer` | ❌ no | **shadow hazard** — full reimplementation (highest risk) |
| `executeTRAP` | ✅ `super.executeTRAP()` in `default` | intentional extension |
| `executeCase10` | ✅ `super.executeCase10()` in `default` | intentional extension |

Non-constructor overrides: **4** · Shadow hazards: **2**

### Shadow hazard detail — `InterpreterPlus.main`

Same pattern as AssemblerPlus: full reimplementation with no `super.main()` call. LCC+
uses a non-blocking event loop (`startNonBlockingLoop`) rather than the synchronous
`run()` loop, so delegation is non-trivial — but changes to option parsing in
`Interpreter.main()` still diverge silently.

### Shadow hazard detail — `InterpreterPlus.loadExecutableBuffer` (highest risk)

The core's `loadExecutableBuffer` handles `o`-header parsing, `S`/`G`/`A` entries, and
memory loading. `InterpreterPlus` completely reimplements this to handle the `op`
two-byte header. If the core `.e` format ever gains a new header entry type, the plus
interpreter won't parse it. There is no super call, no shared parsing path, and no test
that would catch a format drift.

This is the override most likely to cause a hard-to-diagnose runtime failure after a
core change.

---

## Totals

| Subclass | Non-constructor overrides | Super-delegating (intentional) | Shadow hazards |
|---|---|---|---|
| AssemblerPlus | 4 | 3 | 1 |
| InterpreterPlus | 4 | 2 | 2 |
| **Combined** | **8** | **5** | **3** |

Shadow hazard list:
1. `AssemblerPlus.main` — CLI entry reimplementation
2. `InterpreterPlus.main` — CLI entry reimplementation (uses different event model)
3. `InterpreterPlus.loadExecutableBuffer` — header parsing reimplementation (**highest risk**)

---

## `@todo` markers

No new markers added. All three hazards are already in scope for Puzzle B (#417)'s
registration-cutover refactor. If #417 proves narrower than expected (e.g. it only
covers `handleInstruction`/`executeTRAP`/`executeCase10` dispatch methods and not
`loadExecutableBuffer`), file a follow-on to address the buffer-parsing duplication.

## Expected post-#417 state

After H2 Puzzle B's registration cutover, the override table should collapse to:

| Subclass | Survivors |
|---|---|
| AssemblerPlus | `handleDirective`, `writeOutputFile` |
| InterpreterPlus | `executeTRAP` (or eliminated if dispatch is registration-driven) |

Re-run this analysis then to confirm.
