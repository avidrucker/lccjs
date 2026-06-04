# Oracle CI Spike — M2 (#690)

**Parent:** #427 (Tier 2 tracker) · **Date:** 2026-06-04 · **Agent:** ELDERBERRY

## Finding

The oracle parity problem is **already 85% solved.** The existing golden-file cache
in `tests/goldens/` is tracked in git, and the oracle binary is only invoked during
initial golden generation (when `GOLDEN_AUTO_UPDATE=1`). The actual comparison step
runs LCC.js output against committed files — no binary needed.

Running the oracle suite without `LCC_ORACLE` set confirms this:

```
Tests: 18 skipped, 106 passed, 124 total
```

No container, no mock, and no redistribution of a closed-source binary is required
for CI. The 18 skipped tests are the only gap.

## Two oracle test patterns

The codebase has two distinct patterns:

### Pattern A — Golden-cache (CI-compatible)

Used by 5 test files: `assembler.oracle`, `interpreter.oracle`, `lcc.oracle`,
`linker.oracle`, `lcc.oracle.source-retention`.

```
Step 1: Check committed golden source (.a) matches current demo → skip if changed
Step 2: Check committed golden output (.e/.lst) exists → skip if missing; oracle only
        invoked here when GOLDEN_AUTO_UPDATE=1
Step 3: Run LCC.js; compare to committed golden → NO oracle call
```

**Result: 106 tests pass in CI without LCC_ORACLE.**

### Pattern B — Direct oracle (not CI-compatible)

Used by 4 test files:

| File | Skips | Subject |
|------|-------|---------|
| `assembler.branch-mnemonics.oracle.e2e.spec.js` | 11 | branch mnemonic parity |
| `assembler.org.oracle.e2e.spec.js` | 2 | `.org`/`.orig` directives |
| `interpreter.e-path-hex-only.oracle.e2e.spec.js` | 3 | `.e`-path LST hex parity |
| `interpreter.bp.oracle.e2e.spec.js` | 1 | bp step-trace §22 parity |

```javascript
const itOracle = assertOracleConfigured() ? test : test.skip;
itOracle('...', () => { /* calls oracle binary live */ });
```

**Result: all 18 of these tests skip when LCC_ORACLE is unset.**

## Approaches evaluated

### Option A: Migrate Pattern B → Pattern A (Recommended)

Convert the 4 direct-oracle files to the golden-cache pattern:

1. Run each file once locally with `LCC_ORACLE` set to generate golden output.
2. Commit the golden files into `tests/goldens/`.
3. Refactor each test to use the golden-cache read path (Steps 1–3 above).

**Effort:** ~30–45m DEV per the existing golden-cache template.
**CI portability:** 100% — all 124 tests run without the binary.
**Maintenance:** golden files are refreshed the same way as the existing cache
(run with `GOLDEN_AUTO_UPDATE=1` when oracle behavior legitimately changes).
**Drift risk:** same as the current 106 tests — intentional divergences are in
`docs/parity_deviations.md` and the comparison is byte-for-byte.
**Binary redistribution:** none required.

### Option B: Containerize the oracle binary

Bundle the `cuh63/lcc` Linux binary in a Docker image or GitHub Actions runner.

**Effort:** ~120–180m SPIKE+DevOps.
**CI portability:** only on `ubuntu-latest` runners (binary is Linux x86-64).
**Maintenance:** image must be rebuilt per `cuh` release and updated in CI config.
**Drift risk:** live oracle calls catch regressions immediately; but parity
deviations in `docs/parity_deviations.md` require suppression in CI to avoid
false failures.
**Binary redistribution:** requires author permission (closed-source binary,
unverified redistribution rights). BLOCKER.

### Option C: Leave as-is, add a CI job note

Keep the 18 skips, document the CI limitation in a comment.

**Effort:** 0.
**CI portability:** unchanged.
**Maintenance:** none.
**Drift risk:** the 18 test paths remain unguarded in CI.

## Recommendation

**Option A.** Migrate the 4 Pattern B files to the golden-cache pattern.

Rationale:
- Option B has a redistribution blocker and high ongoing maintenance.
- Option C permanently sacrifices 18/124 tests in CI (15% of the oracle suite).
- Option A follows the existing golden-cache precedent — no new infrastructure,
  no redistribution, no CI-config changes, and it closes the 15% gap completely.

## Follow-on ticket

File a DEV ticket: "Migrate 4 direct-oracle test files to golden-cache pattern
(assembler.branch-mnemonics, assembler.org, interpreter.e-path-hex-only,
interpreter.bp) — eliminates 18 CI skips." Estimate: ~45m DEV. Blocked by: oracle
binary access to generate the initial golden files (one-time, on a local machine).

## What this spike does NOT cover

- GitHub Actions CI workflow file (no `run-tests` workflow exists yet — a separate
  ticket is needed to add one if CI integration is desired).
- LCC+ oracle parity (no `.ap`/`.ep` oracle suite exists yet).
- Running the oracle on non-Linux platforms in CI.
