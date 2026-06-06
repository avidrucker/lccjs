# Lezer Grammar for LCC Assembly — Design Notes and Integration Path

**Issue:** #751 (tracker) · spike deliverable for child #754
**Role:** RESEARCH / SPIKE
**Date:** 2026-06-04
**Agent:** ELDERBERRY

---

## 1. What is Lezer and why it was chosen

[Lezer](https://lezer.codemirror.net/) is CodeMirror 6's built-in incremental LR parser. Every CM6 language integration that wants first-class features (syntax highlighting via `styleTags`, `toggleLineComment`, code folding, bracket matching) must supply a Lezer grammar — there is no supported path that bypasses it.

Two alternative paths were evaluated in `docs/research/codemirror-feature-inventory.md` §3:

| Path | Approach | Verdict |
|------|----------|---------|
| **A — `codemirror-textmate`** | Wraps `lcc.tmLanguage.json` via Oniguruma WASM | Rejected: ~500 KB WASM; async load; overkill for a 14-pattern grammar |
| **B — Custom Lezer grammar** | Port `lcc.tmLanguage.json` to `@lezer/generator` | **Chosen**: zero extra deps; full CM6 integration; grammar is small enough to port manually |

The LCC grammar has only 14 TextMate patterns — all simple regex matches, no recursive rules, no lookaheads — making Path B straightforward.

---

## 2. Grammar structure

The compiled grammar lives at `src/lang-lcc/lcc.grammar` (94 lines). Its shape:

```
Program → statement*
statement → Comment newline
          | LabelDef instr? Comment? newline
          | instr Comment? newline
          | newline
instr → Directive operand*
      | MnemonicIO operand*
      | MnemonicBranch operand*
      | MnemonicCore operand*
      | MnemonicPlus operand*
      | Identifier operand*        ← fallback for unknowns / future additions
operand → "," | Register | Number | StringLiteral | CharLiteral | PcRef | Identifier
```

Whitespace (spaces and tabs) is skipped implicitly via `@skip { spaces }`. Newlines are explicit — they close statements, which means an unclosed statement on the last line does not crash the parser (Lezer is error-tolerant by default).

---

## 3. Token inventory

16 term IDs generated from the grammar (from `src/lang-lcc/lcc.terms.js`):

| Term ID | Name | CM `styleTags` mapping |
|---------|------|------------------------|
| 1 | `Program` | (node, not coloured) |
| 2 | `Comment` | `tags.comment` |
| 3 | `LabelDef` | `tags.definition(tags.labelName)` |
| 4 | `DotWord` | (specialised into Directive or falls back) |
| 5 | `Directive` | `tags.keyword` |
| 7 | `Identifier` | `tags.name` |
| 8 | `Register` | `tags.variableName` |
| 9 | `Number` | `tags.number` |
| 10 | `StringLiteral` | `tags.string` |
| 11 | `CharLiteral` | `tags.character` |
| 12 | `PcRef` | `tags.special(tags.variableName)` |
| 13 | `MnemonicIO` | `tags.operatorKeyword` |
| 14 | `MnemonicBranch` | `tags.controlKeyword` |
| 15 | `MnemonicCore` | `tags.keyword` |
| 16 | `MnemonicPlus` | `tags.atom` |

Term 6 is unused (Lezer allocates an ID for the anonymous `instr` rule).

The five mnemonic groups (`MnemonicIO`, `MnemonicBranch`, `MnemonicCore`, `MnemonicPlus`, and `Directive`) are produced with Lezer's `@specialize<base, "keyword" | ...>` syntax — the tokenizer recognises an `Identifier` or `DotWord` first, then the specialisation table narrows it to the appropriate group. This is idiomatic Lezer and avoids building a lookup table in userland.

---

## 4. Design decisions worth preserving

**Debug mnemonics omitted.** `m`, `r`, `s`, and `bp` are absent from `MnemonicCore`. Their single-letter forms (`m`, `r`, `s`) are indistinguishable from label references without forward context the tokenizer cannot efficiently have. They remain coloured as plain `Identifier` (greyish in most themes), which is acceptable — mislabelling them as mnemonics when they appear as operands would be worse.

**LabelDef beats Identifier via maximal munch.** `LabelDef` is defined as `identStart identCont* ":"`. Because it is longer than `Identifier` (which has no trailing `:`), the Lezer tokenizer's maximal-munch rule selects it first. No explicit precedence annotation needed.

**`@precedence` order in `@tokens`.** The declared order is `Comment > StringLiteral > CharLiteral > DotWord > Number > LabelDef > PcRef > Identifier`. This matters for tokens that share a prefix: a `;` always opens a comment (never part of an identifier), a `"` always opens a string, and `.` always starts a `DotWord` rather than a label.

**Numeric literals cover three bases.** `0x`-prefixed hex, `0b`-prefixed binary, and plain decimal (with optional leading `-`). The LCC ISA uses `x`-prefixed hex *without* a leading `0` (e.g., `xF`), but the grammar handles `0x` form only. Programs that use bare `x1F` operands tokenise those as `Identifier`. This is a known limitation — see "Open gaps" below.

**Register aliases `fp`, `sp`, `lr` are correctly included.** The grammar recognises all three assembler-level aliases (`fp`→r5, `sp`→r6, `lr`→r7). There is no `ra` alias in the LCC ISA — earlier drafts of this document falsely listed `ra` as a missing alias; that claim is retracted.

---

## 5. Build pipeline

```
src/lang-lcc/lcc.grammar
    │
    │  npx @lezer/generator lcc.grammar -o lcc.js
    ▼
src/lang-lcc/lcc.js          ← compiled parser tables (lezer-generator 1.8.0)
src/lang-lcc/lcc.terms.js    ← exported term-ID constants
    │
    │  src/lang-lcc/index.js wraps in LanguageSupport
    ▼
src/lang-lcc/index.js        ← Node.js entry (imports from '@codemirror/language')

    │
    │  docs/site/dist/lang-lcc.js is a CDN-ready variant
    │  with full esm.sh URLs inlined (no local imports)
    ▼
docs/site/dist/lang-lcc.js   ← browser CDN bundle
```

Rebuild after grammar changes:
```bash
npm run build:lang-lcc
```

---

## 6. Integration path into the CM6 playground (from #791)

**Current state (as of 2026-06-04):** `docs/playground/index.html` loads CM6 via `basicSetup` only — no language extension, no `toggleLineComment`, no coloured tokens. The `lang-lcc.js` CDN bundle exists at `docs/site/dist/lang-lcc.js` but is not yet imported by the playground.

**What needs to happen to wire it in:**

```js
// 1. Import the CDN bundle (relative path, or host-relative)
import { lcc } from '../dist/lang-lcc.js?external=@codemirror/language,@lezer/lr,@lezer/highlight';

// 2. Import the remaining CM6 deps already used in the playground:
import { syntaxHighlighting, defaultHighlightStyle } from
  'https://esm.sh/@codemirror/language@6?deps=@codemirror/state@6';

import { toggleLineComment } from
  'https://esm.sh/@codemirror/commands@6?deps=@codemirror/state@6';

// 3. Add to the baseExtensions array:
const baseExtensions = [
  basicSetup,
  lcc(),                                               // Lezer language + highlighting
  syntaxHighlighting(defaultHighlightStyle),           // token → colour mapping
  keymap.of([
    indentWithTab,
    { key: 'Mod-/', run: toggleLineComment },          // Ctrl-/ (Win/Linux) Cmd-/ (Mac)
  ]),
];
```

The `?external=` query string tells `esm.sh` to treat `@codemirror/language`, `@lezer/lr`, and `@lezer/highlight` as peer deps — they must be loaded once from the same URLs used elsewhere in the page. Without this pin, `esm.sh` loads duplicate copies that fail the CM6 shared-state check.

**Dependency deduplication rule:** all `@codemirror/*` and `@lezer/*` imports on the page must use the same pinned version string (currently `@6`) and the same `?deps=@codemirror/state@6` resolver chain. Mixing `@codemirror/language@6.10.x` with `@codemirror/language@6` creates duplicate module instances that cause `instanceof` checks to silently fail.

---

## 7. Open gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| Playground (`docs/playground/index.html`) does not import `lang-lcc.js` | High | Integration is one `import` + three extension lines (see §6); tracked in #791 |
| Bare `x`-prefixed hex literals (`xF`, `x1F`) tokenise as `Identifier` | Low | LCC convention; fix by adding `"x" $[0-9A-Fa-f]+` to `Number` token rule |
| Grammar does not cover LCC+ `.lccplus` directive operand shape | Cosmetic | Directive is recognised; operands fall through to generic `Identifier` |
| Browser CDN test blocked in CI (esm.sh unreachable from headless Chromium) | Medium | Node.js parse test covers grammar correctness; CDN integration requires a live browser |

---

## 8. Cross-references

- `docs/research/codemirror-feature-inventory.md` §3 — Path A vs Path B decision rationale
- `src/lang-lcc/lcc.grammar` — full grammar source
- `src/lang-lcc/index.js` — `LanguageSupport` wrapper with `styleTags`
- `docs/site/dist/lang-lcc.js` — CDN bundle (browser entry point)
- #749 — CM6 feature-set inventory (parent research)
- #754 — DEV: Lezer grammar implementation (closed)
- #755 — DEV: register + mnemonic autocomplete (closed)
- #791 — open: playground still needs `lang-lcc.js` wired in
