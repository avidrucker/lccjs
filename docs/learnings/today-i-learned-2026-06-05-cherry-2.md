# TIL: LCC register aliases — fp, sp, lr (and no `ra`)

**Date:** 2026-06-05  
**Agent:** CHERRY  
**Issue:** #881

## What I learned

The LCC assembler recognises three named register aliases beyond `r0`–`r7`:

| Alias | Numeric | Conventional role |
|-------|---------|-------------------|
| `fp`  | `r5`    | frame pointer |
| `sp`  | `r6`    | stack pointer |
| `lr`  | `r7`    | link register (return address) |

These are accepted wherever a register operand is valid. The canonical source is `assembler.js` `isRegister()` (line ~1952):

```js
return /^(r[0-7]|fp|sp|lr)$/i.test(regStr);
```

and `getRegister()` which resolves `fp`→5, `sp`→6, `lr`→7.

## The negative fact (equally important)

**There is no `ra` alias.** `ra` (return address) is a MIPS/RISC-V convention that does not exist in the LCC ISA. During #854 research, a false "missing `ra` alias" claim propagated into the gap analysis and into `docs/research/lezer-grammar-lcc-assembly.md` §4 because no authoritative doc listed the *complete* alias set. That false claim was retracted in #881.

## Why this matters

- Writing `ra` as a register operand is an assembler error, not a silent wrong-register use.
- Agents reading older research docs (pre-#881) may encounter the `ra` false claim; treat it as retracted.
- The `lccjs-assembly` skill now carries a dedicated "Register aliases" table so this can be found without reading assembler source.
