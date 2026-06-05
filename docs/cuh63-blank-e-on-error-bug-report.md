# Partial artifact left on disk after any failed assembly in cuh63 6.3

**Author:** Avi Drucker (avidrucker@gmail.com)
**Date filed:** 2026-06-05
**Distribution under inspection:** `cuh63.zip` (file mtimes 2025-01-09)
**Reported binary:** `lcc` (Linux build from `lnx/` subfolder of the cuh package)
**Reported version string:** `LCC Assemble/Link/Interpret/Debug Ver 6.3` (as printed in `.lst` headers)

This report describes a footgun in the cuh63 6.3 `lcc` binary: when assembly
fails for any reason, partial output artifacts (`.e`, `.lst`, `.bst`) are still
written to disk before the process exits 1. The leftover `.e` is a valid-looking
executable file that, if subsequently run, triggers an "infinite loop" condition
consuming ~100 MB of output.

The report is offered respectfully; the goal is to flag what appears to be an
unintended output-cleanup omission rather than a logic error in the assembler
itself.

---

## Summary

When `lcc` detects an assembly error — regardless of the error type (undefined
label, out-of-range immediate, bad register, invalid directive, missing operand,
duplicate label) — it writes partial artifact files before printing the diagnostic
and exiting 1:

| Artifact | Condition | Written on error? |
|---|---|---|
| `.e` (executable) | pass-2 error | **yes** — 2 bytes: file magic `6f 43` only |
| `.e` (executable) | pass-1 error (dup label) | **yes** — 1 byte: `6f` only |
| `.lst` (listing) | any error | **yes** — header block + error message |
| `.bst` (binary stats) | any error | **yes** — header block + error message |
| `.o` (object module) | any error | **no** |

This was previously documented specifically for undefined-label `br` (OG BUG #10
in `parity_deviations.md`). Systematic probing across nine distinct error types
confirms the behavior is **universal**: it is not specific to undefined labels, but
applies to every assembly error path.

The orphan `.e` is hazardous because it is indistinguishable from a valid build
artifact by filename alone. A build sequence that does not gate on exit code will
run it and encounter the infinite-loop condition described below.

---

## Environment / version

- OS: Linux 6.17.0-29-generic (Ubuntu/Mint family), x86-64.
- Binary: `lnx/lcc` from `cuh63.zip` (overlaid onto the main folder per
  the package's `0READFIRST.txt` instructions).
- `file lcc`:
  `ELF 64-bit LSB pie executable, x86-64 ... dynamically linked,
   for GNU/Linux 3.2.0, not stripped`
- Version banner (from any `.lst` it produces):
  `LCC Assemble/Link/Interpret/Debug Ver 6.3  <timestamp>`

---

## Minimal reproduction

**Step 1 — assemble a program with an undefined label:**

```asm
; undef.a
    br missing_label
    halt
```

Seed `name.nnn` so the assembler does not prompt interactively:

```bash
$ echo "TestUser, Auto" > name.nnn
$ lcc undef.a
Starting assembly pass 1
Starting assembly pass 2
Error on line 1 of undef.a:
    br missing_label
Undefined label
lst file = undef.lst
bst file = undef.bst
$ echo $?
1
```

Assembly correctly fails with exit 1 and the `Undefined label` diagnostic.

**Step 2 — observe the orphan `.e` on disk:**

```bash
$ ls -la undef.e
-rw-r--r-- 1 user user 2 ... undef.e
$ xxd undef.e
00000000: 6f43                                     oC
```

The file exists despite the failed assemble, containing only the 2-byte file
magic (`6f 43`). A valid, minimal program (`halt` only) would be 4 bytes:
`6f 43 00 f0`.

**Step 3 — run the orphan:**

```bash
$ lcc undef.e
Starting interpretation of undef.e
lst file = undef.lst
bst file = undef.bst
====================================================== Output
Possible infinite loop
a120: 0000     ; brz
brz>>>a121: 0000     ; brz
brz>>>a122: 0000     ; brz
[output continues for ~100 MB before the detector halts execution]
```

The zero-filled memory image loads at the default load point (`0xa120`). Every
zero word decodes as `brz` (branch-if-zero) with offset 0. The branch is taken
and the PC advances, walking forward through zero memory indefinitely. The
built-in infinite-loop detector fires eventually, but only after producing
roughly 100 MB of trace output.

---

## Error types that exhibit the same behavior

The following errors were each confirmed to leave a 2-byte `6f 43` orphan `.e`
along with `.lst` and `.bst` files:

| Error type | Assembly source | Error message |
|---|---|---|
| Undefined label | `br missing_label` | `Undefined label` |
| Out-of-range `imm5` | `add r0, r0, 100` | `imm5 out of range` |
| No-comma negative operand | `add r0 r0 -1` | `Missing operand` |
| Invalid directive | `.baddir` | `Invalid operation` |
| Bad register (`r9`) | `mov r9, 5` | `Bad register` |
| Missing operand (bare `add`) | `add` | `Missing operand` |
| Numeric label operand to `br` | `br 999` | `Undefined label` |

The **duplicate label** case differs: the error fires during pass 1, before the
second magic byte is written, leaving a 1-byte (`6f`) orphan `.e` instead:

| Error type | Assembly source | Error message | `.e` size |
|---|---|---|---|
| Duplicate label | `foo:\nfoo:\nhalt` | `Duplicate label` | **1 byte** |

In all cases, `.lst` and `.bst` are also written before exit.

---

## Build-step hazard

The practical risk arises in a build sequence that does not gate on exit code:

```bash
# Unsafe — semicolons do not check exit code between commands
lcc undef.a
lcc undef.e          # runs the orphan — triggers ~100 MB of output
```

versus the safe form:

```bash
# Safe — && aborts on first non-zero exit
lcc undef.a && lcc undef.e
```

An additional silent hazard: if `undef.a` was previously assembled successfully
and produced a valid `undef.e`, a later failed re-assemble **overwrites** that
good executable with the 2-byte orphan. The previously-working program is
silently replaced, and the next run of `undef.e` (even via the `&&`-safe form on
a different invocation) will behave as described above.

---

## Expected behavior

A failed assembly should not write any output artifacts. If the assembler detects
an error before producing a complete, correct `.e`, it should clean up or refrain
from writing partial output and exit 1 with the diagnostic. The `.lst` and `.bst`
files, which are diagnostic-adjacent, could reasonably be retained for inspection;
the `.e` file, which is executable, should not be.

The preferred outcome:

| Assembly result | `.e` written | `.lst`/`.bst` written | Exit code |
|---|---|---|---|
| Success | yes (complete) | yes | 0 |
| Error | **no** | either | 1 |

---

## Acknowledgements

This was found while building a JavaScript reimplementation of LCC (`lccjs`) for
educational use, running differential parity tests against cuh63 6.3. The
reimplementation aborts before writing any output file when assembly fails —
no `.e`, `.lst`, or `.bst` is written on error — and that clean divergence made
the orphan-artifact behavior immediately visible in the test diffs.

Thank you for the educational tool; it continues to be a pleasure to work with.
