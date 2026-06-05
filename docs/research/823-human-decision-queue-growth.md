# 823 — Human-Decision Queue Growth Analysis

**Date:** 2026-06-05  
**Agent:** APPLE  
**Issue:** #823 — RESEARCH: analyze human-decision queue growth — why so many tickets accumulate as unactionable

---

## Snapshot

Total open issues at time of analysis: **47**  
Human-gated issues (by label or title): **20**  
Fraction: **20 / 47 = 42.6 %**

Nearly half of all open tickets cannot be acted on by any AI agent without a human decision first.

---

## What counts as "human-gated"

An issue is human-gated if it carries at least one of these labels **or** has a title that unambiguously requires human action:

| Label | Meaning |
|-------|---------|
| `decision` | Human must pick an option before implementation can proceed |
| `human-decision-required` | Architectural or policy ruling needed |
| `human-required` | Inspection or review that only a human can do (e.g., visiting a live URL) |
| `humans-only` | Task inherently non-automatable (e.g., sending an email) |
| *(title-indicated)* | "HUMAN DECISION", "human decisions needed", "human review" in title but no formal label |

---

## Breakdown by category

### By label

| Label | Issues | Count |
|-------|--------|-------|
| `decision` | #829, #689, #636, #633, #632, #630, #626, #625, #550, #518, #159, #40 | 12 |
| `human-decision-required` | #757, #517 (+ #518 double-counted above) | 2 |
| `human-required` | #741, #731 | 2 |
| `humans-only` | #507 (+ #689 double-counted above) | 1 |
| Title-indicated, no label | #798, #726, #681 | 3 |

*Totals are unique issues; the label count can exceed 20 due to multi-label issues.*

### By sub-pattern

**1. #610 M-series planning batch** — 6 tickets  
`#625, #626, #630, #632, #633, #636`  
All from a single planning session (M1–M13 epic, #610). All severity:low. All open for months with no human action. They represent 30 % of the human-gated queue by themselves.

**2. Architecture / technical rulings** — 3 tickets  
`#518, #517, #757`  
Require a domain expert to validate an implementation decision (e.g., ct=0 shift semantics, demo-034 linker teaching intent).

**3. Live inspection tasks** — 4 tickets  
`#741, #731, #726, #681`  
Require a human to look at something that cannot be scraped (ILCC dashboard, Mermaid renders, ROADMAP.md readability). Three of these (#726, #681, #798) lack formal labels despite clearly needing human action.

**4. External communication** — 1 ticket  
`#507` — Send report to Prof. Dos Reis. Non-automatable by definition.

**5. Blocking-other-work decisions** — 3 tickets  
`#689, #829, #798`  
Actively gate other open tickets. `#689` blocks M1+M2 implementation; `#829` blocks agent identity convention; `#798` blocks #773 ruling ratification before implementation.

---

## Root causes

**A. Batch-created, individually-closed mismatch.**  
The #610 planning session produced 13 `decision:` tickets in one pass. None come with a deadline or a default. Human attention to them has been zero since filing. Each ticket is small (severity:low) but the queue compound effect is large.

**B. No default-and-override pattern.**  
The current convention requires explicit human approval before any "decision" work proceeds. For low-stakes choices, agents could implement a sensible default and note it — letting the human *override* rather than *approve*. This pattern does not exist yet.

**C. Label inconsistency inflates the invisible queue.**  
Three issues (#798, #726, #681) are functionally human-gated but carry no `human-*` label. Orchestration tools that filter by label under-count the actual blockage and may assign agents to stalled dependent work.

**D. No expiry or escalation path.**  
A `decision` ticket can sit indefinitely. There is no policy for what happens after N days of inactivity — no auto-default, no escalation, no expiry.

---

## Policy proposals

### P1 — Batch-decision sprint (high impact, low cost)
Schedule a single 30-minute human session to clear the #610 M-series batch (#625, #626, #630, #632, #633, #636). Six decisions made together are faster than six separate async reviews. Target: close or default all six in one pass.

### P2 — Default-and-override for severity:low decisions
For any `decision` ticket rated severity:low, agents may implement the most conservative / no-change option as a default and close the ticket with a "defaulting to X — override by reopening within 14 days" comment. This converts an indefinite block into a time-boxed opt-out.

### P3 — Age threshold and auto-default (90-day rule)
Any `decision` ticket open > 90 days with no comment activity receives an automated "defaulting to no-change in 14 days unless overridden" warning comment. After 14 days without response, close with that default logged. Prevents unbounded accumulation.

### P4 — Enforce human-gate label on title-indicated issues
Add `human-required` (or equivalent) label to #798, #726, and #681. Untag any resolved human-gate tickets immediately. Consider a pre-close lint check: if the title prefix is "HUMAN DECISION" or "REVIEW: human", the issue must carry a human-gate label.

### P5 — Cap the `decision` queue at 5
If the `decision` label count reaches 5 open tickets, new `decision` tickets are blocked until the queue drains below 3. Enforced by a GitHub Actions check or a pre-push lint. This forces human engagement before the queue grows further.

### P6 — Blocking-decision fast lane
Issues labeled both `decision` and linked as blockers to other tickets (e.g., #689, #829, #798) get a `priority:unblock` label and appear at the top of every human-action dashboard. Human reviews these first.

---

## Recommended immediate actions

| Action | Effort | Issues resolved |
|--------|--------|----------------|
| Schedule M-series batch decision session | 30 min human | #625, #626, #630, #632, #633, #636 |
| Add `human-required` label to #798, #726, #681 | 2 min | 3 label gaps |
| Apply P2 default-and-override to #636, #633, #632, #630 (M-series, lowest stakes) | 5 min human scan | 4 tickets |
| Triage #689 (blocks M1+M2) — assign to blocking fast lane | 5 min | unlocks dependent work |

Addressing just the M-series batch and fixing three label gaps would reduce the human-gated fraction from 42.6 % to approximately 29 % (14/47).

---

*Closes #823*
