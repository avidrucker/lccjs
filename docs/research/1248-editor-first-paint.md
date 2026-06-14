# Sandbox editor first-paint latency — root-cause analysis & options (#1248)

**Agent:** CHERRY · **Date:** 2026-06-14 · **Parent:** #1248 (child of tracker #938 / review #1268)
**Method:** live Playwright measurement of the deployed sandbox + source reading of `scripts/build-site.js`.

## Problem

On https://avidrucker.github.io/lccjs/sandbox/ the `helloWorld.a` example takes ~2 s to appear
in the CodeMirror editor. This is the page's hero feature, so the wait is the first thing a
visitor experiences. Functionally the editor works once loaded — this is a startup-latency /
perceived-performance defect, not broken output.

## Two independent root causes

### 1. Coupling: text is gated behind the *entire* highlighting stack

In `scripts/build-site.js`, the editor's `EditorView` (which holds the example text) is created
**inside** the async highlighter-load IIFE, *after* both Shiki loads and `createHighlighter`
builds all themes:

```
(async () => {
  const [{ createHighlighter }, grammarRes] = await Promise.all([
    import('https://esm.sh/shiki@3'),      // big dependency tree
    fetch('../lcc.tmLanguage.json'),
  ]);
  hl = await createHighlighter({ langs:[grammar], themes:[...11 themes] });  // loads ALL themes
  ...
  editor = new EditorView({ doc: starterCode, ... });   // <-- text only exists HERE (~line 889)
})();
```

So the plain text — trivially cheap to render — is withheld until the slowest part of the page
finishes. The deferral is deliberate (a comment cites avoiding a default→themed color "flicker",
#1124), trading first-paint latency for zero flicker. That trade is wrong for the hero feature.

### 2. Over-fetching: 118 runtime requests, ~half of which redo build-time work

Page load fires **118 requests to esm.sh**. Measured live and categorized:

| Group | ~Count | What |
|---|---|---|
| CodeMirror 6 + Lezer | ~58 | `@codemirror/{view,state,commands,autocomplete,language}`, `@lezer/*`, `style-mod`, `crelt`, … |
| — of which pure waste | ~15–20 | `@codemirror/basic-setup@0.20` drags in a **duplicate** `@codemirror/*@0.20.x` generation (lint, search, view@0.20.7, commands, language, autocomplete) alongside the v6 set |
| Shiki | ~60 | `shiki@3`, `@shikijs/core`, `engine-oniguruma`, the oniguruma→regex chain, `hast-util-to-html`, an **oniguruma WASM** engine, and all **8 theme files** |

**Key finding:** runtime Shiki exists *only* to read per-theme token colors via `hl.getTheme()`
and map them onto the editor's Lezer tags (`lccHighlightStyle`). That same data is already
computed at build time by the **Node-side** Shiki dependency that pre-renders the static docs
code blocks (`build-site.js:306`). The ~60 Shiki requests redo, at runtime and on every visitor's
first load, work the build already does.

## Options

| Option | Mechanism | Payoff | Effort / risk |
|---|---|---|---|
| **A — instant text** | Render starter code as static text; create `EditorView` as soon as CM6 modules load (default highlight), enhance to themed colors via the existing `highlightCompartment`/`applyEditorHighlight` when ready | Text visible at HTML-parse time regardless of the waterfall — **fixes the user complaint** | Small / low (cost: brief color flicker) |
| **B — drop runtime Shiki** | Precompute each theme's `lccHighlightStyle` map at build (Node Shiki already loaded); inject as static JS; delete `SHIKI_CDN_URL` + runtime `createHighlighter` | **~60 of 118 requests gone**, incl. the WASM engine and the all-themes blocking step; no new bundle | Medium / low–medium (must reproduce `getTheme()` output — already proven on static blocks) |
| **C — bundle CM6** | webpack-bundle the remaining CM6/Lezer stack into one local `dist/` asset; drop the deprecated `basic-setup@0.20` duplicate tree | Collapses ~58 requests → a handful | Medium / medium (touches committed `dist/`; larger change) |

A, B, C are independent wins. A is what the user *feels*; B is the highest payoff-to-effort
load reduction; C is a "phase 2" cleanup. **C should follow B** so the bundle never includes Shiki.

## Recommendation

Pursue all three as **separate tickets** (user decision, 2026-06-14):

- **Ticket A** = revised **#1248** — show editor text instantly (progressive enhancement). Solves the complaint; lowest risk.
- **Ticket B** = new — eliminate runtime Shiki by precomputing themes at build. ~60 requests + WASM removed.
- **Ticket C** = new, **blocked-by B** — bundle the CM6 editor stack locally; drop `basic-setup@0.20` duplication.

## Prior-art note

Earlier spikes (#127, #697, #1027) explicitly deferred vendoring/bundling **"until first-load
latency becomes a real complaint."** #1248 is that trigger. The `dist/`-commit-policy concern
that gated the bundling path (#1251) is now **CLOSED**, so Ticket C is unblocked on that axis.

## Verification (for the implementations)

All verify on the **built** page (`npm run build && npm run serve:site`), never by source reading
(#985/#986/#987):

- **A:** editor text present in `#editor` before the esm.sh waterfall completes (`performance.getEntriesByType('resource')`).
- **B:** `performance.getEntriesByType('resource')` shows **0** `shiki`/`@shikijs` requests; highlighting visually unchanged across all 11 themes.
- **C:** **0** esm.sh editor requests; editor loaded from a local `dist/` bundle; pre-push browser-bundle freshness hook (#1075) green.
