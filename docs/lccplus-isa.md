# LCC+ Instruction Set Addendum

This document summarizes the **additions and differences** between the original
LCC instruction set and the **LCC+** extension (see `src/plus/` and `plusdemos/`).

> **Base LCC instruction set** (standard instructions, traps, directives, branch codes)
> is documented in [lcc-isa.md](./lcc-isa.md).

---

## New Machine Instructions

| Mnemonic | Binary Format | Flags Set | Description |
| --- | --- | --- | --- |
| rand | 1010 dr sr1 0 01110 | none | Generate pseudo-random number in range [`dr`, `sr1`] and store in `dr` |

**Notes on `rand`:**

- Generates a number in an inclusive range between the values in `dr` and `sr1`.
- Uses a pseudo-random number generator based on a seeded Linear Congruential Generator (LCG) + XOR shift.
- Seed the RNG with `srand` (see trap instructions below).

---

## New Trap Instructions

LCC+ extension trap vectors occupy the **high end** of the 8-bit trap space (`0xF7`–`0xFF`) so
core traps can grow upward from `0x0E` without collision.

| Mnemonic | Trap Vector | Flags Set | Description |
| --- | --- | --- | --- |
| clear  | 0x00F9 | none | Clears the terminal screen |
| sleep  | 0x00FA | none | Pauses execution for `r[dr]` milliseconds |
| nbain  | 0x00FB | none | Non-blocking ASCII input (returns ASCII code in `dr`, or 0 if no input available) |
| cursor | 0x00FC | none | Shows or hides cursor based on value in `dr` (0 = hide, else = show) |
| srand  | 0x00FD | none | Seeds RNG using value in `sr` |
| millis | 0x00FE | none | Puts current system time milliseconds (0–999) into `dr` |
| resetc | 0x00FF | none | Resets cursor position to top-left of screen |
| beep   | 0x00F8 | none | Emits ASCII BEL (`\x07`) to stdout |
| ding   | 0x00F7 | none | Emits ASCII BEL (`\x07`) to stdout (alias of `beep`; may diverge in a future release) |

**Note on `bp`:** Trap vector `0x000E` is supported as in LCC, but enhanced in LCC+ to
allow "press any key to resume" functionality.

---

## New Assembler Directives

| Directive | Description |
| --- | --- |
| `.lccplus` | Marks the file as an LCC+ file. Required for LCC+ assembly. Triggers special output header format (`'p'`). |

---

## File Conventions

| Aspect | Value |
| --- | --- |
| Source extension | `.ap` |
| Compiled output extension | `.ep` |
| `.ep` header signature | `'op'` (vs. `'o'` for standard LCC `.e` files) |
