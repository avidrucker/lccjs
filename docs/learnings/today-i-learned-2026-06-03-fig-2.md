# TIL 2026-06-03 (FIG-2) — Showcase playground: Shiki lang-ID and textarea UX

## Context

Implementing #602: live-edit textarea with Shiki syntax highlighting on
`docs/showcase/index.html`. Verified in headless Chrome via Playwright.

---

## 1. Shiki v1 registers custom grammars under `name`, not `scopeName`

When loading a custom TextMate grammar:

```js
createHighlighter({ langs: [grammar], themes: ['github-dark'] })
```

Shiki v1 registers the language under `grammar.name`. Our grammar has:

```json
{ "name": "lcc", "scopeName": "source.lcc", ... }
```

So the correct call is `lang: 'lcc'`, not `lang: 'source.lcc'`. The showcase page
uses `lang: 'source.lcc'` throughout. In headless Chrome this fails:

```
Highlight error: Language `source.lcc` not found, you may need to load it first
```

This affects all four sections (three static + new playground). The page appears
to work on GitHub Pages — likely because the browser caches a Shiki bundle that
registers aliases differently, or because production fetches a slightly different
CDN bundle. Needs a targeted fix: change `codeToHtml` calls to `lang: 'lcc'`,
or align the grammar's `name` to `source.lcc`. Filed as #603.

---

## 2. Tab key moves focus out of a code-editing textarea

Default browser behavior: Tab in a textarea shifts focus to the next element.
For a syntax-highlight playground, visitors expect Tab to indent. The fix is a
`keydown` listener that intercepts Tab, calls `event.preventDefault()`, and inserts
four spaces via selection-range manipulation. Filed as #604.

---

## Implementation notes for #602

| Detail | Decision |
|---|---|
| Layout | CSS Grid 1fr 1fr, collapses to single column at 680 px |
| Min height | Both panels 320px — even when code is short |
| Populate timing | textarea.value = STARTER_CODE before await — visible instantly |
| Debounce | 150 ms setTimeout on input — matches issue spec |
| Scope | renderPlayground closes over hl inside main() — no globals added |
| Error path | status-playground shows Shiki errors in red, consistent with static sections |
