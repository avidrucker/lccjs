# CodeMirror 6 Feature-Set Inventory

**Issue:** #749 (parent: #697)
**Role:** RESEARCH
**Date:** 2026-06-04
**Agent:** APPLE

---

## 1. Core editor features

All features in the #697 wishlist exist in the CodeMirror 6 ecosystem.

| Feature | Package | Notes |
|---------|---------|-------|
| Line numbers | `@codemirror/view` (`lineNumbers` extension) | Built-in; one-liner to add |
| Syntax highlighting | `@codemirror/language` + language package | Requires a language definition (see §3) |
| Code folding | `@codemirror/language` (`codeFolding` + `foldGutter`) | Built-in extension |
| Bracket matching | `@codemirror/language` (`bracketMatching`) | Built-in extension |
| Autocomplete | `@codemirror/autocomplete` | Custom `completionSource` for LCC mnemonics/registers (see §6) |
| Multi-cursor | `@codemirror/commands` | Part of default keybindings (`alt+click`, `ctrl+alt+down`) |
| Search/replace | `@codemirror/search` | Separate official package; adds search panel |
| Indentation | `@codemirror/language` (`indentUnit`), `@codemirror/commands` (`indentWithTab`) | `indentWithTab` replaces the current manual `keydown` workaround |
| Undo history | `@codemirror/commands` (`history`) | Built-in |
| Read-only mode | `@codemirror/state` (`EditorState.readOnly`) | First-class field, not a hack |

---

## 2. Extension / plugin ecosystem

**Official `@codemirror/*` packages** (all maintained by the CM team):

| Package | Purpose |
|---------|---------|
| `@codemirror/state` | Editor state model (required) |
| `@codemirror/view` | DOM view layer (required) |
| `@codemirror/language` | Language support, syntax trees, folding, bracket matching |
| `@codemirror/commands` | Default keybindings, history, indent, comment toggle |
| `@codemirror/search` | Search/replace panel |
| `@codemirror/autocomplete` | Autocomplete framework + snippets |
| `@codemirror/lint` | Linter UI (red squiggles + gutter markers) |
| `@codemirror/collab` | Collaborative editing support |
| `@codemirror/language-data` | Language detector metadata |
| `@codemirror/merge` | Side-by-side merge/diff view |
| `@codemirror/lsp-client` | Language Server Protocol client |
| `@codemirror/lang-*` | Language-specific packages (JS, Python, HTML, CSS, Java, C++, JSON, Markdown, Rust, PHP, XML — no assembly language) |

**Community-maintained packages relevant to this project:**

| Package | Purpose | Notes |
|---------|---------|-------|
| `@cmshiki/shiki` (uxiew/codemirror-shiki) | Shiki themes/highlighting inside CodeMirror | See §4 |
| `codemirror-textmate` (zikaari) | TextMate grammar bridge via WebAssembly | See §3 |
| `@lezer/generator` | Lezer grammar compiler (for custom language modes) | Official toolchain |

**What would need to be written from scratch for LCC assembly:**
- A Lezer grammar for the LCC language (see §3 — feasible given grammar size)
- A custom `completionSource` for mnemonic/register autocomplete (see §6)
- A `lineCommentToken` declaration (`;` prefix) for comment toggling

---

## 3. Language mode options — grammar reuse

**The `lcc.tmLanguage.json` CANNOT be consumed directly by CodeMirror 6.**

CodeMirror 6 uses its own [Lezer](https://lezer.codemirror.net/) parser, which requires a `.grammar` source file compiled to a Lezer parser table. Two paths exist:

### Path A — `codemirror-textmate` bridge (third-party, WASM)
The `codemirror-textmate` package (npm: `codemirror-textmate`, github: `zikaari/codemirror-textmate`) wraps TextMate grammars for use in CodeMirror 6. It depends on `onigasm` (an Oniguruma regex engine compiled to WebAssembly) for TextMate's regex dialect.

- **Pro:** Reuses the existing `lcc.tmLanguage.json` directly — zero porting work.
- **Con:** Adds a ~500KB WebAssembly dependency (`onigasm.wasm`) to every page load. WASM must load asynchronously before highlighting activates.
- **Verdict:** Viable but costly. Appropriate only if the TextMate grammar is expected to grow or keep evolving.

### Path B — Custom Lezer grammar (recommended)
The `lcc.tmLanguage.json` is small and well-structured: **14 patterns / 14 repository keys / 102 lines**. All patterns use simple regex matches — no recursive grammar rules, no lookaheads that Oniguruma alone handles. This grammar is straightforward to port to Lezer.

- **Estimated effort:** 2–4 hours for a complete Lezer grammar covering comments, directives, labels, registers, all mnemonic groups, numbers, strings, and the `*` PC reference.
- **Pro:** No WASM dependency; full CodeMirror 6 integration (syntax trees, folding, comment tokens, bracket matching all work out of the box).
- **Con:** One-time porting effort; Lezer syntax is different from TextMate — not zero-cost.
- **Verdict:** Recommended. The grammar is small enough that the porting cost is bounded and the result integrates cleanly.

**Recommendation:** Path B. Write the Lezer grammar (`src/lang-lcc/`) and deprecate `lcc.tmLanguage.json` from the CodeMirror integration path (Shiki can keep using it in the standalone preview panel or Shiki bridge — see §4).

---

## 4. Shiki / theme integration

**There is no `@uiw/codemirror-extensions-shiki` package.**

The documented integration is **`@cmshiki/shiki`** (package) from the GitHub project `uxiew/codemirror-shiki`. This package provides Shiki syntax highlighting rendered inside CodeMirror 6 — the highlighting decorations are applied by Shiki, not by a Lezer grammar.

**Implication for the playground architecture:**

| Architecture | Pros | Cons |
|---|---|---|
| **A — CodeMirror + `@cmshiki/shiki`** | One editor pane; Shiki colours apply in-editor; existing `lcc.tmLanguage.json` stays | `@cmshiki/shiki` API stability unclear; Shiki + CM bundle is larger; highlighting async on first load |
| **B — CodeMirror + Lezer grammar + separate Shiki preview** | CM handles editing (line numbers, indent, autocomplete); Shiki preview remains as-is | Two-panel layout remains; two grammar sources to maintain |
| **C — CodeMirror + Lezer grammar (no Shiki)** | Simplest; self-contained; no Shiki dependency | Colors come from Lezer/CM themes, not from Shiki TextMate scopes |

**Does `@cmshiki/shiki` collapse the need for the separate preview panel?** Potentially yes — but a proof-of-concept is needed to confirm the custom `lcc` language (registered via `lcc.tmLanguage.json`) works with `@cmshiki/shiki` in a CDN-loaded context. This is a **needs-more-work** answer. Filed as part of the #748 implementation spike.

**Recommendation for initial implementation (#748):** Architecture C — CodeMirror with a Lezer grammar and a built-in CM theme. This is the simplest integration path that removes the textarea limitations. The Shiki preview panel can be kept as-is (it works today) while the editor upgrade lands. Unifying to `@cmshiki/shiki` can be a follow-on ticket.

---

## 5. CDN / ESM loading story

**CodeMirror 6 CAN be loaded via `esm.sh` with no local build step.**

```js
// Minimal working CDN import (esm.sh)
import { EditorView, basicSetup } from 'https://esm.sh/codemirror@6';
```

**Bundle sizes (approximate, from CodeMirror docs and community benchmarks):**

| Configuration | Gzipped | Uncompressed |
|---|---|---|
| `minimalSetup` (state + view only) | ~75 KB | ~250 KB |
| `basicSetup` (all standard extensions) | ~130 KB | ~420 KB |
| Full (+ language + theme) | ~180 KB | ~700 KB |

For context, the current Shiki CDN import (`shiki@1` via `esm.sh`) is ~450 KB uncompressed.

**Known issue — dependency duplication on `esm.sh`:**
If you import `@codemirror/state` and `@codemirror/view` as separate CDN URLs, `esm.sh` may load duplicate copies (breaking shared state). The solution is one of:
1. **Import `codemirror` as a single bundle** — `import { ... } from 'https://esm.sh/codemirror@6'` resolves all deps from one entry point.
2. **Pin shared deps** using `esm.sh`'s `?deps=` parameter: `?deps=@codemirror/state@6.x.x,@codemirror/view@6.x.x`.
3. **Use `esm.sh/bundle`** — experimental bundled output that resolves deps at build time.

Option 1 (single bundle entry) is the simplest and is confirmed to work for CDN usage.

**Does this tie into a build step?** No. The existing playground has no build step (no webpack, no rollup) and the CDN path does not require one. The `lcc.bundle.js` is separate (provides the assembler/interpreter API surface) and is unaffected.

---

## 6. LCC-assembly UX specifics

| Feature | CodeMirror 6 support | Implementation notes |
|---------|---------------------|----------------------|
| Tab handling | `indentWithTab` from `@codemirror/commands` | Replaces the current `keydown` workaround entirely |
| Comment toggling (`;` prefix) | `toggleLineComment` from `@codemirror/commands` | Needs the LCC language definition to declare `lineComment: ";"` in the language description |
| Register autocomplete | `@codemirror/autocomplete` `completionSource` | Custom function returning `{label: "r0", type: "variable"}` … `r7` |
| Mnemonic autocomplete | `@codemirror/autocomplete` `completionSource` | Same mechanism; return all mnemonics with optional `detail` string |
| Directive autocomplete | Same | `.string`, `.word`, `.blkw`, `.org`, `.global`, `.extern`, `.lccplus`, etc. |
| Indentation aware of assembly | Custom `indentNodeProp` in the Lezer grammar | Operands should indent to a standard column |

The autocomplete framework is straightforward — no external package needed. The `completionSource` function receives the cursor context and returns a list of completions. The mnemonic and register sets are small and static, so the implementation is a simple lookup array.

---

## 7. Answering `#697` open questions

| #697 Question | Answer |
|---|---|
| **Library choice** — CM6 vs Monaco vs Ace for GitHub Pages, no build step? | **CodeMirror 6.** Monaco requires a separate worker bundle (~5MB) and is designed for VS Code-like tooling; loading via CDN is poorly documented. Ace is older (no ESM native support, legacy API). CM6 wins on bundle size, ESM/CDN loading, and extension architecture. |
| **Grammar reuse** — can `lcc.tmLanguage.json` be consumed directly? | **No — a custom Lezer grammar is needed.** The TextMate bridge (`codemirror-textmate`) exists but adds ~500KB WASM. Write a Lezer grammar instead (estimated 2–4h; grammar is only 14 patterns). |
| **Shiki integration** — is there a Shiki↔CM6 bridge that collapses the preview panel? | **`@cmshiki/shiki` exists but needs a proof-of-concept.** The integration is not `@uiw/codemirror-extensions-shiki` (no such package). Collapsing the preview panel is possible but not confirmed for the custom `lcc` language in a CDN context. Recommend shipping CM6 without this first. |
| **CDN loading** — esm.sh at view time, no build step? | **Yes.** Import `codemirror@6` as a single bundle from `esm.sh`. Avoid importing `@codemirror/*` as separate CDN URLs (duplication risk). No build step required. |
| **Bundle impact** — does the editor change `lcc.bundle.js` API surface? | **No.** The editor is purely UI; `lcc.bundle.js` provides `lcc.assemble/run` and is unchanged. |

---

## 8. Recommended implementation order for `#748`

1. Load CodeMirror 6 via `esm.sh` single-bundle entry (`codemirror@6`).
2. Replace the `<textarea>` with a CM6 `EditorView` using `basicSetup` (gives line numbers, undo, search, indent, bracket matching out of the box).
3. Wire the existing `textarea.value` reads to `editorView.state.doc.toString()`.
4. Carry over the manual `keydown` tab handler via `indentWithTab` (zero new code needed).
5. Write the Lezer grammar for LCC assembly as a follow-on ticket — use a plain CM theme until then (the editor works without language-specific highlighting).
6. Add mnemonic/register autocomplete via `@codemirror/autocomplete` (bounded follow-on, ~1–2h).
7. Revisit `@cmshiki/shiki` as an optional enhancement after steps 1–4 ship.
