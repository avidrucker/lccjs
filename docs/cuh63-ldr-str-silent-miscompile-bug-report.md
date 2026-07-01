# Silent miscompile in cuh63 6.3: `ldr`/`str` with space-separated operands drops negative `offset6`

_Audience: assembly enthusiasts, contributors · Tier: reference_

**Author:** Avi Drucker (avidrucker@gmail.com)
**Date filed:** 2026-05-26
**Distribution under inspection:** `cuh63.zip` (file mtimes 2025-01-09)
**Reported binary:** `lcc` (Linux build from `lnx/` subfolder of the cuh package)
**Reported version string:** `LCC Assemble/Link/Interpret/Debug Ver 6.3` (as printed in `.lst` headers)

This report describes a silent miscompile in the cuh63 6.3 `lcc` binary
affecting the `ldr` and `str` instructions when written with space-separated
(no-comma) operands and a negative `offset6`. The assembler accepts the
source, produces an executable, and prints no error — but silently encodes
`offset6` as 0 instead of the requested negative value. The program then
executes with the wrong memory address.

The report is offered respectfully; a description of this magnitude (no
diagnostic, wrong output) would be worth flagging even if it turns out to be
a deliberate change.

---

## Summary

The LCC ISA defines `ldr` as:

> `ldr dr, sr, offset6` — loads the word at `mem[sr + offset6]` into `dr`.

The cuh63 6.3 assembler accepts both a comma-separated form
(`ldr r1, fp, -1`) and a space-separated form (`ldr r1 fp -1`). For
comma-separated operands the negative offset is encoded correctly. For
space-separated operands **every negative offset is silently encoded as 0**,
regardless of the actual value. No error or warning is emitted.

Side-by-side encoding table (cuh63 6.3 only; `ldr r1, fp/r5, <offset6>`):

| Source line | Encoding | offset6 bits | Correct? |
|---|---|---|---|
| `ldr r1, fp, 0` | `6340` | `000000` | ✓ |
| `ldr r1, fp, 1` | `6341` | `000001` | ✓ |
| `ldr r1, fp, -1` | `637f` | `111111` | ✓ |
| `ldr r1, fp, -32` | `6360` | `100000` | ✓ |
| `ldr r1 fp 0` | `6340` | `000000` | ✓ |
| `ldr r1 fp 1` | `6341` | `000001` | ✓ |
| **`ldr r1 fp -1`** | **`6340`** | **`000000`** | **✗ (should be `637f`)** |
| **`ldr r1 fp -2`** | **`6340`** | **`000000`** | **✗ (should be `637e`)** |
| **`ldr r1 fp -32`** | **`6340`** | **`000000`** | **✗ (should be `6360`)** |

`str` has the same behavior: `str r1, fp, -1` encodes correctly as `737f`;
`str r1 fp -1` silently encodes as `7340` (offset=0).

The expected encoding for `ldr r1, fp/r5, -1` is computed from the
instruction format `[15:12]=0110 | [11:9]=DR | [8:6]=BaseR | [5:0]=offset6`:

- DR = r1 = `001`, BaseR = fp = r5 = `101`, offset6 = −1 = `111111`
- → `0110 001 101 111111` = `0x637f`

The cuh63 6.3 binary produces `6340` = `0110 001 101 000000`, i.e.,
offset=0, whenever the space-separated path encounters a negative value.

---

## Environment / version

- OS: Linux 6.17.0-29-generic (Ubuntu/Mint family), x86-64.
- Binary: `lnx/lcc` from `cuh63.zip` (overlaid onto the main folder per
  the package's `0READFIRST.txt` instructions).
- `file lcc`:
  `ELF 64-bit LSB pie executable, x86-64 ... dynamically linked, ...
   for GNU/Linux 3.2.0, not stripped`
- Version banner (from any `.lst` it produces):
  `LCC Assemble/Link/Interpret/Debug Ver 6.3  <timestamp>`

---

## Minimal reproduction

A single two-line assembly file. `name.nnn` is required because the LCC
runtime will attempt to prompt for it:

```
; ldr_neg.a
    ldr r1, fp, -1
    halt
```

```bash
$ echo "TestUser" > name.nnn
$ lcc ldr_neg.a
Starting assembly pass 1
Starting assembly pass 2
Starting interpretation of ldr_neg.e
[...]
$ grep "ldr" ldr_neg.lst
0000  637f     ldr r1, fp, -1       ← correct (637f)
```

Now the same program, space-separated:

```
; ldr_neg_noc.a
    ldr r1 fp -1
    halt
```

```bash
$ lcc ldr_neg_noc.a
Starting assembly pass 1
Starting assembly pass 2
Starting interpretation of ldr_neg_noc.e
[...]
$ grep "ldr" ldr_neg_noc.lst
0000  6340     ldr r1 fp -1         ← WRONG (6340 = offset 0, not -1)
```

The assembler completes successfully (exit 0) in both cases. The difference
is that the second produces the wrong machine word `6340` instead of `637f`,
and the program silently loads from `mem[fp + 0]` rather than `mem[fp - 1]`.

---

## Expected behavior

Either form should produce the same encoding when the operands are
semantically identical:

- `ldr r1, fp, -1` and `ldr r1 fp -1` are the same instruction written with
  and without commas.
- The ISA says `offset6` is a signed 6-bit field (range −32..+31). The
  comma-separated path correctly handles the full signed range; the
  space-separated path should too.

The self-consistent fix is for both syntax forms to produce identical output
for identical operands. Specifically, `ldr r1 fp -1` should encode as
`637f`, not `6340`.

---

## Why this matters

1. **Silent wrong behavior is harder to diagnose than a rejected assembly.**
   The other cuh63 6.3 regression on record (`mov` rejects negative
   immediates — see separate report) at least halts assembly with an error
   message. This bug lets a miscompiled program run, producing incorrect
   results that may appear in an interpreter's memory output or a debug
   listing without an obvious indicator of what went wrong.

2. **Stack-frame accesses are the primary use case for negative `offset6`.**
   The idiomatic LCC pattern for a local variable at `fp-1` is
   `ldr r0, fp, -1` or `ldr r0 fp -1`. Both forms appear in instructional
   materials and student code. Programs that use the no-comma style for
   stack reads or writes will silently access the wrong memory location.

3. **The space-separated form is documented and accepted.** Because the
   assembler doesn't reject `ldr r1 fp -1`, a user has no way to know
   from the binary's output alone that the encoding is wrong. They would
   have to read the `.lst` file and manually decode the machine word to
   catch the discrepancy.

4. **Cross-implementation parity is broken in a subtle direction.**
   The LCC.js reimplementation handles both syntax forms correctly (it
   produces `637f` for `ldr r1 fp -1`). This means programs that assemble
   correctly on LCC.js may miscompile on cuh63 6.3, with no error from
   either tool to point to the difference.

---

## Considerations / possible underlying causes

These are speculative, intended only to give a starting point for
investigation:

- The no-comma tokenizer may split on whitespace naively, yielding tokens
  `ldr`, `r1`, `fp`, `-`, `1`. If the operand parser then reads only the
  first non-whitespace token after `fp` and encounters `-` as a
  non-numeric character, it may treat the offset as absent or zero and
  silently accept the line without consuming the `1`.

- Alternatively, the signed-integer validator used for the comma path may
  not be shared with the no-comma path. The comma path handles the full
  signed range; the no-comma path may use an unsigned or non-negative
  parser that converts `-1` to 0 (clamp) or ignores the minus sign.

- The fact that positive no-comma offsets (`ldr r1 fp 31`) encode
  correctly suggests the tokenizer does produce a numeric token in the
  positive case; the failure is specific to the leading `-` in negative
  literals.

---

## Suggested fix

Route the no-comma `offset6` parser through the same signed-integer
validator that the comma-separated path already uses. The two parser
branches should share a common helper for reading and range-checking the
`offset6` field, so identical operand values produce identical encodings
regardless of syntax form. If commas are optional syntactic sugar, the
numeric-literal handling should not differ between the two paths.

---

## Scope verification

> **UPDATE (probe #257, 2026-06-02):** A wider probe showed the defect is
> **not** limited to `ldr`/`str`. The full `baser, offset6` family — `ldr`,
> `str`, **`jmp`**, **`blr`/`jsrr`** — is affected by the same silent-drop.
> Additionally, the `imm5`/`imm9` instructions (`add`, `sub`, `and`, `cmp`,
> `mvi`) exhibit a related hard-reject failure for no-comma negative
> immediates. A companion report covers the full family:
> [`docs/cuh63-nocomma-negative-operand-family-bug-report.md`](./cuh63-nocomma-negative-operand-family-bug-report.md).
> The scope conclusion in this section (below) reflects the **original**,
> narrower probe and is superseded by the companion report.

Before sending this report, a broader probe was run to confirm the bug
affects the `ldr`/`str` offset6 parser path. The probe script and its
summary live in
[`public_experiments/ldr_str_no_comma_neg_offset_silent_miscompile/`](../public_experiments/ldr_str_no_comma_neg_offset_silent_miscompile/)
in the LCC.js parity-testing repository.

The original probe verified that the following are unaffected:

- **Comma-separated `ldr`/`str`** — the full offset6 signed range
  (−32..+31) assembles correctly with commas. The bug is entirely in the
  no-comma code path.
- **`ld`/`st`/`lea` (pcoffset9 path)** — `ld r0 x` and `ld r0, x`
  produce identical encodings; no-comma syntax works correctly for
  these instructions.
- **Label arithmetic** (`ld r0, x+1`, `ld r0, x-1`) — both assemble
  correctly in cuh63 6.3. This is a distinct feature (address arithmetic
  in the operand expression) unrelated to the `offset6` tokenizer.

The wider probe (#257) confirms `ld`/`st`/`lea` and label arithmetic
remain unaffected. The fix scope is the no-comma negative-integer parser,
shared across the `baser, offset6` and `imm5`/`imm9` instruction families.

---

## Comparison with the `mov` regression

A separate report covers another cuh63 6.3 regression: `mov dr, imm9`
rejects all negative immediates (while the underlying `mvi dr, imm9`
accepts them correctly). That bug at least makes itself visible — assembly
fails with an error on line N.

The `ldr`/`str` no-comma bug documented here is in a higher severity class
because it **produces wrong output silently**. The two bugs are
mechanically distinct but may share a common root: the no-comma parser
path for `ldr`/`str` may use the same non-negative or unsigned literal
parser that was inadvertently applied to `mov`.

---

## Probe scripts used (for full reproducibility)

These are checked into the LCC.js parity-testing repository under
[`public_experiments/ldr_str_no_comma_neg_offset_silent_miscompile/`](../public_experiments/ldr_str_no_comma_neg_offset_silent_miscompile/)
and are runnable on any machine where the cuh63 `lcc` binary is reachable
via the `LCC_ORACLE` environment variable:

- `probe.sh` — side-by-side sweep of cuh63 6.3 and LCC.js across
  comma/no-comma, positive/negative, boundary values, and sibling
  instructions (`ld`/`st`/`lea`, label arithmetic).

I'm happy to share full session logs or extend the probes if useful.

Thank you for the educational tool; it is a pleasure to work with.
