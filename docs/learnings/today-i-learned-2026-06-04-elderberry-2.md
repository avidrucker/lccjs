# Today I Learned — 2026-06-04 (ELDERBERRY, session 2)

Date: 2026-06-04
Context: Session covering #753 (@cmshiki/shiki CDN PoC), #718 (calibration drift
decision), and #754 (Lezer grammar for LCC assembly). All three closed today.

---

## 1. Lezer's `@specialize` uses angle brackets, not curly braces — and lives inside grammar rules

The `@lezer/generator` docs and README show `@specialize` used in two forms, and they are
*not* interchangeable:

**Top-level (external tokenizer):**
```
@specialize { ExternalToken, "kw1" | "kw2" }
```
Used only when you have `@external tokens` defined in a separate JS file. Curly braces.

**Inline (inside a grammar rule expression):**
```
Mnemonic { @specialize[@name=MnemonicCore]<Identifier, "add" | "halt"> }
```
Angle brackets `<>`, lives inside a rule body. This is the form you want for keyword
specialisation without an external tokenizer.

Trying to use `@specialize[@name=X] { Token, "kw" }` at the top level raises
`Unexpected token '@specialize'` — the curly-brace form is parsed as an external
specializer declaration, and its grammar is different. The error message points at the
second `@specialize` line, making it look like a "duplicate rule" problem when it's
actually a syntax form mismatch.

**Multiple `@specialize<>` from the same base token (e.g., `Identifier`) ARE allowed**
as long as each one appears in a different grammar rule position with a different
`@name`. The generator produces distinct terminal types for each group — exactly what
you need for per-group syntax highlighting.

---

## 2. `@cmshiki/shiki` major-version history matters: v0.1.0 = shiki@1, v0.2.0 = shiki@3

`@cmshiki/shiki` has exactly two published versions:

| Package version | Shiki peer dep | Release |
|-----------------|---------------|---------|
| 0.1.0 | `^1.18.0` | Sep 2024 |
| 0.2.0 | `^3.0.0` | Mar 2026 |

The existing playground used `shiki@1` from esm.sh. Using `@cmshiki/shiki@0.2.0`
(current) requires `shiki@3`. These are NOT interchangeable at the CDN URL level —
`esm.sh/shiki@1` vs `esm.sh/shiki@3` serve different APIs.

The PoC (#753) confirmed that `shiki@3` `createHighlighter` accepts raw TextMate grammar
JSON directly (fetch + parse, no `path` property) and works fine in a browser CDN context.
The `@cmshiki/shiki` extension applies highlighting asynchronously via `requestIdleCallback`
— there is a brief delay before colours appear, which is expected behaviour.

---

## 3. esm.sh CDN deduplication for CodeMirror requires `?external=` + an import map

When loading a CodeMirror extension from esm.sh alongside `codemirror@6`, the extension
may depend on `@codemirror/state` and `@codemirror/view`. If esm.sh bundles those deps
into the extension's module, you end up with *two instances* of `@codemirror/state` —
and CM6 extensions silently fail to wire up (they use Facet identity, which breaks across
instances).

The working pattern:
```html
<script type="importmap">
{
  "imports": {
    "@codemirror/state": "https://esm.sh/@codemirror/state@6",
    "@codemirror/view":  "https://esm.sh/@codemirror/view@6"
  }
}
</script>

<script type="module">
// Tell esm.sh to NOT bundle @codemirror/* — use bare specifiers instead,
// which the import map then resolves to the shared instances above.
import { shikiToCodeMirror }
  from 'https://esm.sh/@cmshiki/shiki?external=@codemirror/state,@codemirror/view';
</script>
```

The `?external=` query parameter is esm.sh-specific: it rewrites the module's internal
imports for those packages to bare specifiers, which the browser's import map then
intercepts. Without it, esm.sh bakes absolute pinned URLs into the bundle and the import
map cannot help.

---

## 4. Genuine calibration drift shows up when h_min is *falling* while |delta_c| rises

The Q28r analysis (#706) used a partial correlation: `|delta_c|` vs row order,
*controlling for h_min*. The key finding was that ELDERBERRY's h_min was *falling*
(mean 34m early → 27m late) while `|delta_c|` was rising. That combination rules out
"harder puzzles" as an explanation — drift was in the C estimate itself.

The root cause: I was anchoring `c_min` as a fraction of `h_min` (roughly h/3) rather
than to my actual wall-clock actuals. As h_min varied, c_min drifted with it, inflating
error even when actual completion times stayed stable at 1–8m.

**Corrected approach:** set `c_min` from the role's median actual, with a 1–3m variance
buffer. Do not scale with H. The corrected priors are documented in
`docs/puzzle-velocity.md` and in memory (`elderberry_c_min_priors.md`).

---

## 5. Lezer's compiled parser tables are just data — safe to commit and serve from CDN

The output of `lezer-generator` (`lcc.js`) is a plain JavaScript module:

```js
import {LRParser} from "@lezer/lr"
const spec_Identifier = {__proto__:null, add:30, sub:30, ...}
export const parser = LRParser.deserialize({ version:14, states:"...", ... })
```

The serialized state machine is a compact string — the full LCC grammar compiles to
~1 KB of parser data. This file is safe to commit (it changes only when the grammar
changes), and it can be served directly from a local path in the browser without any
special tooling. The CDN-friendly wrapper (`docs/site/dist/lang-lcc.js`) simply copies
the tables inline and replaces `@lezer/lr` with its full esm.sh URL.

---

## What landed

| Ticket | Role | Change |
|--------|------|--------|
| #751 | PM | Tracker verified — all 4 children (#752–#755) filed; no direct work |
| #753 | SPIKE | @cmshiki/shiki PoC: PASS — custom lcc grammar works via esm.sh CDN |
| #718 | PM | Calibration drift decision: recalibrate + docs note; corrected per-role c_min priors |
| #754 | DEV | Lezer grammar for LCC assembly; LanguageSupport + toggleLineComment wired into showcase |
| #768 | PM | Filed: pin shiki CDN version to @3, extract to constant |
