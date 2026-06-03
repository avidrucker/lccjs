# Tokenizer Comma Parity Research (#574)

**Date:** 2026-06-03  
**Agent:** ELDERBERRY  
**Parent context:** #220 (core behavior backlog), TIL #570

## Research questions

1. What does the oracle do with `add r0, r1,` (trailing comma) and `add r0, , r1` (double comma)?
2. If oracle gives a generic error, is matching LCC.js behavior correct?

## Test cases

```asm
; trailing_comma.a
  add r0, r1,
  halt
```

```asm
; double_comma.a
  add r0, , r1
  halt
```

Both were run through LCC.js (`node src/core/assembler.js`) and the oracle
(`experiments/runOracleExperiment.js`) on 2026-06-03.

## Results

### Trailing comma (`add r0, r1,`)

| | LCC.js | Oracle |
|---|--------|--------|
| Exit code | 1 | 1 |
| Error message | `Missing operand` | `Missing operand` |
| Artifacts generated | none | stub `.e` (2 B), `.lst`, `.bst` |

Oracle stderr (exact):
```
Starting assembly pass 1
Starting assembly pass 2
Error on line 1 of trailing_comma1.a:
  add r0, r1,
Missing operand
```

LCC.js stderr (exact):
```
Starting assembly pass 1
Starting assembly pass 2
Error on line 1 of experiments/trailing_comma.a: Missing operand
```

### Double comma (`add r0, , r1`)

| | LCC.js | Oracle |
|---|--------|--------|
| Exit code | 1 | 1 |
| Error message | `Missing operand` | `Missing operand` |
| Artifacts generated | none | stub `.e` (2 B), `.lst`, `.bst` |

Oracle stderr (exact):
```
Starting assembly pass 1
Starting assembly pass 2
Error on line 1 of double_comma1.a:
  add r0, , r1
Missing operand
```

LCC.js stderr (exact):
```
Starting assembly pass 1
Starting assembly pass 2
Error on line 1 of experiments/double_comma.a: Missing operand
```

## Conclusions

**Q1 — Oracle parity:** Oracle produces "Missing operand" for both cases. No
more specific comma-aware diagnostic exists in the oracle.

**Q2 — Diagnostic quality:** Since oracle and LCC.js both give "Missing operand",
LCC.js behavior is parity-correct. No change to `tokenizeLine` or the error
message is warranted from parity reasoning.

**Tokenizer design:** Treating commas as pure delimiters (only push non-empty
tokens) is the correct choice by oracle parity. Changing this to detect empty
slots would touch the tokenizer contract for no parity gain and would be a
separate design decision.

## Side finding: error display format divergence (not comma-specific)

The oracle always emits a **three-line error format**:
```
Error on line N of file:
  <source line (2-space indent)>
<error message>
```

LCC.js emits a **single-line format** by default:
```
Error on line N of file: <error message>
```

LCC.js only echoes the source line in `-v`/`--verbose` mode, and uses a
different format (`[assembler]` prefix, 4-space indent).

This divergence is **pre-existing and not comma-specific** — it affects every
assembler error. It is not currently documented in `docs/parity_deviations.md`.
A follow-on issue should decide whether to adopt the oracle's always-on source
echo or leave the current verbose-flag design. Filed as a separate concern; not
in scope for #574.

## Artifact generation on error

The oracle generates stub `.e` (2 bytes), `.lst`, and `.bst` files even when
assembly fails. LCC.js generates nothing on error. This is already documented
in `docs/parity_deviations.md` §3 and §10.
