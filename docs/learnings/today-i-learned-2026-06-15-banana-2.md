# TIL 2026-06-15 — BANANA (session 2: showcase theming)

**Context:** A four-ticket arc that made the GitHub Pages site (`scripts/build-site.js`) fully theme-aware: docs pages stopped forcing light mode (#1334), the sandbox's terminal/input surfaces started following the active code theme's palette (#1333), the two competing theme controls were unified into one dropdown (#1379, pair-work), and docs-prose code blocks stopped rendering as white "islands" on dark pages (#1388, pair-work). Every change shipped with a generator regression test and browser verification against the *built* page. (Session 1 that day was the CM6 selection-layering TIL, #1359.)

---

## 1. A baked `<body>` class silently shadows the pre-paint `<html>` theme

**What happened:** Docs pages were generated with a hardcoded `bodyClass: 'light'`. The head script correctly set `<html class="dark">` *before* paint, yet the page still rendered light. The CSS defines the theme variables on **both** `html.X` and `body.X` (`html.dark, body.dark { --bg:… }`). Because `<body class="light">` redefines `--bg`/`--fg` *on the body element*, it wins for everything inside `<body>` over the correct `html.dark` values — a cascade-proximity shadow, not a specificity bug.

**What I learned:** When the same custom properties are declared on two nested ancestors, descendants resolve the **nearer** ancestor's values — so a "harmless" baked class on `<body>` can quietly override a JS-set class on `<html>`. The fix wasn't to fight it with specificity; it was to bake **no** theme class on `<body>` and let the pre-paint `<html>` class drive (which also removed a FOUC).

**The rule:** **If theme vars live on both `html.X` and `body.X`, set the class on only one element — a baked `<body>` class shadows a JS-driven `<html>` class.**

---

## 2. A backtick in a comment inside a template literal breaks the build

**What happened:** `build-site.js` embeds whole browser scripts as template-literal constants (``const JS = `…` ``). I added a code comment that referred to a variable as `` `sel` `` — the backticks closed the literal early and produced `SyntaxError: Unexpected identifier 'sel'` at `npm run build`, nowhere near the edit.

**What I learned:** Inside these embedded scripts, comments are *not* inert — backticks and `${` are still template-literal syntax. Easy to forget because the comment "looks like" a comment.

**The rule:** **In `build-site.js` embedded-script template literals, never put backticks or `${` in comments or strings.** Filed #1409 to capture this in `docs/project-gotchas.md`.

---

## 3. `replace_all` matches the exact string, leading whitespace included

**What happened:** Two `bodyClass: 'light'` lines needed changing. `replace_all` reported "all occurrences replaced," but a regression test still failed — one line had 8-space indentation, the other 6, so my single old-string only matched one.

**What I learned:** "All occurrences" means all occurrences of the *exact* string. Differing indentation = different strings. The red test (kept red on one assertion) is what caught it, not my eyes.

**The rule:** **Don't trust `replace_all` to catch siblings that differ by whitespace — verify the count, or keep a test red until every site is fixed.**

---

## 4. Theme a surface through a CSS variable, not an inline property — so error colors survive

**What happened (#1333):** The sandbox output pane and stdin used `var(--border)`/`var(--fg)` (page light/dark) instead of the editor's actual theme palette, so on Monokai the editor was olive but the terminal was generic github-dark. I pointed the surfaces at a new `--surface-bg`/`--surface-fg` pair, set by JS from the same precomputed `LCC_THEME_STYLES[theme]` the editor's `chromeTheme()` uses.

**What I learned:** Driving the color through a **CSS custom property** (not an inline `color:`) was what kept the `.lcc-error` red working — `#exec-output.lcc-error { color:#cf222e }` still wins by specificity over `color:var(--surface-fg)`, whereas an inline color would have clobbered it. The var-indirection wasn't cosmetic; it preserved a feature.

**The rule:** **Theme a surface through a CSS variable, not an inline property, so higher-specificity state rules (errors, selection) still override it.**

---

## 5. One un-themed surface hides behind another — fixing chrome exposes the next layer

**What happened:** #1334 unfroze the docs page background; #1379 gave docs the full theme dropdown. Only *then* did the github-light-baked code blocks become visible white islands on a dark page (#1388). The bug existed all along; making the chrome theme-aware is what surfaced it.

**What I learned:** Each layer I themed revealed the next un-themed layer. The right move was to **file the follow-up (#1388) and keep scope tight**, not expand the current ticket to chase the newly-visible defect. Each closing comment named what it did *and didn't* cover.

**The rule:** **When a fix exposes an adjacent defect, file it as a follow-up and note the boundary in the close — don't let scope creep across surfaces.**

---

## 6. Decide design forks in writing before executing — even small ones

**What happened:** #1379 (remove the toggle? group the dropdown? default theme?) and #1388 (all-11 theme variants vs a dark/light pair?) each had a real design fork. Both were `pair-work`: I surfaced options with a recommendation and evidence, captured the human's ruling as a comment *first*, then implemented exactly that.

**What I learned:** Separating the "decide" turn from the "execute" turn (architect-then-courier) kept me from quietly re-designing mid-implementation. #1379's all-11 choice also reused the landing page's existing `.theme-panel` switch, so the docs-code-block fix (#1388) needed **zero new JS** — a payoff from settling the mechanism up front.

**The rule:** **Post the ruling comment before writing code; the design decision and its rationale must live in the tracker, not just in the diff.**

---

## What landed

| Ticket | Change | File |
|---|---|---|
| #1334 | docs pages bake no body theme class; mirror `<html>`→`<body>` on load | `scripts/build-site.js` |
| #1333 | surfaces follow code-theme palette via `--surface-bg/--surface-fg` | `scripts/build-site.js` |
| #1379 | removed `#theme-toggle`; dropdown is the single control on every page | `scripts/build-site.js` |
| #1388 | `lcc` fenced blocks emit per-theme `.theme-panel` variants | `scripts/build-site.js` |

Each shipped a generator regression test in `tests/new/showcase.spec.js` and was browser-verified with playwright **computed-style** probes against the built page (`npm run build && npm run serve:site`) — source reading is explicitly insufficient here per CLAUDE.md.

## Open threads

- #1409 — promote the template-literal backtick foot-gun into `docs/project-gotchas.md`.

## Related artifacts

- Issues #1334, #1333, #1379, #1388, #1409
- [Session 1 this day — CM6 selection layering](./today-i-learned-2026-06-15-banana.md) (#1359)
