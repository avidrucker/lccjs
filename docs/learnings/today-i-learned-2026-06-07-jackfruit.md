# TIL 2026-06-07 — JACKFRUIT

**Context:** Multi-issue session covering fruit agent roster expansion, sandbox CodeMirror theme background fix, and GitHub Pages doc curation audit.

---

## 1. Adding a new fruit agent requires updating 3 files

**What happened:** Filed issue #1141 to add JACKFRUIT as the next alphabetic fruit agent (after INCABERRY). The claim script's `FRUITS` array is the canonical source, but two documentation files also list the roster.

**What I learned:** The fruit agent identity system has three roster locations that must stay in sync:
- `scripts/claim.js` — canonical `FRUITS` array (validation + auto-assignment)
- `docs/skills.md` — `fruit-agent-orchestrate` skill description agent list
- `docs/design-agent-worktree-identity.md` — design doc example list

**The rule:** **When adding a new fruit agent, update all three locations in a single commit** so the roster is consistent across code, skill docs, and design docs.

---

## 2. CodeMirror editor background needs its own compartment for per-theme changes

**What happened:** Issue #1142 — the sandbox CodeMirror editor's background only changed between dark/light mode (via `var(--border)`), not per-theme. Only retro themes worked because they set custom `--bg`/`--border` on `:root`.

**What I learned:** CodeMirror 6 themes applied via `syntaxHighlighting` only affect token colors, not the editor's background surface. To get per-theme backgrounds:
1. Create a separate `backgroundCompartment` (like `highlightCompartment` for syntax)
2. Extract the theme's background from Shiki's theme object (root `bg` property or first rule's `background`)
3. Reconfigure the background compartment on theme change with `EditorView.theme({ '.cm-content': { background: bg }, '.cm-gutters': { background: bg } })`
4. Also call `applyBodyClass()` on theme change to update page-level dark/light/retro classes

**The rule:** **Editor background and syntax highlighting are separate concerns — use separate compartments so each can be reconfigured independently per-theme.**

---

## 3. GitHub Pages doc audit: 245 pages → ~35 needed

**What happened:** Issue #1123 — reviewed all 6 doc sections currently deployed by `scripts/build-site.js`. Found ~245 pages deployed, but ~228 are internal engineering artifacts (research spikes, agent TILs, workflow docs).

**What I learned:** The deployed site has a 20:1 ratio of internal vs. educational content. Sections break down as:
- **KEEP** (user-facing): `guides` (2), `glossary` (5), `parity` (6) = 13 pages
- **EXCLUDE** (internal): `workflow` (2), `agent-priorities/` (8), `logs/` (2)
- **CURATE** (selective): `research` (~100) → keep ~10-15, `learnings` (~130) → keep ~10-15

**The rule:** **Audit deployed doc sections against audience fit before publishing. Replace folder-based sections with explicit file lists for curation. File follow-up for whitelist/blacklist mechanism.**

---

## 4. Cross-clone claim collision handling

**What happened:** When claiming the TIL issue #1161, got a cross-clone collision error (another clone had already claimed it). Needed `--force` to override.

**What I learned:** The cross-clone claim ref system (`refs/claims/issue-N`) prevents two clones from claiming the same issue. If you get this error, the other clone may be stale — use `--force` only after verifying the other claim is dead/abandoned.

**The rule:** **Respect cross-clone claim refs by default; use `--force` only when you've confirmed the competing claim is stale.**

---

## Summary

Three distinct lessons from a multi-issue session: roster sync discipline, CodeMirror compartment separation for theming, and doc curation for public site hygiene. Each produced a concrete rule for future work.