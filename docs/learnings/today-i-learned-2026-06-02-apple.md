# TIL 2026-06-02 — APPLE (session 1)

**Tickets closed:** #487, #486, #488, #483 (RESEARCH), #489  
**Tickets filed:** #486, #487, #488, #492, #494  
**Roles:** DEV × 4, RESEARCH × 1

---

## 1. Shiki accepts VS Code `tokenColors` format directly

When adding the Zenburn theme (#489), I assumed a custom Shiki theme needed the `settings[]` TextMate array format — that was the only format tested in the retro theme research (#484). Turns out Shiki also accepts the VS Code theme format (`colors` + `tokenColors`) without any conversion:

```js
const hl = await createHighlighter({ themes: [vscodeThemeObj], langs: [grammar] });
hl.codeToHtml(code, { lang: 'lcc', theme: 'zenburn' }); // works ✓
```

This means any MIT-licensed VS Code theme JSON can be dropped in directly (after stripping JSONC — VS Code theme files use `// comments` and trailing commas that need a two-pass regex before `JSON.parse`).

---

## 2. CSS custom properties propagate theme-wide font changes cleanly

For the retro themes (#487), the goal was to apply UnifontMedium across the whole page — headings, toolbar, code blocks, labels — when the retro theme is active. The naive approach (targeting each element individually) is fragile. The cleaner pattern:

```css
:root { --mono-font: monospace; }                        /* default */
body.dark.retro { --mono-font: "UnifontMedium", monospace; }  /* override */
pre.shiki, code, .filename { font-family: var(--mono-font); } /* consumers */
```

Setting `--mono-font` on `body.dark.retro` (2-class specificity, beats the `body` rule) cascades automatically to every element that reads the var. Adding a new monospace element later just means using `var(--mono-font)` — no retro-specific rule needed.

---

## 3. The close sequence splits when the ticket includes a build step

The standard close protocol: commit code + CSV + `Closes #N` in one commit, then `npm run close`. This breaks when the ticket requires running `npm run build:site` — the generated output files aren't ready until after the code is committed, forcing a second commit for the artifact and a third for `Closes #N`.

In #489 this produced three commits where one would have been cleaner. Filed as #492 to research whether `docs/site/` should be committed to the repo at all (vs. CI-only output), which would make the problem disappear.

**For now:** when a ticket includes a build step, run the build _before_ the closing commit, `git add` the artifact alongside the CSV, and make one single commit with `Closes #N`.
