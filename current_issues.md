# Current Issues

A living, scan-friendly index of known issues and gaps in this repo. Updated as
fixes land and new findings surface.

For deeper analysis of code-quality issues with file:line citations, see
[`docs/init_code_review.md`](./docs/init_code_review.md) — the May 2026 review
snapshot. For planned refactor / parity / feature work in flight, see
[`TODOS.md`](./TODOS.md). For higher-level direction, see
[`ROADMAP.md`](./ROADMAP.md).

Last updated: 2026-05-30.

## Known bugs (correctness)

**Bug entries live in [`open_bugs.md`](./open_bugs.md)** — that file
has stable IDs (OB-001..), severity, location, reproduction notes, and
suggested fixes.

**Reconciled 2026-05-28 (#165):** the four former headline items —
OB-001 (`mov` immediate), OB-003 (linker writes broken `.e`),
OB-005 (genStats dec/hex), OB-002 (disassembler `mvi` mask) — plus
OB-007 and OB-012 are all **FIXED on `main`**; see each entry's
Status line in `open_bugs.md` for the resolving commit. The
disassembler bug's *module* still has 0% test coverage (separate
gap, tracked in #166).

The remaining `open_bugs.md` entries (OB-009..OB-026) also have
resolution commits and are being reconciled in **#170**; until that
lands, trust each entry's Status line over the count. One upstream bug
report (**OB-008**, cuh63 6.3's `mov`/`mvi` discrepancy) is drafted
in `docs/cuh63-mov-immediate-bug-report.md` and ready to send to
Prof. Dos Reis.

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
- **Symbolic debugger — Phase 1+2 complete.** `Interpreter.debug()` now
  implements oracle-parity commands: Enter/step-count (step), `g` (continue),
  `q` (quit), `r` (registers), `m [addr [n]]` (memory), `b [addr]`
  (set/cancel breakpoint), `i` (next instruction), `h` (help), `s` (stack).
  Per-step trace (`-t`) and interactive mode (`-i`) are both wired end-to-end.
  Remaining open work: step-count command, final infinite-loop-to-debugger
  semantics for CLI mode. See `TODOS.md` "Core Behavior and Features".
- **Incomplete instruction set.** Some standard and extended instructions are
  not yet implemented; see `TODOS.md` and `docs/core-behavior-matrix.md`
  Research entries for specifics.
- **No coverage of dev tools.** `src/extra/disassembler.js` (~33KB) and
  `linkerStepsPrinter.js` have no tests. — review §3.

## Stale or thin documentation

Most of the stale-reference items flagged in the May 2026 review were
addressed on `improve-docs-branch-2026-may-25-01`. Remaining items:

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

- **`mov` immediate-range divergence between two oracle builds, and a
  related LCC.js validation bug.** Investigated 2026-05-25 in
  `scratch/mov_parity/`. The ISA spec (`LCCInstructionSetSummary.pdf`
  shipped with cuh63) states `mov dr, imm9` is a pseudo-instruction for
  `mvi dr, imm9`, and `imm9` is "a signed number field of the indicated
  length" — i.e. -256..+255. Three-way comparison:

  | | OG cuh63 6.3 | LCCjs | Spec |
  |---|---|---|---|
  | `mvi` range | -256..+255 | -256..+255 | -256..+255 ✓ |
  | `mov` range | **0..255 only** | −256..+255 ✓ *(fixed: OB-001/#31)* | -256..+255 |

  Findings:
  1. **cuh63 6.3 has a regression in its `mov` parser** — it accepts a
     narrower range for `mov` than for `mvi`, contradicting its own
     pseudo-instruction definition. The older oracle build that produced
     the committed goldens (`d1f1 = mov r0, -15`) was spec-compliant.
  2. **The committed goldens are spec-correct.** Do **not** regen them
     against cuh63 6.3 — that would adopt cuh63's regression. This is
     why GOLDEN_AUTO_UPDATE=1 crashes on demoF/H/L/R/X: those demos use
     negative `mov` immediates that are spec-legal but cuh63 6.3 rejects.
  3. **LCC.js had its own `mov` validation bug — now FIXED (OB-001/#31,
     `d39fe90`).** It used to treat `mov` differently from `mvi` for range
     checking: `mvi r0, 256` was correctly rejected, but `mov r0, 256` was
     accepted and silently encoded as `mov r0, -256` (9-bit wraparound), and
     `mov r0, 512` became identical to `mov r0, 0` with no warning. `mov` now
     routes through the same `-256..+255` range-check `mvi` uses.

  Action items:
  - ~~Fix LCC.js `mov` to share the `-256..+255` validation `mvi` already
    enforces.~~ **DONE** — OB-001/#31 (`d39fe90`); `mov` now routes through
    the shared range-check.
  - Document the cuh63 6.3 `mov` regression in
    `docs/core-behavior-matrix.md` as a deliberate divergence (LCC.js
    follows the spec; cuh63 6.3 is stricter on `mov` than spec).
  - Consider reporting the cuh63 `mov` regression to Prof. Dos Reis.
    A draft, sendable report is in
    [`docs/cuh63-mov-immediate-bug-report.md`](./docs/cuh63-mov-immediate-bug-report.md).

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
