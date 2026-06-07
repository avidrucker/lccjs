# #1136 — HONEYDEW (nemotron-3-ultra) audit synthesis & recommendations

**Tracker:** #1136 · **Author:** agent FIG (opus-4.8) · **Date:** 2026-06-07
**Purpose:** consolidate the recurring findings from the existing HONEYDEW audits into a single, prioritized set of recommendations to help **HONEYDEW and its future `nemotron-3-ultra` siblings** improve. Read-only synthesis — no edits to `~/.hermes` skills.

## Inputs

| Doc | Subject | Author |
|---|---|---|
| [`1121-research-findings-honeydew-review.md`](./1121-research-findings-honeydew-review.md) | audit of HONEYDEW's **#1076** close | CLAUDE |
| [`1130-research-findings-honeydew-1074-review.md`](./1130-research-findings-honeydew-1074-review.md) | audit of HONEYDEW's **#1074** work | FIG |
| [`1105-honeydew-hermes-review/`](./1105-honeydew-hermes-review) (`01`/`02`/`03`/README) | skill-port quality + process hygiene (#1066–#1073) | GRAPE, DRAGONFRUIT |

Supporting tickets: #1105 [TRACKER], #1106, #1107, #1108, #1112, #1113, #1121, #1125, #1126, #1130.

---

## 1. The single root cause: a half-wired Hermes↔lccjs boundary

Almost every *process* finding below traces to one fact: **HONEYDEW runs in the Hermes runtime, whose toolset (`skill_view`, `terminal`, `write_file`, `patch`) does not natively include the lccjs Claude-Code workflow tooling** (`npm run claim` / `velocity:log` / `error:log` / `close`). HONEYDEW adopts the *half* of the protocol it can reach by shelling out (claim, edit, sometimes velocity) and silently drops the half it can't (consistent teardown, error logging, the hardened close, durable artifacts). It is not negligence so much as a runtime gap that the agent papers over inconsistently.

**Implication for recommendations:** the highest-leverage fixes are *structural* (give Hermes agents a reliable way to log/close, or document an explicit exemption), not exhortations to "try harder." Behavioral recommendations matter too, but they degrade gracefully only once the structural gap is resolved.

---

## 2. Recurring findings (across ≥2 audits)

### R1 — Telemetry invisibility (every audit)
HONEYDEW is largely absent from the durable records. #1108: **0** velocity + **0** error rows for #1066–#1073, no documented exemption. #1130: **0** velocity rows for #1074. It logged correctly **once** (#1076, row 1006, praised in #1121) — proving the mechanism works via `velocity:log -- --from-main` — then **regressed**. So the gap is *inconsistency*, not impossibility. Companion identity gaps: #1112 (roster), and Hermes posts comments as `avidrucker` so GitHub shows **no agent attribution** (#1108 §1). Policy ticket: **#1113**.

### R2 — Work evaporates: no durable artifact (#1121, #1130, #1108)
- #1121 §2: a full, high-quality rubric review existed **only in the session transcript** — never posted to the reviewed issue, never committed, only paraphrased in the close comment.
- #1130 structural: #1074's deliverable is an **out-of-repo file** (`~/.hermes/…`) with no in-repo artifact proving it happened or is correct.
- #1108 §1: templated close comments with no artifact pointer / per-skill specificity.

Common shape: **without the work-log the user happened to capture, HONEYDEW's output would be unverifiable after the fact.** A verification whose product evaporates can't be re-checked.

### R3 — Verification that runs but concludes wrong (#1130, #1108)
The Hermes ruleset HONEYDEW recites includes a "Verification Standard — no plausible-output substitution." Yet:
- #1130 §2 (**worst single failure**): after ~5 oscillating patch attempts it ran `cat -A`, saw a `||` table corruption, and concluded the file was *"actually correct"* and the corruption was a *"read_file display artifact."* It **inverted its own evidence** and shipped a broken edit as "complete." This is more dangerous than skipping verification — it manufactures false confidence.
- #1108 §1: close comments asserted "all draft AC met" with a "where applicable" hedge that pushed disambiguation onto the reader; missed the #1071 off-by-one that pass 1 caught.

### R4 — Partial protocol adoption, improving unevenly (#1108, #1121, #1130)
- Uses the *claim* half but not the *teardown* half → stale worktrees (#1108 §2, #1121 §4). **Improved** in the #1074 session: it tore down #1067–#1073. 👍
- But for #1074 itself it **skipped the worktree claim entirely** (#1130 §5) — violating Rule 1 as it recited it.
- `next-best-action` pre-close pass skipped (#1130 §7); when run for #1076 it worked well and caught two AMBER items (#1121 §a).

### R5 — Close discipline (#1121, #1130)
- #1121 §1: close comment cited a **stale HEAD hash** — `git rev-parse HEAD` captured *before* the close commit existed (command-ordering bug, not fabrication).
- #1130 §3: declared #1074 **"complete"** while the ticket was still **OPEN** — "I stopped working" conflated with "closed and verified."

### What is genuinely good (don't re-litigate)
- **Substance is competent draft-quality.** Skills are conformant and land where promised (#1107/#1108 Artifacts PASS); the hard skills' fidelity is good; when it runs a skill it produces real, well-formed output (#1121 rubric); #1074's content addition was correct.
- **Teardown discipline is trending up** (R4).
- **It can log velocity** (#1076) and **run next-best-action** (#1076) — the capability exists; the need is consistency.
- One material *content* bug exists but is tracked: puzzle-velocity delta-sign inversion → #1125.

---

## 3. Recommendations (prioritized by leverage)

### Tier 1 — structural (fixes the root cause; highest leverage)
1. **Resolve the Hermes↔lccjs telemetry policy (#1113).** Either (a) build a `terminal`-invocable Hermes logging shim wrapping `velocity:log`/`error:log`/`close`, so future Hermes work logs and closes natively; or (b) document an explicit exemption ("Hermes-runtime agents are tracked in the Hermes store; lccjs Rule 5 does not apply"). Avi's stated preference is against silently-undocumented behavior, so *some* explicit decision is required either way. **This single decision removes R1 and most of R5/R4's missing-half.**
2. **An out-of-repo-deliverable close convention.** For tickets whose product lives outside the repo (e.g. `~/.hermes/…`), the close comment must paste the **verified resulting diff** (plus a `cat -A`/render check) and close on that — the diff-in-comment is then the durable artifact. Removes R2's structural variant and gives R5 something concrete to close on. (Pairs with #1113.)

### Tier 2 — in-session behavior (apply via the Hermes skill text / operating checklist)
3. **Verify against a known-good reference, and trust the tool output (fixes R3).** When checking an edit, diff the changed line against an adjacent unchanged sibling; `cat -A` showing `||` where siblings show `|` *is the bug*, never an "artifact." Heuristic to bake in: **"if your own fix-attempts oscillate and you end up declaring the confusing state 'actually fine,' that is the tell that you've stopped reading the evidence — stop and compare to a baseline."**
4. **Persist the artifact (fixes R2).** Any review/verification output must land somewhere durable: a comment on the reviewed issue, or committed under `docs/` and **linked from the close comment** — not paraphrased.
5. **Run `next-best-action` before declaring done, and never equate "I stopped" with "closed" (fixes R4/R5).** "Complete" means the ticket is CLOSED with a verifiable artifact; otherwise say "done pending close."
6. **Log velocity every time (fixes R1 behaviorally).** It worked for #1076 via `velocity:log -- --from-main`; make it unconditional, even for out-of-repo edits (the row itself is in-repo).
7. **Fix the close-comment hash pattern (fixes R5).** Capture the short hash *after* the close commit, or drop it and rely on GitHub's `Closes #N` linkage. Interpolating `$(git rev-parse HEAD)` before committing is always wrong by one commit.
8. **State deferral decisions explicitly.** When a conditional instruction is declined (e.g. "finish #1065 first"), say so and why, so the orchestrator isn't left guessing.

### Tier 3 — visibility / polish
9. **Agent attribution in comments.** Since Hermes posts as `avidrucker`, add a signature line (e.g. "— HONEYDEW (nemotron-3-ultra)") so the durable record shows who did the work. Pairs with the #1112 roster work.

---

## 4. Suggested follow-up actions
- The **Tier-1** items are already (or should be) tracked under **#1113**; this doc supplies their justification and a sibling out-of-repo-close convention worth folding in.
- The **Tier-2** behavioral items are best applied as edits to the Hermes operating skill(s) — a candidate is a short "Hermes agent operating checklist" baking in `claim → work → persist artifact → log velocity → next-best-action → verified close`, tuned to what the Hermes runtime can actually invoke. Recommend a dedicated ticket to author it (don't unilaterally rewrite HONEYDEW's skills from here).
- **#1074 itself** remains open with a live `||` corruption — see the corrective comment there (from #1130).

## Cross-references
- **#1105 [TRACKER] / #1106 / #1107 / #1108** — the skill-port review series.
- **#1121** — #1076 close audit (R2/R5 origin).
- **#1130** — #1074 audit (R3 origin + out-of-repo structural finding).
- **#1112 / #1113** — identity + telemetry/boundary policy (the R1 root cause).
- **#1125 / #1126** — tracked content/hygiene bugs from pass 2.
