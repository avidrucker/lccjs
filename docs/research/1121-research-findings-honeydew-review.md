# #1121 — Audit of HONEYDEW's work on #1076

**Tracker:** #1121 · **Reviewer:** agent CLAUDE (opus-4.8) · **Date:** 2026-06-06
**Subject:** HONEYDEW's close of **#1076** ("verify the `issue-review` Hermes skill end-to-end", DEV, H:15/C:10, model `nemotron-3.0`).
**Method:** read-only audit of the captured session log + GitHub + git + the velocity row. No DB writes.

## Evidence

1. [`docs/logs/1076-honeydew-ticket-work-log.md`](../logs/1076-honeydew-ticket-work-log.md) — the full captured Hermes session (claim → review → velocity → close). **Primary source.**
2. Closing commit `05fed65` (`test(skills): verify issue-review skill end-to-end (#1076)`, `Closes #1076`).
3. Velocity row **1006** (`docs/puzzle-velocity.csv`): `1076,...,DEV,15,10,2,13,8,...,honeydew,nemotron-3.0,lccjs`.
4. #1076 close comment; #1101 (the issue HONEYDEW reviewed) — **0 comments**.

> **Scope note.** #1076 is a **Phase-2 verification** ticket (#1076–#1084), *outside* the #1105 audit window (#1066–#1073, passes #1106/#1107/#1108). So this is new ground — but it is the natural Phase-2 continuation of [`1105-honeydew-hermes-review/03-execution-and-logging.md`](./1105-honeydew-hermes-review/03-execution-and-logging.md), and several findings there recur or improve here.

---

## (a) How well did it do?

**Good — substantially better than the #1066–#1073 batch.** The session log shows HONEYDEW actually ran the `issue-review` skill against a real, on-topic open issue (#1101, a toolchain enhancement) and produced a **complete, well-formed rubric review** (work-log lines 34–148):

- Universal Rubric scored dimension-by-dimension with notes (Scope 3/3, Success criteria 2/3, File specificity 2/3, Single deliverable 3/3, Context sufficiency 0/3 → **10/15**).
- Verdict **NEEDS WORK** correctly derived from the 10/15 threshold.
- Type-specific (dev) checks with PASS/Partial/FAIL per check.
- Three **Required Changes** phrased as concrete *unanswerable agent questions* (explainKey structure, `--explain` test pattern, insertion points) — exactly the skill's intended output shape.
- Two **before→after rewrite hints** with real file:line specificity (`src/utils/explanations.js`, the 7 throw sites).

This is genuinely good review output and a clear step up from #1108's finding that the #1066–#1073 closes were byte-identical templated comments with "zero per-skill specificity."

**Velocity logging now works (improvement over #1108).** #1108 reported HONEYDEW had **0** velocity rows. #1076 logged **row 1006** via `npm run velocity:log -- --from-main '{...}'` (work-log line 156) — a well-formed row: correct role (DEV), dual H/C, timestamps, canonical model short-form `nemotron-3.0`, agent `honeydew`. The Hermes↔lccjs telemetry gap that #1108 escalated to **#1113** is, for Phase 2, at least partially closed.

**Process discipline followed the documented shape.** Claim → capture start timestamp *before* reading the issue (work-log lines 7–13) → run a `next-best-action` pre-close pass (lines 164–199, caught two AMBER items and addressed them) → commit with `Closes #1076` → `npm run close`. That is the workflow, executed in order.

---

## (b) What did it get wrong?

### 1. Stale-HEAD hash in the close comment (auditing nuisance)
The close comment reads *"Closed in d4d3630."* — but `d4d3630` is an **unrelated** commit (`research: log YAML provenance … (#1103)`). The real closing commit is `05fed65`. Root cause is visible in the log: line **202** runs `gh issue comment … "Closed in $(git rev-parse --short HEAD)…"` **before** the close commit is created at line **217**. So `git rev-parse HEAD` returned the pre-existing `main` tip, not HONEYDEW's own commit. This is a **command-ordering bug, not a fabrication** — but it points a reader at the wrong commit.

### 2. The review artifact was never persisted (biggest gap)
The rubric output above existed **only in HONEYDEW's session transcript**. It was:
- **not** posted as a comment on the reviewed issue #1101 (still **0 comments**),
- **not** committed to the repo,
- **not** attached to #1076 (the close comment only *paraphrases* it in two sentences).

The AC "Produce a structured review" was met **in substance** but not **in durable form**. Without the captured work-log the user happened to save, ACs 2–5 (rubric, verdict-vs-threshold, exact Required Changes, before→after hints) would be **unverifiable after the fact**. An e2e *verification* whose product evaporates can't be re-checked.

### 3. `actual_min = 2` is implausibly low (calibration noise)
Row 1006 records 2 minutes actual for "run skill → produce a full rubric → write it up." The timestamps (`23:04:10` → `23:05:53` = 1m43s) almost certainly bracket only a sub-slice of the real work. Not wrong per se, but it under-reports effort and lightly pollutes the calibration corpus. (Mirrors the inter-turn-gap convention: when timing isn't a clean wall-clock, note it.)

### 4. Stale claim worktrees (recurrence of #1108 §2)
Claiming #1121 surfaced the same `⚠ stale worktree … references CLOSED issue` warnings for HONEYDEW's #1066–#1073 stubs that #1108 already flagged — never torn down after close. Consistent with "uses the *claim* half of the protocol but not the *teardown* half." Out of scope to action here.

---

## (c) What can help it do better?

Ordered by leverage:

1. **Persist the review artifact (highest leverage).** A verification ticket's review should land somewhere durable: post the full rubric as a **comment on the reviewed issue** (#1101 here), or save it under `docs/` and **link it from the close comment**. This single change turns an unverifiable claim into an auditable artifact and would have pre-empted this entire audit.
2. **Fix the "Closed in `$(git rev-parse HEAD)`" pattern.** Either capture the short hash **after** the close commit exists, or drop the hash entirely and rely on GitHub's automatic `Closes #N` commit linkage. A close-comment template that interpolates HEAD *before* committing will always be wrong by one commit.
3. **Capture `started_iso` at true work start** (before the skill run, not just before the final write-up) so `actual_min` reflects real effort; if the window is partial, mark it per the inter-turn-gap convention.
4. **Tear down claim worktrees on close** (or let `npm run close` do it) — folds into the #1113/#1112 housekeeping already filed.

### Suggested follow-up @todos
- **Artifact-persistence AC convention** for all Phase-2 verify tickets (#1077–#1084): "the structured review MUST be posted on the reviewed issue or committed under `docs/` and linked from the close comment." Worth a ticket; pairs with #1105's verification phase.
- **Close-comment hash guardrail** (item 2) — small, could be a note in `docs/claude_workflow.md` close section.

---

## Correction to the originally-filed #1121 body

This audit was triggered *after* #1121 was filed, and #1121's body contains **two inaccuracies** that this doc supersedes — both caused by filing before reading the evidence log (the process bug filed as **#1122**, error row id=59):

| #1121 body said | Accurate finding |
|---|---|
| "Confabulated commit hash … cited a commit that has nothing to do with its own work." | A **stale-HEAD ordering bug** (hash captured before the close commit existed). Not a fabrication. |
| "No review artifact persisted … the rubric output exists only as a 2-sentence paraphrase." | The artifact was **fully produced** (work-log lines 34–148); it was merely **never persisted** to an auditable location. The *quality* was high. |

The "implausible 2m velocity" and "did well: real issue, clean row, trunk-based close" observations in #1121 stand.

## Cross-references
- **#1105 / #1108** — prior HONEYDEW process-hygiene audit (#1066–#1073); this is the Phase-2 sibling.
- **#1112** — HONEYDEW absent from orchestration roster (same fault line).
- **#1113** — Hermes↔lccjs telemetry policy; #1076's velocity row 1006 shows partial closure.
- **#1122** — process bug: this reviewer did the investigation + filed #1121 before claiming and before reading the evidence.
