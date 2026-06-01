# Silent source-line split in cuh63 6.3: lines longer than the input buffer are cut in two and the overflow is parsed as source

**Author:** Avi Drucker (avidrucker@gmail.com)
**Date filed:** 2026-06-01
**Distribution under inspection:** `cuh63.zip` (file mtimes 2025-01-09)
**Reported binary:** `lcc` (Linux build from `lnx/` subfolder of the cuh package)
**Reported version string:** `LCC Assemble/Link/Interpret/Debug Ver 6.3` (as printed in `.lst` headers)

This report describes a silent source-handling defect in the cuh63 6.3 `lcc`
binary. The assembler reads each source line into a fixed-size buffer that holds
**298 characters**. A line longer than that is **silently split** at the buffer
boundary, and the overflow tail is fed back into the assembler **as if it were the
next source line**. There is no "line too long" diagnostic. Depending on what the
overflow tail happens to parse as, the result is either a silent miscompile
(exit 0, an executable written, a bogus label injected into the symbol table) or a
misleading, content-dependent error (e.g. `Duplicate label`) that names a spurious
line number and never mentions line length.

The report is offered respectfully. The trigger is a pathological line (longer than
298 characters), so this is low severity in everyday use; but because the
exit-0 path produces a wrong program with no diagnostic, it seemed worth flagging
even if the buffer size is a deliberate design choice.

---

## Summary

The shipped LCC documentation does not state a maximum source-line length, and the
assembler emits no diagnostic when a line exceeds one. Empirically, cuh63 6.3 reads
each line into a buffer of **298 characters**. The boundary is exact:

| Line length | Behavior |
|---|---|
| ≤ 298 | read as a single source line (correct) |
| ≥ 299 | **silently split**: first 298 chars become one logical line, the remainder becomes the next logical line(s) |

The split is not a truncation — the overflow tail is **not discarded**. It is
re-entered into the tokenizer as fresh source. Because a bare identifier at the
start of a line is a label definition in LCC, an alphabetic overflow tail becomes a
**label**, silently added to the symbol table.

The count is **raw bytes of the physical line, including the comment and
leading/trailing whitespace** — comment-only lines (`; aaaa…`) and whitespace-padded
instruction lines (`        …halt`) split at the same 298-char boundary as code,
which is consistent with the buffer filling before any comment-stripping or
tokenization.

---

## Environment / version

- OS: Linux 6.17.0-35-generic (Ubuntu/Mint family), x86-64.
- Binary: `lnx/lcc` from `cuh63.zip` (overlaid onto the main folder per the
  package's `0READFIRST.txt` instructions).
- Version banner (from any `.lst` it produces):
  `LCC Assemble/Link/Interpret/Debug Ver 6.3  <timestamp>`

---

## Minimal reproduction

`name.nnn` is created first because the LCC runtime otherwise prompts for an author
name.

### Case A — a single over-long line: exit 0, executable written, label silently injected

```bash
$ echo "TestUser" > name.nnn
# one physical line: ';' followed by 399 'a' (400 chars total), then halt
$ python3 -c "print(';' + 'a'*399); print('    halt')" > one.a
$ lcc one.a
Starting assembly pass 1
Starting assembly pass 2
Starting interpretation of one.e
...
$ echo $?
0
$ ls one.e            # an executable was written
one.e
```

The `.lst` listing shows the single physical line rendered as **two** logical
source lines — the 298-char comment, then the 102-char overflow tail standing alone
as parsed source (a bare `aaaa…`, i.e. a label definition):

```
Loc   Code           Source Code
           ;aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa…   ← line 1 (comment, 298 chars)
           aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa…   ← line 2 (overflow tail, parsed as source)
0000  f000     halt
```

No error, no warning, no mention of line length. The assemble "succeeds" and a
program runs — with a spurious symbol silently in its table.

### Case B — two identical over-long lines: misleading `Duplicate label`

```bash
$ python3 -c "L=';' + 'a'*399; print(L); print(L); print('    halt')" > two.a
$ lcc two.a
Starting assembly pass 1
...
Error on line 4 of two.a:
Duplicate label
$ echo $?
1
```

The file has **three** physical lines, yet the error names **line 4** — because
each over-long line was split, and the two identical overflow tails became the same
label, colliding. The diagnostic points at a line that does not exist in the source
and never mentions length, so the actual cause (a line longer than the buffer) is
not discoverable from the message.

### Non-monotonic in length

Failure is not monotonic in line length. In the #244 probe, whitespace-padded
`halt` lines failed near length 900 but **passed** at 1000; comment lines passed
through ~835 then failed near 897. Whether an over-long line errors — and with what
message — depends on where the split lands and what the tail tokens collide with.
That is the signature of a fixed buffer with no bounds check, not of a designed
length limit.

---

## Expected behavior

A source line that does not fit the assembler's buffer should produce a **clear,
length-specific diagnostic** and stop — e.g. `Line N exceeds maximum length of K
characters` — rather than being split and re-parsed. Equivalently, the buffer could
grow to fit the line. Either way, the two failure modes that matter are:

- **Silent corruption (Case A)** — an over-long line must never assemble to exit 0
  with an injected symbol and a written executable.
- **Misleading error (Case B)** — when an over-long line does cause a failure, the
  message should name the real cause (line length) and the real line number, not a
  spurious `Duplicate label` on a non-existent line.

---

## Why this matters

1. **Silent wrong behavior is harder to diagnose than a rejected assembly.** The
   exit-0 path (Case A) writes a runnable executable with a bogus symbol and no
   indication anything went wrong. A user has no signal from the binary's output
   that the source was mangled.

2. **The error path misdirects (Case B).** `Duplicate label` on a line number that
   does not exist in the file sends the reader looking for a label collision that
   isn't really there, instead of at the over-long line that actually caused it.

3. **Machine-generated source is the realistic trigger.** Hand-written assembly
   rarely exceeds 298 characters, but generated source, long data lines, or a long
   trailing comment can. Such a line is exactly the case least likely to be
   eyeballed for length.

4. **Cross-implementation parity is broken in a subtle direction.** The LCC.js
   reimplementation enforces an explicit raw-line cap and fails fast with a clear
   `Line exceeds maximum length of 300 characters` (exit 1, no `.e` written). A
   program that LCC.js rejects loudly, cuh63 6.3 may split silently into a different
   (wrong) program — with no error from either tool pointing at the difference.

---

## Considerations / possible underlying causes

These are speculative, intended only as a starting point:

- The line reader likely uses a fixed-size buffer (≈300 bytes, holding 298 usable
  characters after any terminator/sentinel) with a `fgets`-style read that does not
  flag truncation. The leftover bytes in the stream are then read as the next
  "line," so the overflow is re-tokenized rather than dropped.
- Because the split happens before comment-stripping, a `;`-comment that overflows
  loses its leading `;` on the second logical line, which is why the tail is parsed
  as code (a label) rather than as comment text.
- The non-monotonic behavior across lengths is consistent with no explicit
  length check anywhere in the read path — the outcome is entirely determined by
  what the split tail happens to tokenize into.

---

## Suggested fix

Add an explicit line-length check in the source reader: if a physical line exceeds
the buffer capacity, emit a length-specific diagnostic naming the offending line
and stop, rather than splitting. Alternatively, read the full line (growing the
buffer as needed) so long lines assemble correctly. The key property is that a line
the buffer cannot hold must never be silently divided and re-parsed as multiple
source lines.

---

## Cross-implementation note

For reference, the LCC.js reimplementation chose the fail-fast option: a raw-line
cap of 300 characters (counted including comments and whitespace, matching the
oracle's buffer-fill semantics) with the diagnostic `Line exceeds maximum length of
300 characters`, exit 1, and no executable written. This was a deliberate decision
to convert the silent split into a clear error; it is documented as an intentional
divergence on the LCC.js side. We are **not** asking that cuh63 adopt the same
limit — only flagging the silent-split behavior. **If the 298-character buffer is
intentional, a one-line note in `lcc.txt` ("source lines must be ≤ 298 characters")
would close the loop** and let writers avoid the trap.

---

## Evidence / reproducibility

The full confound-isolated probe behind this report — the 298-char buffer boundary
(`.bad`-line-number jump at N=299), the single-line exit-0 silent corruption, the
two-line `Duplicate label` collision, and the non-monotonic length sweep — is
written up in the LCC.js parity repository at
[`docs/research/line-length-limit.md`](./research/line-length-limit.md) (probe
#244). The minimal repros in this report (Cases A and B) were re-run against the
cuh63 6.3 `lcc` binary on 2026-06-01 and reproduce as shown.

I'm happy to share full session logs or extend the probes if useful.

Thank you for the educational tool; it is a pleasure to work with.
