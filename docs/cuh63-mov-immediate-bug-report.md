# Possible regression in cuh63 6.3: `mov` accepts a narrower immediate range than `mvi`

**Author:** Avi Drucker (avi.drucker@dataico.com)
**Date filed:** 2026-05-25
**Distribution under inspection:** `cuh63.zip` (file mtimes 2025-01-09)
**Reported binary:** `lcc` (Linux build from `lnx/` subfolder of the cuh package)
**Reported version string:** `LCC Assemble/Link/Interpret/Debug Ver 6.3` (as printed in `.lst` headers)

This report describes what appears to be a regression in the way the
`lcc` program included with cuh63 validates the immediate operand of the
`mov` pseudo-instruction. It diverges from the behavior documented in
`LCCInstructionSetSummary.pdf` (shipped in the same package) and from
the behavior of `mvi`, the underlying real instruction that `mov` is
supposed to translate to. The report is offered respectfully and may
well be a deliberate change rather than a regression — if so, a one-line
note in `lcc.txt` clarifying the intent would be enough to close the
loop on the educational use case.

---

## Summary

`LCCInstructionSetSummary.pdf` defines:

> `mov dr, imm9` is a pseudo-instruction translated to the machine
> instruction corresponding to `mvi dr, imm9`.

It also notes, in the footnotes of the same page:

> `pcoffset9, pcoffset11, imm5, imm9, offset6` are signed number fields
> of the indicated length.

A 9-bit signed field represents the range **−256..+255**, and `mov`
should therefore accept that range, identically to `mvi`.

The cuh63 6.3 `lcc` binary disagrees with this on the negative side of
the range: **it rejects every negative `mov` immediate**, including
spec-valid values such as `mov r0, −1`, `mov r0, −15`, `mov r0, −256`.

The same binary's `mvi` accepts those same values. Both `mov` and `mvi`
correctly reject values outside the 9-bit signed range (≤ −257 or ≥
+256); the disagreement is only on the negative half of the in-range
window.

Side-by-side acceptance table (cuh63 6.3, same `lcc` binary, same run):

| Value | `mov r0, ⟨val⟩` | `mvi r0, ⟨val⟩` |
|---:|:---:|:---:|
| −257 | REJECT | REJECT |
| −256 | **REJECT** | ACCEPT |
| −255 | **REJECT** | ACCEPT |
| −1 | **REJECT** | ACCEPT |
| 0 | ACCEPT | ACCEPT |
| 1 | ACCEPT | ACCEPT |
| 255 | ACCEPT | ACCEPT |
| 256 | REJECT | REJECT |
| 257 | REJECT | REJECT |

So `mov` and `mvi` should be synonyms per the spec, but in cuh63 6.3
they have different acceptance ranges on the negative half. The bolded
rows show inputs that the spec allows and `mvi` accepts but `mov`
rejects.

The error message produced by `lcc` for the rejected cases is:

```
Error on line N of file.a:
    mov rD, <value>
mov immediate value out of range
```

Exit status is non-zero; assembly aborts.

## Environment / version

- OS: Linux 6.17.0-29-generic (Ubuntu/Mint family), x86-64.
- Binary: `lnx/lcc` from `cuh63.zip` (overlaid onto the main folder per
  the package's `0READFIRST.txt` instructions).
- `file lcc`:
  `ELF 64-bit LSB pie executable, x86-64 ... dynamically linked, ...
   for GNU/Linux 3.2.0, not stripped`
- Version banner (from any `.lst` it produces):
  `LCC Assemble/Link/Interpret/Debug Ver 6.3  <timestamp>`

## Minimal reproduction

Files: a single one-line assembly program. No `name.nnn` required for
this reproduction since the failure is at assembly time, before the
prompt would appear, but supply one if `lcc` warns about its absence:

```
; mov_neg.a
    mov r0, -15
    halt
```

Invoke:

```bash
$ lcc mov_neg.a
Starting assembly pass 1
Starting assembly pass 2
Error on line 2 of mov_neg.a:
    mov r0, -15
mov immediate value out of range
$ echo $?
1
```

Substitute the `mov` for `mvi` and the same binary accepts it:

```
; mvi_neg.a
    mvi r0, -15
    halt
```

```bash
$ lcc mvi_neg.a
Starting assembly pass 1
Starting assembly pass 2
Starting interpretation of mvi_neg.e
[...]
$ echo $?
0
```

The two source files differ in a single mnemonic. Per the documented
pseudo-instruction definition, they should produce the same machine
code and the same acceptance/rejection outcome.

## Expected behavior

Either of the following would be self-consistent:

1. **Treat `mov` exactly as `mvi`** (the documented behavior): accept
   the full 9-bit signed range −256..+255 for both. This is also what
   the older cuh-6.x build that produced the educational example
   listings did — listings in the wild contain encodings such as
   `d1f1 = mov r0, -15`, which is the spec-correct 9-bit-signed
   encoding.

2. **Restrict both `mov` and `mvi` to 0..255** and update
   `LCCInstructionSetSummary.pdf` to redefine `imm9` for `mvi` as
   unsigned, and to redefine `mov`'s range accordingly. If this is the
   intent, the documentation footnote stating that `imm9` is "signed"
   would need to be corrected, since it currently reads as a global
   property of the `imm9` field across all instructions that use it.

The mismatch as it stands today — where `mov` and `mvi` disagree on
which inputs are legal, despite the spec saying they are equivalent —
is the part that looks most like an unintended regression.

## Why this matters (educational impact)

1. **Pre-existing course materials use the rejected forms.** Several
   demos that ship in cuh63 (or were widely used in earlier editions)
   include lines like `mov r0, -15`, `mov r1, -5`, `mov r0, -1`. They
   were written and tested against an earlier cuh-6.x build that
   accepted these. Students or instructors upgrading to cuh63 6.3 will
   see those programs suddenly fail to assemble, with an error that
   reads as if the student wrote something illegal — when in fact the
   program is spec-correct.

2. **The `mov` ↔ `mvi` discrepancy is confusing pedagogically.** The
   pseudo-instruction definition in the LCC ISA summary is, in a small
   way, a teaching opportunity about source-vs-machine-code distinction.
   A student who reads the spec and tries `mov r0, -15` and `mvi r0, -15`
   will see the latter work and the former fail, contradicting the
   stated equivalence. That undermines the pedagogical point.

3. **Cross-implementation parity becomes hard to verify.** Other LCC
   implementations (in JavaScript, in C++, in pedagogical compilers
   built by students as course projects) that follow the documented
   spec will diverge from cuh63 6.3 on these inputs, and it's not
   obvious from `lcc.txt` or the ISA summary which side has the
   correct behavior.

## Considerations / possible underlying causes

These are speculative, intended only to give a starting point for
investigation:

- A range-check that was added to the `mov` parsing path (perhaps to
  guard against typos like writing a 16-bit literal where a 9-bit one
  was intended) and was unintentionally tightened to 0..255 instead of
  −256..+255.
- A reuse of the 8-bit byte-literal validation from `.string` /
  byte-mode handling that leaked into the `mov` parser by accident.
- A deliberate design change with the intent of forcing students to
  use `mvi` for negative immediates (in which case the documentation
  needs an update, since the current wording explicitly equates the
  two).

## Suggested fix (if treated as a bug)

Route `mov`'s immediate-range check through the same validator that
`mvi` already uses. If they share validation, the two acceptance sets
become identical by construction and the spec is preserved.

## Scope verification

Before sending this report, I ran a broader audit of cuh63 6.3 to confirm
the `mov` regression is isolated, not part of a wider parser change.
The audit script and its summary live in
[`public_experiments/cuh63_audit/`](../public_experiments/cuh63_audit/)
in the LCC.js parity-testing repository.

The audit verified that the following all behave per spec in cuh63 6.3
and are unaffected by the issue described above:

- `mvi dr, imm9` (the underlying instruction) — accepts the full
  −256..+255 range.
- Other pseudo-instructions: `cea dr, imm5` (pseudo for
  `add dr, fp, imm5`) and `mov dr, sr` (pseudo for `mvr dr, sr`).
- `imm5` immediates on `add`, `sub`, `and`: −16..+15 accepted, ±16+
  correctly rejected.
- Numeric literal forms: decimal, hex, binary, `char`, unary `+`/`−`,
  negative zero.
- Directive synonyms: `.string`/`.stringz`/`.asciz`,
  `.word`/`.fill`, `.zero`/`.space`/`.blkw`, `.global`/`.globl`.
- Label arithmetic (`br main+1`) and the `*` current-address notation.

Concentrating the suggested fix on the `mov` pseudo's validator (and
not the wider parser) is therefore safe and well-scoped.

## Other observations made during the audit (not separate bug reports)

Two minor behaviors surfaced during the audit that may also be worth
a quick look. They are not in the same category as the `mov`
regression, but flagging them here in case they are unintentional.

1. **`.orig` is silently accepted as a synonym for `.org`.** The ISA
   summary's "Assembler Directives" section lists `.org` but not
   `.orig`. `cuh63 6.3` accepts `.orig 5` and produces a listing
   byte-identical to `.org 5` — same zero-padding, same encoded
   output. Either the doc could mention `.orig` as an accepted alias,
   or the assembler could reject the undocumented form. (LCC.js
   matches this in the permissive direction.)

2. **Duplicate `.start` directives are silently accepted (last-one
   wins).** A program with two `.start` directives produces a `.e`
   header containing the address of the latter target, with no
   warning. This may be intentional, but the documentation does not
   specify. (LCC.js currently does the same; either way, parity work
   should align on a documented behavior.)

## Acknowledgements

This was found while building a JavaScript reimplementation of LCC for
educational use, while running parity tests against cuh63 6.3 as the
reference oracle. The reimplementation matches the documented spec for
`mov`/`mvi` (signed `imm9`, −256..+255), which is what surfaced the
discrepancy. The cuh package's careful packaging — per-platform
binaries, `0READFIRST.txt`, the ISA summary PDFs — made it
straightforward to set up the test environment and locate the spec
text supporting each claim above.

Thank you for the educational tool; it is a pleasure to work with.

## Probe scripts used (for full reproducibility)

These are checked into the LCC.js parity-testing repository under
[`public_experiments/mov_mvi_parity/`](../public_experiments/mov_mvi_parity/)
and are intended to be runnable as-is on any machine where the cuh63
`lcc` binary is reachable via the `LCC_ORACLE` environment variable
(the same variable the LCC.js test suite uses):

- `mov_neg.a` — the minimal one-line reproduction.
- `probe.sh` — sweeps `mov r0, <val>` for
  `val ∈ {−257,−256,−255,−128,−16,−15,−1,0,1,15,16,127,128,255,256,257,511,512}`
  and reports accept/reject for OG `lcc` and the LCC.js
  reimplementation, plus the encoding bytes LCC.js produces.
- `probe_mvi.sh` — same sweep, comparing `mov` against `mvi` side by
  side on the same OG binary. The output is reproduced in the
  acceptance table above; `public_experiments/mov_mvi_parity/README.md`
  walks through how to interpret it.

I'm happy to share full session logs or extend the probes if useful.
