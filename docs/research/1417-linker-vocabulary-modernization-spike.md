# Spike #1417 — Linker-vocabulary modernization (scope + decomposition)

**Agent:** ELDERBERRY · **Date:** 2026-06-16 · **Parent:** #1354 · **Type:** scope spike (no production edits)

## Problem

#879 (DDD gap 2) renamed `src/core/linker.js`'s internal tables from short cryptic names
to descriptive domain vocabulary, but the **glossary manual was never updated** — it still
documents those parts by names that no longer exist in the code.

| Old (glossary still uses) | New (code uses since #879) |
|---|---|
| `mca` (Machine Code Array) | `machineCode` |
| `mcaIndex` | `moduleCurrentAddress` |
| `GTable` | `globalSymbolTable` |
| `ETable` | `externalReferenceTable11` |
| `eTable` | `externalReferenceTable9` |
| `VTable` | `virtualAddressTable` |
| `ATable` | `addressAdjustmentTable` |
| `moduleStart` | *(survives as an ATable-entry property key — not a field)* |

This spike scopes the cleanup. Companion to #1416 (which re-anchored the 17 linker.md
entries whose symbols were stable; the 6 cluster entries above were deferred to this spike).

## Blast radius (classified site inventory)

| Site | Classification | Disposition |
|---|---|---|
| `docs/glossary/linker.md` (67 hits) | defined-term headers, `[term]` cross-links, prose, + the 6 deferred Source refs | **IN** — primary target |
| `docs/glossary/assembler.md` (6 hits) | cross-glossary anchor links `[GTable (linker)](linker.md#gtable)` etc. | **IN** — break when linker.md headers change; must fix atomically |
| `src/extra/linkerStepsPrinter.js` | old names as **real identifiers** (own parallel impl) | **OUT** — see Decision 1 |
| `tests/new/linkerStepsPrinter.unit.spec.js` | tests `linker.VTable`/`linker.mca` against the printer class | **OUT** — moves only if the printer moves |
| `tests/new/linker.unit.spec.js` | old terms only in **test-title strings/comments**; the 102 assertions already use new names | **OPTIONAL** — low-priority title cleanup |
| `docs/research/*` (5 dated analyses) | historical record | **OUT** — left as authored (precedent: RULES.md pre-migration citations) |

## Decisions (locked in grill-with-docs)

### Decision 1 — `linkerStepsPrinter.js` stays excluded
It uses the old names as real identifiers, but #879 **and** #414 **deliberately excluded it
twice** ("has its own parallel implementation with different field names — excluded from this
rename"). It is a standalone *educational* step-printer whose short table names intentionally
mirror the on-disk header marker bytes (`E`/`e`/`V`/`A`) it teaches, and its printed output is
already descriptive (`"E Table (11-bit external references)"`). Reaffirm the exclusion;
renaming it would reverse a recorded decision for weaker (consistency) reasons. If ever
revisited, that needs its own decision superseding #414/#879 + a code+test refactor.

### Decision 2 — Preserve the marker-byte mnemonic in modernized prose (acceptance criterion)
The old names visually encoded the marker bytes (`E`/`e` = 11-bit/9-bit external refs, `V` =
full value, `A` = local adjustment). The descriptive names lose that 1:1. So the modernized
cluster entries MUST state the mapping explicitly — lead-ins like
"**`externalReferenceTable11`** (the `'E'` marker table) …" and a small marker→field table on
the group entry. Nice symmetry with Decision 1: the short marker-aligned names live on in the
educational printer; the canonical linker uses descriptive names; the glossary bridges them.

### Decision 3 — The rename + all inbound link fixes are ATOMIC
Renaming a glossary header changes its anchor, breaking every inbound link at once — both the
intra-doc `[term]` shorthands and the 6 cross-glossary links in assembler.md. So the header
renames and all inbound link updates land in **one commit**, no broken-link window.

### Decision 4 — Single implementation task (not split)
The rename is scriptable (fast, self-checking transform); the only careful part is the 6 entry
definitions + the marker table. Doing it as one pass avoids double-touching those entries and
avoids a transient "renamed-but-marker-insight-lost" state. ~50min, under the 60-min cap, with
the standard overrun fallback (peel the marker-prose into a follow-up if it runs long).

## Decomposition (children of #1354)

1. **WRITER — modernize linker.md linker-table vocabulary (atomic).**
   Rename all 6 cluster terms → descriptive names everywhere in linker.md (headers, `[term]`
   cross-links, prose, **and re-anchor the 6 deferred Source refs** to the new fields), preserve
   the marker-byte mapping (Decision 2), and fix the 6 inbound assembler.md anchor links — all
   in one commit. **Acceptance:** 0 old-term occurrences in linker.md except the deliberate
   marker-mapping references; 0 broken intra-doc or cross-glossary links; 0 line-number Source
   refs in the 6 entries (completes linker.md under ADR 0001). Est ~50m.

2. **WRITER — (optional, LOW) `linker.unit.spec.js` test-title cleanup.**
   Update `test('GTable …')`-style titles to the new names for consistency; assertions already
   use them. Est ~10m. Icebox-able.

**Out of scope (recorded):** `linkerStepsPrinter.js` + its test (Decision 1); dated
`docs/research/*` (historical).

## ROI / sequencing

- Child 1 is the high-value piece: it makes the linker manual *true* again and completes the
  ADR-0001 re-anchoring of all three core-module glossaries (assembler ✅, interpreter ✅,
  linker → ✅ after this). Do it next.
- Child 2 is cosmetic; do it only if a WRITER session has spare budget.
- No code/test risk (docs-only); #1362's future symbol-existence checker will keep it honest.
