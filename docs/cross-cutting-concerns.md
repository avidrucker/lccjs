# Cross-Cutting Concerns

A **cross-cutting concern** is an aspect that spans the toolchain — assembler,
interpreter, linker, and the LCC+ subclasses — rather than living in a single
module. This doc inventories them in one place so a newcomer (human or agent)
can answer "what are the shared concerns, where does each live, and what should
I not break?" without reverse-engineering it from the code.

Two forms appear here:

1. **Shared code** — the modules in [`src/utils/`](../src/utils/utils.md) that
   core modules import instead of duplicating.
2. **Shared mechanisms & boundaries** — conventions woven through the *core*
   code that belong to no single file (the pure-seam boundary, the core↔plus
   subclassing seam, shared trap encoding, oracle parity).

> `src/utils/utils.md` documents the `src/utils` modules **file-by-file**. This
> doc is the **concern-by-concern** companion — read that for "what does
> `reportArtifacts.js` do?", read this for "how does report generation work
> across the toolchain?".

---

## 1. The pure-seam vs CLI-wrapper boundary

The single most important cross-cutting rule (see CLAUDE.md → *Architecture*):

- **Pure in-memory APIs** (`assembleSource`, `executeBuffer`,
  `parseObjectModuleBuffer`, …) throw **typed errors** and return data — no
  `console.*`, no `process.exit`, no file I/O. These are the testable seams.
- **CLI/wrapper paths** own console output, exit codes, and file reads/writes.

The two sides are staffed by two utils:

| Side | Module | Role |
|------|--------|------|
| Pure | [`errors.js`](../src/utils/errors.js) | Typed error classes (`LccError`, `AssemblerError`, `InterpreterRuntimeError`, `InvalidExecutableFormatError`, `LinkerError`) — a stable failure contract the pure APIs throw and callers catch. |
| Wrapper | [`cliExit.js`](../src/utils/cliExit.js) | Shared exit/error scaffolding (`isTestMode`, `fatalExit`, `cliErrorExit`, `cliWrappedErrorExit`) so the exit contract is edited in one place, not eight. Under Jest, `isTestMode` flips `fatalExit` from `process.exit` to a thrown Error so the harness survives. |

**Maturity varies** (a known in-progress refactor): `assembler.js` and
`interpreter.js` have real pure seams; `linker.js` is mid-transition
(wrapper-heavy); `lcc.js` stays orchestration-only by design. Tracked under the
architecture epic **#1540**.

**Gotcha:** adding output or `process.exit` to a pure API silently breaks the
boundary and the tests that rely on catching typed errors. Route it through
`cliExit` from the wrapper instead.

## 2. The error & diagnostics surface

A pipeline, not a single module: a pure API throws a typed error tagged with a
stable `explainKey` (and optionally an id); the wrapper renders it, optionally
augmented with an `--explain` teaching block, a citable error id, and a "did you
mean?" suggestion.

| Module | Concern | Notes |
|--------|---------|-------|
| [`errors.js`](../src/utils/errors.js) | typed error classes | the throw contract (see §1) |
| [`explanations.js`](../src/utils/explanations.js) | `--explain` catalog | student-friendly explanations keyed by a stable `explainKey` set at the throw site (**not** by matching rendered message text). Pure data + lookup. (#1096–#1100) |
| [`errorIds.js`](../src/utils/errorIds.js) | stable citable ids | append-only registries `ASM_ERROR_IDS` / `INT_ERROR_IDS` / `LNK_ERROR_IDS` (`asm-NNN`/`int-`/`lnk-`), keyed by **normalized message**. A published API surfaced under `--show-err-id`; a coverage-guard test (`tests/new/error-ids.spec.js`) asserts every assembler error literal resolves here. **Never renumber or reuse a retired id.** (#1553, #1480) |
| [`suggest.js`](../src/utils/suggest.js) | "did you mean?" | `levenshtein` + `suggestClosest` — the nearest valid token within an edit-distance bound, appended to messages like "Bad label". |
| [`flagDiagnostics.js`](../src/utils/flagDiagnostics.js) | parity-deviation warnings | flags LCCjs knowingly no-ops relative to the oracle (e.g. `-f`); user-facing rationale lives in [`parity_deviations.md`](./parity_deviations.md). (#1371) |

**Gotchas:** (a) `explainKey` is the join key, not the message text (messages
interpolate values + may carry a "did you mean?" suffix); (b) error ids are an
append-only published API — the coverage test fails if a literal has no id.

## 3. Report & artifact generation (`.lst` / `.bst`)

"One generator, three callers" (#608): assembler-, interpreter-, and
lcc-driven paths all produce the same listing/stats output through shared code.

| Module | Concern |
|--------|---------|
| [`reportArtifacts.js`](../src/utils/reportArtifacts.js) | in-memory `.lst`/`.bst` **content** construction, with an injectable `now` for deterministic output — lets pure APIs build reports without touching the filesystem. |
| [`genStats.js`](../src/utils/genStats.js) | the lower-level listing/statistics **formatting machinery** used by `reportArtifacts.js`. |
| [`fileArtifacts.js`](../src/utils/fileArtifacts.js) | sibling-output **filename construction** + shared text/binary reads/writes/report-file writes (wrapper-side). |
| [`name.js`](../src/utils/name.js) | `name.nnn` cwd cache resolution/creation for report **headers** — mirrors oracle LCC's cwd-based behavior. |

**Gotcha:** report *content* (`reportArtifacts`/`genStats`) is pure and
filesystem-free; only `fileArtifacts` writes. Keep that split — it's what lets
the pure APIs emit reports in-memory.

## 4. Shared ISA / assembler logic

Encoding and validation rules that more than one module must agree on:

| Concern | Location | Notes |
|---------|----------|-------|
| ISA numeric constants | [`src/core/constants.js`](../src/core/constants.js) | single source for opcodes/trap vectors/flags, imported by core **and** plus (#794). |
| Shared trap encoding | `assembleTrap` in [`src/core/assembler.js`](../src/core/assembler.js) | the **default-r0 / operand-omittable** behavior for `[sr]`-shape traps cross-cuts base + LCC+; see **#1567** (the concern that motivated this doc). |
| Label validation | [`labelUtils.js`](../src/utils/labelUtils.js) | `isValidLabelDefinition` **mirrors** `assembler.js`'s `isValidLabelDef`/`isValidLabel` — a deliberately duplicated rule (see the duplicated-validation-regex caution, #870). |
| Source formatting | [`formatter.js`](../src/utils/formatter.js) | `formatLccSource` — normalizes labels to col 0, indents bodies, trims trailing space; used by the playground formatter. |

**Gotcha:** `labelUtils` duplicates the assembler's label grammar. If the
assembler's rule changes, this copy must change in lockstep (cross-test with
shared edge cases, per #870).

## 5. The core ↔ plus subclassing seam

LCC+ (`src/plus/*plus.js`) **subclasses** the core assembler/interpreter (see
CLAUDE.md → *Two toolchains*). This is a cross-cutting concern because a core
change can be **shadowed or broken** by a plus override.

- When touching a core method, check for a plus override:
  `handleDirective`, `writeOutputFile`, the InterpreterPlus trap handlers.
- Plus mnemonics are registered directly into `_instructionTable` in the
  constructor (`AssemblerPlus.handleInstruction` no longer exists as an override,
  #417) — so adding a *core* mnemonic to the table cannot be shadowed, but
  overriding a *method* still can.
- The extracted `SoundEngine` (#1503) is a shared subsystem both toolchains
  import rather than a plus-only concern.

## 6. Oracle-parity & golden-cache discipline

Differential testing against the original LCC binary ("the oracle") is a
project-wide concern (see CLAUDE.md → *Oracle-parity testing*):

- `*.oracle.e2e.spec.js` compare JS output to **committed golden caches**; the
  binary runs only under `GOLDEN_AUTO_UPDATE=1`.
- Intentional divergences live in [`parity_deviations.md`](./parity_deviations.md);
  `flagDiagnostics.js` (§2) is the runtime face of that doc.

**Gotcha:** consult `parity_deviations.md` before "fixing" a parity mismatch —
it may be deliberate.

## Standalone inspection helpers (in `src/utils`, but *not* cross-cutting)

For completeness — these live in `src/utils` but are developer-facing tools, not
aspects woven through the toolchain:

- [`hexDisplay.js`](../src/utils/hexDisplay.js) — hex dump of a `.e`/`.o` file.
- [`picture.js`](../src/utils/picture.js) — structure-oriented view of a `.e`/`.o` file.

---

## `src/utils` module → concern map

Every module in `src/utils/`, with its governing concern:

| Module | Concern (section) |
|--------|-------------------|
| `errors.js` | Pure-seam boundary (§1) · Diagnostics (§2) |
| `cliExit.js` | Pure-seam boundary (§1) · Diagnostics (§2) |
| `explanations.js` | Diagnostics surface (§2) |
| `errorIds.js` | Diagnostics surface (§2) |
| `suggest.js` | Diagnostics surface (§2) |
| `flagDiagnostics.js` | Diagnostics (§2) · Oracle parity (§6) |
| `reportArtifacts.js` | Report generation (§3) |
| `genStats.js` | Report generation (§3) |
| `fileArtifacts.js` | Report generation (§3) |
| `name.js` | Report generation (§3) |
| `labelUtils.js` | Shared ISA/assembler logic (§4) |
| `formatter.js` | Shared ISA/assembler logic (§4) |
| `hexDisplay.js` | Standalone inspection helper |
| `picture.js` | Standalone inspection helper |

## Known documentation gaps & follow-ups

- `src/utils/utils.md` historically documented only 7 of the 14 modules; the
  remaining 7 (`cliExit`, `errorIds`, `explanations`, `flagDiagnostics`,
  `formatter`, `labelUtils`, `suggest`) are now covered here and cross-linked
  from `utils.md`.
- Architectural observations surfaced during this inventory (e.g. the
  `labelUtils` ↔ `assembler.js` duplication, the `clear`/`resetc`
  accept-but-ignore operand, the `dr`/`sr` doc-vs-code field-naming nit) are
  **not fixed here** — they are candidate child tickets, filed separately so this
  stays a docs-only inventory.

## Related docs

- [`src/utils/utils.md`](../src/utils/utils.md) — per-module reference
- [`src/core/core.md`](../src/core/core.md) — core module overview
- [`docs/parity_deviations.md`](./parity_deviations.md) — intentional oracle divergences
- [`docs/core-behavior-matrix.md`](./core-behavior-matrix.md) — pure-seam vs wrapper behavior
- CLAUDE.md — *Architecture: pure seams vs CLI wrappers*, *Two toolchains*, *Oracle-parity testing*
