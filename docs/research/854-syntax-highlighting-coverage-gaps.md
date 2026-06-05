# Syntax Highlighting Coverage Gaps — lccjs vs vscode-lcc

**Issue:** #854
**Role:** RESEARCH
**Date:** 2026-06-05
**Agent:** BANANA

---

## 1. Scope

This document maps every syntax-highlighting coverage gap across three artefacts:

| Artefact | Path | Used by |
|----------|------|---------|
| `lcc.tmLanguage.json` | `docs/lcc.tmLanguage.json` | Shiki (static site, docs, grammar tests) |
| `lcc.grammar` (Lezer) | `src/lang-lcc/lcc.grammar` | CodeMirror 6 playground editor |
| `grammar.unit.spec.js` | `tests/new/grammar.unit.spec.js` | Jest test suite (Shiki-based) |

Cross-reference: `vscode-lcc/syntaxes/lcc.tmLanguage.json` and `vscode-lcc/src/rules.json`.

The authoritative ISA source for valid tokens is `src/core/assembler.js` (`isValidLabel`, `_buildCoreTable`, `handleDirective`).

---

## 2. Label definitions — gap inventory

### 2a. tmLanguage.json `label_def` pattern

```
^\s*(?:[$@A-Za-z_][$@A-Za-z0-9_]*):
```

**Status: CORRECT.** Accepts `$`, `@`, `_`, and letter starts. Matches vscode-lcc and assembler.

### 2b. tmLanguage.json `label_ref` pattern

```
(?<![A-Za-z0-9_@])[@A-Za-z_][A-Za-z0-9_@]*(?:[+-][0-9]+)?\b
```

**GAP: `$` prefix missing.**  A `$`-prefixed label reference (`$var`, `$loopEnd`) is not captured by this pattern. The leading character class is `[@A-Za-z_]` — `$` is absent. A `$`-prefixed label used as a branch target or operand will fall through to unhighlighted text.

Fix: add `$` to both the lookbehind exclusion and the character classes:
```
(?<![A-Za-z0-9_@$])[$@A-Za-z_][$@A-Za-z0-9_]*(?:[+-][0-9]+)?\b
```

### 2c. Lezer grammar `identStart` / `identCont`

```lezer
identStart { @asciiLetter | "_" | "@" }
identCont  { @asciiLetter | @digit | "_" | "@" }
```

**GAP: `$` prefix missing from both rules.** Consequences:
- `$cheese:` is NOT tokenised as `LabelDef` — the tokenizer fails to match and falls back to error recovery.
- `$var` used as an operand is NOT tokenised as `Identifier` — same fallback.
- The assembler accepts `$`-prefixed labels via `/^[A-Za-z_$@][A-Za-z0-9_$@]*$/`; vscode-lcc accepts them via `^[a-zA-Z_$@][a-zA-Z0-9_$@]*`; the Lezer grammar silently rejects them.

Fix (one-line each):
```lezer
identStart { @asciiLetter | "_" | "@" | "$" }
identCont  { @asciiLetter | @digit | "_" | "@" | "$" }
```

After changing the grammar source, rebuild: `npm run build:lang-lcc`.

---

## 3. Mnemonic coverage — gap inventory

### 3a. tmLanguage.json vs assembler

The `mnemonic_core` regex covers:
```
add, sub, mul, div, rem, and, or, xor, not, sll, srl, sra, rol, ror,
mov, mvi, mvr, ld, ldr, st, str, lea, cea, cmp, sext, push, pop, halt
```

The `mnemonic_branch` regex covers:
```
br, bral, brz, brnz, bre, brne, brn, brp, brlt, brgt, brc, brb,
jmp, jsr, jsrr, bl, blr, call, ret
```

The assembler's `_buildCoreTable()` defines the identical set. **No core/branch mnemonic gap between tmLanguage.json and the assembler.**

vscode-lcc `validPattern` for bad-mnemonic rules lists the same set (minus LCC+ extensions, which is expected — vscode-lcc covers core only).

### 3b. Lezer grammar vs tmLanguage.json

The Lezer grammar at `src/lang-lcc/lcc.grammar` uses `@specialize` lists for the same mnemonic groups. The sets match `mnemonic_core` and `mnemonic_branch` exactly. **No gap here.**

### 3c. grammar.unit.spec.js test coverage gaps

The current test suite covers these **core mnemonics**:
```
add, sub, mul, div, rem, and, or, xor, not, mov, ld, ldr, st, str, lea, cmp, push, pop, halt
```

**Missing from tests (9 mnemonics):**
| Mnemonic | Group | In tmLanguage | In Lezer |
|----------|-------|---------------|----------|
| `sll`    | core  | ✓ | ✓ |
| `srl`    | core  | ✓ | ✓ |
| `sra`    | core  | ✓ | ✓ |
| `rol`    | core  | ✓ | ✓ |
| `ror`    | core  | ✓ | ✓ |
| `mvi`    | core  | ✓ | ✓ |
| `mvr`    | core  | ✓ | ✓ |
| `cea`    | core  | ✓ | ✓ |
| `sext`   | core  | ✓ | ✓ |

The current test suite covers these **branch mnemonics**:
```
br, bral, brz, brnz, bre, brne, brn, brp, brlt, brgt, bl, blr, ret, jmp
```

**Missing from tests (5 mnemonics):**
| Mnemonic | Group  | In tmLanguage | In Lezer |
|----------|--------|---------------|----------|
| `brc`    | branch | ✓ | ✓ |
| `brb`    | branch | ✓ | ✓ |
| `jsr`    | branch | ✓ | ✓ |
| `jsrr`   | branch | ✓ | ✓ |
| `call`   | branch | ✓ | ✓ |

These mnemonics are defined in both grammars but have no regression test guarding them.

---

## 4. Directive coverage — gap inventory

### 4a. tmLanguage.json directive pattern

```
\.(?:start|org|orig|word|fill|stringz|string|asciz|zero|space|blkw|lccplus|extern|globl|global)\b
```

The assembler's `handleDirective()` accepts: `start, org, orig, global, globl, extern, blkw, space, zero, fill, word, stringz, asciz, string, lccplus`. **No gap — all assembler directives appear in the pattern.**

vscode-lcc directive coverage: `word, zero, blkw, fill, string, asciz, stringz, space, start, global, globl, extern, org, orig` (no `.lccplus`, which is intentional — it's an lccjs extension).

### 4b. grammar.unit.spec.js test coverage gaps

Current tests cover: `.word`, `.zero`, `.string`, `.start`, `.lccplus`, `.org`, `.extern`, `.globl`

**Missing from tests (7 directives):**
| Directive  | In tmLanguage | In Lezer |
|------------|---------------|----------|
| `.orig`    | ✓ | ✓ |
| `.fill`    | ✓ | ✓ |
| `.stringz` | ✓ | ✓ |
| `.asciz`   | ✓ | ✓ |
| `.space`   | ✓ | ✓ |
| `.blkw`    | ✓ | ✓ |
| `.global`  | ✓ | ✓ |

---

## 5. Register coverage

### 5a. tmLanguage.json

```
\b(?:r[0-7]|fp|sp|lr)\b
```

**No gap.** The assembler's `isRegister` (line 1953) accepts exactly `r0-r7`, `fp` (→r5), `sp` (→r6), `lr` (→r7) — the same set as the grammar. There is no `ra` alias in LCC; `docs/research/lezer-grammar-lcc-assembly.md` §4 asserts one, but it is incorrect.

### 5b. Lezer grammar

Same set: `r0-r7, fp, sp, lr`. **No gap.**

---

## 6. Numeric literal coverage

### 6a. Lezer grammar

```lezer
Number {
  "0x" $[0-9A-Fa-f]+ |
  "0b" $[01]+         |
  "-"? @digit+
}
```

**GAP: Bare `x`-prefixed hex (`xF`, `x1F`) tokenises as `Identifier`.** LCC assembly historically uses `x`-prefix without a leading zero (e.g. `mvi r0, xF`). The grammar only recognises `0x` form.

This gap is pre-existing, noted in `docs/research/lezer-grammar-lcc-assembly.md` §4 ("open gaps"). The tmLanguage.json `number` group also only covers `0x` form (its `number` repository entry covers `0x`-hex, `0b`-binary, decimal, negative decimal — same limitation).

---

## 7. LCC+ coverage vs vscode-lcc

| Token | lccjs tmLanguage | lccjs Lezer | vscode-lcc |
|-------|-----------------|-------------|------------|
| `.lccplus` | ✓ (`storage.type.directive.lcc`) | ✓ (`Directive`) | ✗ |
| `clear` | ✓ (`keyword.mnemonic.extension.lcc`) | ✓ (`MnemonicPlus`) | ✗ |
| `sleep` | ✓ | ✓ | ✗ |
| `nbain` | ✓ | ✓ | ✗ |
| `rand`  | ✓ | ✓ | ✗ |
| `srand` | ✓ | ✓ | ✗ |
| `millis`| ✓ | ✓ | ✗ |
| `resetc`| ✓ | ✓ | ✗ |
| `cursor`| ✓ | ✓ | ✗ |

vscode-lcc is a core-LCC-only extension; the LCC+ gaps there are intentional, not defects.

---

## 8. Summary — actionable gaps

| # | Gap | Severity | Artefact | Fix |
|---|-----|----------|----------|-----|
| G1 | `$` missing from Lezer `identStart`/`identCont` | **High** | `src/lang-lcc/lcc.grammar` | Add `"$"` to both token rules; rebuild |
| G2 | `$` missing from tmLanguage `label_ref` pattern | **Medium** | `docs/lcc.tmLanguage.json` | Add `$` to leading lookbehind + char class |
| G3 | 9 core mnemonics untested in grammar suite | **Medium** | `tests/new/grammar.unit.spec.js` | Add to `test.each` list in `core mnemonics` describe block |
| G4 | 5 branch mnemonics untested | **Medium** | `tests/new/grammar.unit.spec.js` | Add to `test.each` list in `branch mnemonics` describe block |
| G5 | 7 directives untested | **Medium** | `tests/new/grammar.unit.spec.js` | Add to `test.each` list in `directives` describe block |
| G6 | Bare `x`-prefix hex (`xF`) tokenises as Identifier | **Low** | `lcc.grammar`, `lcc.tmLanguage.json` | Add `"x" $[0-9A-Fa-f]+` to `Number` token; add `\bx[0-9A-Fa-f]+\b` to tmLanguage number group |

Gaps G3–G5 are test-coverage gaps only — the grammars already define the tokens correctly; there are just no red-green tests guarding them against regression.

Gaps G1 and G2 are real code bugs: `$`-prefixed labels are valid per the assembler and vscode-lcc but are not highlighted correctly by lccjs's grammars.

> **Correction note:** An earlier draft listed a G6 for a missing `ra` register alias. `ra` does not exist in LCC — the assembler only accepts `fp`, `sp`, `lr` as named aliases. The `lezer-grammar-lcc-assembly.md` §4 "open gaps" entry claiming `ra` is also incorrect.

---

## 9. Recommended child issues

| Issue | Type | Scope | Estimates |
|-------|------|-------|-----------|
| Fix `$` in Lezer `identStart`/`identCont` + add test | DEV | `lcc.grammar` + rebuild + test | H=15, C=10 |
| Fix `$` in `label_ref` pattern + add test | DEV | `lcc.tmLanguage.json` + grammar test | H=10, C=5 |
| Expand grammar test coverage — missing mnemonics + directives | TEST | `grammar.unit.spec.js` | H=20, C=10 |

The bare-`x` hex issue (G6) is a low-priority cosmetic fix; it can be folded into any upcoming grammar-touch PR rather than receiving a dedicated issue.

---

## 10. Cross-references

- `docs/research/lezer-grammar-lcc-assembly.md` — Lezer grammar design notes and prior open-gaps list
- `src/lang-lcc/lcc.grammar` — Lezer grammar source
- `docs/lcc.tmLanguage.json` — Shiki/TextMate grammar
- `tests/new/grammar.unit.spec.js` — Shiki-based token classification tests
- `vscode-lcc/syntaxes/lcc.tmLanguage.json` — reference grammar
- `vscode-lcc/src/rules.json` — reference mnemonic validPattern
- #850 — label definition fixture files
- #853 — `@`/`$` formatter fix (formatter regex already correct as of `src/utils/formatter.js:36`)
