# LCC ISA Quick Reference

Terse lookup for the base LCC ISA. Long-form table with binary layouts:
`lccjs/docs/lcc-isa.md`. Encoder field semantics: `docs/glossary/assembler.md`.
Scope is base LCC only (no LCC+ traps).

## Registers

`r0`–`r4` scratch · `r5 = fp` · `r6 = sp` · `r7 = lr`. Only `r0`–`r4` are free
to clobber; see `calling-convention.md` and SKILL.md pitfall 1.

## Field widths (the encoding-range table)

Every "out of range" assembler error traces to one of these. SKILL.md pitfalls
2 and 3 explain *why* they bite; this is the lookup.

| Field | Bits | Signed range | Used by |
|---|---|---|---|
| `imm9` | 9 | −256 … 255 | `mov`/`mvi` |
| `imm5` | 5 | −16 … 15 | `add` `sub` `cmp` `and` (immediate form) |
| `offset6` | 6 | −32 … 31 | `ldr` `str` `blr` `jmp` `ret` (defaults to 0 if omitted) |
| `pcoffset9` | 9 | −256 … 255 | `ld` `st` `lea` `br*` (word offset from PC) |
| `pcoffset11` | 11 | −1024 … 1023 | `bl`/`call`/`jsr` |
| `ct` | 4 | 0 … 15 | shift count on `srl`/`sra`/`sll`/`rol`/`ror` (defaults to 1) |

Constant too wide for its destination encoding → put it in a `.word` and `ld` it.

## Instructions

| Mnemonic | Form | Effect | Flags |
|---|---|---|---|
| `add dr, sr1, sr2/imm5` | reg or imm5 | `dr = sr1 + op` | nzcv |
| `sub dr, sr1, sr2/imm5` | reg or imm5 | `dr = sr1 − op` | nzcv |
| `cmp sr1, sr2/imm5` | reg or imm5 | `sr1 − op` (flags only) | nzcv |
| `and dr, sr1, sr2/imm5` | reg or imm5 | `dr = sr1 & op` | nz |
| `not dr, sr1` | | `dr = ~sr1` | nz |
| `mul/div/rem dr, sr` | | `dr = dr ∘ sr` | nz |
| `or/xor dr, sr` | | `dr = dr ∘ sr` | nz |
| `mvr dr, sr` (`mov dr, sr`) | | `dr = sr` | — |
| `mvi dr, imm9` (`mov dr, imm9`) | | `dr = imm9` | — |
| `sext dr, sr` | | sign-extend field of `sr` into `dr` | nz |
| `srl/sra/sll/rol/ror sr, ct` | | shift/rotate by `ct` | nzc |
| `ld dr, label` | pcoffset9 | `dr = mem[pc + off]` | — |
| `st sr, label` | pcoffset9 | `mem[pc + off] = sr` | — |
| `ldr dr, baser, off6` | | `dr = mem[baser + off6]` | — |
| `str sr, baser, off6` | | `mem[baser + off6] = sr` | — |
| `lea dr, label` | pcoffset9 | `dr = pc + off` (address-of) | — |
| `push sr` | | `mem[--sp] = sr` | — |
| `pop dr` | | `dr = mem[sp++]` | — |
| `bl/call/jsr label` | pcoffset11 | `lr = pc; pc += off` | — |
| `blr/jsrr baser, off6` | | `lr = pc; pc = baser + off6` | — |
| `jmp baser, off6` | | `pc = baser + off6` | — |
| `ret` | | `pc = lr` | — |
| `br* label` | pcoffset9 | conditional branch (see codes) | — |

`mov` is a pseudo-instruction: `mov dr, imm9` → `mvi`, `mov dr, sr` → `mvr`.

## Branch condition codes

`br*` (and the same suffixes on `jmp`) test N/Z/C/V from the last flag-setting op.
SKILL.md pitfall 4 covers the gotchas; `brp` is the surprising one.

| Suffix | Fires when | Meaning |
|---|---|---|
| `brz` / `bre` | z = 1 | zero / equal |
| `brnz` / `brne` | z = 0 | nonzero / not equal |
| `brn` | n = 1 | negative |
| `brp` | n = z (both 0) | **strictly** positive (not zero) |
| `brlt` | n ≠ v | signed less than |
| `brgt` | n = v and z = 0 | signed greater than |
| `brc` / `brb` | c = 1 | carry / unsigned below |
| `br` / `bral` | always | unconditional |

## Trap vectors

| Trap | Effect | | Trap | Effect |
|---|---|---|---|---|
| `halt` | stop | | `sout sr` | print string at `sr` |
| `nl` | newline | | `din dr` | read decimal |
| `dout sr` | print signed decimal | | `hin dr` | read hex |
| `udout sr` | print unsigned decimal | | `ain dr` | read ASCII char |
| `hout sr` | print hex | | `sin sr` | read string into buffer at `sr` |
| `aout sr` | print ASCII char | | | |

`sr`/`dr` default to `r0` if omitted. Debug traps: `m` (memory), `r` (registers),
`s` (stack), `bp` (breakpoint).

## Directives

`.word`/`.fill` (one initialized word) · `.zero`/`.space`/`.blkw <n>` (n zero words) ·
`.string`/`.stringz`/`.asciz` (null-terminated ASCII) · `.start <label>` (entry point) ·
`.global`/`.globl`, `.extern` (linkage) · `.org <addr>` (set location counter).
