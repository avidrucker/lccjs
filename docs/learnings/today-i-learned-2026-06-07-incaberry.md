# TIL 2026-06-07 — INCABERRY

**Context:** Two-session run as INCABERRY. Session 1 (2026-06-06) added INCABERRY to the fruit agent roster. Session 2 (2026-06-07) implemented persistent light/dark mode for the GitHub Pages site (#1143) — an end-to-end web feature touching the site generator, CSS, navbar, and browser-side JS across all page types.

---

## 1. The patch tool edits the wrong file when main and worktree both have it

**What happened:** I applied all my patches to `scripts/build-site.js` using the `patch` tool, verified the diff looked right, built the site, and only discovered at verification time that the generated HTML was missing the inline script and toggle button. The `patch` tool had resolved to the **main checkout's** file, not the worktree's. The worktree had its own copy of the file (git worktrees are separate checkouts), so my edits were invisible to `npm run build:site` running inside the worktree.

**What I learned:** After claiming a worktree, always verify that file edits land in the worktree by checking the resolved path or running `git status --short` inside the worktree directory. The `patch` tool's `resolved_path` field in the response tells you which file it actually edited — read it, don't assume.

**The rule:** **After every patch/write_file in a worktree session, run `git status --short` (or `git diff --stat`) inside the worktree to confirm the intended file was modified, not the main checkout's copy.** (Authority: this is a new lesson; no existing RULES.md entry covers it. Filed as memory entry.)

---

## 2. Inline theme script must use array `.indexOf()`, not Set `.has()`

**What happened:** The HEAD_SCRIPT inline script serialized `DARK_IDS` as a JSON array and called `DARK.has(t)` — but arrays don't have `.has()`, only Sets do. The inline script silently threw a TypeError at runtime, so the `<html>` element never got its theme class, and the CSS variables (which I'd updated to use `html.dark`/`html.light` selectors) were never applied by the inline script. The page still looked correct because `body.dark` was set by `makePage()`'s `bodyClass` parameter, but the flash-prevention mechanism was broken.

**What I learned:** Code inside a template literal that gets serialized to a string and injected into HTML doesn't benefit from IDE type-checking or Set APIs. When the target is a JSON-serialized array, use `.indexOf() >= 0` instead of `.has()`. Test the inline script by evaluating it in the browser console, not just by reading the source.

**The rule:** **When writing inline `<script>` content that will be serialized to a string, use plain array/object APIs (`.indexOf()`, `in`, bracket access) — not Set/Map methods that won't survive JSON serialization.** (Authority: judgment heuristic, no RULES.md entry needed.)

---

## 3. `document.documentElement.className` and `document.body.className` must stay in sync

**What happened:** The inline HEAD_SCRIPT set `document.documentElement.className` (the `<html>` element) because `document.body` is null when scripts in `<head>` run. But the runtime `apply()` function only set `document.body.className`. After toggling, the `<html>` element kept its original class while `<body>` changed, creating a split-brain state. The CSS worked because I'd added `html.dark`/`html.light` selectors alongside `body.dark`/`body.light`, but the mismatch was a latent bug — any code reading `document.documentElement.className` would get stale data.

**What I learned:** When two DOM elements carry the same semantic state (theme class), every code path that updates one must update both. The inline script sets `<html>`, the runtime sets `<body>` — they need to be unified.

**The rule:** **Any code that sets the theme class must set it on both `document.documentElement` and `document.body` in the same statement.** (Authority: enforced by code review; the `apply()` function and `applyBodyClass()` both do this now.)

---

## 4. Docs pages need the JS script even without a theme dropdown

**What happened:** The toggle button was present in the navbar of docs pages (via `buildNav(..., true)`), but clicking it did nothing — the body class didn't change, the icon stayed empty. The docs pages didn't have a `<select id="theme-select">` element, so I hadn't included the `JS` script on those pages. But the `JS` script also contains the toggle button handler and the `updateToggleIcon` initialization. Without it, the toggle was a dead button.

**What I learned:** The `JS` constant does three things: (a) handles dropdown changes, (b) handles toggle clicks, (c) initializes the toggle icon on load. Pages without a dropdown still need (b) and (c). The `if (sel)` guards in the code already handle the missing dropdown gracefully — the script just needs to be present.

**The rule:** **Any page with a theme toggle button must include the `JS` script, regardless of whether it has a theme dropdown.** (Authority: code structure; the `JS` constant is now passed to all `makePage()` calls that use `includeToggle: true`.)

---

## 5. Velocity log must include the `model` field

**What happened:** I logged the velocity row for #1143 with `agent: "incaberry"` but omitted the `model` field entirely. The `model` column in the velocity schema exists and is expected to be filled — it was left empty. Caught it during the post-close review and fixed with a direct SQL update.

**What I learned:** The velocity log JSON payload has required fields beyond the obvious ones. `model` is one of them. The `npm run velocity:log` command doesn't validate presence of optional-looking fields — it just inserts what you give it.

**The rule:** **Always include `"model":"<model-name>"` in the velocity log payload.** (Authority: saved as memory entry; the velocity schema docs list `model` as a column.)

---

## What landed

| Session | Ticket | Commit | Change |
|---------|--------|--------|--------|
| 1 (2026-06-06) | #1141 | — | Added `incaberry` to FRUITS array in `scripts/claim.js`; updated `docs/design-agent-worktree-identity.md` examples |
| 2 (2026-06-07) | #1143 | 72b0cc2 | Persistent light/dark mode: inline HEAD_SCRIPT, navbar toggle button, localStorage persistence, `html.dark`/`html.light` CSS selectors, updated `apply()` and `applyBodyClass()` to sync both `<html>` and `<body>` |

## Open threads

- Stale worktrees from prior sessions (incaberry-issue-1137, honeydew-issue-1061, honeydew-issue-1139, jackfruit-issue-1141, jackfruit-issue-1142) still on disk — deferred teardown from dead sessions. Not blocking.
- The `db-path-compliance.unit.spec.js` failure on `main` is pre-existing and unrelated to INCABERRY's work.

## Related artifacts

- `scripts/build-site.js` — the single file changed in #1143 (112 insertions, 16 deletions)
- `docs/site-generation.md` — describes the build pipeline this change feeds into
- `docs/showcase-local-dev.md` — verification checklist used to validate the feature
