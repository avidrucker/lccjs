# Segfault in cuh63 6.3: the `-d` debugger crashes on a bare `c` command (no operands)

**Author:** Avi Drucker (avidrucker@gmail.com)
**Date filed:** 2026-06-15
**Distribution under inspection:** `cuh63.zip` (file mtimes 2025-01-09)
**Reported binary:** `lcc` (Linux build from `lnx/` subfolder of the cuh package)
**Reported version string:** `LCC Assemble/Link/Interpret/Debug Ver 6.3` (as printed in `.lst` headers)

This report describes a crash in the cuh63 6.3 `lcc` interactive debugger: when the
change-value command `c` is entered at the debugger prompt with **no operands**, the
binary segfaults. Well-formed `c <loc> <val>` works correctly, and `c <loc>` (a value
omitted) prints a clean `Missing operand` — so the crash is specific to the
zero-operand case, and looks like a missing-operand guard that is absent on one path.

The report is offered respectfully; as with the prior reports on `mov`, `ldr`/`str`,
and the `.o` exit code, the goal is simply to flag what appears to be an unintended
discrepancy.

---

## Summary

Running a program under the debugger (`lcc -d <prog>.e`) and typing a bare `c` at the
`{mnemonic}>>>` prompt terminates the process with **SIGSEGV** (the wrapping shell sees
exit code **139** = 128 + signal 11). The `c` command otherwise behaves correctly:

| Input at the `>>>` prompt | Result |
|---|---|
| `c r0 5` (register + hex value) | works — `r0` becomes `0x0005` |
| `c r0` (location, value omitted) | prints `Missing operand` (clean, no crash) |
| **`c`** (no operands at all) | **SIGSEGV — process crashes** |

Because `c r0` (one operand) is handled gracefully but `c` (zero operands) crashes, the
fault appears to be an operand dereference that runs before the empty-input check on the
no-operand path.

---

## Environment / version

- OS: Linux 6.17.0-35-generic (Ubuntu/Mint family), x86-64.
- Binary: `lnx/lcc` from `cuh63.zip` (overlaid onto the main folder per the
  package's `0READFIRST.txt` instructions).
- Version banner (from any `.lst` it produces):
  `LCC Assemble/Link/Interpret/Debug Ver 6.3  <timestamp>`

---

## Minimal reproduction

A tiny program is enough; the crash happens at the prompt, before any instruction
needs to execute.

`p.a`:
```
        mvi r0, 5
        halt
```

```bash
# (a name.nnn in the working dir avoids the interactive name prompt)
printf 'Tester\n' > name.nnn
lcc p.a                          # produces p.e

# drive the -d debugger with a single bare 'c':
printf 'c\nq\n' | lcc -d p.e ;  echo "exit=$?"
# -> exit=139    (SIGSEGV; no diagnostic printed)
```

For contrast, the well-formed and missing-value forms do **not** crash:
```bash
printf 'c r0 5\nr\nq\n' | lcc -d p.e   # r0 shows 0005 — works
printf 'c r0\nq\n'      | lcc -d p.e   # prints "Missing operand" — clean
```

---

## Analysis (hypothesis)

The `c` command parser appears to read the location token and the value token, and to
print `Missing operand` when the **value** token is absent (the `c r0` case). On the
bare-`c` case there is no **location** token either; the code path that would normally
report that case instead dereferences an absent/garbage pointer (e.g. the location
string) before validating it, causing the segfault. A single presence-check on the
location token before use would convert the crash into the same `Missing operand`
diagnostic the `c r0` case already produces.

---

## Suggested fix

Guard the operand parse at the top of the `c` handler: if no location token follows
`c`, emit the existing `Missing operand` message (matching the value-omitted case)
rather than proceeding to dereference it.

---

## For reference: how LCC.js handles it

LCC.js's `-d` debugger mirrors the oracle's command set, and validates this input:
both bare `c` and `c <loc>` (value omitted) print `Missing operand` and continue; the
interpreter never crashes (`src/core/interpreter.js`, `debug()` change-value handler;
LCC.js issue #1349). This report exists so the upstream binary can be hardened the same
way; LCC.js's behavior is offered only as a reference, not as a parity requirement.

---

## Provenance

Surfaced by LCC.js differential testing: oracle probe issue **#1348** captured the exact
transcripts and exit codes above; tracked for upstream reporting under LCC.js issue
**#1353** (umbrella **#1406**).
