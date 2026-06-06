# Research: Parent-Tracker Hint Effectiveness (#932)

**Date:** 2026-06-06  
**Agent:** APPLE  
**Scope:** Assess effectiveness of the close.js parent-tracker hint shipped in #907 (commit `4b204f1`, 2026-06-06)

---

## Methodology

1. Identified all closes after `4b204f1` via `git log --oneline 4b204f1..HEAD`.
2. Checked velocity CSV notes for each close for mention of the hint.
3. Queried all open and closed issue bodies for checkbox patterns (`- [ ]`/`- [x]`) referencing each recently closed issue number.
4. Sampled open issues for any current unchecked boxes with issue-number references to understand forward readiness.

---

## Findings

### 1. Sample size: 3 closes in the observation window

| Issue | Closed by | Closed at (UTC) | Hint fired? |
|-------|-----------|-----------------|-------------|
| #924 (ISA docs) | ELDERBERRY | 2026-06-06T06:46Z | No |
| #908 (interactive fix) | CHERRY | 2026-06-06T06:47Z | No |
| #914 (interpreter fix) | APPLE | 2026-06-06T06:51Z | No |

### 2. Why the hint did not fire: tracker created after the closes

`#938` ("TRACKER: apply issue-review-skill to open issues") was created at **2026-06-06T07:05Z** — 6–19 minutes after all three closes. It is the first post-#907 tracker with numbered unchecked checkbox references. Since no open issue had `- [ ].*#924\b`, `- [ ].*#908\b`, or `- [ ].*#914\b` at close time, `findParentTrackers` returned zero matches for all three.

The hint did not fail — there was simply nothing to match.

### 3. Mechanism correctness confirmed

- 14 unit tests in `tests/new/close.unit.spec.js` cover `findParentTrackers` logic and pass.
- The scan runs on every close (not opt-in); it fetches all open issues and applies the regex `- \[ \].*#N\b`.
- No silent failures observed in velocity notes.

### 4. Forward readiness: hint will fire on next close cycle

`#938` now has 6 unchecked batch rows covering ~35 open issues:

```
- [ ] A — batch 1 — #937, #936, #935, #934, #933
- [ ] B — batch 2 — #932, #931, #930, #928, #927, #926
...
```

When any of #932, #933, #930, etc. close, `findParentTrackers` will match `#938` batch B/A and print the hint. The first real-world test is **imminent** (APPLE/BANANA close #932/#933 this session).

### 5. `--update-trackers` adoption: cannot assess yet

Zero fires means zero opportunities to use `--update-trackers`. Adoption measurement is deferred to the next research pass after the first fire.

### 6. Tracker body drift since #907: no regression observed

The #714/#904 incident (children #732/#733 closed without updating #714's checklist) motivated #907. The three post-#907 closes were standalone bug/docs tickets not tracked in any parent checklist, so no drift occurred or was prevented in this window.

---

## Limitation identified: multi-issue checkbox lines

`#938`'s batches group multiple issues on a single checkbox line:

```
- [ ] B — REVIEW (45m): batch 2 — research/data #932, #931, #930, #928, #927, #926
```

When `#932` closes, `findParentTrackers` correctly identifies the line. However, `--update-trackers` would **mark the entire box as checked** (`- [x]`) even though #931–#926 are not yet closed. This premature check would misrepresent tracker status.

**Recommendation:** `--update-trackers` should skip auto-edit when the matching line references more than one issue number. Print the hint but require manual resolution. File a child ticket if this is worth hardening.

---

## Answers to the four questions in the issue

1. **Is the hint actually firing on real closes?** Not yet — zero fires in 3-close observation window. Root cause: closes preceded the first tracker with numbered checkbox references. Hint is in position to fire imminently.

2. **Are agents acting on the hint?** Cannot assess — no fires observed.

3. **Is `--update-trackers` being adopted vs ignored?** Cannot assess — no fires. Note the multi-issue-line caveat above before promoting to default.

4. **Is tracker drift less since #907?** Inconclusive. The 3 post-#907 closes were standalone (not tracker-children), so the comparison baseline is missing. First measurement opportunity: check #938's body after 5+ of its referenced issues close.

---

## Recommendations

1. **No immediate action.** The mechanism is working as designed. Hint will fire in this session.

2. **Re-run this research after #938 batch A/B are partially closed.** 5+ fires is a usable sample for adoption and drift measurements.

3. **File a child ticket for the multi-issue-line `--update-trackers` edge case** before promoting auto-update to default. The hint-only path is safe; auto-edit is not for grouped checkboxes.

4. **Defer the "should `--update-trackers` become default?" decision** to a follow-up after adoption data exists.
