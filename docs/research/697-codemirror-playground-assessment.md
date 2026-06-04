# CodeMirror assessment for playground editor (#697)

**Date:** 2026-06-04 · **Agent:** ELDERBERRY · **H:** 45m

## Current playground state

`docs/site/showcase/index.html` uses:
- `<textarea id="playground-input">` for editing (no line numbers, no in-editor highlighting)
- A separate `<div id="playground-output">` Shiki read-only preview panel below the textarea
- Shiki loaded via `import('https://esm.sh/shiki@1')` + `fetch('../lcc.tmLanguage.json')`
- Manual `keydown` handler that inserts 4 spaces on Tab (kludge, replaces textarea default)

## Library comparison

| | CodeMirror 6 | Monaco | Ace |
|---|---|---|---|
| ESM CDN (esm.sh) | Yes (import map needed) | No (AMD loader) | Yes |
| TextMate grammar reuse | Via Shiki bridge | Via vscode-textmate (complex) | No (own mode format) |
| Line numbers | `lineNumbers()` built-in | Built-in | Built-in |
| Tab indentation | `indentWithTab` built-in | Built-in | Built-in |
| CDN bundle size | ~150–200 KB | ~3.8 MB | ~362 KB |
| `file://` support | Yes (with import map) | Complex | Yes |
| Active maintenance | Very high | Very high | Low–medium |

## Key questions answered

**1. Library choice — CodeMirror 6.**
Monaco is 3.8 MB and requires an AMD loader with no clean ESM CDN path — a poor fit for a no-build GitHub Pages playground. Ace is smaller but uses its own mode format and is less actively maintained. CodeMirror 6 is the modern, ESM-native choice and the same library used by the reference web_ilcc project.

**2. Grammar reuse — yes, via Shiki bridge.**
CodeMirror 6 uses the Lezer parser system, which does NOT natively consume TextMate grammars. However, `@cmshiki/shiki` (npm: `@cmshiki/shiki`, aka `codemirror-shiki`) wraps a pre-built Shiki highlighter as a CodeMirror extension. Since `lcc.tmLanguage.json` is already a Shiki-compatible TextMate grammar, no new grammar needs to be written. The existing 11-theme system is preserved.

**3. Shiki integration — yes, collapses the preview panel.**
The `@cmshiki/shiki` extension provides in-editor highlighting directly on the `EditorView`. Once CodeMirror handles highlighting, the separate `<div id="playground-output">` Shiki preview panel is redundant and can be removed, simplifying the UX to a single edit/run/output layout.

**4. CDN loading — yes, with an import map.**
CodeMirror 6's packages are all on esm.sh and load via `type="module"` scripts. The one known gotcha: multiple `@codemirror/*` packages can each pull a different version of `@codemirror/state` from esm.sh, breaking `instanceof` checks. The fix is a `<script type="importmap">` in `<head>` that pins `@codemirror/state` to a single version. This is a one-time setup cost, not ongoing maintenance.

**5. Bundle impact — none.**
The editor is purely UI. `lcc.bundle.js` provides `lcc.assemble/run`; CodeMirror only replaces the `<textarea>` surface. No API changes needed.

## Recommendation: **proceed — decompose into one DEV puzzle**

CodeMirror 6 + `@cmshiki/shiki` is the right path. The integration is well-scoped:

1. Add `<script type="importmap">` to pin `@codemirror/state` version
2. Replace `<textarea id="playground-input">` with a `<div id="editor">` mount target
3. Initialize `EditorView` with `lineNumbers()`, `basicSetup`, Shiki extension (LCC grammar + current theme)
4. Wire editor content to Run button: `editor.state.doc.toString()` replaces `textarea.value`
5. Remove the separate Shiki preview panel (`#playground-output` section)
6. Verify on `file://` and GitHub Pages

Estimated DEV cost: **45–60m** (one micro-puzzle). The main risk is the import-map version-pinning step — if esm.sh's pinned URL for `@codemirror/state` drifts, the editor breaks silently. Mitigate by using versioned URLs (e.g. `https://esm.sh/@codemirror/state@6.x.x`).

## Deferred questions (out of scope for this spike)

- Exact import map URLs to use (needs a quick test at implement time)
- Whether to support light/dark theme switching within the CodeMirror editor (vs the current body-class approach)
- Error annotation (red squiggles at assembly error sites) — a follow-on feature, not part of the initial integration
