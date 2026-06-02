# No-comma negative-operand family in cuh63 6.3: silent miscompile on `baser,offset6` instructions + hard reject on `imm5`/`imm9` instructions

**Author:** Avi Drucker (avidrucker@gmail.com)
**Date filed:** 2026-06-02
**Distribution under inspection:** `cuh63.zip` (file mtimes 2025-01-09)
**Reported binary:** `lcc` (Linux build from `lnx/` subfolder of the cuh package)
**Reported version string:** `LCC Assemble/Link/Interpret/Debug Ver 6.3` (as printed in `.lst` headers)

This report extends an earlier finding
([`docs/cuh63-ldr-str-silent-miscompile-bug-report.md`](https://github.com/avidrucker/lccjs/blob/main/docs/cuh63-ldr-str-silent-miscompile-bug-report.md))
from two instructions (`ldr`/`str`) to the full set of instructions whose operands
include a signed integer in the **no-comma (space-separated) syntax**. A wider probe
(`public_experiments/nocomma_negative_immediate_family/`) shows the root cause —
the no-comma operand parser cannot read a **negative** integer — affects seven
instructions across two distinct failure modes.

---

## Summary

When cuh63 6.3 assembles an instruction with space-separated operands that include
a **negative** signed integer, the behavior differs from the comma-separated form
in two ways depending on where in the instruction that integer appears:

1. **Silent miscompile (trailing `offset6` position):** `ldr`, `str`, `jmp`,
   `blr`/`jsrr` — the negative offset is silently encoded as **0**. Assembly
   succeeds, a `.e` file is written, no error or warning is emitted. The program
   then executes with the wrong memory address or branch target.

2. **Hard reject (`imm5`/`imm9` position):** `add`, `sub`, `and`, `cmp`, `mvi` —
   the negative immediate causes `Error on line 1` and leaves a blank `.e` file on
   disk. The comma form and no-comma **positive** immediates for these same
   instructions assemble without error.

Both modes have the same root cause. Comma-separated syntax handles the full signed
range for all these instructions; the divergence is entirely in the no-comma path.
LCC.js handles both syntax forms correctly for all affected instructions.

---

## Part A — Silent miscompile: `baser, offset6` instructions

### Affected instructions

`ldr`, `str`, `jmp`, `blr` (alias `jsrr`).

All four use the `baser, offset6` operand pair. The `offset6` field is a signed
6-bit value (range −32..+31) in the LSB of the instruction word. Single-operand
`ret` (which encodes a fixed `offset6`) is **not** affected; the parser failure
requires a user-supplied `offset6` token.

### Encoding table — `jmp` (new; the `ldr`/`str` table is in the companion report)

| Source line | Oracle encoding | offset6 bits | Correct? |
|---|---|---|---|
| `jmp r1, -1` (comma) | `c07f` | `111111` | ✓ |
| `jmp r1, 0`  (comma) | `c040` | `000000` | ✓ |
| `jmp r1, 1`  (comma) | `c041` | `000001` | ✓ |
| **`jmp r1 -1`** (no-comma, neg) | **`c040`** | **`000000`** | **✗ (should be `c07f`)** |
| `jmp r1 0`   (no-comma, pos) | `c040` | `000000` | ✓ |
| `jmp r1 1`   (no-comma, pos) | `c041` | `000001` | ✓ |

The no-comma negative case encodes the same word as `jmp r1 0` — the offset is
silently dropped to 0 rather than encoding the intended −1.

### Encoding table — `blr` / `jsrr`

| Source line | Oracle encoding | offset6 bits | Correct? |
|---|---|---|---|
| `blr r1, -1` (comma) | `407f` | `111111` | ✓ |
| **`blr r1 -1`** (no-comma, neg) | **`4040`** | **`000000`** | **✗ (should be `407f`)** |
| `jsrr r1, -1` (comma) | `407f` | `111111` | ✓ |
| **`jsrr r1 -1`** (no-comma, neg) | **`4040`** | **`000000`** | **✗ (should be `407f`)** |

### Why this matters

`jmp`, `blr`, and `jsrr` with a no-comma negative `offset6` produce a silently
wrong branch target. A call or indirect jump to `BaseR − 1` is assembled as a
call to `BaseR + 0` — not a rejected instruction, not a run-time error, just
the wrong target. This failure mode is identical in character to the previously
reported `ldr`/`str` bug: the assembler exits 0, writes a `.e`, and the program
executes incorrectly with no diagnostic from either the assembler or interpreter.

---

## Part B — Hard reject: `imm5`/`imm9` instructions

### Affected instructions

`add`, `sub`, `and`, `cmp` (5-bit signed immediate field, `imm5`); `mvi` (9-bit
signed immediate field, `imm9`).

### Behavior table

| Source line | Oracle result | LCC.js result |
|---|---|---|
| `add r0, r0, -1` (comma, neg) | `103f` ✓ | `103f` ✓ |
| `add r0 r0 1`    (no-comma, pos) | `1021` ✓ | `1021` ✓ |
| **`add r0 r0 -1`** (no-comma, neg) | **`Error on line 1` + blank `.e`** ✗ | `103f` ✓ |
| `sub r0, r0, -1` (comma) | correct ✓ | correct ✓ |
| **`sub r0 r0 -1`** (no-comma, neg) | **`Error on line 1` + blank `.e`** ✗ | correct ✓ |
| `and r0, r0, -1` (comma) | correct ✓ | correct ✓ |
| **`and r0 r0 -1`** (no-comma, neg) | **`Error on line 1` + blank `.e`** ✗ | correct ✓ |
| `cmp r0, -1` (comma) | correct ✓ | correct ✓ |
| **`cmp r0 -1`** (no-comma, neg) | **`Error on line 1` + blank `.e`** ✗ | correct ✓ |
| `mvi r0, -1` (comma) | correct ✓ | correct ✓ |
| **`mvi r0 -1`** (no-comma, neg) | **`Error on line 1` + blank `.e`** ✗ | correct ✓ |

The pattern is consistent: comma form assembles correctly for any signed value in
range; no-comma form with a **positive** immediate assembles correctly; no-comma
form with a **negative** immediate is rejected with a generic `Error on line 1`.

### Secondary concern — blank `.e` artifact

When cuh63 6.3 rejects an assembly with `Error on line 1`, it leaves a 2-byte
(header-only) `.e` file on disk. Running that file in the interpreter causes an
infinite-loop-style hang (`jmp r0` from address 0 → `jmp r0` again). This
secondary behavior means that a user who misses the error message can silently
end up executing a stale or stub `.e` from a prior run — the file name signals
success but the content is the failure artifact. This is a known cuh63 6.3
characteristic; it is not new to this report.

---

## Common root cause

Both failure modes appear to share a single underlying cause: the **no-comma
operand tokenizer** splits the source line on whitespace and then passes each
token to a numeric parser that does not handle a **leading minus sign**. In the
`baser, offset6` case the result is that the `−N` token is read as 0 (sign
dropped, base interpreted as absent or zero). In the `imm5`/`imm9` case the
parser either rejects the token as invalid or produces a value that fails a
downstream range check, triggering a generic `Error on line 1`.

The comma-separated parser uses a distinct code path that correctly reads the
full signed range; the inconsistency is entirely between the two paths.

Speculative implementation detail: splitting on whitespace may yield tokens `…`,
`-`, `1` rather than `…`, `-1` — or the token parser may read only unsigned
digits after skipping whitespace. Either would explain why positive no-comma
immediates work (no minus sign to trip over) and why the comma path is unaffected
(the comma parser likely reads a complete operand expression including the sign).

---

## Environment / version

- OS: Linux 6.17.0-29-generic (Ubuntu/Mint family), x86-64.
- Binary: `lnx/lcc` from `cuh63.zip` (overlaid onto the main folder per
  `0READFIRST.txt`).
- `file lcc`: `ELF 64-bit LSB pie executable, x86-64 … dynamically linked, for GNU/Linux 3.2.0, not stripped`
- Version banner (from any `.lst`): `LCC Assemble/Link/Interpret/Debug Ver 6.3  <timestamp>`

---

## Minimal reproduction — Part A (silent miscompile)

```
; jmp_neg_noc.a
    jmp r1, -1
    halt
```

Comma form (correct):

```bash
$ echo "TestUser" > name.nnn
$ lcc jmp_neg_noc.a
$ grep "jmp" jmp_neg_noc.lst
0000  c07f    jmp r1, -1        ← correct (c07f = offset −1)
```

Now no-comma form (silent miscompile):

```
; jmp_neg_noc2.a
    jmp r1 -1
    halt
```

```bash
$ lcc jmp_neg_noc2.a
Starting assembly pass 1
Starting assembly pass 2
Starting interpretation of jmp_neg_noc2.e
[...]
$ grep "jmp" jmp_neg_noc2.lst
0000  c040    jmp r1 -1         ← WRONG (c040 = offset 0, not −1)
```

The assembler exits 0 and writes a `.e` in both cases; only the machine word
differs, and only a manual decode of the `.lst` reveals the discrepancy.

---

## Minimal reproduction — Part B (hard reject)

```
; add_neg_noc.a
    add r0 r0 -1
    halt
```

```bash
$ lcc add_neg_noc.a
Starting assembly pass 1
Error on line 1
$ ls -la add_neg_noc.e   # 2-byte header-only stub left on disk
-rw-rw-r-- 1 … 2 … add_neg_noc.e
```

The comma form assembles correctly:

```
; add_neg_comma.a
    add r0, r0, -1
    halt
```

```bash
$ lcc add_neg_comma.a
Starting assembly pass 1
Starting assembly pass 2
Starting interpretation of add_neg_comma.e
[...]
$ grep "add" add_neg_comma.lst
0000  103f    add r0, r0, -1    ← correct (103f = imm5 = −1)
```

---

## Expected behavior

For all affected instructions, comma-separated and space-separated syntax are
described in the LCC documentation as interchangeable. A negative integer is a
valid value in the signed immediate/offset fields of `ldr`, `str`, `jmp`,
`blr`/`jsrr`, `add`, `sub`, `and`, `cmp`, and `mvi`. Both syntax forms should
produce identical output for identical operand values.

Specifically:
- `jmp r1 -1` should encode as `c07f` (same as `jmp r1, -1`).
- `blr r1 -1` / `jsrr r1 -1` should encode as `407f`.
- `add r0 r0 -1`, `sub r0 r0 -1`, `and r0 r0 -1`, `cmp r0 -1`, `mvi r0 -1`
  should all assemble without error (same as their comma counterparts).

---

## Suggested fix

Route all numeric-literal parsing in the no-comma path through the same
signed-integer validator used by the comma-separated path. A single shared
helper for reading and range-checking a signed integer would eliminate the
divergence; both paths would produce identical encodings for identical values,
and the no-comma path would accept the full signed range the ISA defines.

---

## Relationship to prior reports

**Companion to the `ldr`/`str` report:** this is an extension of the
silent-miscompile finding in
[`docs/cuh63-ldr-str-silent-miscompile-bug-report.md`](https://github.com/avidrucker/lccjs/blob/main/docs/cuh63-ldr-str-silent-miscompile-bug-report.md).
That report's "Scope verification" section concluded the bug was isolated to
`ldr`/`str`, based on a narrower probe that did not test `jmp`, `blr`, or
`jsrr`. The wider probe (`public_experiments/nocomma_negative_immediate_family/`)
corrects that conclusion: the defect covers the entire `baser, offset6` instruction
family. The two reports are intended to be sent together as a single upstream
notification.

**Distinct from the `mov` report (OB-008):** a separate report covers cuh63 6.3's
rejection of `mov dr, imm9` with a negative immediate —
[`docs/cuh63-mov-immediate-bug-report.md`](https://github.com/avidrucker/lccjs/blob/main/docs/cuh63-mov-immediate-bug-report.md).
That issue is specifically the `mov` pseudo-instruction's validation logic
(it rejects values the underlying `mvi` would accept); it is not a
comma-vs-no-comma syntax issue and the `mvi` instruction is itself unaffected.
The `mov` report was drafted independently and may be sent separately or
bundled with this one at the sender's discretion.

---

## Probe scripts (for full reproducibility)

The differential probe that produced the tables above is checked into the
LCC.js parity-testing repository:

- [`public_experiments/nocomma_negative_immediate_family/`](https://github.com/avidrucker/lccjs/tree/main/public_experiments/nocomma_negative_immediate_family/)
  — `probe.js` assembles a one-instruction program for each case (comma and
  no-comma, positive and negative) under both cuh63 6.3 and LCC.js and diffs
  the emitted `.e` hex. Runnable with `LCC_ORACLE=/path/to/cuh63/lcc node probe.js`.

I am happy to share full session logs or run extended probes if useful.

Thank you for the educational tool.
