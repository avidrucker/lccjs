# Today I Learned — 2026-06-05 (DRAGONFRUIT)

Date: 2026-06-05
Agent: DRAGONFRUIT
Context: Research spike for #824 — define a ticket-dependency sequencing protocol
to prevent parallel-agent write conflicts. Triggered by the 2026-06-05 orchestration
session where #821 (fix claim.js) and #796 (test claim.js) were withheld from
parallel assignment because the tests would immediately go stale once the fix landed.
No convention existed; the orchestrator resolved it ad-hoc. This TIL proposes the
convention so future sessions have a documented rule.

---

## 1. Two distinct conflict types require different responses

When two open tickets are candidates for parallel assignment, there are two ways they
can conflict:

**Semantic sequencing conflict**: Ticket B's correct implementation depends on Ticket
A's final output. The canonical example is `fix: X` + `test: cover X`. Writing tests
against unfixed behavior produces tests that either (a) pass against the wrong behavior
and must be rewritten after the fix, or (b) are written to fail — a deliberate but
fragile approach. Either way, the test ticket cannot be done correctly until the fix
ticket is closed.

**Write conflict**: Tickets A and B both modify the same files. Their branches will
produce a merge conflict. The conflict itself is resolvable, but it wastes cycle time
and risks corruption if the resolver doesn't understand both changes.

The existing `blocked` label covers a third case — waiting on an external event (a
professor reply, an upstream release) — and should not be overloaded for inter-ticket
sequencing. A `blocked` ticket is stuck indefinitely; a `sequenced` ticket is just
waiting for a sibling to land first.

**The rule:** distinguish the type before deciding the response. Semantic conflicts
require strict ordering. Write conflicts in the same cluster require ordering or
explicit conflict-resolution planning. External blocks need the `blocked` label and
are not assignable at all.

## 2. The proposed annotation: `Sequenced after: #N` in the issue body

The body is the right place to encode sequencing constraints because labels cannot
express *which* ticket is the dependency. A `depends-on` or `sequenced` label alone
is opaque — it tells you a constraint exists but not what it is. Any agent reading
only the label still has to open the body.

The recommended format, placed in the issue body just after the role/H line:

```
Sequenced after: #N — <one sentence on why>
```

Example for a hypothetical #796:
```
Sequenced after: #821 — tests must be written against the corrected claim.js
behavior, not the current broken one.
```

This line is machine-parseable with `grep "Sequenced after:"` or a `gh` body query.
It is also human-readable in the issue list preview.

For multi-step chains (`B after A, C after B`), each ticket names only its immediate
predecessor. The chain is reconstructable by following the links.

**Optional label `sequenced`**: Apply to any ticket that has a `Sequenced after:`
line. This makes the constraint visible in `gh issue list` output without opening the
body, and lets `fruit-agent-orchestrate` cheaply identify candidates to check. The
label is never authoritative on its own — it is a filter shortcut.

## 3. How `fruit-agent-orchestrate` should enforce this in Step 2

Step 2 (pre-flight cleanup) already checks for stale markers and stale worktrees.
Add a third check: **sequencing constraints**.

For each open ticket in the actionable queue:

1. Check the body for `Sequenced after: #N`.
2. Resolve the state of #N:
   - **#N is CLOSED** → constraint satisfied; ticket is freely assignable.
   - **#N is OPEN and claimed/in-flight** → hold the dependent ticket; annotate it
     in the triage output as `⏳ waiting on #N (in-flight)`. It will become
     available when #N closes.
   - **#N is OPEN and unclaimed** → assign #N first. If both tickets would otherwise
     go to different agents, assign #N to the most available agent and hold the
     dependent ticket for a later round.
3. Report constrained tickets under a new pre-flight section:
   `## ⏳ Sequenced — waiting on dependency`.

The label `sequenced` enables a quick pre-filter: only inspect body text for tickets
that carry the label. Without the label, `fruit-agent-orchestrate` would have to
fetch the full body for every open ticket — expensive at 50+ issues.

## 4. Path-cluster heuristic for write-conflict detection

`docs/puzzle-clusters.csv` maps issue numbers to named clusters (e.g., `identity`,
`cluster-tooling`). When assigning two tickets to different agents, check whether
both appear in the same cluster row. If so, surface an advisory flag:

```
⚠ #A and #B share cluster `identity` — risk of merge conflict; consider sequencing.
```

This is advisory, not blocking. The orchestrator or agents can decide to proceed in
parallel and resolve the conflict, or to sequence. What matters is that the conflict
is surfaced before assignment, not discovered mid-merge.

The cluster CSV is currently sparse (covers ~12 issues). As it grows, coverage
improves. Tickets not in the CSV get no cluster check — tolerable until the file
matures.

## 5. When sequential is correct vs. when to parallelize anyway

Not every semantic overlap requires strict sequencing. The decision rule:

- **Strict sequence required**: B rewrites or tests behavior that A is changing.
  Writing B before A lands guarantees rework. (#821 → #796 is the canonical case.)
- **Parallel OK with conflict-resolution plan**: A and B touch the same file in
  non-overlapping regions (e.g., two different functions), or both are additive (new
  tests for different behaviors). The merge conflict is mechanical and resolvable.
- **Parallel OK, no conflict**: A and B touch completely different clusters. Default
  for most parallel-agent sessions.

The `Sequenced after:` annotation documents the first case. The cluster check flags
the second. The third needs no annotation.

## 6. What is not in scope here

- **Automated enforcement at claim time**: `npm run claim` does not validate
  sequencing constraints. This is deliberate — enforcement at claim time requires
  the claim script to fetch every potential dependency's state, which is slow and
  adds external calls. The orchestrator (human or `/fruit-agent-orchestrate`) is the
  right enforcement point, not the individual claim.
- **Multi-level dependency graphs**: This protocol covers direct predecessors only
  (`B after A`). Transitive chains (`C after B after A`) are handled by following
  the links at each step; no graph-traversal tooling is proposed here.
- **Retroactive annotation of existing tickets**: Existing tickets are not annotated.
  The convention applies to new tickets going forward, and can be applied
  retroactively when the orchestrator detects an ad-hoc sequencing decision (as
  happened with #821/#796).

---

## What landed

| Artifact | Change |
|----------|--------|
| This TIL | Proposed sequencing protocol: `Sequenced after: #N` body line + optional `sequenced` label + Step 2 detection in `fruit-agent-orchestrate` |
| [#824](https://github.com/avidrucker/lccjs/issues/824) | **Closed** with this doc as the deliverable |

## Open threads

- **File a child ticket** to update `fruit-agent-orchestrate/SKILL.md` Step 2 with
  the sequencing-constraint check described in §3 above. The protocol is defined here;
  the skill update is a separate WRITER task.
- **File a child ticket** to add `sequenced` to the GitHub label set and document it
  in `docs/claude_workflow.md`. Without the label, the cheap pre-filter in §3 can't
  work.
- The `puzzle-clusters.csv` heuristic (§4) is currently sparse. As more tickets are
  filed and clusters identified, the cluster file should grow to cover the active
  development surface.
