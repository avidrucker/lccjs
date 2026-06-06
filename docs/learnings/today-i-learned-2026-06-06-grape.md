# TIL 2026-06-06 — GRAPE

**Context:** Three-puzzle session in the `area:web` lane. Fixed a test-suite crash caused by missing npm packages (#941), resolved all ILCC dashboard unknowns using Playwright (#714/#731), discovered the showcase editor's CM6 features were silently broken on the live site, and filed three new tickets (#985–#987).

---

## 1. A worktree branch can have an older version of a script that writes to a different database

When I logged velocity for #714 from inside the `grape/issue-714` worktree, the row went to `~/.lccjs/velocity.db` instead of `~/.lccjs/lccjs.db`. The worktree branch had been cut from main before the `velocity-log.js` script was migrated to use `lccjs.db`, so its copy still referenced the old filename. The shared `velocity.db` hadn't been cleaned up, so the open-and-write succeeded silently — no error, wrong destination.

**What I learned:** `db-path.js`'s migration guard (`if lccjs.db doesn't exist, rename velocity.db`) only runs when `lccjs.db` is absent. Because `lccjs.db` already existed, the guard was skipped and the old script used the stale path without complaint.

**The rule:** Before logging velocity from a worktree, check which DB the branch's `velocity-log.js` connects to (`grep DB_PATH scripts/velocity-log.js`). If it says `velocity.db`, either use the main checkout's script via `--from-main` or update the worktree branch first.

---

## 2. `human-required` labels become stale when new tools arrive

Issue #731 was labeled `human-required` because `WebFetch` on the ILCC dashboard URL returns only `"client"` — the SPA renders entirely in JavaScript. Every prior agent left it untouched. In this session I navigated to the live URL using Playwright MCP, which drives a real Chromium browser, and answered all six checklist items in a single pass.

**What I learned:** The label `human-required` describes the tool constraints *at the time it was applied*, not a permanent truth. Playwright MCP fully bypasses the WebFetch limitation — it waits for the SPA to render, reads the live DOM, clicks buttons, and inspects `localStorage`.

**The rule:** Before passing a `human-required` issue to a human, check whether Playwright MCP is available. If the issue is a browser-based audit of a public URL, Playwright can almost certainly handle it.

---

## 3. Source code reading is not a substitute for verifying rendered output

The feature audit doc (`docs/research/ilcc-dashboard-feature-audit.md`) confidently marked line numbers ✅ and syntax highlighting ✅ for the lccjs showcase editor. The code imports `basicSetup` (which includes `lineNumbers()`), `lcc()` (Lezer LanguageSupport), and `syntaxHighlighting(defaultHighlightStyle)` — it reads like it should work. But the live page at `https://avidrucker.github.io/lccjs/showcase/` has no `.cm-lineNumbers` element in the DOM and zero `span[class]` elements inside `.cm-content`. Neither feature renders.

**What I learned:** Features that look correct in source can fail silently in production — CDN import resolution, version mismatches, or ordering issues can suppress extensions without throwing errors. The audit was done by reading the HTML, not by running it. That gap produced two months of inaccurate documentation.

**The rule:** Web feature audits must be performed against the running page, not the source file. For any claim about a browser feature (line numbers, syntax highlighting, localStorage), verify with DevTools or Playwright: `document.querySelector('.cm-lineNumbers')`, `document.querySelectorAll('.cm-content span[class]').length`, etc.

---

## 4. `package.json` listing ≠ package installed

Issue #941: `@lezer/lr` was in `package.json` (line 34) and `package-lock.json`, but absent from `node_modules`. Eight lezer-grammar tests crashed with `ERR_MODULE_NOT_FOUND`. The package had been added to the manifest by a previous agent but `npm install` was never run to materialise it.

**What I learned:** `package.json` is a declaration of intent; `node_modules` is the ground truth. The lock file records *what should* be installed; only `npm install` makes it real.

**The rule:** When a test fails with `ERR_MODULE_NOT_FOUND` and the package is in `package.json`, the fix is `npm install`, not adding the package again. Also check sibling packages: `src/lang-lcc/index.js` imported `@lezer/highlight` which was missing from `package.json` entirely — always audit all imports in the affected directory.

---

## What landed

| Artifact | Change |
|---|---|
| `package.json` + `package-lock.json` | Added `@lezer/highlight ^1.2.1`; `npm install` now provides both Lezer packages (#941) |
| `docs/research/ilcc-dashboard-feature-audit.md` | All `?` entries resolved; verified-findings table added; gap table complete (#731, #714) |
| `docs/puzzle-velocity.csv` | Three new velocity rows (GRAPE, #941 + #714 + #991) |

## Open threads

- #985 — showcase CM6 editor: no line-number gutter (root cause unresolved)
- #986 — showcase CM6 editor: no syntax highlighting (root cause unresolved)
- #987 — no local dev flow for testing showcase changes before GH Pages deploy

## Related artifacts

- [TIL 2026-06-06 DRAGONFRUIT](./today-i-learned-2026-06-06-dragonfruit.md) — independent session same day
- Issue #941 · Issue #714 · Issue #731 · Issues #985–987
