# Segfault in cuh63 6.3: the linker crashes on a `.o` header label with no NUL terminator

_Audience: assembly enthusiasts, contributors · Tier: reference_

**Author:** Avi Drucker
**Date filed:** 2026-06-16
**Distribution under inspection:** `cuh63.zip` (file mtimes 2025-01-09)
**Reported binary:** `lcc` (Linux build from `lnx/` subfolder of the cuh package)
**Reported version string:** `LCC Assemble/Link/Interpret/Debug Ver 6.3` (as printed in `.lst` headers)

This report describes a crash in the cuh63 6.3 `lcc` linker: when it reads an object
module (`.o`) whose `G`/`E`/`e`/`V` header entry carries a symbol label that is **not**
terminated by a NUL byte before end-of-file, the binary segfaults. A label that *is*
NUL-terminated is handled gracefully — even when the rest of the module is malformed —
so the crash is specific to the missing terminator, and looks like a label-reading loop
that lacks an end-of-buffer bound.

The report is offered respectfully; as with the prior reports on `mov`, `ldr`/`str`,
the `.o` exit code, and the `-d` debugger's bare `c`, the goal is simply to flag what
appears to be an unintended discrepancy.

---

## Summary

A `.o` object module begins with an `'o'` signature, followed by header entries, a `'C'`
code marker, and little-endian code words. A `G` (global), `E`/`e` (external), or `V`
header entry is laid out as the type byte, a 16-bit address, then the symbol's label as
ASCII bytes terminated by a `0x00`. If that terminating `0x00` is missing — the label
bytes run to the end of the file — linking the module terminates the process with
**SIGSEGV** (the wrapping shell sees exit code **139** = 128 + signal 11). The linker
otherwise rejects malformed modules cleanly:

| Input `.o` (header bytes) | Result |
|---|---|
| `o G <addr> "var1" 00 C <code…>` (well-formed) | links — `out.e` written (exit 0) |
| `o G <addr> "var1" 00` (label terminated, no code section) | `<file> is not a linkable module` (clean, exit 1) |
| **`o G <addr> "var1"`** (label, **no NUL terminator**) | **SIGSEGV — process crashes (exit 139)** |

Because a NUL-terminated label is parsed and then rejected gracefully (row 2), while the
same bytes without the terminator crash (row 3), the fault appears to be a label-copy or
scan loop that reads past the end of the module buffer when no `0x00` is found.

---

## Environment / version

- OS: Linux 6.17.0-35-generic (Ubuntu/Mint family), x86-64.
- Binary: `lnx/lcc` from `cuh63.zip` (overlaid onto the main folder per the
  package's `0READFIRST.txt` instructions).
- Version banner (from any `.lst` it produces):
  `LCC Assemble/Link/Interpret/Debug Ver 6.3  <timestamp>`

---

## Minimal reproduction

A module with a single global label is enough; the assembler emits a normal `.o`, and a
one-byte truncation removes the label's terminator.

```bash
# (a name.nnn in the working dir avoids the interactive name prompt)
printf 'Tester\n' > name.nnn

# A module with a .global label assembles to a .o ("needs linking"):
cat > prog.a <<'EOF'
        .global var1
        ld r0, var1
        halt
var1:   .word 10
EOF
lcc prog.a            # -> "Output file prog.o needs linking" (exit 1); prog.o written

# prog.o layout (16 bytes):
#   6f 47 02 00 76 61 72 31 00 43 01 20 00 f0 0a 00
#    o  G  <addr> "v  a  r  1" 00  C  <code words ...>
# The label "var1" is terminated by the 00 byte at offset 8.

# Corrupt it: keep bytes 0..7 (through "var1"), drop the 00 terminator and all that
# follows, so the file ends in the middle of the label:
head -c 8 prog.o > badprog.o      # 6f 47 02 00 76 61 72 31  (no NUL terminator)

lcc badprog.o -o out.e ; echo "exit=$?"
# -> Segmentation fault (core dumped); exit=139   (no diagnostic printed, no out.e)
```

For contrast, neither the well-formed module nor a NUL-terminated-but-codeless module
crashes:

```bash
lcc prog.o -o out.e          # well-formed: links, out.e written (exit 0)

head -c 9 prog.o > tnc.o     # keep the 00 terminator, drop the code section
lcc tnc.o -o out.e           # prints "tnc.o is not a linkable module" (exit 1) — clean
```

---

## Analysis (hypothesis)

When reading a `G`/`E`/`e`/`V` header entry, the linker appears to copy/scan the label
by advancing through bytes until it sees a `0x00`. The loop is bounded by the
terminator, not by the module's length. When the module buffer ends before a `0x00` is
found, the scan walks off the end of the in-memory buffer (and/or copies into an
unbounded fixed label buffer), dereferencing memory past the allocation and faulting.
The graceful `not a linkable module` path (row 2 above) is reached only once the label
*is* terminated and parsing continues to discover the missing code section — so the
crash happens strictly earlier, inside the unbounded label read.

---

## Suggested fix

Bound the label-reading loop by the module's length: when scanning the label bytes of a
`G`/`E`/`e`/`V` entry, stop at end-of-buffer as well as at the `0x00` terminator, and if
the buffer is exhausted before a terminator is seen, emit the existing malformed-module
diagnostic (`is not a linkable module`, or a more specific "unterminated label" message)
instead of continuing to read. This converts the crash into the same clean rejection the
codeless-module case already produces.

---

## For reference: how LCC.js handles it

LCC.js's linker parses the same `.o` format. Its object-module header reader tracks
whether the label's NUL terminator was seen; if the buffer ends first, it throws a typed
`LinkerError` (`Unterminated label in <T> entry`) and rejects the module cleanly, never
crashing (`src/core/linker.js`, `parseObjectModuleBuffer`; LCC.js issue #1384). This
report exists so the upstream binary can be hardened the same way; LCC.js's behavior is
offered only as a reference, not as a parity requirement.

---

## Provenance

Surfaced by LCC.js differential testing: the oracle probe under LCC.js issue **#1384**
captured the exact transcripts and exit codes above (the same probe that drove the
LCC.js-side guard). Tracked for upstream reporting under LCC.js issue **#1428** (umbrella
**#1406**). Sibling of the `-d` debugger bare-`c` segfault report (**#1353**) — the same
"missing guard on a malformed-input path" class.
