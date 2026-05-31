# Commit Quality Findings — lccjs

**Date:** 2026-05-31  
**Agent:** APPLE  
**Issue:** #280  
**Reference spec:** [qoomon's Conventional Commits gist](https://gist.github.com/qoomon/5dfcdf8eec66a051ecd85625518cfd13)

---

## 1. Conventional Commits: spec recap

```
<type>(<optional scope>): <description>
<blank line>
<optional body>
<blank line>
<optional footer(s)>
```

**Standard types:** `feat`, `fix`, `refactor`, `perf`, `style`, `test`, `docs`, `build`, `ops`, `chore`

**Key rules from the spec:**
- One type per commit.
- Scope is optional context — **do not use issue identifiers as scopes.**
- Description: imperative present tense, lowercase, no trailing period.
- Breaking changes: `!` before the colon; `BREAKING CHANGE:` in the footer.
- Footer may reference issues: `Closes #N`, `Fixes #N`.

---

## 2. Repo history: two eras

| Era | Commits | Notes |
|-----|---------|-------|
| Pre-CC (before `931b6fe`) | ~575 | Free-form (`init`, `update`, `fix add …`). Predates any CC adoption. |
| CC era (`931b6fe` → `HEAD`) | 355 | Project intentionally uses CC from this point forward. |

All findings below apply to the **CC era only**.

---

## 3. Compliance rate

In the CC era, **349 / 355 commits (98.3%)** match the conventional commits format.

**The 6 exceptions:**

| SHA | Subject | Problem |
|-----|---------|---------|
| `b035a64` | `test+fix: branch-mnemonic OG parity audit…` | Compound type (`test+fix`) — spec allows exactly one type. |
| `e825552` | `update .a and .ap syntax highlighting…` | Missing colon-format; bare `update` is not a CC type. |
| `9422e9b` | `Pin Node version via .nvmrc + engines.node` | No type prefix at all. |
| `b012a67` | `todo(#68): log call-site link.e intent…` | `todo` is not a standard type; also uses issue ID as scope. |
| `c90e7c5` | `Merge branch 'glossary-puzzles'` | Git merge commit — generally acceptable. |
| `e3ef37c` | `Merge improve-docs-branch-2026-may-25-01…` | Git merge commit — generally acceptable. |

---

## 4. Project-specific types (extensions to the spec)

The project has added custom types not in the official spec. They appear consistently and are clearly intentional, but they are **not documented anywhere**.

| Type | Count | Usage | Verdict |
|------|-------|-------|---------|
| `pdd` | 6 | Adding `@todo` puzzle markers at code sites | Reasonable extension; document it. |
| `research` | 4 | Research-only deliverable commits | Reasonable; document it. |
| `data` | 3 | Data re-runs / CSV analysis updates | Reasonable; document it. |
| `stats` | 1 | Statistical analysis commits | Reasonable; document it. |

These are fine to keep — the spec allows project-specific extensions. They just need to be written down so every agent (and any future contributor) knows the full type vocabulary.

---

## 5. Issue IDs used as scopes (spec violation)

The spec explicitly states: **"Do not use issue identifiers as scopes."**

Eight commits violate this rule:

```
pdd(#223):       file identity follow-ups #228/#229/#230 + markers
research(#223):  reconcile --as vs CLAUDE_AGENT_NAME
data(#213):      re-run enrich + day-02 notebook on the dedup'd CSV
data(#210):      bucket day-02 velocity §1 in HST, not UTC
research(#208):  graduate @todo — de-confound velocity over-time drift
data(#206):      re-run day-02 velocity notebook on 74-row CSV
research(#152):  validate cea semantics; fix imm-width doc defect
research(#145):  report-artifact parity probe + findings
```

**Fix going forward:** put the issue number in the description body or footer, not the scope.

```
# Wrong
research(#208): graduate @todo — de-confound velocity over-time drift

# Right (issue in description)
research: graduate @todo — de-confound velocity over-time drift (#208)

# Or right (issue in footer)
research: graduate @todo — de-confound velocity over-time drift

Closes #208
```

---

## 6. `chore` overloading

`chore` is used for a wide range of work: gitignore tweaks, PDD marker flips, velocity-row PM-accounting, todos clearing. Some of these are legitimately `chore`; others stretch the definition. This isn't a spec violation, but it makes `chore` commits noisy and hard to grep.

Common sub-patterns that have their own scopes (`chore(velocity)`, `chore(pdd)`, `chore(todos)`, `chore(puzzles)`) work well. The undifferentiated bare `chore:` commits are the noisiest.

---

## 7. Project-specific scopes in use

These appear consistently across many commits and are meaningful within the project workflow. Not a problem — just worth documenting alongside the custom types.

| Scope | Meaning |
|-------|---------|
| `velocity` | puzzle-velocity.csv row logging |
| `pm` | project-management / filing cycles |
| `pdd` | PDD marker edits |
| `todos` | TODOS.md housekeeping |
| `learnings` | TIL entries in docs/learnings/ |
| `parity` | oracle parity deviation docs |
| `workflow` | claude_workflow.md edits |
| `glossary` | docs/glossary/ changes |
| `claim` / `close` / `scripts` | toolchain script changes |

---

## 8. Summary scorecard

| Area | Status | Notes |
|------|--------|-------|
| Format (`type(scope): desc`) | ✅ 98.3% conformant | 4 real violations + 2 merge commits |
| Standard types | ✅ Core types used correctly | |
| Custom types | ⚠️ Undocumented | `research`, `data`, `stats`, `pdd` — add to CONTRIBUTING.md |
| Issue IDs as scopes | ❌ 8 violations | Stop; put `#N` in description or footer |
| Compound types | ❌ 1 violation (`test+fix`) | Pick dominant type or split commit |
| Description format | ✅ Consistently imperative, lowercase | |
| Breaking change notation | ✅ N/A — internal toolchain | No public API yet |
| Merge commits | ✅ Acceptable | Standard git behavior |

---

## 9. Recommendations

### Immediate (change behavior now)

1. **Never use issue numbers as scopes.** Put `(#N)` in the description or use `Closes #N` in the footer.
2. **No compound types.** If a commit fixes and tests, pick `fix` (the dominant change). If they're truly separate, make two commits.

### Short-term (one small ticket each)

3. **Write a `CONTRIBUTING.md` commit-conventions section** (or add to CLAUDE.md) that lists:
   - The full type vocabulary including project extensions (`research`, `data`, `stats`, `pdd`).
   - The project-specific scope vocabulary.
   - The issue-reference rule (description vs. footer).

4. **Add a lightweight `commit-msg` hook** that rejects messages with `(#N)` as a scope or compound `type+type` prefixes. A ~15-line shell script is enough; no `commitlint` dependency needed.

### Optional

5. **Audit `chore` usage** — where `chore(velocity):` is purely a velocity CSV row with no code change, `docs(velocity):` is arguably more accurate. (Low priority; the project already uses `docs(velocity)` consistently for most of these.)

---

*This document is the deliverable for issue #280. Future audits: re-run `git log --oneline <last-sha>..HEAD | grep -v -E "^[a-f0-9]+ (feat|fix|...):"` against the extended type list.*
