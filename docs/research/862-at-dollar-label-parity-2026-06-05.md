# Research: OG LCC handling of @/$ prefix labels in formatter output — #862

**Date:** 2026-06-05  
**Agent:** ELDERBERRY  
**Issue:** #862  
**Related:** #798 (formatter implementation track)

---

## Summary

OG LCC **has no source code formatter.** The formatter in lccjs is purely a lccjs-specific feature with no oracle parity constraint. The fix in `909a734` (extending the label regex to `[@$A-Za-z_][@$\w]*`) is the correct and unambiguous implementation choice.

---

## Q1: Does OG LCC emit any formatted source?

**No.** OG LCC (`lcc` Ver 6.3) has no source-prettifying mode. The full option set:

```
Optional args: -d -m -r -t -f -x -l<hex loadpt> -o <outfile> -h
   -d:   debug, -m mem display at end, -r: reg display at end
   -f:   full line display, -x: 4 digit hout, -h: help
```

`-f` is "full line display" (a listing width option), not a formatter. Source formatting is a purely lccjs concern.

---

## Q2: How does OG LCC list @/$ labels in .lst files?

Both `@`-prefixed and `$`-prefixed labels appear at **the standard label column** — identical to plain labels. Tested with `experiments/label_prefix_probe.a`:

```asm
        mov r0, 0
@loop:  add r0, r0, 1
        cmp r0, 3
        brn @loop
$done:  dout r0
        nl
        halt
```

Oracle listing output:
```
Loc   Code           Source Code
0000  d000         mov r0, 0
0001  1021 @loop:  add r0, r0, 1
0002  8023         cmp r0, 3
0003  05fd         brn @loop
0004  f002 $done:  dout r0
0005  f001         nl
0006  f000         halt
```

`@loop:` and `$done:` appear at the same column as regular labels. No special treatment.

For standalone label lines (label with no instruction on the same line), from `ex0601.lst`:
```
000e  0ff6           br @L0
           @L1:
000f  ad4c           mov sp, fp
```

`@L1:` (standalone) also appears at the standard label column with address/code fields blank — same as any label-only line.

### Oracle assembler acceptance

OG LCC accepts `@`-prefixed labels across many course programs. Examples from `cuh63/`:

| File | Labels used |
|---|---|
| `ex0601.a` | `@L0:`, `@L1:` |
| `ex0603.a` | `@L0:`, `@L1:`, `@m0:`, `@m1:`, `@m2:` |
| `ex1101.a` | `@L0:`, `@L1:`, `@L2:`, `@L3:`, `@L4:` |
| `ex1501.a` | `@set$p1Aii:`, `@display$p1A:` (`$` in middle of label) |
| `ex0902.a` | `@avail:` |

`$` as the **first character** of a label: zero examples found in any `cuh63/` source file. OG LCC's own source uses `$` only inside labels (e.g. `@set$p1Aii:`), not as a leading character. However, lccjs's `isValidLabel` regex accepts `$` as first char, matching the tmLanguage grammar.

---

## Q3: Is there a course style guide for @/$ labels?

No explicit style guide document was found in `cuh63/`. The convention is clear from the source files: `@`-prefixed labels appear at **column 0** in source, identical to regular labels. They are compiler-generated labels for branch targets (`@L0`, `@L1`…) and string data (`@m0`, `@m1`…).

---

## Implications for the formatter fix

Since OG LCC has no formatter, the parity question reduces to: "does the source convention place `@`/`$` labels at column 0?" The answer is **yes** — every `@L0:`, `@m0:` etc. in the oracle corpus appears at column 0 in source.

The fix in `909a734` — extending the label detection regex from `/^([A-Za-z_]\w*)\s*:/` to `/^([@$A-Za-z_][@$\w]*)\s*:/` — is correct. It makes the formatter consistent with both:
1. The source column-0 convention used in all oracle programs
2. lccjs's own `isValidLabel` regex (`/^[A-Za-z_$@][A-Za-z0-9_$@]*$/`)

**No parity deviation to document.** The formatter is a lccjs-only feature; the fix defines its correct behavior independently of oracle output.

---

## Artifacts

- `experiments/label_prefix_probe.a` — minimal test: `@loop:` + `$done:` labels
- `experiments/label_prefix_probe.lst` — oracle listing confirming both accepted at standard column
- `experiments/label_prefix_probe.e` — oracle executable (runs correctly, output: `3`)
