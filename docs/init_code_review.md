# LCC.js Codebase Assessment — May 2026

A focused review of `/home/avi/Documents/Study/JavaScript/lccjs` as of commit `87f41d4` on branch `research-2026-may` (created 2026-05-24). The project is a JavaScript reimplementation of LCC's assembler / linker / interpreter, with a documented in-flight refactor toward a pure-API + CLI-wrapper split. Overall it is in surprisingly good shape for a learning project: the public surface is coherent, the test suite is large and intentional, and the docs spell out what is provisional. But there are several real bugs and a thick layer of doc drift worth fixing.

> This document is the starting point for known bugs and code quality issues as of May 2026. It will grow stale as work is done — update or replace it rather than letting it drift.

## 1. Code clarity & correctness

**Layout is clear.** `src/core` cleanly separates `assembler.js`, `interpreter.js`, `linker.js`, `lcc.js`; `src/utils` collects errors, file artifacts, report building, name handling, and standalone inspectors. The boundary the README/`docs/core-behavior-matrix.md` describes (pure APIs throw typed errors, wrappers do CLI exits) is genuinely implemented in `assembleSource` (`src/core/assembler.js:262-379`) and `executeBuffer` (`src/core/interpreter.js:253-299`). That refactor is the strongest part of the codebase.

**Major correctness/clarity issues:**

- **`Interpreter.raiseRuntimeError` ignores its own flag.** `src/core/interpreter.js:1542-1550` always re-throws, regardless of `throwOnRuntimeError`. So the "throw vs. exit" semantics promised in `docs/interpreter.md` are achieved only because tests run with `isTestMode`, and `interpreter.js:main()` catches and re-maps via `cliErrorExit` (`src/core/interpreter.js:407-413`). Functional, but the boolean is essentially dead code — a smell, given that `Assembler.abortAssembly` (`src/core/assembler.js:223-229`) does the inverse correctly.
- **Linker error flow is broken in subtle ways.** `Linker.error()` (`src/core/linker.js:363-366`) only sets `errorFlag` and logs — it does not abort. `link()` (`src/core/linker.js:172-205`) checks the flag between phases, but after `adjustExternalReferences()` returns early on undefined-symbol, the linker still falls through to `adjustLocalReferences()` and `createExecutable()` (lines 195-204). It writes a broken `.e` to disk on error rather than refusing. `abortLinking` (line 75) is only invoked from `readObjectModule`'s parse-failure path; everywhere else uses `this.error()`. The doc `docs/linker.md` advertises a typed `LinkerError` boundary that the rest of the linker does not actually use.
- **`Linker.link()` accumulates state across calls.** `link()` does not reset `mca/mcaIndex/GTable/...`. Calling `linker.link(...)` twice on the same instance silently produces garbage. Not exercised today, but it's a future trap.
- **`Linker.createExecutable` writes `VTable` entries with header type `'A'`** (`src/core/linker.js:334-340`). This may be intentional (V entries become A-style adjustments after resolution), but there is zero comment explaining it, and the closest doc (`docs/linker.md`) does not mention it.
- **Interpreter SEXT semantics are encoded as a hand-rolled 16×32 lookup table** (`src/core/interpreter.js:23-40`). It is well-commented as oracle-derived and covered by two unit tests (`tests/new/interpreter.unit.spec.js:227-307`), but it is opaque magic numbers; the TODO in `TODOS.md` to derive the actual transform is still open and worth doing.
- **`lcc.handleSingleFile('demo.e')` calls `executeFile(false)`** (`src/core/lcc.js:131`), passing only one arg. `executeFile(includeSourceCode, includeComments)` then passes `undefined` as `includeComments` to `buildReportArtifacts`. Works because the codepath coerces, but the second parameter is silently lost for `.e`-direct executions. The `.hex`/`.bin` branch (line 127) deliberately passes `true` for comments; the contract is documented inline but the call shape is fragile.
- **Several copy-paste blocks in operand parsing.** `assembleLD`, `assembleST`, `assembleLea`, `.word`, and `assembleBR` all repeat the same "is operand[1] an operator? then re-glue operands[0]+operands[1]+operands[2]" pattern (`assembler.js:1392-1405, 1643-1656, 1687-1705, 1733-1746, 1090-1103`). About 60 lines of near-identical code that should be a helper.
- **Magic `loadPoint = 0` repeated four times with the same TODO comment** (`assembler.js:119,192,715,787,581`). The comment is correct but the duplication isn't.
- **`Assembler.tokenizeLine`** (`assembler.js:856-911`) has dead state: `escape` is set to `true` but only used to skip *that* iteration; the comment "Reset escape flag" doesn't quite match what happens. Strings with `\\\\\\"` work, but the logic is harder to read than it should be.
- **`Interpreter.executeSRL/SRA/ROL/ROR`** (`interpreter.js:920-944`) use `ct - 1` to extract the "last bit shifted out." For `ct = 0` this becomes `>> -1`, which JS evaluates as `>> 31`. Likely never reached in practice (the assembler defaults `ct` to 1), but it's an undocumented corner.

Naming is mostly fine; the worst offender is `assembler.code` versus `interpreter.code` versus an `entry.codeWords` array — three different meanings for "code." `Assembler.error()` vs `failAssembly()` vs `abortAssembly()` is also a confusing three-way split (`assembler.js:2175-2194`); the comments explain it, but the names don't.

## 2. Documentation quality

The architecture story is told consistently across `README.md`, `ROADMAP.md`, `TODOS.md`, `docs/core-behavior-matrix.md`, and the per-module `.md` files. The "Preserve / Wrapper-only / Pure API / Research" classification in `core-behavior-matrix.md:12-18` is a genuinely good idea and makes intent legible.

**Concrete documentation problems:**

- **Every cross-reference in the docs is a broken absolute path.** All `docs/*.md`, `src/core/core.md`, `src/utils/utils.md`, and `README.md:281-290` link to `/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/...` which doesn't exist on this machine (the repo lives under `~/Documents/Study/JavaScript/lccjs`). These look like a `sed` replacement that was never run after a workspace move. Use repo-relative paths.
- **`docs/assembler.md:139` lists `.orig` as a research question**, but the code at `src/core/assembler.js:974` already implements `.orig` as an alias for `.org`. Drift.
- **`package.json` test scripts point to nonexistent paths.** `test:legacy` runs `jest test/` (there's no `test/`), and `test:oracle` runs `tests/new/integration.oracle.spec.js` (the file doesn't exist; the oracle suites are `assembler.oracle.e2e.spec.js`, `interpreter.oracle.e2e.spec.js`, `lcc.oracle.e2e.spec.js`, `linker.oracle.e2e.spec.js`). Anyone copy-pasting from the README's `npm run test:oracle` block will hit "no tests found."
- **`onboarding.md` is dated.** Says `linker.js` has no tests ("Linker Test Suite Not Implemented"), dated 11/21/2024, while `tests/new/linker.unit.spec.js` and `tests/new/linker.oracle.e2e.spec.js` exist. README's `## Current Status` more accurately reflects today.
- **`ROADMAP.md` "Remove Docker Dependency" is stale.** No Docker anywhere in the tree (`grep -i docker` returns nothing). That bullet should be marked done or removed.
- **`docs/onboarding_strategy.md` is a seven-line skeleton** that adds nothing on top of `onboarding.md`. Either expand or delete.
- **Per-module docs are consistent with code** for the most part (the assembler doc's `.orig` drift above is the main exception). The `core-behavior-matrix.md` Research markers correctly map to the still-open work in `TODOS.md`.

## 3. Test suite quality

~6200 lines across `tests/new/`, with a sensible split: `*.unit.spec.js` for pure APIs, `*.integration.spec.js` for wrapper behavior using a mocked `fs`, `*.oracle.e2e.spec.js` for golden-cache parity with the C oracle, and `research.behavior.spec.js` for skipped open questions. `tests/helpers/` (env.js, runOracle.js, virtualFs.js, compareFiles.js, etc.) is genuinely well-factored.

**Strengths:**
- The oracle tests use a golden-cache pattern (`tests/new/assembler.oracle.e2e.spec.js:62-122`) so CI can run without the oracle present but regen with `GOLDEN_AUTO_UPDATE=1`. That's good engineering for a parity project.
- Unit tests for `sext` match concrete observed oracle outputs (`tests/new/interpreter.unit.spec.js:227-307`), not just internal expectations.
- Research-skipped tests are documented inline (`tests/new/research.behavior.spec.js:15-39`) rather than silently disabled.

**Weaknesses and gaps:**
- **Virtual-fs harness corrupts binary writes.** `tests/helpers/assemblerIntegrationHarness.js:67-78` concatenates chunks as `buffer.toString('utf-8')` — the assembler's output buffer (binary 16-bit words via `Buffer.alloc(...).writeUInt16LE`) is therefore mangled before being stored in `virtualFs[fd]`. The tests don't notice because almost no integration test inspects bytes — they read `assembler.outputBuffer` or `errorFlag` directly. So this is latent but real, and `tests/new/lcc.integration.spec.js:67-73` does the right thing (uses `Buffer.concat`), proving the bug is fixable.
- **Coverage is heavily asymmetric.** Assembler integration: 1042+933+390+387 lines on edge/instruction/labels/directives. Linker unit: 112 lines, mostly happy path. Linker integration: none. Most linker error paths (`error()` recovery, duplicate `.start` across modules, A-table adjustment correctness with multi-module layouts) are exercised only indirectly through `linker.oracle.e2e.spec.js`.
- **Interpreter coverage skews to format errors.** `interpreter.unit.spec.js` covers signature, traps, sext, and infinite loop; `interpreter.integration.spec.js` (578 lines) is mostly happy paths. The flag-setting in `setCV` (`interpreter.js:1462-1492`, gnarly logic) and the BR condition decode (`interpreter.js:849-881`, where `brgt` uses `n === v && z === 0`) have no direct unit-level assertions outside the oracle suites.
- **Interpreter SOUT/SIN/AIN edge cases**: empty buffer, unicode in inputBuffer, CRLF normalization on Windows — none directly tested. The `// TODO` at `interpreter.js:1101` is honest about this.
- **Many tests use brittle string matching.** `tests/new/assembler.unit.spec.js:140` matches `'Unsupported file type'` (loosely OK), but `tests/new/assembler.cli.integration.spec.js:131` exact-matches `'Line exceeds maximum length of 300 characters'`. Refactoring assembler error wording will require touching dozens of tests. Worth introducing `expect(...).toThrow(AssemblerError)` more often and reserving message strings for end-to-end checks.
- **No coverage of `disassembler.js`** (`src/extra/disassembler.js`, 33KB) or `linkerStepsPrinter.js`. They appear to be developer tools, but they're still 850+KB of unverified code.
- **The `name.integration.spec.js` and `interpreter.e2e.spec.js` tests touch real `os.tmpdir()`** (e.g. `tests/new/interpreter.e2e.spec.js:8`) — fine, but the directory naming `lccjs-interpreter-e2e-` is reasonable; they clean up in `finally`. Good.

## 4. Demos as documentation

The `demos/` set (`demoA.a` through `demoZ.a` plus `happy-path.a`, multi-module pairs `m1/m2`, `r1/r2`, `s1/s2`, `start`, `startup`) is deliberately curated: each demo's purpose is listed in `tests/new/lcc.oracle.e2e.spec.js:30-57` and `tests/new/assembler.oracle.e2e.spec.js:19-46` with one-line comments ("demoR: srl, sra, sll"; "demoY: label offsets for ld"). The demos themselves are short and mostly commented well — `demoZ.a` has line-by-line comments explaining expected output; `demoA.a` is a clean two-line intro example. `happy-path.a` is the long, mnemonic-coverage one and is heavily commented.

`plusdemos/` is genuinely demo-as-documentation: `plusdemos.md` describes each `.ap` file's purpose and the `.ap` files themselves have header comments. `gameSnake.ap` (the most ambitious) has a register-usage block, coordinate convention, key bindings, and a DONE/TODO list at the top — that's exemplary.

**Weaknesses:**
- Some demos (`demoJ.a`) have no header comment explaining what they demonstrate; you have to find their entry in the test file to know they exist for infinite-loop testing. A one-line `;` comment at the top would help.
- `experiments/*.a` files have terse names but no inline summary; `experiments/README.md` describes them as a group, not individually.
- The single `docs/example assembly programs.txt` file is 15KB and undocumented in `README.md` — what is it, and how does it relate to `demos/`?

## 5. Specific bugs or smells

Findings, with file:line citations:

1. **`src/core/linker.js:195-205`**: `adjustExternalReferences` only `return`s without setting any state when it errors. The caller `link()` then proceeds to `adjustLocalReferences` and `createExecutable`. The early-return-without-flag is a real bug.
2. **`src/core/interpreter.js:1542-1550`**: `raiseRuntimeError` always throws — the `throwOnRuntimeError` flag set in `executeBuffer` (line 271) is read nowhere. Either honor it or delete it.
3. **`src/utils/genStats.js:125`**: program-size dec form uses `interpreter.memMax + 1`, the hex form uses `interpreter.memMax - interpreter.loadPoint + 1`. The dec form is wrong when `loadPoint != 0`.
4. **`src/core/assembler.js:706-708`**: `performPass()` pops the last listing entry if it's empty — comment says "possible bug/strange lcc behavior." Either confirm against oracle and update the comment, or guard with a feature flag.
5. **`src/core/assembler.js:1077-1084`**: 8 lines of dead `// this.error` / `// return` code with five "inspect to make sure" TODOs. Either implement validation or remove the dead block.
6. **`src/core/assembler.js:1844-1847`**: four near-identical TODO comments about `ret+3`, `ret +3`, `ret+ 3`, `ret + 3`. These are operand-spacing concerns; collapse into one.
7. **`package.json:5-6`**: `test:legacy` runs `jest test/` (no such directory); `test:oracle` runs `tests/new/integration.oracle.spec.js` (no such file).
8. **`src/utils/name.js:13`**: "asks t he user" — typo.
9. **`src/core/interpreter.js:570`**: `this.code = this.dr = this.sr = (this.ir >> 9) & 0x7` — triple assignment to express three names for the same bits. Works, but the comment `dr/sr` is misleading (it's also `code` for BR). A line of clarifying comment would help.
10. **`src/core/interpreter.js:651-688`**: post-step debug formatting reads `prevPC` but the code uses `this.pc.toString(16)` without `padStart` — formatting inconsistent with other places (e.g. line 660 uses `padStart(1, '0')` which is a no-op).
11. **`src/core/lcc.js:15`** and many others: `const isTestMode = (typeof global.it === 'function')` is duplicated verbatim across `assembler.js:23`, `interpreter.js:42`, `linker.js:8`, `lcc.js:15`, `assemblerplus.js:7`, `interpreterplus.js:10`, `lccplus.js:11`. Same with `cliErrorExit` / `fatalExit` / `cliWrappedErrorExit` in `assembler.js`, `interpreter.js`, and `lcc.js`. Move to a shared `cliErrors.js` in `src/utils/`.
12. **`tests/helpers/assemblerIntegrationHarness.js:67-78`**: binary-to-string concat corrupts assembled output buffers when stored in the virtual FS. Not currently causing test failures because nothing reads the bytes back from the virtual FS through this harness.
13. **`onboarding.md`**: stale linker-tests claim (from 11/21/2024); says debugger is "not yet implemented" while `interpreter.js:807` has a `debug()` method.
14. **`ROADMAP.md`**: Docker removal is listed as a priority; there's no Docker in the project. Stale.

## 6. Top recommendations (prioritized)

1. **Fix the broken doc cross-references.** Run a search-and-replace replacing `/home/avi/Documents/SchoolLocalOnly/AssemblyLocalOnly/lccjs/` with relative paths (e.g. `./` or `../`) across `README.md`, `docs/*.md`, `src/core/core.md`, `src/utils/utils.md`. Low effort, high credibility.
2. **Fix `package.json` test scripts.** `test:legacy` and `test:oracle` reference paths that don't exist. Either point them at real targets (e.g. `test:oracle` → a `--testPathPattern oracle.e2e` invocation) or delete them.
3. **Fix the linker error propagation bug.** In `src/core/linker.js:195-205`, after `adjustExternalReferences` or `adjustLocalReferences` errors, `link()` still calls `createExecutable()`. Either have `error()` throw a `LinkerError` (matching the doc's claimed boundary) or check `errorFlag` and bail before `createExecutable`. Add a unit test.
4. **Remove dead `throwOnRuntimeError` flag (or honor it).** `src/core/interpreter.js:271` sets it but `raiseRuntimeError` at line 1542 ignores it. Either delete the flag, or branch on it like `Assembler.abortAssembly` does.
5. **Fix the dec/hex inconsistency in genStats.** `src/utils/genStats.js:125` should use `interpreter.memMax - interpreter.loadPoint + 1` for both forms. Add a unit test with non-zero `loadPoint`.
6. **Consolidate the duplicated CLI scaffolding.** Move `isTestMode`, `fatalExit`, `cliErrorExit`, `cliWrappedErrorExit` to `src/utils/cliExit.js`; remove ~25 lines × 6 files of duplication.
7. **Refactor the operand-parsing copy-paste.** Extract the `if (!isNumLiteral(operands[N]) && operands[N+1] && operands[N+2])` glue-operands pattern into a helper; reuse from `assembleLD`, `assembleST`, `assembleLea`, `assembleBR`, and `.word` handler in `src/core/assembler.js`. Eliminates ~60 lines and is a precondition for the TODOS.md decomposition work.
8. **Fix the test harness's binary buffer handling.** `tests/helpers/assemblerIntegrationHarness.js:67-78` should use `Buffer.concat` like `tests/new/lcc.integration.spec.js:67-73` already does. Then add an integration test that verifies the bytes written to the virtual FS match `assembler.toOutputBuffer()`.
9. **Replace the SEXT lookup table with the derived transform.** `TODOS.md` flags this; doing it would shrink `interpreter.js:23-40` from ~17 lines of opaque hex to a few lines of documented logic, and would make the "Research" item in `core-behavior-matrix.md` movable to "Preserve."
10. **Update `onboarding.md` and `ROADMAP.md` for current reality.** Mark Docker work done/dropped; correct the linker-test claim; either expand or delete `docs/onboarding_strategy.md`. A short pass would remove the project's clearest stale-doc smells.

---

Net assessment: the refactor narrative the docs tell is mostly true. The pure-API/wrapper split is real and well-tested in the assembler and interpreter; the linker doc oversells what `src/core/linker.js` actually does. The biggest risks are the linker's silent-error path (#3 above) and the volume of stale documentation cross-references (#1). The test suite is more thoughtfully organized than typical learning projects, but its asymmetric coverage and one latent harness bug deserve attention before the next round of decomposition work.
