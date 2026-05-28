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

The following trap instructions use trap vectors from `0x000F` and up.

| Mnemonic | Trap Vector | Flags Set | Description |
| --- | --- | --- | --- |
| clear | 0x000F | none | Clears the terminal screen |
| sleep | 0x0010 | none | Pauses execution for `r[dr]` milliseconds |
| nbain | 0x0011 | none | Non-blocking ASCII input (returns ASCII code in `dr`, or 0 if no input available) |
| cursor | 0x0012 | none | Shows or hides cursor based on value in `dr` (0 = hide, else = show) |
| srand | 0x0013 | none | Seeds RNG using value in `sr` |
| millis | 0x0014 | none | Puts current system time milliseconds (0–999) into `dr` |
| resetc | 0x0015 | none | Resets cursor position to top-left of screen |

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
