# Showcase / Playground — local dev & pre-deploy verification

The live showcase (https://avidrucker.github.io/lccjs/showcase/) is the CM6
editor "Playground". CM6 editor features depend on **runtime** behaviour — the
editor bundle wiring (`window.LccEditor`), Lezer/highlight tag identity, `basicSetup`
extensions under CodeMirror 6 — that **cannot be verified by reading the source**. Twice the
feature-audit doc declared line numbers ✅ and syntax highlighting ✅ from a code
reading while the deployed page silently lacked them (#985, #986).

**Running the built page in a browser is the required verification step for any
showcase/playground change before it ships to GitHub Pages.**

## The one thing to get right: serve the GENERATED page

The deployed Playground is a single, generated file:

| File | What it is | Deployed? |
|------|------------|-----------|
| `docs/site/showcase/index.html` | The **Playground** — *generated* by `scripts/build-site.js` | ✅ **Yes** |

> The legacy standalone source pages (`docs/showcase/index.html`,
> `docs/playground/index.html`) were **removed in #1045**. They were never
> deployed, and CM6 fixes kept landing on them by mistake instead of on the
> generated page (#985). The generator is now the single source of truth.

GitHub Pages serves the `docs/site` directory as its artifact root (built by the
`build:browser` + `build:site` jobs in `.github/workflows/pages.yml`). The
Playground's editor markup lives in the `playgroundScript` template inside
`scripts/build-site.js` — **edit the template, not the generated file.**

> **`docs/site/**` is gitignored (#1075).** It is 100% generated and CI is the
> sole producer of what deploys, so there is **nothing to "mirror into a committed
> copy"** — just edit the source (`scripts/build-site.js`, the browser bundle, the
> grammar) and rebuild. The browser artifacts the page loads land under `dist/` and
> are *copied* into `docs/site/dist/` by `build:site`:
>
> | Artifact | Canonical source | How it reaches the page |
> |----------|------------------|-------------------------|
> | `lcc.bundle.js` | `src/browser/` → webpack (`npm run build:browser`); the `dist/lcc.bundle.js` output is **gitignored, built on demand**, not committed (#1178) | `build:site` builds it if missing, then copies to `docs/site/dist/` |
> | `editor.bundle.js` | `src/browser/editor.js` → webpack: CodeMirror 6 + Lezer + the `lcc()` language from `src/lang-lcc/index.js`; **gitignored, built on demand** (#1284) | `build:site` builds it if missing, then copies to `docs/site/dist/` |
>
> So change the CM6 editor or the LCC language at **`src/browser/editor.js`** /
> **`src/lang-lcc/index.js`**, and the assemble/run engine under `src/browser/`, then
> `npm run build:browser` to rebuild the bundles. The webpack bundle is **not committed** —
> `build:site`/`serve:site` rebuild it on demand if missing, and CI rebuilds it fresh
> on every Pages deploy (#1178). (The former `pre-push` browser-bundle freshness guard
> was retired in #1178, since there's no longer a committed copy to keep in sync.)

Serving `docs/` (as opposed to `docs/site/`) would not serve the Playground at all.
Always serve `docs/site`.

## Steps

```bash
# 1. Regenerate the built site (browser bundle + docs/site). Required after any
#    change to scripts/build-site.js, the browser bundle, or the grammar.
npm run build            # = build:browser + build:site

# 2. Serve the built artifact (docs/site) on http://localhost:8080
npm run serve:site
#    Different port:  npm run serve:site -- --port 9000

# 3. Open the Playground and run the checklist below
#    http://localhost:8080/showcase/
```

`serve:site` is a zero-dependency Node static server (`scripts/serve-site.js`) — it
serves `docs/site` with correct MIME types for the ES-module imports the page makes.
No `npx serve` / network fetch and no Python required.

## Pre-deploy verification checklist

Open `http://localhost:8080/showcase/` and confirm each item. The DevTools console
one-liners give an objective pass/fail rather than a visual guess.

- [ ] **Editor renders** — the CM6 editor is visible with the starter program.
- [ ] **Syntax highlighting** — tokens are multi-colored (comment, mnemonics,
      label, string, number), not one flat color.
      `document.querySelectorAll('.cm-content span[class]').length` → **> 0**
- [ ] **Line numbers** — a numbered gutter is visible on the left.
      `!!document.querySelector('.cm-gutters')` → **true**
- [ ] **Autocomplete** — typing a partial mnemonic (e.g. `ad`) offers completions.
- [ ] **Shiki output preview** — running a program renders colored output; the
      grammar fetch (`/lcc.tmLanguage.json`) returns 200 (check the Network tab).
- [ ] **No console errors** related to module loading or CodeMirror (ignore an
      unrelated `favicon.ico` 404).

A failing item is a bug to fix or file before deploy — not something to wave through
from a source reading.

## Why a build step is part of the loop

`docs/site` is committed (so Pages can deploy it), but it is *generated*. Editing
`scripts/build-site.js` without re-running `npm run build` leaves the committed
`docs/site` stale, and serving it shows old behaviour. Build, then serve, then
verify — every time.
