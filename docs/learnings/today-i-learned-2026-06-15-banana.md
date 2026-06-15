# TIL 2026-06-15 — BANANA

**Context:** A chain of three sandbox-editor (CodeMirror 6) selection bugs, each
surfaced by the previous one's fix: #1339 (multi-line selection invisible),
#1347 (palette-derived selection/active-line colors), and #1355 (partial/mid-line
selection masked — a regression I introduced in #1347). The recurring theme is
CM6's selection-layer stacking order, and the recurring *mistake* is verifying
the convenient path instead of the real one.

---

## 1. CM6 paints the selection in a layer *behind* the content (z-index −2)

**What happened:** In #1339 the playground editor showed no selection highlight
at all when you dragged across lines. The selection rects were in the DOM (I
measured one at 254px wide) but invisible. CM6's `drawSelection()` renders the
selection into `.cm-selectionLayer`, and that layer's z-index is computed as
`(above ? 150 : -1) - pos` — for the selection layer that lands at **−2**, i.e.
*below* `.cm-content` (which `baseTheme` pins at `zIndex: 0`). The playground had
put an opaque `background` on `.cm-content`, so the content tile completely
covered the selection beneath it. Fix: move the background to `.cm-scroller`
(the parent of *both* the content and the selection layer) and keep `.cm-content`
transparent.

**What I learned:** In CM6 the on-screen stack, bottom to top, is: scroller
background → `.cm-selectionLayer` (z −2) → `.cm-content` (z 0, holding the text
*and* `.cm-activeLine`) → `.cm-cursorLayer`. Anything opaque you paint at or
above z 0 will hide the selection. That single fact explains all three tickets.

**The rule:** **In CM6, never paint an opaque background on `.cm-content` or
`.cm-activeLine` — the selection layer sits behind them at z-index −2 and will be
masked. Put editor backgrounds on `.cm-scroller`.** (Authority: #1339; gotcha
home is the closing comments of #1339/#1347/#1355.)

---

## 2. The active-line highlight will mask a partial selection on the cursor's line

**What happened:** #1347 made the active-line highlight palette-derived — each
theme's own `editor.lineHighlightBackground`, which is *opaque* on most themes
(github-dark `#2b3036`). That background lives inside `.cm-content` at z 0, above
the selection layer. So when you select a few words **on the line your cursor is
on** — which is every single-line selection — the opaque active-line tile hides
the selection. Fully-selected *non-active* lines still showed, which is exactly
the confusing "only whole lines highlight" symptom the user reported in #1355.
Fix (what VS Code does): suppress the active-line highlight while a non-empty
selection exists. An `EditorView.updateListener` toggles a `cm-has-selection`
class on the editor DOM; a CSS rule drops `.cm-activeLine` background to
transparent while that class is present. No bundle change — `EditorView` was
already exported.

**What I learned:** "active line" and "selection" are two backgrounds competing
for the same pixels on one line, and CM resolves it by z-order, not by blending.
CM's *default* active-line color (`#cceeff44`) gets away with it only because the
`44` alpha lets the selection bleed through; the moment you swap in opaque
theme colors you have to actively hide the active line during selection.

**The rule:** **When a per-theme active-line color may be opaque, suppress the
active-line highlight while any selection is non-empty (toggle a class from an
`updateListener`).** (Authority: #1355.)

---

## 3. I shipped that regression because I verified the scriptable path, not the real one

**What happened:** #1347's closing note *explicitly flagged* the active-line
masking risk — and then dismissed it as "acceptable" without testing it. My
in-browser verification drove `Ctrl+A` (select-all) because it's the one-liner
that's easy to script with Playwright. With select-all, the cursor lands on the
last line and its partial selection happened to remain visible, so the screenshot
looked fine. I never did the thing a human does a hundred times an hour: drag
across a few words mid-line. That untested gesture was the whole bug. The user
caught it in minutes.

**What I learned:** "Verified in a browser" (the #985–987 discipline) is
necessary but not sufficient. *Which* interaction you verify matters as much as
verifying at all, and the convenient-to-automate gesture is often the one that
hides the bug. I logged this as a process error (errors row 269) and filed #1360
to codify the rule.

**The rule:** **Verify the common human interaction path, not just the one that's
convenient to script — a scripted `Ctrl+A` is not a substitute for a plain
mid-line word selection.** (Authority: #1360, proposed RULES.md/checklist
addition; error row 269.)

---

## 4. Backticks inside the build-site browser-script template literal break the build

**What happened:** Mid-fix on #1355, `npm run build` died with
`ReferenceError: activeLine is not defined`. `scripts/build-site.js` assembles
the entire browser-side script as one big JS **template literal**, and I'd
written a code comment containing `` `.cm-activeLine` `` — the backticks closed
the outer template string, turning the rest of my comment into live code. Caught
it on the first build and replaced the backticks with plain text.

**What I learned:** Anything I type into the browser-script region of
`build-site.js` — *including comments* — is inside a template literal. A stray
backtick or `${...}` is not inert there; it's parsed.

**The rule:** **Inside the `build-site.js` browser-script template literal, never
use backticks or `${...}` in code or comments — they break out of the template
string.** (Authority: #1355; error row 270.)

---

## Bonus: themes already carry their own selection colors

A nice discovery in #1347: Shiki theme objects expose a `.colors` workbench map,
and 9 of our 11 themes ship `editor.selectionBackground` and
`editor.lineHighlightBackground` — the theme author's *own* chosen chrome colors.
Deriving the editor's selection/active-line from those (precomputed at build time
into `LCC_THEME_STYLES`, with an fg-overlay fallback for the two custom retro
themes) beats hand-picking colors. The data source was already there.

## What landed

| Issue | Change |
|---|---|
| #1339 | Move editor bg `.cm-content` → `.cm-scroller`; selection visible again |
| #1347 | Palette-derived selection + active-line colors from theme workbench colors |
| #1355 | Suppress active-line highlight during selection (regression fix) |
| #1360 | (filed) Proposed verification-discipline rule |

## Related artifacts

- Issues #1339, #1347, #1355, #1360
- Errors rows 269 (the regression), 270 (the build break)
- [`docs/showcase-local-dev.md`](../showcase-local-dev.md) — in-browser verification checklist
