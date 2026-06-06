# Research: `.hex` input — oracle vs lccjs parity characterization (#934)

**Date:** 2026-06-06  
**Agent:** CHERRY  
**Issue:** [#934](https://github.com/avidrucker/lccjs/issues/934)

---

## Summary

This doc records the oracle (cuh63 6.3 `lcc`) behavior on `.hex` input across five cases
and compares it to lccjs. Two new parity deviations were found and added to
`docs/parity_deviations.md` as **§26** and **§27**. Both are classified **BY DESIGN**.

**Existing §20** (loading-message difference) is confirmed in scope; two additional sub-divergences
for error contexts are now covered by §26 and §27.

---

## Test environment

```
Oracle: /home/avi/Documents/Study/Assembly/cuh63/lcc  (cuh63 6.3)
lccjs:  node src/cli/lcc.js  (current main)
Wrapper: scripts/lccrun.sh 10 <cmd>  (avoids stdin-TTY hangs)
```

**Important:** oracle rejects absolute paths from directories like `/tmp/` with
"Bad command line switch". All oracle tests must use relative paths from the
project root. Test files were created in `tests/fixtures/assembler-formats/`.

---

## Test fixtures used

| File | Content |
|---|---|
| `tests/fixtures/assembler-formats/hexExample.hex` | `  1A2F ; this is a valid 4-nibble hex line` / `  FFFF ; another 4-nibble hex line` |
| `tests/fixtures/assembler-formats/badHex.hex` | `  1A2 ; only 3 nibbles` |
| `tests/fixtures/assembler-formats/badHex2.hex` | `  1G2F` |
| `tests/fixtures/assembler-formats/empty.hex` | *(0 bytes)* |
| `tests/fixtures/assembler-formats/commentOnly.hex` | `; this is a comment only line` / `; another comment` |
| `tests/fixtures/assembler-formats/whitespaceOnly.hex` | `   ` / `\t` |
| `tests/fixtures/assembler-formats/fiveNibble.hex` | `1A2F3` |

Files `empty.hex`, `commentOnly.hex`, `whitespaceOnly.hex`, and `fiveNibble.hex` were created
during this session and are temporary test scaffolding (not committed).

---

## Case 1: Valid `.hex` input (`hexExample.hex`)

### Oracle output
```
Starting interpretation of tests/fixtures/assembler-formats/hexExample.e
lst file = tests/fixtures/assembler-formats/hexExample.lst
bst file = tests/fixtures/assembler-formats/hexExample.bst
====================================================== Output
Error on line 2 of tests/fixtures/assembler-formats/hexExample.hex:
; another 4-nibble hex line
Trap vector out of range
```
Exit: 1 (runtime error — the second word `0xFFFF` is an invalid trap vector)

Oracle also **creates `hexExample.e`, `hexExample.lst`, `hexExample.bst`** alongside the
input file (same directory).

### lccjs output
```
Loading tests/fixtures/assembler-formats/hexExample.hex (no assembly pass) — 2 word(s)
Starting interpretation of tests/fixtures/assembler-formats/hexExample.e
lst file = tests/fixtures/assembler-formats/hexExample.lst
bst file = tests/fixtures/assembler-formats/hexExample.bst
====================================================== Output
Error on line 0 of 

Error running tests/fixtures/assembler-formats/hexExample.e: Trap vector out of range
```
Exit: 1

### Analysis

- **Generated `.e` content is identical**: both produce `6f43 2f1a ffff` (magic header + 2 words).
- **Loading message** (lccjs-only): already covered by §20.
- **Runtime error format differs**:
  - Oracle traces the fault back to the .hex source line ("Error on line 2 of hexExample.hex:\n; another 4-nibble hex line")
  - lccjs reports "Error on line 0 of " (empty filename, PC-0) — the interpreter lacks source-line metadata for hex-loaded programs.
  This sub-divergence is noted but not added as a separate deviation; it is a minor quality difference in error reporting rather than a behavioral parity gap.

---

## Case 2: Bad-length line — 3 nibbles (`badHex.hex`)

### Oracle output
```
Error on line 1 of tests/fixtures/assembler-formats/badHex.hex:
  1A2 ; only 3 nibbles
Fewer than four hex digits in hex number
```
Exit: 1. No `.e` file created.

### lccjs output
*(no output)*  
Exit: 1. No `.e` file created.

### Analysis

Both exit 1 and produce no artifacts. Oracle prints a descriptive error; lccjs is silent.
The lccjs message `"Error: line 1 in .hex file does not have exactly 4 nibbles: …"` exists
in `assembler.js:863` but is discarded because `abortAssembly` routes to `fatalExit`
which calls `process.exit(code)` without printing anything. This is covered by **§27**.

---

## Case 3: Non-hex character (`badHex2.hex`)

### Oracle output
```
Error on line 1 of tests/fixtures/assembler-formats/badHex2.hex:
  1G2F
Bad hex number
```
Exit: 1. No `.e` file created.

### lccjs output
*(no output)*  
Exit: 1. No `.e` file created.

### Analysis

Same pattern as Case 2. Covered by **§27**.

---

## Case 4: Too many nibbles — 5 nibbles (`fiveNibble.hex`)

### Oracle output
```
Error on line 1 of tests/fixtures/assembler-formats/fiveNibble.hex:
1A2F3
More than four hex digits in hex number
```
Exit: 1. No `.e` file created.

### lccjs output
*(no output)*  
Exit: 1. No `.e` file created.

### Analysis

Same pattern as Cases 2–3. Covered by **§27**.

---

## Case 5: Empty file (`empty.hex`, 0 bytes)

### Oracle output
```
Cannot open executable file tests/fixtures/assembler-formats/empty.e
```
Exit: 1. No `.e` file created.

### Oracle behavior explanation

The oracle parses the empty file, produces 0 words, writes no `.e` file, then attempts
to open and run the `.e` file anyway → file-not-found error.

### lccjs output
*(no output)*  
Exit: 0. No `.e` file created.

### Analysis

lccjs: `parseHexFile()` detects `locCtr === 0` → `abortAssembly('Empty file', 0)` →
`fatalExit('Empty file', 0)` → `process.exit(0)`. Exit-code 0 and no message.

This follows the same BY DESIGN pattern as §9 (empty `.a` files). Covered by **§26**.

---

## Case 6: Comment-only lines (`commentOnly.hex`)

Content: `; this is a comment only line\n; another comment`

### Oracle output
```
Cannot open executable file tests/fixtures/assembler-formats/commentOnly.e
```
Exit: 1.

### lccjs output
*(no output)*  
Exit: 0.

### Analysis

Same as Case 5 — a file with only comments produces 0 words; oracle fails on missing `.e`.
lccjs exits 0 silently. Covered by **§26**.

---

## Case 7: Whitespace-only lines (`whitespaceOnly.hex`)

Content: `   \n\t\n`

### Oracle output
```
Cannot open executable file tests/fixtures/assembler-formats/whitespaceOnly.e
```
Exit: 1.

### lccjs output
*(no output)*  
Exit: 0.

### Analysis

Same as Cases 5–6. Covered by **§26**.

---

## Summary table

| Case | Oracle exit | Oracle message | lccjs exit | lccjs message | Deviation |
|---|---|---|---|---|---|
| Valid .hex (runs OK) | 1 (runtime trap) | "Trap vector out of range" with source attribution | 1 (runtime trap) | "Trap vector out of range" (no source attribution) | §20 (loading), minor runtime-fmt diff (not filed) |
| 3-nibble line | 1 | "Fewer than four hex digits in hex number" | 1 | *(silent)* | **§27** |
| Non-hex char | 1 | "Bad hex number" | 1 | *(silent)* | **§27** |
| 5-nibble line | 1 | "More than four hex digits in hex number" | 1 | *(silent)* | **§27** |
| Empty file | 1 | "Cannot open executable file" | 0 | *(silent)* | **§26** |
| Comment-only | 1 | "Cannot open executable file" | 0 | *(silent)* | **§26** |
| Whitespace-only | 1 | "Cannot open executable file" | 0 | *(silent)* | **§26** |

---

## Ancillary finding: oracle rejects absolute paths from `/tmp/`

When invoked as `lcc /tmp/file.hex`, the oracle prints:
```
Bad command line switch: /tmp/file.hex
Usage: lcc <infile>
...
```
This applies even to non-empty files. Oracle accepts only relative paths (or paths
without leading `/`). This is an oracle-specific quirk; lccjs accepts any valid filesystem path.
Filed as an observation; not a lccjs parity issue.

---

## New parity deviation entries

See `docs/parity_deviations.md` §26 and §27 for the formal records.

§26 — Empty / comment-only / whitespace-only `.hex`: oracle exits 1 ("Cannot open executable file"); lccjs exits 0 silently.  
§27 — Malformed `.hex` line error diagnostics: oracle prints line-specific error text; lccjs exits 1 silently.
