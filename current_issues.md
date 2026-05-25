# Current Issues

A living, scan-friendly index of known issues and gaps in this repo. Updated as
fixes land and new findings surface.

For deeper analysis of code-quality issues with file:line citations, see
[`docs/init_code_review.md`](./docs/init_code_review.md) — the May 2026 review
snapshot. For planned refactor / parity / feature work in flight, see
[`TODOS.md`](./TODOS.md). For higher-level direction, see
[`ROADMAP.md`](./ROADMAP.md).

Last updated: 2026-05-25.

## Known bugs (correctness)

These are real defects, not just smells. Citations refer to commit `87f41d4`
(branch `research-2026-may`); verify before fixing if the branch has moved on.

- **Linker error propagation is broken.** `Linker.error()` only sets `errorFlag`
  and logs; `link()` still falls through to `adjustLocalReferences()` and
  `createExecutable()` after an `adjustExternalReferences()` failure, writing a
  broken `.e` to disk. (`src/core/linker.js:172-205, 363-366`) — review item #3.
- **`Interpreter.raiseRuntimeError` ignores its own flag.**
  `throwOnRuntimeError` is set in `executeBuffer` but never read.
  (`src/core/interpreter.js:1542-1550`) — review item #4.
- **`Linker.link()` accumulates state across calls.** No reset of
  `mca/mcaIndex/GTable/...`. Latent, not currently exercised.
- **`genStats.js` dec/hex program-size inconsistency.** Decimal form uses
  `memMax + 1`; hex form uses `memMax - loadPoint + 1`. Decimal is wrong when
  `loadPoint != 0`. (`src/utils/genStats.js:125`) — review item #5.
- **Test harness binary-buffer corruption.** `assemblerIntegrationHarness.js`
  concatenates write chunks as utf-8 strings, mangling 16-bit-word binary
  output. Latent — no current test inspects bytes through this harness.
  (`tests/helpers/assemblerIntegrationHarness.js:67-78`) — review item #8.
- **`Interpreter.executeSRL/SRA/ROL/ROR`** use `ct - 1`, which becomes `>> -1`
  (≡ `>> 31`) when `ct = 0`. Unreachable in practice today; still an
  undocumented corner. (`src/core/interpreter.js:920-944`).

## Missing features and asymmetries

- **No plus-linker yet.** `src/plus/` has `assemblerplus.js`,
  `interpreterplus.js`, and `lccplus.js`, but **`linkerplus.js` does not
  exist**. The `.ap` toolchain currently has no way to link multi-module plus
  programs. **Planned as a major enhancement** — needs:
  - a design pass on how `.op` (object-plus) modules should look relative to
    the existing `.o` format and whether plus-mode introduces any new
    relocation kinds;
  - parity research against the LCC+ oracle for the multi-module case;
  - a `linkerplus.js` implementation that mirrors `linker.js`'s wrapper
    structure but routes through the plus-aware assembler/interpreter; and
  - unit and oracle-e2e suites under `tests/new/`.
- **Symbolic debugger is partial.** `Interpreter.debug()` and `debugMode`
  exist (`src/core/interpreter.js`), but full breakpoint/step semantics and
  oracle-parity behavior are still open. Tracked in `TODOS.md` and the
  `branch-feat-debugger` branch.
- **Incomplete instruction set.** Some standard and extended instructions are
  not yet implemented; see `TODOS.md` and `docs/core-behavior-matrix.md`
  Research entries for specifics.
- **No coverage of dev tools.** `src/extra/disassembler.js` (~33KB) and
  `linkerStepsPrinter.js` have no tests. — review §3.

## Stale or thin documentation

Most of the stale-reference items flagged in the May 2026 review were
addressed on `improve-docs-branch-2026-may-25-01`. Remaining items:

- **`docs/onboarding_strategy.md`** is a 7-line skeleton that adds nothing on
  top of `onboarding.md` — expand-or-delete decision still open.
- **`docs/example assembly programs.txt`** (15KB) is undocumented in
  `README.md`; its relationship to the curated `demos/` set is unclear.
- **Per-module docs (`docs/assembler.md`, `interpreter.md`, `lcc.md`,
  `linker.md`)** still need rewrites against the current pure-API plus
  wrapper architecture. Tracked in `TODOS.md` "Documentation".
- **`linker.md` oversells the typed `LinkerError` boundary** — the rest of
  the linker still uses `this.error()`-and-continue. Doc / code drift.

## Test-coverage gaps

Confirmed by `npx jest --coverage` on 2026-05-25 (branch
`improve-docs-branch-2026-may-25-01`). Overall src/ coverage:
**79.21% stmts, 68.45% branch, 83.54% funcs.**

- **`lcc.oracle.e2e.spec.js` is structurally broken.** `.gitignore:10` is a
  global `*.bst` rule, which blocks committing the `.bst` goldens the suite
  needs (`git ls-files | grep .bst` → 0 results). All 24 demos in the suite
  skip with "missing golden files" until either the gitignore is narrowed
  (e.g. `!tests/goldens/**/*.bst`) and goldens are committed, or
  `GOLDEN_AUTO_UPDATE=1` regens them on every run.
- **Plus-mode (`src/plus/`) has 0% coverage.** No tests at all for
  `assemblerplus.js`, `interpreterplus.js`, or `lccplus.js`; the only
  exercise is the informal `plusdemos/*.ap` files. Related to the missing
  `linkerplus.js` work — see "Missing features and asymmetries".
- **Dev tools have 0% coverage:** `src/extra/disassembler.js` (~33KB),
  `src/extra/linkerStepsPrinter.js`, `src/utils/picture.js`,
  `src/utils/hexDisplay.js`.
- **`tests/helpers/runOracle.js` is only 13% covered** — the golden-cache
  design keeps the live oracle dormant in CI. There is no automated check
  that the cache still matches the oracle binary's current behavior. A
  nightly or opt-in `test:oracle:live` mode that bypasses the cache would
  close this gap.
- **Asymmetric coverage.** Assembler integration is deep; linker
  integration is non-existent (only unit + oracle-e2e). Most linker error
  paths are exercised only indirectly.
- **`src/core/lcc.js` is the weakest core module** at 66% stmts / 64%
  branch — orchestration and report-generation paths under-tested.
- **Interpreter flag-setting and BR-condition decode** have no direct
  unit-level assertions outside oracle suites — gnarly logic in `setCV`
  (`interpreter.js:1462-1492`) and BR (`interpreter.js:849-881`).
- **Interpreter I/O edge cases** (empty SIN buffer, unicode in `inputBuffer`,
  CRLF on Windows) are not directly tested. — review §3.
- **Brittle string-matching tests.** Many tests exact-match error message
  strings; refactoring assembler error wording will require touching dozens
  of tests. — review §3.

## Oracle parity divergences

- **`mov` immediate range differs between oracle builds.** The currently
  installed cuh63 6.3 oracle (Jan 2025 release) rejects negative `mov`
  immediates and `mov` immediates > 0xFF, but the existing committed
  goldens were generated by an older oracle build that accepted them via
  9-bit signed encoding (`d1f1 = mov r0, -15`). When `GOLDEN_AUTO_UPDATE=1`
  is set, the regen crashes on `demoF.a:12` (`mov r0, -15`); affected
  demos are F, H, L, R, X. LCC.js currently follows the older permissive
  behavior. Needs a decision recorded in `docs/core-behavior-matrix.md`:
  tighten LCC.js to match cuh63 6.3, adjust demos, or document the
  intentional divergence as a `Research` entry.

## Code smells (not bugs, but worth addressing)

These don't break anything but raise the cost of future work.

- **Duplicated CLI scaffolding.** `isTestMode`, `fatalExit`, `cliErrorExit`,
  `cliWrappedErrorExit` are copy-pasted across 6+ files in `src/core/` and
  `src/plus/`. Should live in a shared `src/utils/cliExit.js`. — review #6.
- **Operand-parsing copy-paste.** ~60 lines of near-identical "re-glue
  operands" logic across `assembleLD`, `assembleST`, `assembleLea`,
  `assembleBR`, and the `.word` handler. — review #7.
- **Magic `loadPoint = 0`** repeated four times in `assembler.js` with the
  same TODO comment.
- **`assembler.code` vs `interpreter.code` vs `entry.codeWords`** — three
  different meanings for "code" across the codebase.
- **`Assembler.error()` / `failAssembly()` / `abortAssembly()`** — three-way
  split is documented in comments but not in the names.

## Research / parity open questions

See `TODOS.md` "Oracle Parity and Research" and the `Research` entries in
`docs/core-behavior-matrix.md`. Highest-leverage open items:

- Derive the oracle SEXT transform (replace the 16×32 hand-rolled lookup
  table at `src/core/interpreter.js:23-40`).
- Finish `.org` / `.orig` parity decisions.
- Decide oracle-parity scope for breakpoint (`bp`) stdout and non-interactive
  auto-continue behavior.
