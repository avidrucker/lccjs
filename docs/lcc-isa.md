# LCC Instruction Set Summary

Reference for the LCC (Little Computer) instruction set from
*C and C++ Under the Hood* by Anthony J. Dos Reis.

> **LCC+ additions** (new instructions, trap vectors, and the `.lccplus` directive)
> are documented separately in [lccplus-isa.md](./lccplus-isa.md).

---

## Registers

The LCC architecture has 8 general-purpose registers: `r0` through `r7`. The 3-bit register field in every instruction encoding admits exactly these 8 — there are no others.

| Register | Alias | Conventional role |
| --- | --- | --- |
| `r0` | — | general-purpose / return value |
| `r1` | — | general-purpose |
| `r2` | — | general-purpose |
| `r3` | — | general-purpose |
| `r4` | — | general-purpose |
| `r5` | `fp` | frame pointer (reserved by calling convention) |
| `r6` | `sp` | stack pointer (reserved by calling convention) |
| `r7` | `lr` | link register / return address (reserved by calling convention) |

**These 3 aliases (`fp`, `sp`, `lr`) are the only register aliases recognised by the assembler.** Any other name — including names from MIPS, RISC-V, or other ISAs — is not valid. Source: `assembler.js` `isRegister()` accepts only `^(r[0-7]|fp|sp|lr)$`.

---

## Standard Instructions

| Mnemonic | Binary Format | Flags Set | Description |
| --- | --- | --- | --- |
| br-- | 0000  cc pcoffset9 | | if cc, pc = pc + pcoffset9 |
| add | 0001  dr   sr1 000 sr2 | nzcv | dr = sr1 + sr2 |
| add | 0001  dr   sr1 1 imm5 | nzcv | dr = sr1 + imm5 |
| ld | 0010  dr   pcoffset9 | | dr = mem[pc + pcoffset9] |
| st | 0011  sr   pcoffset9 | | mem[pc + pcoffset9] = sr |
| bl, call, or jsr | 0100  1    pcoffset11 | | lr = pc; pc = pc + pcoffset11 |
| blr or jsrr | 0100  000  baser offset6 | | lr = pc; pc = baser + offset6 |
| and | 0101  dr   sr1 000 sr2 | nz | dr = sr1 & sr2 |
| and | 0101  dr   sr1 1 imm5 | nz | dr = sr1 & imm5 |
| ldr | 0110  dr   baser offset6 | | dr = mem[baser + offset6] |
| str | 0111  sr   baser offset6 | | mem[baser + offset6] = sr |
| cmp | 1000  000  sr1 000 sr2 | nzcv | sr1 - sr2 (set flags) |
| cmp | 1000  000  sr1 1  imm5 | nzcv | sr1 - imm5 (set flags) |
| not | 1001  dr   sr1   000000 | nz | dr = ~sr1 |
| push | 1010  sr   0000 00000 | | mem[--sp] = sr |
| pop | 1010  dr   0000 00001 | | dr = mem[sp++] |
| srl | 1010  sr   ct   00010 | nzc | sr >> ct (0 inserted on left, c = last out) |
| sra | 1010  sr   ct   00011 | nzc | sr >> ct (sign bit replicated, c = last out) |
| sll | 1010  sr   ct   00100 | nzc | sr << ct (0 inserted on right, c = last out) |
| rol | 1010  sr   ct   00101 | nzc | sr << ct (rotate: bit 15 → bit 0, c = last out) |
| ror | 1010  sr   ct   00110 | nzc | sr << ct (rotate: bit 0 → bit 15, c = last out) |
| mul | 1010  dr   sr 0 00111 | nz | dr = dr * sr |
| div | 1010  dr   sr 0 01000 | nz | dr = dr / sr |
| rem | 1010  dr   sr 0 01001 | nz | dr = dr % sr |
| or | 1010  dr   sr 0 01010 | nz | dr = dr \| sr (bitwise OR) |
| xor | 1010  dr   sr 0 01011 | nz | dr = dr ^ sr (bitwise exclusive OR) |
| mvr | 1010  dr   sr 0 01100 | | dr = sr |
| sext | 1010  dr   sr 0 01101 | nz | dr sign extended (sr specifies field to extend) |
| sub | 1011  dr   sr1 000 sr2 | nzcv | dr = sr1 - sr2 |
| sub | 1011  dr   sr1 1  imm5 | nzcv | dr = sr1 - imm5 |
| jmp | 1100  000  baser offset6 | | pc = baser + offset6 |
| ret | 1100  000  111   offset6 | | pc = lr + offset6 |
| mvi | 1101  dr   imm9 | | dr = imm9 |
| lea | 1110  dr   pcoffset9 | | dr = pc + pcoffset9 |

**Pseudo-instructions:**

- `mov dr, imm9` → `mvi dr, imm9`
- `mov dr, sr` → `mvr dr, sr`
- `cea dr, imm5` → `add dr, fp, imm5` (compute address of a stack-frame local; `fp` = `r5`. The fp-relative analogue of `lea`.)

**Field sizes:**

- `dr`, `sr`, `sr1`, `sr2`, `baser` — 3-bit register fields
- `cc` — 3-bit condition code field in branch instructions
- `ct` — 4-bit shift count field (defaults to 1 if omitted at assembly level)
- `pcoffset9`, `pcoffset11`, `imm5`, `imm9`, `offset6` — signed number fields of the indicated length
- `offset6` defaults to 0 if omitted in an assembly language instruction

> **`jmp` takes no condition suffix.** Despite Appendix B p.276 ("same mnemonic
> suffixes … on `jmp`"), condition-suffixed `jmp` forms (`jmpz`, `jmpn`, …) do
> **not** exist — `jmp` is encoded with no `cc` field. Both lccjs and the
> reference oracle reject them with `Invalid operation`; conditional control flow
> is `br<cc>`. See [research/jmp-condition-suffix-mnemonics.md](./research/jmp-condition-suffix-mnemonics.md) (#151).

> **This is the complete set of standard instructions.** No additional opcodes exist. If you reach for a mnemonic not listed above (e.g. `nop`, `inc`, `dec`, `abs`, `neg`, `swap`, `ldi`, `sti`), it does not exist and the assembler will reject it with `Invalid operation`.

---

## Trap Instructions

| Mnemonic | Binary Format | Flags Set | Description |
| --- | --- | --- | --- |
| halt | 1111 000 0 00000000 | none | Stop execution, return to OS |
| nl | 1111 000 0 00000001 | none | Output newline |
| dout | 1111 sr 0 00000010 | none | Display signed number in sr in decimal |
| udout | 1111 sr 0 00000011 | none | Display unsigned number in sr in decimal |
| hout | 1111 sr 0 00000100 | none | Display number in sr in hex |
| aout | 1111 sr 0 00000101 | none | Display ASCII character in sr |
| sout | 1111 sr 0 00000110 | none | Display string sr points to |
| din | 1111 dr 0 00000111 | none | Read decimal number from keyboard into dr |
| hin | 1111 dr 0 00001000 | none | Read hex number from keyboard into dr |
| ain | 1111 dr 0 00001001 | none | Read ASCII character from keyboard into dr |
| sin | 1111 sr 0 00001010 | none | Input string into buffer sr points to |

If `sr` or `dr` is omitted in a trap assembly language instruction, it defaults to `r0` (000).
This applies to assembly programming only, not direct machine code.

> **This is the complete set of I/O trap instructions (11 total).** There is no `puts`, `printf`, `print`, `write`, `read`, `getchar`, `putchar`, or any other C-library-style trap. Any mnemonic not in this table does not exist and will assemble with `Invalid operation`. LCC+ adds additional trap vectors in a separate, non-overlapping range — see [lccplus-isa.md](./lccplus-isa.md).

---

## Debugging Instructions

| Mnemonic | Binary Format | Flags Set | Description |
| --- | --- | --- | --- |
| m | 1111 000 0 00001011 | none | Display all memory in use |
| r | 1111 000 0 00001100 | none | Display all registers |
| s | 1111 000 0 00001101 | none | Display stack |
| bp | 1111 000 0 00001110 | none | Software breakpoint (activates debugger) |

> **This is the complete set of debugging instructions (4 total).** Trap vectors `0x0B`–`0x0E` are fully enumerated here. There are no other debug traps in base LCC. The next vector above `bp` (`0x0F`) belongs to LCC+ extensions.

---

## Branch Condition Codes

The same suffixes can also be used on the `jmp` instruction.

| Mnemonic | Code | Branch occurs if |
| --- | --- | --- |
| brz or bre | 000 | z = 1 (zero / equal) |
| brnz or brne | 001 | z = 0 (nonzero / not equal) |
| brn | 010 | n = 1 (negative) |
| brp | 011 | n = z (positive) |
| brlt | 100 | n ≠ v (less than, signed) |
| brgt | 101 | n = v and z = 0 (greater than, signed) |
| brc or brb | 110 | c = 1 (carry / below, i.e. less than unsigned) |
| br or bral | 111 | always |

> **These are the complete set of branch condition suffixes (8 code slots).** Suffixes not in this table (`ge`, `le`, `pos`, `neg`, `ult`, `ugt`, `ule`, `uge`, `brzp`, etc.) do not exist. Note: the header above about `jmp` suffixes is a textbook error — see the `jmp` note in Standard Instructions; condition-suffixed `jmp` forms are rejected by both lccjs and the oracle.

---

## Assembler Directives

| Directive | Description |
| --- | --- |
| `.word <value>` | Create word initialized to `<value>` |
| `.fill <value>` | Same as `.word` |
| `.zero <size>` | Create block of `<size>` words initialized to 0 |
| `.space <size>` | Same as `.zero` |
| `.blkw <size>` | Same as `.zero` |
| `.string <string>` | Create null-terminated ASCII `<string>` |
| `.stringz <string>` | Same as `.string` |
| `.asciz <string>` | Same as `.string` |
| `.start <label>` | Specify `<label>` as entry point (or use label `_start` on the entry point line) |
| `.global <var>` | Specify `<var>` is a global variable |
| `.globl <var>` | Same as `.global` |
| `.extern <var>` | Specify `<var>` is an external variable |
| `.org <address>` | Reset location counter to a higher `<address>` |

> **This is the complete set of assembler directives (13 forms across 8 distinct directives).** There is no `.text`, `.data`, `.bss`, `.section`, `.align`, `.include`, `.macro`, `.equ`, or `.set`. LCC+ adds exactly one directive (`.lccplus`) — see [lccplus-isa.md](./lccplus-isa.md).
