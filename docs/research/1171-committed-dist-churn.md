# #1171 — Why committed build artifacts keep dirtying `main`

**Status:** investigation complete · **Agent:** CHERRY · **Date:** 2026-06-07
**Method:** empirical (clean-tree rebuild + determinism diff) on a worktree based on `origin/main` (HEAD `d313183`).

## TL;DR

The committed webpack bundles (`dist/lcc.bundle.js`, `dist/lcc-injector.js`) **chronically go stale** because they transitively bundle `src/core/**` + `src/utils/**`, but the only thing that forces a rebuild — the #1075 pre-push freshness guard — **watches `src/browser/**` only.** Every assembler/interpreter/formatter edit (i.e. most toolchain work) silently invalidates the committed bundle; the next `npm run build` surfaces the drift as a dirty tree. The build itself is **deterministic** — this is not a non-determinism problem, it's a *stale committed artifact* problem.

`dist/` is also **redundant to commit**: CI rebuilds it fresh on every Pages deploy.

## Evidence

### 1. The build is deterministic (non-determinism ruled out)
Two consecutive `npm run build:browser` runs on the same clean tree (from a fresh `npm ci`) produced **byte-identical** output for both `lcc-injector.js` and `lcc.bundle.js`. Config (`webpack.browser.config.js`) uses fixed filenames (no `[contenthash]`), `mode: 'production'`, no date banner, no source maps. So rebuilding in a *stable environment* does not churn.

### 2. A clean-tree rebuild immediately dirties committed `dist/`
From a pristine `origin/main` checkout with **zero source edits**, `npm run build:browser` modified both bundles:

| File | Committed (HEAD) | Fresh build | Δ |
|---|---|---|---|
| `dist/lcc.bundle.js` | 92,224 B | 96,682 B | **+4,458 B**, ~88,590 bytes differ (from offset 316) |

A ~5% size delta and near-total byte divergence ⇒ the committed bundle was built from **older source** (or a different toolchain), i.e. it is **stale**, not trivially version-stamped.

### 3. The bundle depends on `src/core` + `src/utils`, but the guard doesn't watch them
- `src/browser/api.js` → `require('../core/assembler')`, `require('../core/interpreter')`, `require('../utils/formatter')`. `src/browser/lcc-injector.js` → `require('./api')`. So bundle output is a function of `src/core/**` and `src/utils/**`.
- The #1075 guard (`scripts/git-hooks/pre-push:71`) only fires on:
  ```
  grep -E '^(src/browser/|webpack\.browser\.config\.js)'
  ```
  It does **not** include `src/core/**` or `src/utils/**`. → a change to the assembler/interpreter/formatter passes the guard while staling the committed bundle.

### 4. The staleness is chronic (quantified)
Last 30-commit window: **30** commits touched `src/core/`, only **12** touched `dist/`. The bundle's source changes roughly every commit; the bundle is re-committed far less often. It is almost always behind.

### 5. Committing `dist/` is redundant for deployment
`.github/workflows/pages.yml:89-90` runs `npm run build:browser` then `build:site` on every deploy — CI rebuilds the bundle fresh. The deployed site never relies on the committed copy. Committed-`dist/` consumers are **local-dev only**: `npm run build:site` / `serve:site` and `src/browser/lcc-worker.js` (`importScripts('../dist/lcc.bundle.js')`), plus `spike/test-bundle.html`.

### 6. Important caveat — `dist/lang-lcc.js` is NOT a webpack output
`dist/lang-lcc.js` is a **hand-maintained** port (`scripts/serve-site.js:199`, #1075) that lives in `dist/` but is a *source of truth*. Any fix must be **file-specific** — blanket-gitignoring `dist/` would delete a tracked source file. (Same class of trap as TIL #1075/#1111: a "generated" dir hiding a hand-written file.)

### 7. The non-`dist` dirtiness is a different problem
`scripts/build-site.js` and `docs/learnings/README.md` showing as modified/staged on `main` are **not** artifact churn — they are *source* files being edited directly on the shared `main` checkout (concurrent agents building/editing on `main` instead of in worktrees). That's a process issue, adjacent to #1134, not a build-config one.

## Recommendation

**Primary — stop committing the webpack bundles (scoped Option B).**
- `git rm --cached dist/lcc.bundle.js dist/lcc-injector.js` and gitignore exactly those two (mirroring the `docs/site/` precedent at `.gitignore:54`). **Keep `dist/lang-lcc.js` committed.**
- Make local `build:site`/`serve:site` build the bundles on demand if missing (they already *warn*; upgrade to auto-build or a clear one-liner).
- Retire the #1075 pre-push browser-bundle freshness guard (it only existed to protect a committed copy that no longer exists; CI already rebuilds at deploy).
- **Pre-req decision:** confirm no external consumer depends on the committed raw bundle path (e.g. reveal-md slides or a doc linking `dist/lcc.bundle.js` on GitHub) before removing it.

**Fallback — fix the guard (Option C), only if the committed bundle must stay.**
Extend the pre-push trigger to the bundle's true dependency set (`src/core/**`, `src/utils/**`, `src/browser/**`, `webpack.browser.config.js`). Correct, but it forces a `dist/` rebuild+commit on *nearly every toolchain commit* → heavy `dist/` churn and merge conflicts across parallel agents. Likely worse than B in this multi-agent repo.

**Ruled out — Option A (deterministic builds):** the build is already deterministic (Evidence §1).

**Process (separate):** add a `git status` clean-gate before claim, and reinforce "don't run `npm run build` or edit source on the main checkout — use a worktree" (Evidence §7). Track with / under #1134.

## Suggested follow-up puzzles
1. **DEV** — implement scoped Option B: untrack + gitignore `dist/lcc.bundle.js` + `dist/lcc-injector.js` (keep `lang-lcc.js`), make `build:site` auto-build missing bundles, retire the #1075 bundle-freshness guard. *(Gated on the external-consumer check.)*
2. **decision** — confirm/deny any external dependency on the committed bundle path (blocks #1).
3. **process** — clean-gate + worktree-discipline reinforcement for the `build-site.js`/`README` direct-on-`main` churn (fold into #1134 or its own ticket).

## References
- `webpack.browser.config.js`, `scripts/git-hooks/pre-push:53-78`, `.github/workflows/pages.yml:87-90`, `.gitignore:49-54`
- `src/browser/api.js`, `src/browser/lcc-injector.js`, `src/browser/lcc-worker.js:23`, `scripts/serve-site.js:199`
- Related: #1075 (CLOSED — build/deploy contract), #1134 (OPEN — concurrent-session contention)
