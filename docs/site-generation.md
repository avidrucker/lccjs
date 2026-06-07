# How the docs site & playground/showcase are generated

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
 docs/lcc.tmLanguage.json ├─►  build:site  ──────────┤  docs/site/dist/{lcc.bundle,lang-lcc}.js
 demos/*.a, plusdemos/*   │   (build-site.js)         ├─ docs/site/showcase/index.html
 src/browser/lcc-worker.js┘                           └─ docs/site/showcase/lcc-worker.js
 src/browser/{api,injector}.js ─► build:browser ─► dist/lcc.bundle.js (copied in by build:site)
```

`npm run build` = `build:browser` **then** `build:site`. The order matters: the
browser bundle must exist before `build:site` copies it into `docs/site/`.

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
Markdown rendered to HTML, one section per folder/list:
`guides` and `glossary` (folder-based — every `.md` deploys), plus `research`,
`learnings`, and `parity` (**explicit curated file lists** — e.g.
`parity_deviations.md`, the `cuh63-*` bug reports, a hand-picked ~12 `research`
docs and ~5 `learnings` docs). Each section gets an index page plus one page per
source `.md`. `research`/`learnings` are curated rather than folder-based because
the full folders are ~100+ internal engineering/process artifacts, not public
educational content (curation ruling: `docs/github-pages-docs-audit.md`, #1123;
implemented in #1153). The former internal `workflow` section
(`claude_workflow.md`, `RULES.md`) is intentionally **not** deployed.

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
| **Editor** | CodeMirror 6, imported from **esm.sh** CDN URLs | the code editor: line numbers, comment toggle, autocomplete |
| **Syntax highlighting** | **`dist/lang-lcc.js`** (a hand-maintained, CDN-ready CM6 `LanguageSupport`, compiled from the Lezer grammar in `src/lang-lcc/`) | colorizes LCC assembly as you type |
| **Assemble + run** | **`dist/lcc.bundle.js`** (webpack bundle of `src/browser/api.js`) executed inside a **Web Worker** (`src/browser/lcc-worker.js`) | runs the program off the main thread so a busy loop can't freeze the tab |

`build:site` **copies** `dist/lcc.bundle.js` and `dist/lang-lcc.js` into
`docs/site/dist/`, and `src/browser/lcc-worker.js` into `docs/site/showcase/`, so
the page's relative imports (`../dist/lcc.bundle.js`, `../dist/lang-lcc.js`)
resolve on `file://`, local HTTP, and Pages alike.

> **CM6 + esm.sh gotcha (#772, #986):** the page imports each CodeMirror symbol
> from its individual subpackage with a pinned `?deps=` so every `@codemirror/*`
> and `@lezer/*` resolves to one shared instance — otherwise `instanceof` checks
> fail and highlighting silently renders zero spans. Don't "simplify" those
> imports back to the umbrella package.

### Why two `lang-lcc` files exist
`src/lang-lcc/` is the **Node/build-time** grammar (Lezer parser tables generated
from `lcc.grammar`, consumed by tests). **`dist/lang-lcc.js`** is a separate,
**hand-maintained** browser port that uses CDN URLs and needs no build step. They
are not auto-synced today — editing the grammar does **not** regenerate the
browser file. (Relocated from `docs/site/dist/` to `dist/` in #1075 so the
generated tree stays 100% generated; see §5.)

---

## 5. The build/commit/deploy contract (#1075)

Two trees look generated but are governed differently:

| Tree | Nature | Committed? | Kept fresh by |
|------|--------|------------|---------------|
| **`docs/site/**`** | Pure derived HTML; CI rebuilds on deploy | **No — gitignored** | CI (`build:site`) is the sole producer |
| **`dist/**`** | Consumer-facing bundle — the reveal-md injector + code-block embed guides tell users to grab it from a checkout | **Yes — committed** | a `pre-push` guard: if `src/browser/**` changed, `dist/**` must be re-committed |

So: **don't commit `docs/site/`** (a local `npm run build` will leave it dirty —
that's expected; it's ignored), and **do re-commit `dist/`** after a browser-bundle
change (the pre-push hook enforces it). The one hand-maintained file that *lives*
in `dist/` but isn't webpack-built — `dist/lang-lcc.js` — is edited directly.

---

## 6. The fast dev loop (#1028)

For iterating on the showcase without a manual rebuild-and-refresh cycle:

```bash
npm run dev:site        # = serve-site.js --dev
```

It watches `scripts/build-site.js`, `src/browser/`, `src/lang-lcc/`, and
`dist/lang-lcc.js`; on a change it runs the **minimal** build step (template →
`build:site`; `src/browser/*` → `build:browser` + `build:site`) and pushes a
live-reload over SSE so the open tab refreshes itself. The reload `<script>` is
injected **only** under `--dev`, so the page bytes stay identical to deploy.

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
| `webpack.browser.config.js` | builds `dist/lcc.bundle.js` + `dist/lcc-injector.js` from `src/browser/` |
| `src/browser/{api,lcc-injector,lcc-worker}.js` | browser entry points (API bundle, slide injector, playground worker) |
| `src/lang-lcc/` | Lezer grammar + generated parser (build/test time) |
| `dist/lang-lcc.js` | hand-maintained CM6 language support for the browser (CDN-ready) |
| `dist/**` (committed) | consumer-facing bundle; copied into `docs/site/dist/` by `build:site` |
| `docs/site/**` (gitignored) | the generated, deployed site — never hand-edit |
