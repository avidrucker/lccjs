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

## Entry convention

Each term entry follows this shape:

```markdown
### term-name

1–3 sentence definition that explains the LCC-specific angle. Avoid
restating general assembler/VM/linker knowledge.

**Source:** `src/core/<file>.js:<line-range>` (or function name)
**See also:** [related-term-1], [related-term-2]
```

Cross-links use plain-text `[term-name]` refs within a file. Cross-file
references use the standard `[term](other-file.md#anchor)` markdown form.
