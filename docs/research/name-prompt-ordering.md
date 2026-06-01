# Research: name-prompt ordering — LCC.js prompts after execution; oracle prompts first

**Ticket:** #393  
**Date:** 2026-06-01  
**Agent:** ELDERBERRY

---

## Summary

LCC.js defers name resolution to report-generation time (after execution). The oracle
resolves the name before any assembly or execution. Root cause identified; fix is
straightforward and targeted to `lcc.js`.

---

## Call graph trace

### Path 1 — TTY interactive (the bug repro)

```
lcc.js main()
  └─ parseArguments()           ← no name resolution
  └─ handleSingleFile()
       └─ assembleFile()        ← no name resolution (pass 1, pass 2 run)
       └─ executeFile()
            interpreter.allowRuntimeDebugging = true
            interpreter.run()
              → hits instructionsCap
              → canEnterInteractiveDebugger() → true (TTY + flag)
              → sets debugMode = true, drops into interactive debugger
              → user types q → run() returns NORMALLY (no throw)
            catch: skipped (no error)
            finally: allowRuntimeDebugging = false
            if (generateStats):
              this.buildReportArtifacts()        ← lcc.js:363
                this.resolveUserName()           ← lcc.js:40
                  nameHandler.createNameFile()   ← *** NAME PROMPT HERE ***
              writeReportFiles()
```

Name prompt appears **after** assembly, execution, and the entire interactive debug
session. This is the bug.

### Path 2 — non-TTY (no interactive debugger, no name prompt at all)

```
executeFile()
  interpreter.run()
    → hits instructionsCap
    → canEnterInteractiveDebugger() → false (not TTY)
    → raiseRuntimeError('Possible infinite loop')   ← throws
  catch(error):
    cliWrappedErrorExit() → process.exit(1)         ← exits immediately
  generateStats block: NEVER REACHED → no name prompt, no .lst/.bst
```

No name prompt in non-TTY. The `name.nnn`-absent + non-TTY guard added by #375
(`process.exit(1)` in `name.js:77`) is never even reached; `process.exit` happens
first in the catch block.

### Oracle behavior (always correct)

Oracle calls the name prompt unconditionally at startup, before any assembly or
execution phase begins.

---

## Root cause

`nameHandler.createNameFile()` is called from `lcc.js:buildReportArtifacts()`
→ `lcc.js:resolveUserName()`, which is invoked at `lcc.js:363` inside
`executeFile()` — after `interpreter.run()` completes. This is report-generation
time, not startup time.

The three existing call sites:

| File | Line | When called |
|------|------|-------------|
| `lcc.js` | 40 (via `buildReportArtifacts`) | After execution, during report write |
| `assembler.js` | 560 | Before writing `.o` output — object-module path only |
| `interpreter.js` | 443 | During stats generation — interpreter standalone path |

`lcc.js:main()` has no name resolution at startup. All three call sites are lazy.

---

## Affected paths

| Invocation | Name prompt timing | Correct? |
|-----------|-------------------|---------|
| `lccjs ret.a` (TTY, hits infinite loop) | After debug session | ✗ Bug |
| `lccjs halt.a` (TTY, normal run) | After execution | ✗ Bug |
| `lccjs ret.a` (non-TTY) | Never (exits before report) | ✗ Bug (no name written) |
| `lcc ret.a` (oracle) | Before assembly | ✓ |

Note: even the normal happy path (`lccjs halt.a`, no infinite loop) prompts after
execution, not before — the bug affects all TTY runs, not only the infinite-loop case.

---

## Fix strategy

**Minimal change — `lcc.js` only:**

Add one eager call in `lcc.js:main()`, immediately after argument parsing and before
any file operations:

```js
// lcc.js main(), after parseArguments() and inputFileName assignment:
this.userName = this.resolveUserName();   // ← ADD THIS
```

Then change `buildReportArtifacts()` to use the pre-resolved name:

```js
buildReportArtifacts(includeSourceCode, includeComments, now) {
  // this.userName already set at startup — no re-prompt
  return buildReportArtifacts({
    ...
    userName: this.userName,
    ...
  });
}
```

Because `nameHandler.createNameFile()` writes `name.nnn` on first call, all
subsequent calls (assembler.js:560, interpreter.js:443) will just read from the
file and return silently — no second prompt. The startup call is the only one that
interacts with the user.

**Side-effects of the fix (all beneficial):**

- Non-TTY runs with no `name.nnn`: fail immediately at startup ("Fatal:
  name.nnn not found and stdin is not a terminal") — before assembly begins.
  More parity with oracle. Strengthens the #375 guard by moving it earlier.
- Object-module path (`assembler.js:560`): reads from `name.nnn` written at
  startup — no change in visible behavior.
- ILCC path (`lcc.js:runInteractiveMode()`): ILCC and linker do NOT call
  nameHandler — no impact.

**Not covered by this fix:**

- `src/core/interpreter.js:443` and `src/core/assembler.js:560` — standalone
  CLI use of those entry points (not via `lcc.js`) still resolves name lazily.
  Those paths have their own standalone wrappers; fixing them is out of scope
  here but should be tracked separately.

---

## Verdict

Root cause confirmed. Fix is a two-line change in `lcc.js` (add eager
`resolveUserName()` at startup; use `this.userName` in `buildReportArtifacts()`).
No architectural changes needed. File a DEV ticket for the implementation.

The #375 non-TTY guard in `name.js` does not need to change — moving the call
site earlier only makes the guard fire sooner (better, not worse).
