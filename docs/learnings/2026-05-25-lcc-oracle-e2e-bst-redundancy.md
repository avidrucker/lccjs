# Learnings — `lcc.oracle.e2e` and the redundant `.bst` golden

Date: 2026-05-25
Branch where this work landed: `improve-docs-branch-2026-may-25-01`

## The bug

`tests/new/lcc.oracle.e2e.spec.js` was **structurally broken** in any
fresh clone of the repo:

- The suite compared LCCjs output against four oracle artifacts per demo:
  `.a`, `.e`, `.lst`, and `.bst`.
- `.gitignore:10` globally ignored `*.bst` files, which meant the `.bst`
  goldens could never be checked in (`git ls-files | grep '\.bst$'` → 0).
- Without `.bst` goldens on disk, every demo hit the `needsRegen` branch
  in the spec and was skipped with "missing golden files".
- Net effect: **all 24 demos in the suite skipped, every run, on every
  clean checkout**. The suite contributed zero to CI signal.

The only way to make it run was setting `GOLDEN_AUTO_UPDATE=1`, which
forced live regen of the goldens against the installed cuh63 LCC oracle
— and then crashed on `demoF.a:12` due to an unrelated parity regression
in cuh63 6.3's `mov` validation (see the separate `mov` parity bug
report).

## The investigation

The bug surfaced while running `npm install` followed by `npm test` for
the first time after wiring up the LCC oracle (`.env` + `LCC_ORACLE`):

1. `npm test` reported 24 unexpected skipped tests in `lcc.oracle.e2e`.
   Coverage was otherwise green.
2. Setting `GOLDEN_AUTO_UPDATE=1` to force regen crashed on a `mov r0, -15`
   error from cuh63 6.3.
3. Tracing the skip path revealed `needsRegen` was `true` because
   `haveGoldenBst` was `false` — no `.bst` files anywhere in
   `tests/goldens/lcc/`.
4. `cat .gitignore | grep bst` showed the global `*.bst` rule. The
   ignore-versus-required conflict was the root cause.
5. Inspecting an `.lst` and a `.bst` side-by-side for the same demo
   revealed they are **the same listing in two different bases**:

   ```
   .lst  →  0000  d005             mov r0, 5
   .bst  →  0000  1101 0000 0000 0101  mov r0, 5
   ```

   Every other byte of the two files is identical (timestamp header
   aside). The `.bst` carries no information not present in `.lst`.

## The fix

`tests/new/lcc.oracle.e2e.spec.js`:

- Removed `bstDiff` and `compareBstFiles` from the helpers import.
- Dropped the `goldenBst` path, the `haveGoldenBst` flag, the `.bst`
  arm of `needsRegen`, the `.bst` write in the auto-update branch, and
  the `.bst` comparison + diff in the `test()` body.
- Added a comment explaining *why* `.bst` is not compared (so a future
  contributor doesn't add it back thinking it's missing coverage).

No production code touched; spec is ~20 lines lighter.

## Benefits / what we gained

| Before | After |
|---|---|
| 0 / 24 lcc.oracle.e2e demos passing on a clean clone | **24 / 24 passing** |
| 26 total skipped tests in `npm test` | **2 skipped** (intentional research markers only) |
| Required `GOLDEN_AUTO_UPDATE=1` env var on first run | Runs out-of-the-box, no env vars needed |
| Required live oracle binary on first run | Live oracle still optional (only needed when `.a` demos change) |
| Conflicted with the global `*.bst` gitignore | No `.bst` goldens needed; gitignore stays as-is |
| Test code duplicated the same parity check in two formats | Single comparison; ~20 fewer lines of spec code |

## General lessons

1. **Coverage by redundancy is not coverage.** If artifact A is a
   one-to-one reformat of artifact B, comparing both adds maintenance
   cost without adding bug-detection power. The `.bst` ↔ `.lst`
   relationship was exactly that. Any parity defect that would have
   been caught by `.bst` was already caught by `.lst`.

2. **A golden test that conflicts with `.gitignore` is structurally
   broken, not just misconfigured.** The "skip on missing golden"
   pattern is reasonable per se, but combined with a gitignore that
   forbids committing the goldens, it silently degrades the suite to
   a no-op. Before adding a new golden format, check that the format
   can actually live in version control.

3. **Skip-on-missing is invisible.** Jest reports skipped tests
   without colour or count emphasis. A 24-skip suite looks the same
   as a 24-pass suite in casual scrollback. Worth periodically
   auditing `test.skip` and the skip rates per suite.

4. **An apparent "oracle parity" issue can mask a deeper test-design
   issue.** Setting `GOLDEN_AUTO_UPDATE=1` to "fix the skip" surfaced
   the cuh63 `mov` regression as if it were the real problem, when
   in fact the real problem was that the suite was structurally
   unable to run in the first place. Following the skip back to its
   root cause (rather than just unblocking auto-update) was what
   exposed the redundant `.bst` check.

## Related artifacts

- `tests/new/lcc.oracle.e2e.spec.js` — the spec we simplified.
- `tests/goldens/lcc/` — the golden cache (`.a`, `.e`, `.lst` per demo).
- `scratch/mov_parity/` — the investigation tools for the cuh63 `mov`
  regression that was uncovered en route.
- `current_issues.md` — living issue log.
- `docs/init_code_review.md` — the May 2026 review that prompted the
  test-coverage assessment.
