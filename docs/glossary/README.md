# LCC.js Glossary

Per-module glossaries of LCC-specific vocabulary. Aimed at newcomers who already
understand general assembler / VM / linker concepts and need the
**LCC-specific** angle (load point, listing load point, adjustment entries,
externs vs globals, .e/.bst/.lst formats, ISA opcode nibble layout, loop
detection, etc.).

## Files

| File | Source it documents | Status |
|---|---|---|
| [`assembler.md`](./assembler.md) | `src/core/assembler.js` | ✅ complete — 147 entries (#108, #111) |
| [`interpreter.md`](./interpreter.md) | `src/core/interpreter.js` | ✅ complete — 39 entries (#109, #112) |
| [`linker.md`](./linker.md) | `src/core/linker.js` | ✅ complete — 26 entries (#110, #113) |

Parent tracker: #107. Originally requested in #9.

## Entry convention

Each term entry should follow this shape:

```markdown
### term-name

1–3 sentence definition that explains the LCC-specific angle. Avoid
restating general assembler/VM/linker knowledge.

**Source:** `src/core/<file>.js:<line-range>` (or function name)
**See also:** [related-term-1], [related-term-2]
```

Cross-links use plain-text `[term-name]` refs within a file. Cross-file
references use the standard `[term](other-file.md#anchor)` markdown form.
