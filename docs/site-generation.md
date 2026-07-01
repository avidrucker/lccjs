# How the docs site & playground/showcase are generated

_Audience: contributors · Tier: reference_

A high-level map of how `lccjs` turns repo content into the deployed GitHub Pages
site at **https://avidrucker.github.io/lccjs/** — and how the in-browser
playground is assembled. This is the *story*, not an API reference; each section
links to the narrower doc that owns the details.

> **Companion docs**
> - [`showcase-local-dev.md`](./showcase-local-dev.md) — the authoritative
>   pre-deploy verification checklist (run it before shipping CM6 changes).
> - [`web-feature-parity.md`](./web-feature-parity.md) — feature matrix (what the
>   web build can/can't do vs. the CLI).
> - Issue **#1075** — the build/commit/deploy *contract* decision.
> - Issue **#1027** / **#1028** — the fast dev-loop research + implementation.

---

## 1. The one-paragraph story

Everything under **`docs/site/`** is **generated**, never hand-edited, and (since
#1075) **gitignored**. A single script, **`scripts/build-site.js`**, renders the
landing page, the doc sub-sections, and the playground into `docs/site/`. GitHub
Pages is the **sole producer of what deploys**: the `pages.yml` workflow runs the
build fresh on every push to `main` and uploads `docs/site/` as the Pages
artifact. Locally, `npm run serve:site` serves that same built directory so you
can verify the *real* deployed page in a browser before shipping.

```
 repo sources                build step                 deployed artifact
 ─────────────               ──────────                 ─────────────────
 docs/{guides,research,                                 docs/site/index.html
   learnings,glossary,…}  ┐                          ┌─ docs/site/docs/<section>/*.html
 docs/lcc.tmLanguage.json ├─►  build:site  ──────────┤  docs/site/dist/{lcc.bundle,editor.bundle}.js
 demos/*.a, plusdemos/*   │   (build-site.js)         ├─ docs/site/showcase/index.html
 src/browser/lcc-worker.js┘                           └─ docs/site/showcase/lcc-worker.js
 src/browser/{api,injector,editor}.js ─► build:browser ─► dist/{lcc.bundle,editor.bundle}.js (copied in by build:site)
```

`npm run build` = `build:browser` **then** `build:site`. `build:site` copies the
browser bundle into `docs/site/`; if it is missing (it is gitignored, not committed
— #1178), `build:site` builds it on demand first, so running `build:site` alone also
works.

---

## 2. The GitHub Pages deploy pipeline

`.github/workflows/pages.yml` (triggered by pushes to `main` that touch the
relevant `paths:`):

1. `npm ci`
2. **`npm run build:browser`** — webpack builds the browser bundle fresh in CI, so
   the deployed playground engine can never lag `src/browser/**` (the #985/#986
   silent-staleness class). *Added in #1075.*
3. **`npm run build:site`** — renders `docs/site/` and copies the fresh
   `dist/` artifacts into it.
4. Upload `docs/site/` as the Pages artifact → deploy.

Because CI rebuilds from source, **the committed copy of `docs/site/` would be
irrelevant** — which is exactly why #1075 stopped committing it. The `paths:`
filter includes the doc-source folders, the grammar/theme assets, the curated
samples, **and** (post-#1075) `src/browser/**`, `src/lang-lcc/**`, `dist/**`, and
`webpack.browser.config.js`, so a bundle/source change actually triggers a
redeploy.

---

## 3. What `build-site.js` generates

One script produces three kinds of output, all under `docs/site/`:

### a. The landing page (`index.html`)
A themed showroom rendered with **Shiki** (server-side syntax highlighting at
build time). It shows:
- a **curated sample** (`demos/helloWorld.a`) and an **LCC+ sample**
  (`plusdemos/charTypewriter.ap`),
- the full **alphabet demo suite** (`demos/demoA.a` … `demoZ.a`) — every letter
  rendered as a highlighted code block,
- a **theme switcher** across **11 themes** (GitHub Dark/Light, Monokai, One Dark
  Pro, Dracula, Nord, Tokyo Night, Solarized Light, Zenburn, and two custom
  "Retro Console" themes), with a "Try it" link into the playground.

### b. The doc sub-sections (`docs/site/docs/<section>/`)
Markdown rendered to HTML, one section per folder/list. Each section gets an index
page plus one page per source `.md`. Two shapes:

- **Folder sections** — `guides`, `research`, `learnings`, `glossary`: every `.md`
  in the folder deploys **unless** its path is matched by the root **`.pages-ignore`**
  (`.gitignore` syntax, matched by the `ignore` dev-dependency). This is how
  `research`/`learnings` are curated down to a user-facing subset (~12 + ~5) without
  a hand-edited list in `build-site.js` — the full folders are ~100+ internal
  engineering/process artifacts, not public educational content. To publish (or
  un-publish) a doc, edit `.pages-ignore`, not the build script. `guides`/`glossary`
  have no `.pages-ignore` entries, so they deploy in full.
- **Explicit list** — `parity`: a `files: []` array in `build-site.js`, because it
  cherry-picks a few root-level `docs/*.md` (`parity_deviations.md`, the `cuh63-*`
  bug reports, `lccjs-unique-features.md`) rather than a whole folder; an ignore
  file can't cleanly express "publish exactly these N of the dozens of `docs/*.md`."

Curation ruling: `docs/github-pages-docs-audit.md` (#1123); curated in #1153; made
maintainable via `.pages-ignore` in #1182. The former internal `workflow` section
(`claude_workflow.md`, `RULES.md`) is intentionally **not** deployed (and is listed
in `.pages-ignore` so it stays out if ever folded into a folder section).

### c. The playground (`docs/site/showcase/index.html`)
The interactive editor+runner — see §4. Its editor markup lives in the
`playgroundScript` template *inside* `build-site.js`; the legacy standalone source
pages were removed in #1045, so the generator is the single source of truth.

> **Rule of thumb:** to change the deployed page, edit the **source**
> (`build-site.js`, a sample, a theme, the grammar, the browser bundle) — never a
> file under `docs/site/`, which is overwritten on every build.

---

## 4. How the playground/showcase is composed

The playground is a self-contained page that runs the **real** assembler +
interpreter in the browser. Three moving parts:

| Part | Source | Role |
|------|--------|------|
| **Editor + syntax highlighting** | **`dist/editor.bundle.js`** (webpack bundle of `src/browser/editor.js`: CodeMirror 6 + Lezer + the `lcc()` `LanguageSupport` from `src/lang-lcc/index.js`), exposed as `window.LccEditor` | the code editor — line numbers, comment toggle, autocomplete — and LCC syntax colors as you type |
| **Per-theme colors** | precomputed at **build time** from the Shiki themes and inlined into the playground script as `LCC_THEME_STYLES` (#1283) | no Shiki at runtime; the editor recolors instantly on theme change |
| **Assemble + run** | **`dist/lcc.bundle.js`** (webpack bundle of `src/browser/api.js`) executed inside a **Web Worker** (`src/browser/lcc-worker.js`) | runs the program off the main thread so a busy loop can't freeze the tab |

`build:site` **copies** `dist/lcc.bundle.js` and `dist/editor.bundle.js` into
`docs/site/dist/`, and `src/browser/lcc-worker.js` into `docs/site/showcase/`, so
the page's relative refs (`../dist/lcc.bundle.js`, `../dist/editor.bundle.js`)
resolve on `file://`, local HTTP, and Pages alike. Both bundles load via plain
`<script src>` (UMD → `window.lcc` and `window.LccEditor`), so since #1283/#1284
the playground makes **zero** runtime requests to esm.sh.

> **CM6 instance-identity (historical — #772, #986):** when the editor loaded each
> CodeMirror symbol from a separate esm.sh URL, every `@codemirror/*` / `@lezer/*`
> had to pin the same `?deps=` so they shared one instance — otherwise `instanceof`
> checks failed and highlighting silently rendered zero spans. Bundling the whole
> stack into `editor.bundle.js` (#1284) yields a single `@codemirror/state`
> instance by construction, so this trap no longer applies.

### The `src/lang-lcc/` sources
`src/lang-lcc/index.js` is the CM6 `LanguageSupport` (`lcc()`): it wires the Lezer
parser tables (`lcc.js`, generated from `lcc.grammar`) to the syntax tags the editor
colors. Since #1284 it is compiled into `editor.bundle.js` (via `src/browser/editor.js`),
so the playground needs no CDN module for the language. The grammar is not
auto-synced to the parser tables — editing `lcc.grammar` does **not** regenerate
`lcc.js` automatically.

> **History:** before #1284 the playground loaded a hand-maintained,
> esm.sh-importing port — `src/lang-lcc/lang-lcc.cdn.js`, served as `dist/lang-lcc.js`.
> The bundle superseded it; the file was **removed in #1304**, which also rewired
> `serve-site.js`'s dev-loop to rebuild `editor.bundle.js` on `src/lang-lcc/**` changes.

---

## 5. The build/commit/deploy contract (#1075)

Two trees look generated but are governed differently:

| Tree | Nature | Committed? | Kept fresh by |
|------|--------|------------|---------------|
| **`docs/site/**`** | Pure derived HTML; CI rebuilds on deploy | **No — gitignored** | CI (`build:site`) is the sole producer |
| **`dist/lcc.bundle.js`, `dist/lcc-injector.js`, `dist/editor.bundle.js`** | Webpack output (bundles `src/core/**`+`src/utils/**`+`src/browser/**`; the editor bundle also pulls in CodeMirror 6 + `src/lang-lcc/**`) | **No — gitignored (#1178, #1284)** | built on demand by `build:site`/`serve:site`; CI rebuilds fresh on every deploy |

So: **don't commit `docs/site/`** (a local `npm run build` will leave it dirty —
that's expected; it's ignored), and **don't commit the webpack bundles** either —
they were untracked + gitignored in #1178 because they transitively bundle
`src/core/**`+`src/utils/**` and so went stale on nearly every toolchain commit
(see `docs/research/1171-committed-dist-churn.md`). `build:site`/`serve:site` build
them on demand if missing, and CI rebuilds them on deploy. The former `pre-push`
browser-bundle freshness guard was retired in the same change (nothing left to
protect once the committed copy is gone). Since #1284 the editor's CodeMirror stack
and the `lcc()` language are part of the webpack output too (`dist/editor.bundle.js`),
so there is no longer a hand-maintained `dist/` file to special-case: the former
`src/lang-lcc/lang-lcc.cdn.js` → `docs/site/dist/lang-lcc.js` copy was dropped in
#1284, and the file itself was removed in #1304.

---

## 6. The fast dev loop (#1028)

For iterating on the showcase without a manual rebuild-and-refresh cycle:

```bash
npm run dev:site        # = serve-site.js --dev
```

It watches `scripts/build-site.js`, `src/browser/`, and `src/lang-lcc/`; on a
change it runs the **minimal** build step and pushes a live-reload over SSE so the
open tab refreshes itself: a template / `build-site.js` edit runs `build:site`,
while a `src/browser/**` or `src/lang-lcc/**` edit runs `build:browser` (rebuilding
`editor.bundle.js` / `lcc.bundle.js`) + `build:site` — the `src/lang-lcc/**` →
rebuild wiring was added in #1304. The reload `<script>` is injected **only** under
`--dev`, so the page bytes stay identical to deploy.

`dev:site` is for speed; it does **not** replace verification.

---

## 7. Verifying before deploy

The deployed playground is a generated page, and CM6 features have twice been
declared working from a source reading while the live page silently lacked them
(#985, #986). So the rule (owned by [`showcase-local-dev.md`](./showcase-local-dev.md)):

```bash
npm run build && npm run serve:site   # serve the BUILT docs/site
```

Open `http://localhost:8080/showcase/` and run the checklist **against the plain
`serve:site` page (no `--dev`)** — that page is byte-identical to what Pages
deploys. Source reading is not sufficient.

---

## Map of the moving parts

| File / path | Role |
|-------------|------|
| `.github/workflows/pages.yml` | CI: build fresh + deploy `docs/site/` to Pages |
| `scripts/build-site.js` | renders landing + doc sections + playground into `docs/site/` |
| `scripts/serve-site.js` | local static server for the built site; `--dev` adds watch + live-reload |
| `webpack.browser.config.js` | builds `dist/lcc.bundle.js`, `dist/lcc-injector.js`, and `dist/editor.bundle.js` from `src/browser/` |
| `src/browser/{api,lcc-injector,lcc-worker,editor}.js` | browser entry points (API bundle, slide injector, playground worker, CM6 editor bundle) |
| `src/lang-lcc/` | Lezer grammar + generated parser + `index.js` (`lcc()` `LanguageSupport`, bundled into `editor.bundle.js`) |
| `dist/**` (gitignored, built on demand) | webpack bundles; copied into `docs/site/dist/` by `build:site`; CI rebuilds on deploy (#1178) |
| `docs/site/**` (gitignored) | the generated, deployed site — never hand-edit |
