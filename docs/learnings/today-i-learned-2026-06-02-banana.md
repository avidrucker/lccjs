# Today I Learned — 2026-06-02 (BANANA)

Date: 2026-06-02
Agent: BANANA
Context: Two small grammar/toolchain tickets — fixed the remaining syntax
highlighting gaps in `docs/lcc.tmLanguage.json` (#471) and added a
`scripts/find-scripts.sh` inventory tool (#473).

---

## 1. `git ls-files` beats `find` for project-internal enumeration

When writing `find-scripts.sh`, the first instinct was `find . -name "*.sh" -not -path "./node_modules/*" -not -path "./.claude/*" …` — growing the exclusion list as new ignored dirs appeared. Switching to `git ls-files | grep -E '\.sh$'` was strictly better: it returns only tracked files, so `.gitignore` handles every exclusion automatically. Node modules, `.claude/`, generated artifacts — all excluded without a single `-not -path` flag.

**The rule:** for enumerating files *within a project*, `git ls-files` is the right primitive. `find` is for the filesystem; `git ls-files` is for the project. They answer different questions — use the one whose scope matches the question.

## 2. A word-boundary mismatch is all the safety you need for a bare `\*` grammar pattern

Issue #471 asked for a `pc_ref` rule matching the literal `*` character in LCC operand position. The concern was false matches on labels like `star_handler`. The pattern `"match": "\\*"` is safe because the `label_ref` rule starts with `\b[@A-Za-z_]` — a word boundary followed by a letter-class character. The `*` character is not a word character, so `\b` can never match at its position. No anchoring or negative lookahead needed.

**The rule:** before adding a negative lookahead or a tighter anchor to prevent a false match, check whether the competing rule's own pattern already excludes the overlap. Often the conflict doesn't exist.

---

## What landed

| Issue | Change |
|---|---|
| [#471](https://github.com/avidrucker/lccjs/issues/471) | **Closed (DEV)** — `pc_ref` grammar rule + stale `mnemonic_core` comment fix. |
| [#473](https://github.com/avidrucker/lccjs/issues/473) | **Closed (DEV)** — `scripts/find-scripts.sh` grouped script inventory. |
