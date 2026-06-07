# TIL 2026-06-06 — CHERRY (session 3)

**Context:** A single-ticket session on #1075 (`chore(web): fix the showcase build/commit/deploy contract`). The goal was to stop `docs/site/**` generated HTML from churning the tree and blocking `npm run close`, while fixing the silent-staleness of the deployed `dist/` bundle. What looked like a tidy gitignore-and-go turned into three lessons about verifying assumptions before doing something irreversible.

---

## 1. A "generated" directory can hide a source-of-truth file with no build step

**What happened:** The ticket's Option A was "stop committing generated output — gitignore `docs/site/**` and let CI rebuild it." 191 files lived under `docs/site/`, all apparently produced by `scripts/build-site.js`. Before running `git rm -r --cached docs/site`, I traced what `build-site.js` actually writes. It writes the HTML pages, copies `lcc.tmLanguage.json`, copies `dist/lcc.bundle.js`, copies `src/browser/lcc-worker.js` — but **never touches `docs/site/dist/lang-lcc.js`**. That file (the CodeMirror 6 language support the playground imports for syntax highlighting) is hand-authored: its own header says *"CDN-friendly… no build step is needed."* Webpack doesn't build it either. A clean `npm run build` left it untouched while regenerating everything around it.

Had I gitignored `docs/site/**` naively, that one file would have been orphaned — and CI, which only runs `build:site`, would have deployed a `docs/site/` with no `lang-lcc.js`, silently killing playground highlighting. That is the exact #985/#986 silent-staleness failure class this very ticket was trying to eliminate.

The fix that *clarified* the contract instead of fighting it: `git mv docs/site/dist/lang-lcc.js dist/lang-lcc.js` (into the committed, consumer-facing `dist/` family), then add a copy step to `build-site.js` mirroring the `lcc.bundle.js` copy. Now `docs/site/**` is genuinely 100% generated and safe to ignore.

**What I learned:** "It's in a generated directory" is a claim to verify, not assume. The cheap check — `git status` after a clean build — tells you exactly which tracked files the build does *not* reproduce. Anything it leaves untouched is, by definition, not generated, no matter where it lives.

**The rule:** **Before gitignoring or deleting a "generated" tree, run a clean build and confirm every tracked file in it is actually regenerated; the ones the build doesn't touch are sources in disguise.** (Authority: documented in `docs/showcase-local-dev.md` and the `build-site.js` copy-block comment, both shipped in #1075.)

---

## 2. The node_modules symlink trap blocks `npm run close` in a worktree

**What happened:** Worktrees don't get a `node_modules` (it's gitignored and not copied at claim time), so to run `npm run build` I symlinked it: `ln -s <main>/node_modules node_modules`. Builds worked. But at close time, `npm run close 1075` failed with `[close] ✗ working tree is not clean`. The culprit: `git status --porcelain` showed `?? node_modules`. The `.gitignore` entry is `node_modules/` — the trailing slash matches a *directory*, and a **symlink** named `node_modules` is a file, so it isn't ignored. Earlier in the session a `git add -A` had even staged the symlink, which I caught and unstaged. The clean-tree gate in `close.js` then refused to proceed until I ran `unlink node_modules`.

**What I learned:** A symlink is not the directory it points to, and gitignore patterns with trailing slashes know the difference. Two downstream habits matter: (a) never `git add -A` in a worktree where you've hand-created scaffolding symlinks — stage explicit paths; (b) the close gate is doing its job by refusing a dirty tree, so the fix is to clean up the scaffold, not to bypass.

**The rule:** **If you symlink `node_modules` into a worktree to build, `unlink` it before `npm run close` — the `node_modules/` gitignore pattern doesn't match the symlink, so it dirties the tree and blocks the close.** (Authority: filed #1111 to fix the friction at the source — auto-symlink in `claim.sh` and/or a symlink-safe gitignore.)

---

## 3. A ticket that frames a decision as global A-vs-B may be hiding a per-item answer

**What happened:** #1075 asked me to pick **one** contract: (A) stop committing all generated output, or (B) keep committing it all and enforce freshness. I started to ask the user to choose — then traced how the two artifacts are actually consumed. `docs/site/**` is pure derived HTML that CI rebuilds and nobody references from a checkout. But `dist/**` is a **published, consumer-facing bundle**: the `docs/guides/reveal-md-lcc-slides.md` and `lcc-code-blocks.md` guides literally tell users to grab `dist/lcc-injector.js` from a checkout for slide embeds. Pure Option A (gitignore `dist/**` too) would have broken documented workflows. Pure Option B keeps the `docs/site` churn that was the whole problem. The right answer was **per-artifact**: Option A for `docs/site/**`, Option B (a freshness guard) for `dist/**`.

I reframed the user question around that finding instead of forcing the binary, and we landed the hybrid.

**What I learned:** When a ticket poses "choose A or B for these things," the unstated premise is that "these things" are homogeneous. Check it. A five-minute trace of *who consumes each artifact* dissolved a false dichotomy and produced a better contract than either option as written.

**The rule:** **Before answering a binary A/B design question, verify the things being chosen-over are actually the same kind of thing — trace real consumers; a per-item split often beats either uniform option.** (Authority: recorded as the decision comment on #1075; it's a judgment heuristic, not a mechanical rule, so no `RULES.md` entry.)

---

## What landed

| Artifact | Change |
|---|---|
| `.gitignore` | Ignore `docs/site/**` (CI is sole producer) (#1075) |
| `scripts/build-site.js` | Copy `dist/lang-lcc.js` → `docs/site/dist/` so docs/site is fully generated (#1075) |
| `dist/lang-lcc.js` | Relocated from `docs/site/dist/` into the committed artifact family (#1075) |
| `.github/workflows/pages.yml` | Run `build:browser` before `build:site`; add `src/browser/**`, `src/lang-lcc/**`, `dist/**`, `webpack.browser.config.js` to `paths:` (#1075) |
| `scripts/git-hooks/pre-push` | Guard: `src/browser/**` changed ⇒ `dist/**` must be re-committed (#1075) |

## Open threads

- #1111 — auto-symlink `node_modules` at claim time and/or a symlink-safe gitignore.
- #1104 — pre-existing `db-path-compliance` test failure on `main` (`preflight.js`), surfaced but out of #1075 scope.
- The browser `lang-lcc.js` still embeds parser tables that `src/lang-lcc/lcc.grammar` regenerates with no automated propagation — a latent staleness risk noted but not addressed in #1075.

## Related artifacts

- Issue #1075 (the contract) and its decision comment
- `docs/showcase-local-dev.md` — the verification discipline + the new contract table
