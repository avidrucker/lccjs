# Spike: LCC syntax highlighting via Shiki (#127)

**Authored:** 2026-06-01 · agent ELDERBERRY · ≤60m

---

## Grammar assessment

The `lcc-tools` VS Code extension grammar referenced in the issue/TODOS does **not yet
exist as a committed file** in this repo — `.gitattributes` and TODOS.md both reference
it aspirationally. The grammar I drafted for this spike (`docs/lcc.tmLanguage.json`)
is therefore the first concrete artifact.

The grammar covers the full token set found by surveying ~60 `.a` and ~17 `.ap` files:

| Scope | What it matches |
|---|---|
| `comment.line.semicolon.lcc` | `;` to end of line |
| `entity.name.label.lcc` | `label:` definitions (including `@`-prefixed labels) |
| `keyword.other.directive.lcc` | `.start` `.org` `.word` `.fill` `.string[z]` `.asciz` `.zero` `.space` `.blkw` `.lccplus` `.extern` `.global` |
| `keyword.control.branch.lcc` | `br` `bral` `brz` `brnz` `bre` `brne` `brn` `brp` `brlt` `brgt` `brc` `brb` `jmp` `jsr` `jsrr` `bl` `blr` `call` `ret` |
| `keyword.mnemonic.lcc` | arithmetic/logic/shift/move/load/store/stack/debug (`add` `sub` … `halt` `bp`) |
| `support.function.io.lcc` | I/O traps: `dout` `udout` `hout` `aout` `sout` `nl` `din` `hin` `ain` `sin` |
| `keyword.mnemonic.extension.lcc` | LCC+ pseudo-instructions: `clear` `sleep` `nbain` `rand` `srand` `millis` `resetc` `cursor` |
| `variable.language.register.lcc` | `r0`–`r7` · `fp` · `sp` · `lr` |
| `string.quoted.double.lcc` | `"…"` with escape support (`\n`, `\"`, etc.) |
| `string.quoted.single.lcc` | `'x'` character literals |
| `constant.numeric.hex.lcc` | `0x…` |
| `constant.numeric.decimal.lcc` | signed/unsigned integers |
| `variable.other.label.lcc` | identifier references (catch-all, includes `label+offset` like `x+1`) |

**Shiki compatibility:** Shiki accepts a TextMate grammar JSON directly (no build step).
The drafted grammar is drop-in ready for `createHighlighter({ langs: [lccGrammar] })`.

**Known limitation:** The single-letter mnemonics `m` (dump memory) `r` (dump registers)
`s` (dump stack) were omitted in the original spike draft — see `docs/lcc.tmLanguage.json`
for the corrected grammar that adds them (fixed in #458). They are anchored with a
start-of-field pattern to avoid over-matching label references.

---

## Approach A: GitHub Pages docs site + Shiki

**Effort:** ~4–6h to bootstrap. Needs: a static site generator (Astro/Vite or bare HTML),
a `highlight.js`-style wrapper around `shiki@^1`, and a curated set of `.a`/`.ap` code
examples to showcase.

**Maintenance:** Low after initial setup. Grammar updates ripple automatically if the
grammar JSON is kept in the repo and the build imports it. Hosting on GitHub Pages is
free and CI-driven (push → Pages rebuild).

**Who benefits:** Everyone — public visitors, students, anyone who clicks a GitHub Pages
link. No install required.

**Hosting/build implications:** Adds a `docs/` build step or a separate `pages` branch.
If Astro: ~5 MB node_modules in Pages workflow, trivial. If bare HTML + ESM Shiki: even
simpler, no bundler.

**Recommendation: pursue this.** One-time build, permanent public win.

---

## Approach B: Tampermonkey userscript

**Effort:** ~1–2h. Inject Shiki via CDN, detect `github.com/*/lccjs/*.a` URLs, replace
GitHub's `<code>` block with a Shiki-rendered `<div>`.

**Maintenance:** Fragile — GitHub can change DOM layout. Shiki CDN version must be pinned
or updates can silently break the script.

**Who benefits:** Only the person who installs the userscript. Public visitors see the
stock `asm` grammar.

**Recommendation: skip for now.** The effort is similar to approach A's first milestone
(get Shiki rendering LCC), but the payoff is private and brittle. Could be offered later
as a developer convenience, but not the primary deliverable.

---

## Recommendation

**Do approach A (GitHub Pages + Shiki).** The grammar drafted here is the foundation.
The recommended decomposition:

1. **Commit the grammar** to a stable path (e.g. `docs/lcc.tmLanguage.json`) and update
   `TODOS.md` — this closes #127 (the spike) and de-risks A.
2. **Build puzzle:** set up a minimal Astro (or plain Vite) GitHub Pages site that imports
   the grammar and renders 3–5 curated `.a`/`.ap` snippets. ~3–4h / SPIKE → DEV.
3. **Stretch puzzle:** add the Tampermonkey script as an optional install once the grammar
   is proven in Pages.

Neither Linguist submission nor Tampermonkey are blocking — approach A lands public
highlighting with zero user-install friction.
