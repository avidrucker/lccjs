# Exit-code error in cuh63 6.3: `lcc` exits 1 on a successful `.o` (object-module) assemble

**Author:** Avi Drucker (avidrucker@gmail.com)
**Date filed:** 2026-06-02
**Distribution under inspection:** `cuh63.zip` (file mtimes 2025-01-09)
**Reported binary:** `lcc` (Linux build from `lnx/` subfolder of the cuh package)
**Reported version string:** `LCC Assemble/Link/Interpret/Debug Ver 6.3` (as printed in `.lst` headers)

This report describes an exit-code error in the cuh63 6.3 `lcc` binary: when
assembling a source file that produces an object module (`.o`) rather than a
runnable executable (`.e`), `lcc` exits **1** even though all artifacts are
correctly written and assembly was successful. The same binary exits 0 on a
successful executable assemble, so the non-zero exit is specific to the
`.o`/"needs linking" path.

The report is offered respectfully; as with the prior reports on `mov` and
`ldr`/`str`, the goal is simply to flag what appears to be an unintended
discrepancy.

---

## Summary

When a `.a` source file contains `.extern` or `.global` directives, `lcc`
assembles it into an object module (`.o`) that must be linked before it can
run. On a successful such assemble — one where `.o`, `.lst`, and `.bst` are
all correctly written — the cuh63 6.3 binary exits **1**, signalling failure
to any caller that checks the process exit code.

The `.o` assemble and the executable assemble paths differ only in exit code:

| Path | Artifacts written | `lcc` stdout | Exit code |
|---|---|---|---|
| Successful `.e` assemble+run | `.e`, `.lst`, `.bst` | pass/run output | **0** ✓ |
| Successful `.o` assemble (needs linking) | `.o`, `.lst`, `.bst` | `Output file m1.o needs linking` | **1** ✗ |

The artifacts are correctly formed in both cases. The exit 1 on the `.o` path
therefore misrepresents a successful operation as a failure.

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

Two source files: a main module that declares a global symbol, and an extern
module that references it. Only the main module is needed to demonstrate the
exit-code issue; assembling it produces a `.o` because it uses `.extern`.

```
; m1.a  — declares a global entry point and references an extern sub-routine
    .global main
    .extern sub
main:
    call sub
    halt
```

Seed `name.nnn` so the runtime does not prompt interactively:

```bash
$ echo "TestUser, Auto" > name.nnn
$ lcc m1.a
Starting assembly pass 1
Starting assembly pass 2
Output file m1.o needs linking
lst file = m1.lst
bst file = m1.bst
$ echo $?
1
```

All three artifacts (`m1.o`, `m1.lst`, `m1.bst`) are present and
correctly formed. The exit 1 is the sole anomaly.

For contrast, a standalone `.a` (no `.extern`/`.global` → produces `.e`) exits 0:

```bash
$ echo "    halt" > standalone.a
$ lcc standalone.a
Starting assembly pass 1
Starting assembly pass 2
Starting interpretation of standalone.e
Execution complete
$ echo $?
0
```

---

## Expected behavior

A successful assemble — one that writes all intended artifacts without error —
should exit **0**, regardless of whether the output is a runnable executable
or an object module that requires a subsequent link step. The distinction
between `.e` and `.o` output is a feature of the build pipeline, not an error
condition. Exiting 1 after correctly producing a `.o` conflates "this program
cannot be run directly" with "assembly failed," which are distinct outcomes.

The expected exit-code table:

| Outcome | Expected exit code |
|---|---|
| Successful `.e` assemble + run | **0** |
| Successful `.o` assemble (needs linking) | **0** |
| Assembly error (undefined label, bad syntax, etc.) | 1 |

---

## Why this matters

**Scripts and CI that check the exit code of a `.o` build receive a false
failure signal.** Any build script of the form:

```bash
lcc m1.a || { echo "assembly failed"; exit 1; }
lcc m2.a || { echo "assembly failed"; exit 1; }
lcc -link m1.o m2.o
```

will abort at the first `lcc m1.a` invocation even when assembly succeeds,
because `lcc` exits 1. The caller has no way to distinguish a genuine
assembly error from a successful `.o` assemble short of inspecting the
filesystem for the presence and validity of the `.o` artifact — which
defeats the purpose of exit codes.

This affects instructors or students who assemble multi-module programs
and check `$?` between steps, as well as any automated test harness that
wraps `lcc` calls.

---

## Possible underlying cause

The `lcc` binary is primarily a "compile and run" tool: it assembles,
optionally links, and immediately interprets the result. When the result is
a `.o` that cannot be run directly, the tool appears to treat the absence
of a runnable output as a non-success condition and exits 1. The check is
likely in the post-assemble branch that detects "needs linking" and reports
`Output file <name>.o needs linking` — a diagnostic message that reads as
informational but is paired with a non-zero exit.

The fix would be to return exit 0 from the `.o` branch when assembly
completes without errors, reserving exit 1 for genuine assembly failures
(undefined labels, syntax errors, out-of-range values, etc.).

---

## Acknowledgements

This was found while building a JavaScript reimplementation of LCC
(`lccjs`) for educational use, running parity tests against cuh63 6.3 as
the reference oracle. The reimplementation exits 0 on a successful `.o`
assemble (matching the semantically correct behavior described above), and
that divergence in exit code surfaced the issue.

Thank you for the educational tool; it continues to be a pleasure to work
with.
