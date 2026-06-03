# Test Suite Audit — Brittleness, Robustness, and Quality (#522)

**Agent:** BANANA · **Date:** 2026-06-03 · **Role:** RESEARCH

Scope: `tests/new/` (primary suite run by `npm test`). Oracle suites noted where
relevant. Baseline: `docs/init_code_review.md` §3 (May 2026 snapshot); this report
picks up where that left off and covers the current state.

---

## 1. Brittleness

### B1 — 146 exact-string `toThrow` assertions (7:1 brittle-to-typed ratio)

**Files:** `assembler.edge.integration.spec.js` (41 instances), `assembler.instructions.integration.spec.js`, `assembler.unit.spec.js`, `interpreter.unit.spec.js`, `linker.unit.spec.js`, and others.

The non-oracle suite has **146** assertions of the form `.toThrow('Bad number')` / `.toThrow('Missing register')` / etc., against only **22** typed-error class assertions (`.toThrow(AssemblerError)`, `.toThrow(LinkerError)`). Top patterns by count: `'Bad number'` (26), `'Bad register'` (22), `'Missing operand'` (15), `'Missing register'` (12), `'Undefined label'` (8).

Any refactoring of error message wording — even a capitalisation fix or punctuation change — silently invalidates dozens of tests. The fix path is to default to `toThrow(AssemblerError)` and reserve message-string matching for end-to-end scenarios that are explicitly pinning UX text.

**Severity:** High. Directly suppresses refactoring.

---

### B2 — Virtual-FS harness corrupts binary writes (still present)

**File:** `tests/helpers/assemblerIntegrationHarness.js:68`

```js
fs.writeSync.mockImplementation((fd, buffer) => {
  if (Buffer.isBuffer(buffer)) {
    virtualFs[fd] += buffer.toString('utf-8');  // ← corrupts binary output
```

`openSync` initialises `virtualFs[fd] = ''` (a string), then binary code words are appended as a UTF-8 decoded string. The assembled `.e` bytes are mangled. Currently **latent** — integration tests check `assembler.outputBuffer` or `assembler.errorFlag` directly, not the bytes in `virtualFs`. The fix (`Buffer.concat`) is already demonstrated at `tests/new/lcc.integration.spec.js:67-73`. If any future test reads back an assembled binary from `virtualFs`, it will silently get corrupted data.

First identified in `docs/init_code_review.md` §3. Still open.

**Severity:** Medium (latent; will cause silent corruption when binary round-trip tests are added).

---

### B3 — Linker tests couple to `console.error` strings

**File:** `tests/new/linker.unit.spec.js:119,137`

```js
expect(console.error).toHaveBeenCalledWith('More than one global declaration for main');
expect(console.error).toHaveBeenCalledWith('missing is an undefined external reference');
```

These assertions test a console side-effect rather than the semantic error outcome. They would break silently if linker errors were migrated to `throw new LinkerError(...)` (which the docs claim is the goal), and they break on any message wording change.

**Severity:** Low–Medium. Blocks the linker's error-boundary refactor.

---

### B4 — Opaque numeric test ID prefixes

**Files:** `assembler.instructions.integration.spec.js`, `assembler.edge.integration.spec.js`

Tests are named `'11. should throw if an immediate is out of range...'`, `'122. should throw error for add instruction...'`, etc. The source of these numbers is not documented. They make CI failure output harder to parse ("failed: 122."), hide what is actually being tested, and create an implicit numbering gap that is hard to maintain.

**Severity:** Low. Quality only — does not affect correctness.

---

## 2. Robustness gaps

### R1 — Shift/rotate with count = 0: no test (related: #518 ARC open question)

**File:** `src/core/interpreter.js:920-944`

The shift/rotate methods compute `ct - 1` to extract the last bit shifted out. For `ct = 0`, this evaluates `>> -1`, which JavaScript reduces to `>> 31`. Issue #518 is validating whether ct=0 is a valid encoding and what the runtime semantics should be. There are **no tests** for shift/rotate with `ct=0` in the non-oracle suite — neither unit nor integration. Oracle suites cover `demoR` (srl/sra/sll) but not the zero-count edge.

Once #518 resolves the semantic question, a pinning test should be filed.

**Severity:** Medium (pending #518 resolution).

---

### R2 — SIN with empty `inputBuffer`: untested

**File:** `tests/new/interpreter.unit.spec.js:167`; `interpreter.integration.spec.js:357`

The only SIN/AIN input-buffer tests use non-empty strings (`'hi\n'`, `'42\n'`). What happens when a SIN trap fires against an empty `inputBuffer` is untested. The `readLineFromStdin()` codepath (interpreter.js ~line 1100-1130) hits a `// TODO` for this condition, and the behavior — error? empty string? block? — is unspecified.

**Severity:** Medium. Realistic misuse path; the TODO at the call site signals the gap is known.

---

### R3 — InterpreterPlus extension traps: no unit tests

**File:** `tests/new/interpreterplus.unit.spec.js` (6 tests)

`interpreterplus.unit.spec.js` covers only `rand`/`srand` (the LCG). The five other LCC+ traps — `sleep`, `nbain`, `cursor`, `millis`, `resetc` — have **zero unit coverage**. They are only exercised indirectly through end-to-end demo runs (which exist: `interpreterplus.e2e.spec.js` runs `randDeterministic.ap`). But e2e demos don't test error paths: what does `nbain` do with an empty buffer? what does `cursor` do with out-of-bound coordinates? Untested.

**Severity:** Medium.

---

### R4 — Duplicate `.start` across two linked modules: untested

**File:** `tests/new/linker.unit.spec.js`

`assembler.unit.spec.js:169` tests that duplicate `.start` in a **single** source file keeps the last one. But what happens when two `.o` modules both contain an `S` header and are linked together? The linker's `processModule()` handles duplicate globals (throws `LinkerError`), but the `S` header path is not guarded the same way. No test exists for this scenario.

**Severity:** Low–Medium.

---

### R5 — Condition-code (setCV, BR decode) coverage depends entirely on oracle suites

**Files:** `src/core/interpreter.js:1462-1492` (`setCV`), `:849-881` (BR condition decode)

The condition-code flag-setting logic (particularly `brgt: n === v && z === 0`) and `setCV`'s C/V overflow math have no direct unit or integration assertions outside the oracle parity suites. If the oracle is unavailable (CI without `LCC_ORACLE`), these paths have zero test coverage. They're not complex edge cases — they're core execution semantics.

**Severity:** Medium. Core correctness hidden behind oracle dependency.

---

## 3. Coverage gaps

### C1 — `disassembler.unit.spec.js`: 11 tests for 915 LOC

`src/extra/disassembler.js` is 915 lines (96 functions, max nesting depth 28 — the deepest in the codebase per `docs/research/codebase-quality-hotspots.md`). The test file has 11 tests covering `signExtend`, an OB-002 regression on `disassembleMVI`, and a handful of other per-instruction decode methods plus a CLI smoke. The vast majority of per-instruction decode paths are untested. This was flagged as a tier-2 item in `docs/research/codebase-quality-hotspots.md` (#427 Tracker).

**Severity:** Medium.

---

### C2 — `assemblerplus.unit.spec.js`: 6 tests, happy path only

`src/plus/assemblerplus.js` (187 LOC) has 6 tests, all in a "happy path" describe block. Error paths — what happens if `.lccplus` is missing, if an unknown plus mnemonic appears, if a core instruction is mixed with plus-only ones — are untested. These are the most likely misuse paths.

**Severity:** Medium.

---

### C3 — No linker integration tests

The linker is tested at unit level (hand-constructed module objects, mocked fs) and at oracle e2e level. There are zero tests that: (a) call `assembler.main()` on two `.a` files, (b) produce `.o` files, and (c) call `linker.main()` on them. All cross-module linking behavior is validated only through oracle golden-cache comparison, not through assertions on intermediate state.

First identified in `docs/init_code_review.md` §3. Still open.

**Severity:** Medium. Breaks coverage gap on linker error paths.

---

### C4 — `assembler.performPass()` empty-listing-entry pop: no oracle-verified test

**File:** `src/core/assembler.js:706-708`

The code has an inline comment: "possible bug/strange lcc behavior". The behavior (popping the last listing entry if empty) has never been confirmed against the oracle. It's neither an active test nor a skipped research test — it's dead comment. This should graduate to either a pinned behavior test or a `research.behavior.spec.js` entry.

**Severity:** Low.

---

## 4. Quality issues

### Q1 — `research.behavior.spec.js` name no longer matches content

The file name implies disabled/experimental research-mode tests. It now contains **active, passing regression tests** for line-length (#244) and label-length (#245) behavior. Callers scanning for skipped tests won't look here; callers scanning for active tests may skip it. Rename to `assembler.line-label-length.spec.js` or move the tests into `assembler.edge.integration.spec.js` and delete the file.

**Severity:** Low (discoverability).

---

### Q2 — Mixed `clearAllMocks` vs `restoreAllMocks` across the suite

`clearAllMocks()` resets call counts but leaves mocked implementations in place. `restoreAllMocks()` also reverts spy implementations to the originals. The suite uses both patterns inconsistently:
- `linker.unit.spec.js`, `lcc.integration.spec.js`, `interpreter.integration.spec.js`, `name.integration.spec.js` → `clearAllMocks()`
- `assemblerplus.unit.spec.js`, `linkerStepsPrinter.unit.spec.js`, `lccplus.unit.spec.js`, `velocity-export.unit.spec.js` → `restoreAllMocks()`

In `--runInBand` mode this rarely causes failures because Jest isolates modules, but a leaked `mockImplementation` from a `clearAllMocks()` suite can pollute the next describe block in the same file. `lcc.unit.spec.js:306` documents one such case with an explicit workaround comment. A codebase-wide audit would remove those workarounds.

**Severity:** Low (occasional mystery failures).

---

### Q3 — `interpreter.integration.spec.js`: 586 lines with one flat describe

All 23+ tests in `interpreter.integration.spec.js` sit in a single `describe('Interpreter Integration Tests')` with no sub-grouping by feature. `assembler.edge.integration.spec.js` (1083 lines) has the same pattern. When a test fails, the output is `Interpreter Integration Tests > test 14. should handle DIN...` with no grouping context. Sub-describes by feature area (traps, memory, output formatting, etc.) would improve diagnosis speed.

**Severity:** Low (readability).

---

### Q4 — Console-negative assertions as proxy for absent behavior

**File:** `interpreter.integration.spec.js:231-232`

```js
expect(console.log).not.toHaveBeenCalledWith(`lst file = ${eFilePath.replace(...)}`);
expect(console.log).not.toHaveBeenCalledWith(`bst file = ${eFilePath.replace(...)}`);
```

These check that a console call with a specific *format string* did not happen. If the format changes (e.g., from `lst file = X` to `lst: X`), the assertion passes even if the side effect still occurs. Prefer asserting on the outcome (e.g., `result.reports.lst` is null, or the file was not written to the virtual FS).

**Severity:** Low (precision issue).

---

## 5. Summary matrix

| ID | Area | Finding | Severity | Action |
|----|------|---------|----------|--------|
| B1 | Brittleness | 146 exact-string toThrow (7:1 vs. typed) | High | File fix ticket: convert to `toThrow(TypedError)` |
| B2 | Brittleness | Harness binary corruption (still latent) | Medium | File fix ticket (init_review B8) |
| B3 | Brittleness | Linker tests on console.error strings | Low–Med | File fix ticket |
| B4 | Brittleness | Opaque numeric test ID prefixes | Low | Note only (no ticket) |
| R1 | Robustness | Shift ct=0: no test (pending #518) | Medium | File test ticket after #518 closes |
| R2 | Robustness | SIN with empty inputBuffer | Medium | File test ticket |
| R3 | Robustness | InterpreterPlus traps (5 untested) | Medium | File test ticket |
| R4 | Robustness | Linker duplicate .start across modules | Low–Med | File test ticket |
| R5 | Robustness | setCV / BR condition codes: oracle-only | Medium | File unit test ticket |
| C1 | Coverage | disassembler.unit.spec.js thin (11/915) | Medium | Tracked in #427 |
| C2 | Coverage | assemblerplus.unit.spec.js errors untested | Medium | File test ticket |
| C3 | Coverage | No linker integration tests | Medium | Known; file test ticket |
| C4 | Coverage | performPass() pop: no oracle-verified test | Low | File research ticket |
| Q1 | Quality | research.behavior.spec.js name misleading | Low | File rename ticket |
| Q2 | Quality | Mixed clearAllMocks/restoreAllMocks | Low | File cleanup ticket |
| Q3 | Quality | Flat describes in large test files | Low | Style ticket |
| Q4 | Quality | Console-negative assertions | Low | Note only |

---

## 6. Recommended follow-up tickets (priority order)

1. **B1 — Migrate error-string `toThrow` to typed errors** (High): `assembler.edge.integration.spec.js`, `assembler.instructions.integration.spec.js`, and related files. Systematic replace: `toThrow('Bad number')` → `toThrow(AssemblerError)`. Reserve message-string pinning for top-level e2e tests only. ~60m.

2. **B2 — Fix virtual-FS harness binary corruption** (Medium): `tests/helpers/assemblerIntegrationHarness.js:68` — replace the `buffer.toString('utf-8')` append with `Buffer.concat`. Add one integration test that reads assembled bytes from `virtualFs`. ~30m.

3. **R5 — Add setCV / BR condition-code unit tests** (Medium): Direct assertions on flag-setting and `brgt`/`brnz`/etc. condition decode, without requiring the oracle. ~45m.

4. **R2 — Test SIN with empty inputBuffer** (Medium): Clarify and pin the behavior when a SIN trap fires against an empty buffer. ~20m.

5. **R3 — InterpreterPlus trap unit tests** (Medium): sleep, nbain, cursor, millis, resetc — at minimum one happy-path and one error-path per trap. ~45m.

6. **B3 — Linker tests: replace console.error checks with outcome assertions** (Low–Med): Pairs with any linker error-boundary work. ~20m.

7. **C3 — Linker integration tests** (Medium): Assemble two `.a` files → `.o`, link → `.e`, assert output. ~45m.

8. **R1 — Shift ct=0 pinning test** (Medium): After #518 resolves. ~15m.

9. **C2 — AssemblerPlus error-path tests** (Medium): Missing `.lccplus`, unknown mnemonic, core+plus mix. ~30m.

10. **Q1 — Rename `research.behavior.spec.js`** (Low): ~10m.

Items C1 (disassembler) and C4 (performPass pop) are already tracked or low-priority; no new ticket needed.
