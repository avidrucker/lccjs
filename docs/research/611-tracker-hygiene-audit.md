# Tracker Hygiene Audit — Last 100 Issues

**Issue:** #611  
**Date:** 2026-06-03  
**Agent:** DRAGONFRUIT  
**Corpus:** 100 issues, `gh issue list --state all --limit 100`, range #520–#619  
**Comment:** https://github.com/avidrucker/lccjs/issues/611#issuecomment-4618638617

---

## Summary scores

| Dimension | Yes / Correct | Partial / Missing | No / Wrong |
|-----------|:---:|:---:|:---:|
| **Title clarity** (self-contained, unambiguous without body) | 46% | 54% | 0% |
| **Label accuracy** (type + severity labels present and matching) | 12% | 86% missing | 2% wrong |
| **Description coverage** (body fully substantiates title) | 21% full | 76% partial | 3% missing |

---

## Dimension 1: Title clarity

**46 / 100** titles have a `ROLE:` prefix; **54** do not.

Of the 46 with a prefix, all scored "yes" (clear enough to act without reading body). Of the 54 without, almost all scored "partially" — readable, but a fresh agent cannot infer role or type without opening the body.

**Pattern A — Commit-message format used as issue title (25 issues):**  
A large cluster uses lowercase `type(scope): description` (git-commit convention) rather than `ROLE: description` (tracker convention). Example titles: `docs(learnings): TIL...`, `fix(gamesnake): ...`, `test: integration smoke...`. Syntactically clear but break the expected `ROLE:` prefix convention and are invisible to `ROLE_PREFIXES` matchers.

**Pattern B — TIL issues are a structural outlier (17 issues):**  
TIL/learnings issues (`TIL 2026-06-03 AGENT session N — ...`) serve as diary entries, not work-complaint issues. They carry no role prefix and no BDD structure by design. Their presence systematically depresses clarity and coverage scores. They should be exempted from quality standards as a recognized sub-genre.

**Pattern C — ARCHITECT role prefix has three spellings:**  
`ARCHITECT` (#520), `ARCH` (#592), `ARC` (#539). All refer to the same role. No canonical form is enforced.

**Pattern D — Non-vocabulary prefixes in use:**  
`AUDIT:` (2 issues), `DECISION:` (1), `Q:` (1), `HUMAN REVIEW:` (1), `Tracker:` (2, not even UPPER). Non-standard, not in any documented vocabulary.

---

## Dimension 2: Label accuracy

**Only 12 / 100** issues have both a type label and a severity label that match the title's role. **86%** are partially or fully missing labels.

**Largest gap: severity label missing from 52 / 100 issues.**  
`severity:medium` appears only once in the entire corpus. Severity labels are applied inconsistently, often omitted under time pressure.

**11 issues have NO labels at all** — all closed, almost all filed mid-session under agent time pressure.

**Systematic label-name mismatches:**

| Title prefix | Expected label | Actual label used |
|---|---|---|
| `TEST:` or `test:` | `test` | `testing` (6+ issues) — label `test` does not exist |
| `SPIKE:` | `spike` | `enhancement` + sometimes `experiment` — no `spike` label |
| `ARCHITECT:` | `architect` | `research` + `decision` + `review-decision` — no `architect` label |
| `WRITER:` | (no label) | `documentation` — acceptable proxy |
| `PM:` | `pm` | `documentation` (2 issues) — wrong category |

The label vocabulary does not align with the role-prefix vocabulary. `test`, `spike`, and `architect` labels don't exist but their prefixes do.

---

## Dimension 3: Description coverage

**21 / 100** bodies have all three BDD sections (Have / Should Have / Repro). **76** have partial structure. **3** have near-empty bodies (< 100 chars).

Most partial cases are missing the `## Repro` section — they state the problem and desired state but omit a concrete reproduction path. Most common in `DEV:`, `TEST:`, and `WRITER:` issues where "repro" is implicitly "just do the task."

The **17 TIL issues** have no BDD sections by design. Excluding TILs, full-coverage rate rises from 21% to ~25%.

---

## Worst offenders (OPEN, multi-dimension failure)

| Issue | Clarity | Labels | Coverage | Gap |
|-------|:---:|:---:|:---:|---|
| #587 — Potato Token Testing suite | partially | missing | partial | No role prefix, no labels, thin body |
| #568 — Tracker: address 8 workflow gaps | partially | missing | partial | "Tracker:" not a valid role prefix; no labels |
| #558 — Tracker: human backlog-grooming from #273 | partially | missing | partial | No labels at all |
| #550 — HUMAN REVIEW: audit results from #532 | partially | missing | partial | Non-vocabulary prefix; no type/severity label |
| #609 — WRITER: correct assembler.md + interpreter.md | partially | missing | partial | Valid prefix but no matching label in tracker |

---

## Pattern observations

1. **Commit-message format is the tracker's biggest title ambiguity source.** 25% of titles use `type(scope):` instead of `ROLE:`. Both formats are clear, but mixing them makes automated scanning on prefix vocabulary unreliable.

2. **The label vocabulary does not cover all title-prefix roles.** `test` (vs `testing`), `spike`, `architect`, and `pm` labels are either absent or unused, causing systematic false-missing reads even when the title is correct. A label schema cleanup would turn ~10% of "missing" reads into "correct."

3. **Severity is the most neglected label.** Missing from 52% of issues. `severity:medium` is effectively absent (1 occurrence). The scale may be calibrated wrong — `severity:low` is doing too much work.

4. **TIL issues are an undocumented genre.** 17 issues function as session diary entries rather than BDD complaints. They fail all three quality criteria by design. Formally defining them in `RULES.md` or the label taxonomy would make the corpus bimodal and let the hygiene audit exclude them cleanly.

5. **Titles with `ROLE:` prefix are consistently clearer than bare titles.** 100% of ROLE-prefixed issues scored "yes" or "partially" on clarity; none scored "no." Even a short title like `FIX: writeSync corrupts binary output` is immediately actionable.
