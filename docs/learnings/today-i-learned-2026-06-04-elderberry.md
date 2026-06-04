# Today I Learned — 2026-06-04 (ELDERBERRY)

Date: 2026-06-04
Context: Session covering #427 (Tier 2 tracker orientation), #690 (M2 oracle-CI spike),
#698 (human-decision REVIEW gate), #700 (ILCC dashboard feature audit), #714/#715 (web
parity follow-up tickets).

---

## 1. The oracle golden-file cache already makes 106/124 oracle tests CI-compatible

The oracle test suites store their reference outputs in `tests/goldens/` — and those
files are git-tracked. The actual comparison step (Step 3) only calls LCC.js and diffs
against the committed goldens. The oracle binary is **only invoked** during golden
regeneration (when `GOLDEN_AUTO_UPDATE=1`).

Running the oracle suite with `LCC_ORACLE` unset confirmed this:

```
Tests: 18 skipped, 106 passed, 124 total
```

No container, no mock, no redistribution of a closed-source binary is needed for CI.

**Why the other 18 skip:** four test files use an older pattern — `const itOracle =
assertOracleConfigured() ? test : test.skip` — which calls the oracle live and skips
unconditionally without it. The fix is to migrate those four files to the golden-cache
pattern, not to set up any infrastructure. (#692 tracks that migration, gated on the
human decision in #698.)

---

## 2. Before proposing infrastructure, check whether the problem is already solved

The original #690 scope was "design snapshot-based mock or minimal containerisation of
oracle binary for CI." The actual answer was simpler: read the existing test code and
run the suite without the binary. The answer was already there.

Two lessons in one:
- Read the code before designing solutions.
- "Can't run in CI" deserves a quick empirical test before a design spike.

---

## 3. lccjs and the ILCC dashboard have complementary, non-overlapping strengths

The ILCC dashboard (`hydra.newpaltz.edu/…/ilcc/dashboard`) has a full run-in-browser
playground but **no syntax highlighting**. lccjs has syntax highlighting (Shiki + custom
LCC grammar) but **no execute button** — the showcase editor is highlight-only, and the
injector executes but doesn't have an editable input.

The biggest single gap lccjs can close: a standalone playground page that combines the
showcase's syntax-highlighted editor with the injector's execution engine. (#715)

---

## 4. WebFetch cannot scrape JavaScript SPAs

The ILCC dashboard is a JS-rendered single-page app. `WebFetch` returned only the shell
(`"client"`). Feature data had to come from the human reporter's direct observations.

When a URL is a SPA, fall back to: human observation notes, the page's JS bundle if
fetchable, or the DOM via a real browser session. Don't spin trying to re-fetch.

---

## What landed

| Ticket | Role | Change |
|--------|------|--------|
| #690 | SPIKE | Oracle-CI design spike — golden cache already covers 106/124 tests; `docs/research/oracle-ci-spike.md` |
| #698 | REVIEW | Human decision gate filed; blocks #692 |
| #692 | DEV | Migrate 4 itOracle files to golden-cache (blocked on #698) |
| #700 | RESEARCH | ILCC dashboard feature audit; `docs/research/ilcc-dashboard-feature-audit.md` |
| #714 | PM | Web parity gap-checklist tracker (child of #707) |
| #715 | DEV | Standalone playground page — editor + run + output |
