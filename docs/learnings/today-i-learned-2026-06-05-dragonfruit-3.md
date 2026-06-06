# TIL 2026-06-05 — DRAGONFRUIT session 3

**Context:** Three tickets shipped this session. #859 (SPIKE) prototyped an Observable notebook velocity dashboard using Observable Plot 0.6; #897 (WRITER) clarified the close sequence in two workflow docs; a follow-up ticket (#899) was filed linking `errors.csv` to the #898 errors-table spike.

---

## 1. Observable Plot is a standalone library — the "notebook" is optional

**What happened:** Issue #859 asked for an `.ojs` or `.html` file using an "Observable notebook." I initially assumed this required the Observable notebook runtime (a build step or observablehq.com hosting). Reading the CDN docs made clear that Observable Plot 0.6 is a vanilla ES module — it imports from `cdn.jsdelivr.net` and works in any `<script type="module">` block, no runtime needed.

**What I learned:** "Observable notebook" and "Observable Plot" are different things. The notebook *format* (`.ojs` files, the Observable runtime) is one way to use Plot, but Plot itself is just a charting library. Importing it from CDN and calling `Plot.plot({...})` in ordinary HTML is the simplest path and produces a fully self-contained artifact that works anywhere the CSV is served alongside it.

**The rule:** **When an issue mentions "Observable notebook," default to a self-contained HTML file using Observable Plot from CDN — no build step, no hosting requirement, no runtime dependency.**

---

## 2. `const` is not hoisted — define before use, even in a catch path

**What happened:** In the dashboard prototype, I wrote `const NOTES = \`...\`` at the bottom of the module script, then referenced `NOTES` in a catch block near the top (the error path that fires when the CSV fetch fails). JavaScript `const` is not hoisted; the catch block would throw a `ReferenceError` rather than displaying the notes text.

**What I learned:** This is a subtle trap unique to large `<script type="module">` blocks where the error path is written first and the data is defined later. Unlike `var` (which hoists to `undefined`), `const` and `let` sit in a temporal dead zone — referencing them before their declaration line is a hard error, not a silent miss.

**The rule:** **In module scripts, define constants used in early error paths at the top of the script — before any `try`/catch block that references them.**

---

## 3. `npm run close` is push-only — the commit must exist first

**What happened:** Issue #897 was filed because agents repeatedly hit `✗ working tree is not clean` when calling `npm run close` before committing. The docs showed the right sequence (commit, then close) but buried it without a prominent warning.

**What I learned:** The mental model that trips agents is "close = commit + push." In reality, `close` only loops `git pull --rebase && git push` until the commit lands on `origin/main`, then tears down the worktree. It cannot commit on your behalf. A dirty working tree is a hard abort, not a prompt.

**The rule:** **`npm run close <N>` is push-only. All changes must be committed before invoking it. If close aborts with "working tree is not clean," commit first, then re-run close.**

---

## 4. CSV append conflicts are mechanically resolvable

**What happened:** On #859 this session (and on prior sessions), `git pull --rebase` produces a conflict in `docs/puzzle-velocity.csv`. The conflict always looks the same: HEAD ends at row N, my commit adds rows N+1 and N+2, and a parallel agent added a different row N+1.

**What I learned:** This is always an append conflict — both sides are adding rows at the same line; neither is editing an existing row. The resolution is always "keep all rows from both sides, in any order." The only risk is accidentally dropping one side, which `grep -c '^<<<<<<<'` catches before `git add`.

**The rule:** **Velocity CSV conflicts are append-only; resolve by keeping both sides' rows, then verify zero conflict markers before staging.**

---

## What landed

| Artifact | Change |
|---|---|
| `docs/research/859-observable-velocity-dashboard.html` | Self-contained Observable Plot dashboard prototype (3 charts, ~300 LOC) |
| `docs/claude_workflow.md` | Blockquote callout + inline comment: close does not commit (#897) |
| `docs/puzzle-lifecycle.md` | Step 5 rewritten to open with "close only pushes"; cheatsheet comment updated (#897) |
| GitHub issue #899 | Filed: errors.csv + export script follow-up to #898 |

---

## Related artifacts

- Issue #859 (SPIKE: Observable notebook prototype)
- Issue #897 (docs: commit-first callout)
- Issue #899 (errors.csv follow-up)
