# Second-Wave Assignment Protocol for fruit-agent-orchestrate

**Date:** 2026-06-05
**Issue:** #827
**Context:** 2026-06-05 session produced 10 actionable tickets for 7 agent slots. Three tickets (#795, #813, #796) were deferred with no formal protocol for pickup after first-wave agents closed.

---

## Problem statement

When the actionable queue exceeds the agent roster (7 agents, N > 7 tickets), the current skill assigns 7 and silently drops the rest. Agents have no signal that overflow work exists, no ordered list to draw from when they finish early, and no convention for self-assigning without human coordination.

Three questions to answer:
1. What triggers second-wave pickup — agent self-assign, human re-invocation, or something else?
2. Should overflow be included in original assignment paragraphs ("if you finish early, pick up #N")?
3. Should the skill emit a dedicated second-wave section?

---

## Question 1 — Re-invocation trigger

Four options considered:

**A. Human re-invokes the skill** after first-wave agents close. Clean state, fresh triage, no stale queue. Latency: the human must notice that agents are free and manually issue `/fruit-agent-orchestrate`.

**B. Agent self-invokes the skill.** Not viable — the trigger rule ("only when user types it verbatim") exists to prevent autonomous invocation. Removing that guard creates unpredictable re-entrancy.

**C. Agent picks from a pre-computed overflow list included in its original assignment.** No coordination needed. The orchestrator computes the overflow queue at triage time (it already knows the full priority order) and embeds it in the assignment output. An agent that closes early reads "check the second-wave queue below" and claims the top available item.

**D. Agent posts a handoff message and waits for human direction.** Lowest autonomy; requires human attention per agent cycle.

**Recommendation: Option C as the primary path, Option A as the fallback when the queue is exhausted.**

Option C requires only that the skill output include a priority-ordered overflow list. The claim script already prevents races (two agents competing for the same overflow item get a clean error on the second claim attempt and can try the next item). No new tooling is needed.

---

## Question 2 — Include overflow in original assignment paragraphs?

**Yes, with a standard tail sentence.**

Each agent assignment paragraph should end with:

> When you close your ticket, check the **Second Wave** section below and claim the top available item.

This replaces ad-hoc "if you finish early" notes. The sentence is identical for all agents, so the orchestrator emits it unconditionally whenever a second-wave queue exists. When the queue is empty (≤ 7 actionable tickets), the sentence and the section are both omitted.

---

## Question 3 — Dedicated second-wave section in skill output?

**Yes.** Add a `## 🔄 Second Wave — overflow queue` section immediately after `## 👥 Assignments`. Format:

```
## 🔄 Second Wave — overflow queue

Listed in Yegor priority order. First available agent claims the top item.

| Priority | Ticket | Role | Est |
|----------|--------|------|-----|
| 1 | #N — title | DEV | 30m |
| 2 | #M — title | WRITER | 20m |
| 3 | #P — title | RESEARCH | 45m |
```

Rules:
- Include up to 5 overflow tickets (beyond that the queue grows stale before agents reach it).
- Same ranking algorithm as the main actionable table (severity → estimate → number).
- Blocked and icebox issues are never in the second-wave queue.
- If the queue is empty, omit the section entirely.

---

## Handoff message convention

When an agent closes its first-wave ticket and is ready to self-assign:

> Closed #N. Claiming #M from the second-wave queue.

No human reply needed for the common path. The agent runs `npm run claim -- M --as <fruit>` immediately after the closing commit. If the claim fails (another agent already grabbed it), the agent tries the next item in the queue.

When the second-wave queue is exhausted and an agent is still free:

> Closed #N. Second-wave queue exhausted — standing by.

This is the signal for the human to either run `/fruit-agent-orchestrate` again or direct the agent manually.

---

## Proposed skill changes

### Output shape (updated)

```
## ⚠ Pre-flight cleanup
[stale markers and worktrees]

## 🎯 Actionable — Yegor priority order
[compact ranked table, all actionable issues]

## ⛔ Blocked  /  💤 Icebox  /  🔵 In-flight
[brief lists]

## 👥 Assignments

APPLE: [paragraph ending with "When you close, check the Second Wave section below and claim the top available item."]

BANANA: [same tail when second-wave queue is non-empty]

... (all 7 agents)

## 🔄 Second Wave — overflow queue     ← new; omit if ≤7 actionable

| Priority | Ticket | Role | Est |
|----------|--------|------|-----|
| 1 | #N — title | DEV | 30m |
...
```

### Step 5 update (produce assignments)

Add to the existing rules:

> If the actionable queue has more than 7 items, emit a `## 🔄 Second Wave — overflow queue` section listing items 8–12 in priority order. Append this sentence to every first-wave assignment paragraph: "When you close your ticket, check the Second Wave section below and claim the top available item."

---

## Implementation ticket

The skill change is small (one new output section, one new sentence per assignment paragraph, one step-5 rule). Recommend filing a WRITER ticket to apply it — expected H ≤ 20m.

---

## Decision on re-invocation threshold

Re-invoke `/fruit-agent-orchestrate` from scratch when:
- The second-wave queue is exhausted **and** ≥ 2 agents are free simultaneously, OR
- A significant amount of new issues has been filed since the last invocation (subjective; orchestrator's call).

Do not re-invoke just because one agent is idle — the second-wave self-assign handles that case without human coordination.

---

*Agent: CHERRY · Model: sonnet-4.6 · Date: 2026-06-05*
