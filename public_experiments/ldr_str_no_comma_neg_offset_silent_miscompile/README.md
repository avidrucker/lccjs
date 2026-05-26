# ldr/str — no-comma syntax, negative offset6: silent miscompile in cuh63 6.3

An investigation into a silent miscompile in the cuh63 6.3 `lcc` binary:
`ldr` and `str` with space-separated (no-comma) operands and a negative
`offset6` silently encode the offset as 0 instead of the requested value.
No error is raised; the program assembles without complaint and runs — just
with the wrong memory address.

This audit was produced while preparing the upstream bug report at
[`../../docs/cuh63-ldr-str-silent-miscompile-bug-report.md`](../../docs/cuh63-ldr-str-silent-miscompile-bug-report.md).

The same inputs are run through the LCC.js reimplementation to confirm that
LCC.js handles both comma and no-comma negative-offset syntax correctly, and
to establish that the bug is isolated to the cuh63 6.3 parser path.

## How to run

```bash
# from this directory
./probe.sh
```

Reads `LCC_ORACLE` from `../../.env` or the environment. See the repo's
main README for how to install cuh63 and set `LCC_ORACLE`.

## What the probe covers

The probe runs assembly snippets through both cuh63 6.3 (`OG=`) and LCC.js
(`JS=`), pairing them so the discrepancy is visible on adjacent lines.

1. **`ldr` comma syntax — control group.** The comma-separated form
   (`ldr r1, fp, -1`) is the known-good path; both implementations encode
   negative offsets correctly here. These runs exist to confirm the parser
   is not globally broken.

2. **`ldr` no-comma syntax — the bug.** The space-separated form
   (`ldr r1 fp -1`) is the broken path in cuh63 6.3. Every negative
   offset tested (-1, -2, -32) encodes as `6340` (offset=0). Positive
   offsets (0, +1, +31) encode correctly.

3. **`str` — same bug, same pattern.** `str r1 fp -1` encodes as `7340`
   (offset=0) in cuh63 6.3; LCC.js produces the correct `737f`.

4. **`ld`/`st`/`lea` scope check.** These instructions use a `pcoffset9`
   operand, a different parser path. Both comma and no-comma forms work
   correctly in both implementations, confirming the bug is isolated to
   the `ldr`/`str` offset6 parser path.

5. **Label arithmetic.** `ld r0, x+1` and `ld r0, x-1` both assemble
   correctly in both implementations. This is a separate feature
   (label-address arithmetic, not the same as register-relative offsets)
   and is unaffected by the `ldr`/`str` bug.

## Summary of findings

| Syntax form | Input example | cuh63 6.3 encoding | LCC.js encoding | Correct? |
|---|---|---|---|---|
| comma, zero | `ldr r1, fp, 0` | `6340` | `6340` | ✓ both |
| comma, positive | `ldr r1, fp, 1` | `6341` | `6341` | ✓ both |
| comma, negative | `ldr r1, fp, -1` | `637f` | `637f` | ✓ both |
| comma, lower bound | `ldr r1, fp, -32` | `6360` | `6360` | ✓ both |
| no-comma, zero | `ldr r1 fp 0` | `6340` | `6340` | ✓ both |
| no-comma, positive | `ldr r1 fp 1` | `6341` | `6341` | ✓ both |
| **no-comma, -1** | **`ldr r1 fp -1`** | **`6340` ✗** | **`637f` ✓** | **cuh63 WRONG** |
| **no-comma, -2** | **`ldr r1 fp -2`** | **`6340` ✗** | **`637e` ✓** | **cuh63 WRONG** |
| **no-comma, -32** | **`ldr r1 fp -32`** | **`6340` ✗** | **`6360` ✓** | **cuh63 WRONG** |
| `str`, comma, -1 | `str r1, fp, -1` | `737f` | `737f` | ✓ both |
| **`str`, no-comma, -1** | **`str r1 fp -1`** | **`7340` ✗** | **`737f` ✓** | **cuh63 WRONG** |
| `ld`/`st`/`lea`, comma | `ld r0, x` | `2001` | `2001` | ✓ both |
| `ld`/`st`/`lea`, no-comma | `ld r0 x` | `2001` | `2001` | ✓ both |
| label arithmetic | `ld r0, x+1` | `2002` | `2002` | ✓ both |

**Result:** The bug is in cuh63 6.3's `ldr`/`str` no-comma parser path only.
LCC.js is correct across the board. `ld`/`st`/`lea` are unaffected.

The silent-miscompile severity is higher than the `mov`-negative regression
(OB-008): that bug raises an error (the program fails to assemble); this
one produces a working `.e` file that silently executes with the wrong
memory address, which is harder to diagnose.

## Files

| File | Purpose |
|---|---|
| `probe.sh` | Side-by-side OG vs LCC.js sweep — comma and no-comma syntax, positive and negative offsets, boundary values, scope check against ld/st/lea. |
| `README.md` | This file. |
