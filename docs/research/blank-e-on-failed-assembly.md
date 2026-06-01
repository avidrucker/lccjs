# Blank `.e` on Failed Assembly — OG LCC Characterization

**Ticket:** #263 · **Date:** 2026-05-31 · **Agent:** DRAGONFRUIT  
**Oracle:** cuh63 6.3 (`~/Documents/Study/Assembly/cuh63/lcc`)  
**Probe:** `public_experiments/blank_e_probe/run_probe.sh`

---

## 1. Scope: which errors trigger it?

**Every** assembly error tested leaves at least a partial `.e` on disk.
This is not specific to undefined labels — it is the universal OG LCC failure mode.

| Error type | Error message | Exit | `.e` size | `.lst`/`.bst` written |
|---|---|---|---|---|
| Undefined label | `Undefined label` | 1 | 2 B | yes |
| Out-of-range imm5 | `imm5 out of range` | 1 | 2 B | yes |
| No-comma negative (add) | `Missing operand` | 1 | 2 B | yes |
| Invalid directive | `Invalid operation` | 1 | 2 B | yes |
| Bad register (r9) | `Bad register` | 1 | 2 B | yes |
| Missing operand (bare `add`) | `Missing operand` | 1 | 2 B | yes |
| `br 999` (numeric) | `Undefined label` | 1 | 2 B | yes |
| **Duplicate label** | `Duplicate label` | 1 | **1 B** | yes |
| Valid program (control) | — | 0 | 4 B | yes |

The **duplicate label** case is unique: the error fires during **pass 1**, before the
second byte of the file header is written, so the orphan `.e` is only 1 byte (`6f`).
Every other error fires during pass 2 and leaves the full 2-byte header (`6f 43`).

One case does **not** produce a blank `.e`:

| Input | Result | Why |
|---|---|---|
| `ldr r0 r1 -2` (no-comma, neg offset6) | Exit=0, 6B `.e` — **silently miscompiled** | OG LCC accepts the no-comma form and encodes wrong code; see parity_deviations.md §11 |

This is a distinct bug class (silent miscompile, not failed assembly) and is already
documented; it is out of scope for this characterization.

---

## 2. Orphan `.e` contents and execution behavior

### Contents

**Pass-2 errors** (all non-dup-label cases above): `6f 43` — the 2-byte file magic only.
No code words follow. The remaining memory image is entirely zero.

**Pass-1 errors** (duplicate label): `6f` — the first magic byte only.

A valid assembly of `halt` produces `6f 43 00 f0` (4 bytes: magic + halt word).

### What executing the orphan does

Running the 2-byte blank `.e` through OG LCC:

```
Starting interpretation of blank1.e
lst file = blank1.lst
bst file = blank1.bst
====================================================== Output
Possible infinite loop
a120: 0000     ; brz
brz>>>a121: 0000     ; brz
brz>>>a122: 0000     ; brz
...
```

The zero-filled image loads into memory starting at the load point (`0xa120`).
Every zero word decodes as `brz` (opcode `0000`) with offset `0` — but OG LCC's
`brz` apparently advances the PC even on a taken branch, so the interpreter walks
forward through zero memory indefinitely. OG LCC's own infinite-loop detector
eventually fires and halts with "Possible infinite loop" — but only after generating
~100 MB of listing output (observed in testing).

The `.e`-path output confirms that `.lst` and `.bst` are also generated for the blank-
`.e` run, compounding disk usage.

---

## 3. `.lst` and `.bst` on failed assembly

Both files are always written, for every error case tested, regardless of whether the
error fires in pass 1 or pass 2.

Content for a pass-2 error (abridged):

```
LCC Assemble/Link/Interpret/Debug Ver 6.3  ...
TestUser

Header
o
C

Loc   Code           Source Code
Error on line 1 of undef1.a:
    br cheese
Undefined label

========================================== Program statistics
Instructions executed =    0 (hex)     0 (dec)
Program size          =    0 (hex)     0 (dec)
```

The "Header / o / C" section literally prints the raw bytes of the `.e` header —
showing the orphan artifact plainly. Stats are all zero because no code ran.

`.o` is **never** written on a failed assembly (confirmed for all cases).

---

## 4. Contrast with LCC.js

| Behavior | OG LCC cuh63 6.3 | LCC.js |
|---|---|---|
| `.e` on failed assembly | Always written (1 B or 2 B) | **Not written** |
| `.lst`/`.bst` on failed assembly | Always written | **Not written** |
| `.o` on failed assembly | Not written | Not written |
| Exit code on error | 1 | 1 |
| Error message | Printed (stdout) | Printed |

LCC.js's `failAssembly(message, exitCode)` aborts before `writeOutputFile`, so no
artifacts reach disk. This is the correct, all-or-nothing behavior.

---

## 5. Verdict

**Report-worthy footgun.** The behavior is:

- **Universal** (every assembly error, not just undefined labels).
- **Silent** (exit code 1 is returned but the `.e` is written *before* the exit — a
  build script that runs `lcc foo.a && lcc foo.e` will not hit the `&&` gate and skip
  execution, but a script that runs `lcc foo.a; lcc foo.e` will execute the orphan).
- **Hazardous on re-run** (the orphan `.e` overwrites a previous valid build's output,
  so a previously-working program is silently replaced by the blank artifact).
- **Amplifying on execution** (running the orphan triggers "Possible infinite loop"
  with ~100 MB of output before OG LCC's detector fires).

The clearest single repro:

```asm
; undef.a
    br missing_label
    halt
```

```
$ lcc undef.a
Error on line 1 of undef.a: Undefined label
$ echo $?
1
$ ls -la undef.e
-rw-r--r-- 1 user user 2 ... undef.e   ← orphan left on disk despite exit 1
$ lcc undef.e
Possible infinite loop
[~100 MB of brz trace output]
```

**Existing documentation:** OG BUG #10 in `docs/parity_deviations.md` already covers
the undefined-label specific case. This document extends the scope finding: the footgun
applies to **all** error types (9 distinct cases confirmed), with the duplicate-label
edge case producing a 1-byte rather than 2-byte orphan.

**Recommendation:** Report alongside OG BUG #10 (framing it as a general finding,
not a new bug). The undefined-label repro above is the clearest entry point.
The paired WRITER ticket (#264) should frame this as a footgun report with that repro.
