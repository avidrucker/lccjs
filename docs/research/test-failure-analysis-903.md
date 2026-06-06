# Test failure root-cause analysis

**Issue:** #903 · **Agent:** BANANA · **Date:** 2026-06-05 · **Role:** RESEARCH  
**Repro:** `npm test` — 19 tests fail across 9 suites (grew from 11/8 since issue was filed 2026-06-05)

---

## Summary table

| Cluster | Suites affected | Tests | Root cause | Child ticket |
|---|---|---|---|---|
| A | interactive.unit, ilcc.unit | 3 | `currentIteration` off-by-one | #908 |
| B | close.e2e | 1 | error message wording drift | #909 |
| C | velocity-log.unit | 1 | stale negative-delta rejection test | #910 |
| D | puzzle-velocity-csv.unit | 1 | model column assertion gone stale | #911 |
| E | lezer-grammar.unit | 8 | `@lezer/lr` not installed (`npm install` gap) | #912 |
| F | assembler.formats.integration | 3 | missing .hex fixture files | #913 |
| G | interpreter.oracle.e2e, lcc.oracle.e2e | 2 | `sin` second-string read regression (demoB) | #914 |

---

## Cluster A — `currentIteration` off-by-one (3 tests)

**Failing tests:**
- `interactive.unit.spec.js`: `stepping forward: 1 step changes currentIteration to 1` → got **2**
- `interactive.unit.spec.js`: `0 command redisplays without stepping` → got **1**  
- `ilcc.unit.spec.js`: `1 step then q: r0 === 5 after MVI r0, 5` → `currentIteration` = **2** not 1

**Root cause:** After one forward step from the initial state, `currentIteration` is 2 instead of 1. After a `0` (no-op redisplay) command, `currentIteration` is 1 instead of 0. This implies an extra step is being executed during initialization or the interactive loop setup — before the user's first explicit command — that increments `currentIteration`.

**Source:** `src/interactive/iinterpreter.js` (step logic, lines 135–152); `src/interactive/ilcc.js` (initialization).

---

## Cluster B — `close.js` error message wording drift (1 test)

**Failing test:**
- `close.e2e.spec.js`: `dies when HEAD lacks a Closes #N message`

**Root cause:** Test expects the error to match `/does not reference/i`. Actual message from `scripts/close.js:646` is:

> `No unpushed commit references "Closes #N". Commit the close (marker deletion + \`Closes #N\`) FIRST, then run close.`

The phrase "does not reference" was replaced with "No unpushed commit references…" (restructured subject/verb). The message was reworded in `close.js` without updating the test regex.

**Fix options:** Update the test `toMatch` to `toMatch(/No unpushed commit references/i)`, OR revert close.js to use the original phrase.

---

## Cluster C — stale negative-delta rejection test (1 test)

**Failing test:**
- `velocity-log.unit.spec.js`: `rejects negative delta_c_min with exit 1 and error message`

**Root cause:** Test was written under an old protocol rule that rejected negative `delta_c_min`. The protocol was later updated to **accept** negative deltas (they signal over-run; discarding them destroys calibration signal). `velocity-log.js` now exits 0 for negative `delta_c_min`. The test expectation is wrong per the current design.

Note: `delta_h_min` negatives are still rejected (separate test passes: ✓). Only `delta_c_min` changed.

---

## Cluster D — puzzle-velocity-csv model column assertion stale (1 test)

**Failing test:**
- `puzzle-velocity-csv.unit.spec.js`: `all rows with id >= 126 have a non-empty model value`

**Root cause:** 158 rows with id ≥ 126 have `model = NULL` or `''`. The test was written after a specific backfill pass set model for rows up to some cutoff, asserting the backfill held. Since then, many rows have been logged without the `model` field (it's optional per velocity-log validation — test `allows empty string model field` passes). The assertion has grown stale as the DB grew.

**Fix options:** (a) Backfill model values for rows ≥ 126 in `~/.lccjs/velocity.db`, then re-export CSV; or (b) raise the threshold in the test to match current reality; or (c) remove the assertion and rely on velocity:log's model-format validation instead.

---

## Cluster E — `@lezer/lr` not installed (8 tests)

**Failing suite:** `lezer-grammar.unit.spec.js` — all 8 tests crash before running:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@lezer/lr' imported from .../src/lang-lcc/lcc.js
```

**Root cause:** `@lezer/lr: ^1.4.10` is listed in `package.json` devDependencies but is **absent from `node_modules/`**. `npm install` has not been run since the dependency was added. No `@lezer/*` namespace exists under `node_modules/` at all.

**Fix:** `npm install` in the main checkout. All 8 tests are expected to pass once the package is present (the grammar was verified to tokenize correctly via commit #874's fix).

---

## Cluster F — missing `.hex` fixture files (3 tests)

**Failing tests:**
- `assembler.formats.integration.spec.js`: tests 6a, 6b, 6c — all crash with `ENOENT`

**Root cause:** Tests 6a–6c reference `tests/fixtures/assembler-formats/hexExample.hex`, `badHex.hex`, and `badHex2.hex`. Only binary fixtures (`binaryExample.bin`, `badBinary.bin`, `badBinary2.bin`) exist in that directory. The `.hex` fixture files were never created alongside the tests.

---

## Cluster G — `sin` second-string read regression (2 tests)

**Failing tests:**
- `interpreter.oracle.e2e.spec.js`: `demoB — sin, sout, .string and .zero directives`
- `lcc.oracle.e2e.spec.js`: same demoB

**Root cause:** The second `sin` call in demoB reads an empty string or fails silently. Observed diff:

```
JS:     what's your last name?            (no echoed input)
Oracle: what's your last name? input2

JS:     hi, input1 .                      (space but no second name)
Oracle: hi, input1 input2.
```

The first `sin` (`input1`) works correctly. The second `sin` (`input2`) either reads empty or is not echoing/storing the input. Possible causes: input buffer consumed by first read, newline handling between consecutive `sin` calls, or an `isEOF` flag set prematurely.

**Source:** `src/core/interpreter.js` around the `sin` trap handler (`readLineFromStdin`, trapvec 10, line ~1458).

---

## Child tickets filed

#908 — fix(interactive): `currentIteration` off-by-one after initialization (Cluster A)
#909 — fix(close): update test regex to match current error message wording (Cluster B)  
#910 — test(velocity-log): remove stale negative-`delta_c_min` rejection test (Cluster C)
#911 — data(velocity-csv): backfill or reconcile model column for rows id ≥ 126 (Cluster D)
#912 — ops: run `npm install` to pull `@lezer/lr` into node_modules (Cluster E)
#913 — test(assembler-formats): create missing `.hex` fixture files for tests 6a–6c (Cluster F)
#914 — fix(interpreter): `sin` second-string read regression breaks demoB oracle parity (Cluster G)
