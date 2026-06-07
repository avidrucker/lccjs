# Common Workflows

A home for the project's recurring **operational** processes — the "when do I
actually run X, and what happens automatically?" questions that otherwise have to
be reconstructed from scattered scripts, hooks, and CI config.

This is a living doc: append a new section per workflow as they come up. Each
section states **what runs**, **manual vs. automated**, **when / how often**, and
**why**.

> Scope note: this doc is about *operational* workflows (build, deploy, release-y
> mechanics). The **per-puzzle agent protocol** (claim → work → close) lives in
> [`docs/claude_workflow.md`](./claude_workflow.md); **tooling preferences** live in
> [`docs/do-this-not-that.md`](./do-this-not-that.md).

---

## Build & deploy the Pages site (`npm run build`)

### What `npm run build` composes

`npm run build` is a two-step pipeline (`package.json`):

1. **`build:browser`** — `webpack --config webpack.browser.config.js` → emits the
   browser engine: `dist/lcc.bundle.js` + `dist/lcc-injector.js`.
2. **`build:site`** — `node scripts/build-site.js` → regenerates the static Pages
   site into `docs/site/`, copying the freshly-built `dist/` artifacts in.

So "build" = bundle the in-browser engine, then regenerate the playground/docs
site that consumes it.

### Automated path (the authoritative one) — CI on push to `main`

`.github/workflows/pages.yml` runs **`npm run build:browser && npm run build:site`
fresh in CI, then deploys `docs/site/` to GitHub Pages** — on every push to `main`
that touches an **allowlisted path**.

- The deployed site is **always CI-generated**. The committed `docs/site/` is not
  what ships; CI rebuilds from source every deploy. (This is deliberate — it kills
  the silent-staleness class where a committed bundle lags its source, #985/#986.)
- The trigger is a specific `paths:` allowlist, not "any push." It includes
  `src/browser/**`, `src/lang-lcc/**`, `dist/**`, `webpack.browser.config.js`, the
  grammar/theme assets (`docs/lcc.tmLanguage.json`, `docs/themes/**`), the demo
  `.a`/`.ap` files rendered into the playground, the folder-based doc sections
  (`docs/research/**`, `docs/learnings/**`, `docs/glossary/**`), the explicit parity
  docs, the workflow docs, and **`scripts/build-site.js` itself**.
- A push that touches **none** of those paths does **not** redeploy.
- `workflow_dispatch` is enabled, so a deploy can also be kicked manually from the
  Actions tab without a code change.

**Practical consequence:** most commits never need a local build — if your change
is on an allowlisted path, merging to `main` triggers a fresh CI build+deploy
within ~30s. (Example: a docs edit that also touches `scripts/build-site.js` or a
listed parity doc will rebuild and redeploy the whole site automatically.)

### Manual path — local pre-deploy verification only

Run the build by hand when you've changed **showcase / CodeMirror 6 / browser-bundle
behavior** and need to eyeball the *built* page before pushing:

```bash
npm run build && npm run serve:site   # → http://localhost:8080/showcase/
```

This is the [`docs/showcase-local-dev.md`](./showcase-local-dev.md) discipline:
for CM6 features, **reading the source is not sufficient** to know the rendered
result (#985/#986/#987) — you must verify against the built site. For a pure
docs/text change, a local build buys nothing CI won't do, so skip it.

### The pre-push hook *guards* freshness — it does not build

The `pre-push` hook (`scripts/git-hooks/pre-push`, #1075) **blocks** a push that
changes `src/browser/**` or `webpack.browser.config.js` **without** re-committing
`dist/**` — because `dist/` is a committed, consumer-facing artifact (used by the
reveal-md injector and npm consumers) that would otherwise go stale silently. The
hook does **not** run a build; it only enforces that you ran one. CI rebuilds
`dist/` fresh regardless, so this protects the *checked-in* copy. This is the one
case where you might run `npm run build:browser` manually purely to satisfy the
hook (`git add dist/`), not to deploy. Bypass with `git push --no-verify` only if
the rebuild produced no change.

### When / how often — summary

| Situation | Run `npm run build` locally? | What happens |
|-----------|------------------------------|--------------|
| Docs/text-only change | No | CI builds+deploys if the path is allowlisted; otherwise no deploy needed |
| Showcase / CM6 / playground change | **Yes**, before pushing | Verify the built page locally, then CI rebuilds fresh on merge |
| `src/browser/**` or webpack config change | `build:browser`, then commit `dist/` | pre-push hook blocks until `dist/` is re-committed; CI also rebuilds |
| Need to redeploy with no code change | No | Trigger `workflow_dispatch` from the Actions tab |

**Bottom line:** building is *automated for deploys* (CI on qualifying pushes to
`main`) and *manual only* for local CM6/showcase verification before pushing.

### Sources

`package.json` (`build` / `build:browser` / `build:site` / `serve:site`),
`.github/workflows/pages.yml`, `scripts/build-site.js`, `scripts/git-hooks/pre-push`.
Background: [`docs/site-generation.md`](./site-generation.md),
[`docs/showcase-local-dev.md`](./showcase-local-dev.md).
