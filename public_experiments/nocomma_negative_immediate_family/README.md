# No-comma negative-immediate family (cuh63 6.3 `lcc`)

Differential probe (#257) that maps the **full blast radius** of the no-comma
negative-operand defect first reported for `ldr`/`str` in
[`docs/cuh63-ldr-str-silent-miscompile-bug-report.md`](../../docs/cuh63-ldr-str-silent-miscompile-bug-report.md).

## Run

```bash
LCC_ORACLE=/abs/path/to/cuh63/lcc node probe.js
# or, from a checkout that has .env with LCC_ORACLE set:
node probe.js
```

Each row assembles a one-instruction program (`<instr>` then `halt`) with BOTH
the comma and the no-comma operand form, then compares the emitted `.e` code
word. `oracle:comma no-comma | lccjs:comma no-comma`. `6f43` = the 2-byte
header-only `.e` an OG assembly leaves on a **failed** assemble.

## Findings

The cuh63 6.3 no-comma operand parser cannot read a **negative** integer. Same
root cause, two manifestations by operand position:

1. **Trailing `offset6` (silent miscompile)** — `ldr`, `str`, `jmp`, `blr`/`jsrr`
   (`baser, offset6` pair): a negative no-comma offset silently encodes as **0**.
   Assembly succeeds, `.e` written, no diagnostic. e.g. `jmp r1 -1` → `c040`
   (offset 0) vs comma `jmp r1, -1` → `c07f` (offset −1). Extends the existing
   `ldr`/`str` report to `jmp`/`blr`/`jsrr`. Single-operand `ret -1` is NOT
   affected (the offset is the sole operand).
2. **`imm5`/`imm9` (hard error)** — `add`, `sub`, `and`, `cmp`, `mvi`: a negative
   no-comma immediate is **rejected** (`Error on line 1`, blank `.e`), even though
   the comma form and no-comma **positive** immediates assemble fine.

LCC.js accepts every form and encodes correctly in all rows.
