# Research: br/brz/brn with numeric operand — parity probe (#524)

**Date:** 2026-06-03  
**Agent:** APPLE  
**Parent:** #520 (Decision A), #524

## Summary

The full BR mnemonic family (`br`, `brz`, `brn`, `brp`, `brgt`, `brc`/`brb`, `bral`, and aliases `bre`, `brne`, `brlt`) silently assembles a bare-integer operand in LCC.js but is correctly rejected by the oracle. This is **LCC.js BUG §25**.

## Probe

### Test inputs

```asm
; br_numeric_probe.a
        br 5

; brz_numeric_probe.a
        brz 5

; brn_numeric_probe.a
        brn 5

; brp_numeric_probe.a
        brp 5

; brgt_numeric_probe.a
        brgt 5
```

### Results

| Mnemonic | Oracle exit | Oracle message | LCC.js exit | LCC.js artifact |
|----------|-------------|----------------|-------------|-----------------|
| `br 5`   | 1 | `Undefined label` | 0 | `.e` (2 bytes) |
| `brz 5`  | 1 | `Undefined label` | 0 | `.e` (2 bytes) |
| `brn 5`  | 1 | `Undefined label` | 0 | `.e` (2 bytes) |
| `brp 5`  | 1 | `Undefined label` | 0 | (not checked) |
| `brgt 5` | 1 | `Undefined label` | 0 | (not checked) |

Oracle error format (same for all probed variants):

```
Starting assembly pass 1
Starting assembly pass 2
Error on line 2 of br_numeric_probe.a:
        br 5
Undefined label
```

LCC.js: no stderr output, exit 0, `.e` artifact written.

## Root cause

`assembleBR` (`src/core/assembler.js:1342`) calls `evaluateOperand(label, 'e')` directly at line 1377 without first validating the operand as a label. `evaluateOperand` calls `parseNumber(operand)` first — for a bare integer like `5` this returns `5` (not NaN), so the function returns `5` immediately, treating it as an absolute address. The instruction then encodes `pcoffset9 = 5 - locCtr - 1` with no error.

Contrast with `assembleBL` (`src/core/assembler.js:1732`), which calls `isValidLabel(label)` as its first step. A bare integer fails `isValidLabel` immediately with `Bad label`, preventing silent encoding.

## Contrast with §24 (`bl 5`)

§24 documents that `bl 5` diverges between oracle ("Undefined label") and LCC.js ("Bad label"), but **both reject with exit 1**. That is classified as OG BUG because LCC.js's upfront syntactic validation is more precise.

This case is different: LCC.js **accepts** `br 5` while the oracle rejects it. Here LCC.js is wrong — a branch operand must be a label, not a raw numeric address.

## Classification

**LCC.js BUG**: `assembleBR` lacks the label-validation gate that `assembleBL` applies. The oracle's "Undefined label" behavior is correct here; any bare integer is not a valid label name.

## Fix scope

`assembleBR` (`src/core/assembler.js:1342`) should validate the branch target as a label before passing it to `evaluateOperand`. The fix is parallel to the `isValidLabel` gate in `assembleBL`. Exact behavior (error message, single vs. multi-error mode) is a separate design decision.

**Scope:** all mnemonics routed through `assembleBR` (see `codes` map at line 1343): `brz`, `bre`, `brnz`, `brne`, `brn`, `brp`, `brlt`, `brgt`, `brc`, `brb`, `br`, `bral`.
