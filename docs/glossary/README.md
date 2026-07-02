# LCC.js Glossary

Per-module glossaries of LCC-specific vocabulary. Aimed at newcomers who already
understand general assembler / VM / linker concepts and need the
**LCC-specific** angle (load point, listing load point, adjustment entries,
externs vs globals, .e/.bst/.lst formats, ISA opcode nibble layout, loop
detection, etc.).

## Files

| File | Source | What it covers |
|---|---|---|
| [`assembler.md`](./assembler.md) | `src/core/assembler.js` | Two-pass assembler: state & lifecycle, the `.e` / `.o` object-file format, per-instruction encoders, and operand parsing (grouped into sections a–e) |
| [`interpreter.md`](./interpreter.md) | `src/core/interpreter.js` | The VM: memory/register model, executable loading, the fetch–decode–execute loop, trap implementations, and the interactive debugger |
| [`linker.md`](./linker.md) | `src/core/linker.js` | Multi-module linking: per-link state tables, the link pipeline, external / local reference fix-ups, and executable serialization |
| [`stats-analysis.md`](./stats-analysis.md) | `stats/*.ipynb` | Non-parametric statistics used in the velocity notebooks: c_ratio, sign test, bootstrap CI, Spearman ρ, Kruskal-Wallis, Mann-Whitney U, and the underpowered qualifier |

## Acronym glossaries

Quick **expansion** tables for the acronyms/abbreviations used across the project,
split by vocabulary. These are lookup tables (`Acronym | Expansion | project meaning`),
not the `###`-entry concept format used by the per-module glossaries above. (#1580)

| File | Covers |
|---|---|
| [`domain.md`](./domain.md) | LCC / assembly acronyms — LCC, ISA, OG, PC, sr/dr, … |
| [`process.md`](./process.md) | workflow / PM acronyms & role tags — **AC** (acceptance criteria, ≠ **ARC** = architect), ICE, SSOT, ADR, TIL, PDD/BDD (→ yegor-pm for the method) |
| [`tech.md`](./tech.md) | tooling / engineering acronyms — **CM6** (CodeMirror 6), **TOCTOU** (time-of-check to time-of-use), CLI, CI, TTY, DDD, … |

> Methodology *concepts* (PDD, BDD, spike, epic, velocity, architect mode, …) remain
> defined in the canonical **yegor-pm `GLOSSARY.md`** (see below); `process.md` only
> expands their acronyms and links there — it does not vendor the definitions.

## Entry convention

Each term entry follows this shape:

```markdown
### term-name

1–3 sentence definition that explains the LCC-specific angle. Avoid
restating general assembler/VM/linker knowledge.

**Source:** `<file>.js` — `symbolName()`, `OTHER_SYMBOL`
**See also:** [related-term-1], [related-term-2]
```

`Source:` cites **stable symbols only — never line numbers** (functions, methods,
`const`s, or a distinctive grep landmark string), so a reference survives refactors and
stays greppable. When the code is not inside a single named symbol, cite the nearest
enclosing symbol plus a landmark, e.g. ``**Source:** `interpreter.js` — `step()`, grep
`"unknown opcode"` ``. The rationale and the rejected line-number alternatives are
recorded in [ADR&nbsp;0001](../adr/0001-symbol-anchored-glossary-source-refs.md). (The
`stats-analysis.md` glossary cites notebooks, not source, and is unaffected.)

Cross-links use plain-text `[term-name]` refs within a file. Cross-file
references use the standard `[term](other-file.md#anchor)` markdown form.

### `Source:` shapes

Not every entry maps to one named function. These are the documented shapes a `Source:`
line can take (rendered form shown; in the file each symbol is backticked). They were
settled across the #1354 re-anchoring chunks and refine ADR 0001:

| Shape | Example `Source:` line |
|---|---|
| Named method / function | `assembler.js` — `getRegister()`, `_instructionTable` |
| Field / `const` | `interpreter.js` — `mem` (field), `MAX_MEMORY` (const) |
| Multi-symbol group | `interpreter.js` — `storeMem()`, `loadMem()` (memory access) — enumerate the real members |
| Field cluster | `interpreter.js` — fields: `n`, `z`, `c`, `v` (flags) — enumerate every field inline with a `fields:` prefix |
| Block within a method | `assembler.js` — `evaluateOperand()`, grep `operand[0] === '*'` |
| Cross-cutting param / concept | `assembler.js` — `evaluateOperand()`, `handleExternalReference()`; grep `usageType` for call sites |
| Top-level (no enclosing symbol) | `assembler.js` — module footer; grep `module.exports = Assembler` |
| Cross-file entry | cite each file's symbols, e.g. `interpreter.js` — `step()`; `utils/errors.js` — `LccError` |

A symbol that is genuinely hard to anchor (no enclosing name, no distinctive landmark) is a
signal the *code* wants decomposing — cite the file plus nearest landmark and file that as
the code's ticket, not the glossary's (ADR 0001).

### Renamed symbols — anchor stability

When a cited symbol has been **renamed in the code** (e.g. the linker's #879 rename
`mca` → `machineCode`), the entry's **header carries the current symbol** and a
**transitional `(formerly …)` alias goes on its own italic line directly under the header**:

```markdown
### `machineCode`
*(formerly `mca` — "machine code array")*
```

This keeps the heading anchor (`#machinecode`) tracking the live code while preserving the
old name so readers arriving from older docs, source comments, or git history can still find
the entry. (#1418)

### Marker-byte preservation

Where a symbol's identity is tied to an on-disk **marker byte** in the `.e` / `.o` format,
state that mapping explicitly in the entry so the mnemonic survives a rename. linker.md's
external-reference tables, for instance, spell out `'E'` → `externalReferenceTable11`,
`'e'` → `externalReferenceTable9`, `'V'` → `virtualAddressTable`, `'A'` →
`addressAdjustmentTable`. The old short names' capitalisation used to encode these bytes, so
the #879 rename would have dropped the cue without the explicit note. (#1418)

### Enforcement — `npm run glossary:check`

`npm run glossary:check` (`scripts/check-glossary-symbols.js`, #1362) is the rot-detector for
ADR 0001: for every `**Source:**` line in the three core-module glossaries it verifies that
each cited backticked symbol and `grep` landmark still grep-matches the file(s) it names,
exiting non-zero on any unresolved token. It is **lenient by design** — wildcards / ranges
(`TRAP_*`), char-literals, and free-form expressions are skipped so it stays green-by-default
and trustworthy. `stats-analysis.md` (cites notebooks) and this `README.md` (its one Source
line is a `<file>.js` template) are intentionally out of scope.

---

## Process & methodology terms (yegor-pm)

This glossary defines **LCC domain** vocabulary. For **workflow / methodology** terms —
*courier mode, architect mode, spike, epic, microtask, puzzle, velocity, PDD, BDD, "if it
isn't in the tracker it didn't happen"* — see the canonical **yegor-pm `GLOSSARY.md`**,
which lives in the standalone `yegor-pm-skills` repo (symlinked into `~/.claude/skills/yegor-*`).
It is the single source of truth for those terms; this repo points to it rather than
vendoring a copy that would drift. Those are the terms used across `docs/claude_workflow.md`,
`RULES.md` (the yegor-derived rules `amber-mantis`, `saffron-marten`, `jade-pangolin` cite them), the `yegor-*` skills, and ticket discussions.
