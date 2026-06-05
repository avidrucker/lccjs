# Test Suite Snapshot — 2026-06-04

Run by agent BANANA (sonnet-4.6) in worktree for #776.
Branch: `banana/issue-776-data-full-test-suite-output`
Node version: see `.nvmrc` / `package.json engines` field.

---

## 1. Primary suite — `npm test` (`tests/new/`)

```
Test Suites: 2 failed, 63 passed, 65 total
Tests:       2 failed, 1302 passed, 1304 total
Time:        ~32s
```

### Failures

| Spec file | Test name | Failure summary | Notes / future intention |
|---|---|---|---|
| `tests/new/close.e2e.spec.js` | `dies when HEAD lacks a Closes #N message` | Regex `/does not reference/i` does not match actual error string | Error message wording in `close.js` diverged from what the test expects. Pre-existing; file a DEV ticket to align the test regex with the current message text. |
| `tests/new/puzzle-velocity-csv.unit.spec.js` | `all rows with id >= 126 have a non-empty model value` | 4 rows (ids 464/569, 534/637, 544/650, 556/665) missing `model` field | Data-quality gap: those rows were logged without a model value and the backfill was not applied. File a DATA ticket to backfill these rows in `~/.lccjs/velocity.db` and re-export. |

### Oracle suites (within `tests/new/`)

All 8 oracle suites appear as **PASS** (`lcc.oracle`, `assembler.oracle`, `linker.oracle`, `interpreter.oracle`, `interpreter.e-path-hex-only.oracle`, `interpreter.bp.oracle`, `assembler.branch-mnemonics.oracle`, `assembler.org.oracle`). **These auto-skip all their tests when `LCC_ORACLE` is unset** — Jest reports them as passing because skipped tests do not count as failures. See `docs/oracle-setup.md` for setup.

---

## 2. Full suite — `npm run test:all` (all `tests/`)

```
Test Suites: 4 failed, 63 passed, 67 total
Tests:       5 failed, 1302 passed, 1307 total
Time:        ~87s
```

Adds `tests/browser/` to the run. All `tests/new/` results are identical to §1 above.

### Additional failures (browser suite)

| Spec file | Test name | Failure summary | Notes / future intention |
|---|---|---|---|
| `tests/browser/playground.browser.spec.js` | T1 (Hello World), T2 (assembly error), T3 (stdin pass-through) | `page.waitForFunction` timeout 15–20s exceeded | Browser suite requires a running local server with `lcc.bundle.js` served. Not started in CI. These are **environment-dependent** — not regressions in the code. File a DEV ticket to document the local-server precondition and add a `PLAYGROUND_URL` env guard that skips cleanly when unset. See also #772 (build fix) and #776/#774 (e2e harness). |
| `tests/browser/playground.e2e.spec.js` | (entire suite failed to run) | Playwright test invoked via `jest --runInBand`; Playwright requires `npx playwright test` | Configuration bug: `tests/browser/playground.e2e.spec.js` uses Playwright's `test.describe` API but is picked up by Jest. Must be excluded from Jest's `testMatch` or moved to a dedicated `playwright/` directory. Use `npm run test:browser` (`playwright test tests/browser/`) instead, not `jest`. Pre-existing; tracked in context of #762 / #774. |

---

## 3. Oracle suite — `npm run test:oracle`

```
Test Suites: 8 passed, 8 total
Tests:       124 passed, 124 total
Time:        ~1s
```

**`LCC_ORACLE` was unset** — all 124 tests auto-skipped and reported as passed. No oracle binary available in this environment. To run with real parity checks:

```bash
# Copy .env.example → .env and set:
LCC_ORACLE=/path/to/cuh63/lcc
npm run test:oracle
```

See `docs/oracle-setup.md` for full setup. The oracle binary (`cuh63/lcc`) lives at `~/Documents/Study/Assembly/cuh63/lcc` on the developer machine (see `docs/oracle-setup.md`).

---

## 4. Known skips and their reasons

| Pattern | Reason | Files affected |
|---|---|---|
| Oracle suites auto-skip | `LCC_ORACLE` env var unset — skips via `beforeAll` guard in each suite | All `*.oracle.e2e.spec.js` |
| `playground.browser.spec.js` T2/T3 | Cascade from T1 timeout — server not running | `tests/browser/playground.browser.spec.js` |

---

## 5. Future test intentions (known gaps)

| Area | Intent | Ticket / reference |
|---|---|---|
| Playwright playground e2e | Needs to run via `npx playwright test`, not Jest; isolate in `tests/e2e/` | #774 (filed 2026-06-04) |
| Browser playground e2e precondition | Add `PLAYGROUND_URL` skip guard so suite is clean-skip when server not running | Follow-on to #772, #774 |
| `close.js` error message test | Align `/does not reference/i` regex with current error wording | File DEV child of #633 or standalone |
| Velocity CSV model backfill | Backfill missing `model` values for ids 464, 534, 544, 556 | File DATA ticket |
| Oracle suite with real binary | Run differential parity suite against `cuh63/lcc` and record any new deviations | Ongoing; see `docs/parity_deviations.md` |
