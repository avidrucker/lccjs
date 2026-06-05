# 832 — Wave Composition Quality Analysis

**Date:** 2026-06-05  
**Agent:** APPLE  
**Issue:** #832 — RESEARCH: analyze wave-composition quality — ratio targets, cluster metadata, and load-balancing for fruit-agent-orchestrate

---

## Summary

Two complete orchestration waves were analyzed using the velocity CSV (722 logged rows as of 2026-06-05). Wave 2 had only **15 % code-touching work** vs. Wave 1's **42 %**, driven by a backlog that had drained its DEV tickets and was left with meta/research accumulation. Three proposals follow: a DEV-floor ratio target enforced at orchestration time, a lightweight `cluster:` label scheme for new issues, and a top-up protocol for light-loaded agents.

---

## Wave data

### Wave 1 — 2026-06-04 to early 2026-06-05 (rows 688–719, n=26)

| Role | Count | % |
|------|-------|---|
| DEV | 11 | 42 % |
| WRITER | 8 | 31 % |
| RESEARCH | 4 | 15 % |
| PM | 2 | 8 % |
| SPIKE | 1 | 4 % |

Code-touching (DEV): **42 %**  
Non-code (WRITER + RESEARCH + SPIKE + PM): **58 %**

### Wave 2 — 2026-06-05 first orchestration session (rows 720–737, n=13)

| Role | Count | % |
|------|-------|---|
| RESEARCH | 4 | 31 % |
| PM | 4 | 31 % |
| WRITER | 3 | 23 % |
| DEV | 2 | 15 % |

Code-touching (DEV): **15 %**  
Non-code: **85 %**

### Interpretation

The drop is not random. Wave 2's actionable queue at the time of orchestration had **zero pure-DEV tickets** — all available code work had already been claimed or closed. Research and PM tickets persist longer than DEV tickets (DEV work resolves in minutes; research docs generate follow-on tickets). The backlog therefore accumulates toward research-heavy over time unless DEV work is continuously replenished.

---

## Proposal 1 — DEV-floor ratio target

**Rule:** At orchestration time, DEV-role tickets must account for at least **30 % of assignments**. If the actionable queue cannot supply a 30 % DEV floor, the orchestrator must either:

a) **Lift a deferred DEV ticket** — scan the `deferred` label queue for a DEV ticket that can be undeferred (no active blockers), assign it, and add a note in the assignment paragraph.  
b) **Flag the shortfall explicitly** — if no DEV work can be surfaced, report it as `⚠ DEV floor not met (N %)` above the assignments section so the human PM can replenish the queue.

**Why 30 % and not 40 %?**  
Wave 1 (the healthy wave) ran at 42 %. A 40 % target would be ideal but fails immediately when the queue is depleted. 30 % is achievable by lifting one or two deferred tickets, and it keeps the floor meaningful without making every orchestration run a false alarm.

**Scope:** Applied per wave (per invocation of `/fruit-agent-orchestrate`), not as a rolling average. Rolling averages are invisible at decision time.

---

## Proposal 2 — Lightweight `cluster:` label scheme

**Problem:** `puzzle-clusters.csv` covers only issues < ~240. Newer tickets have no cluster annotation, forcing the orchestrator to guess file ownership from titles (fragile, silent when wrong).

**Proposed labels** (prefix `cluster:`):

| Label | Files covered |
|-------|--------------|
| `cluster:src` | `src/**` — assembler, interpreter, linker, plus, utils |
| `cluster:tests` | `tests/**` |
| `cluster:scripts` | `scripts/**` |
| `cluster:skills` | `.claude/skills/**` |
| `cluster:docs-workflow` | `docs/claude_workflow.md`, `docs/do-this-not-that.md`, `docs/project-gotchas.md`, `docs/pitfalls.md` |
| `cluster:docs-research` | `docs/research/**` |
| `cluster:docs-learnings` | `docs/learnings/**` |
| `cluster:docs-site` | `docs/site/**` |
| `cluster:issue-only` | No file changes (issue comments, labels, closures only) |

**Convention:**
- Add one `cluster:` label when filing a new issue; if the ticket spans two clusters, pick the primary one and note the secondary in the issue body.
- The orchestrator reads `cluster:` labels in Step 5 and refuses to assign two agents to the same cluster in the same wave (unless one ticket is `cluster:issue-only`).
- Existing issues do not need backfill; the label takes effect on new issues going forward.

**Two tickets that proved the need:** #833 and #835 both modified `docs/do-this-not-that.md`. Without cluster metadata, the conflict was caught only by manually reading both titles. With `cluster:docs-workflow`, the collision would be detected automatically.

---

## Proposal 3 — Top-up protocol for light-loaded agents

**Problem:** Wave 1 assigned GRAPE a single issue-comment task (H ≤ 5 min) with no mechanism to offer a second ticket. One agent's capacity went unused.

**Rule:** After initial assignment, if any agent's single assigned ticket has `H_min ≤ 10`, the orchestrator offers that agent the next unassigned actionable ticket from a **different cluster** than their first ticket. The offer appears in the assignment paragraph with the label "(top-up)".

**Constraints:**
- Top-up ticket must be from a cluster not already assigned to any agent in this wave.
- If no suitable top-up exists, note explicitly: "(no top-up available — all clusters spoken for)".
- Top-up tickets are assigned in priority order (same Yegor ranking as first assignments).
- An agent must finish their first ticket before starting the top-up — the top-up is not parallel work.

**Why H ≤ 10 min as the threshold?**  
At the current median RESEARCH actual of 4 min and PM actual of 2 min, an H ≤ 10 ticket is likely to complete in under 5 min wall-clock, leaving meaningful capacity available. An H > 10 ticket may still run fast but the estimate uncertainty is higher.

---

## Recommended immediate actions

| Action | Owner | Effort |
|--------|-------|--------|
| Add `cluster:` label to the 9 issues currently in the actionable queue | PM | ~5 min |
| Update `fruit-agent-orchestrate` Step 5 to check `cluster:` labels before assigning | DEV (new ticket) | ~30 min H |
| Add DEV-floor check to Step 3 or Step 5 of the skill | DEV (same ticket) | ~20 min H |
| Add top-up paragraph template to Step 5 of the skill | WRITER (new ticket) | ~15 min H |

These four actions convert all three proposals from guidelines into enforced behavior in the skill itself.

---

*Closes #832*
