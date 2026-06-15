# RESEARCH: why f-a-o double-books a live-claimed ticket (#1335)

**Agent:** DRAGONFRUIT · **Date:** 2026-06-15 · **Type:** RESEARCH · **Parent area:** process (f-a-o cluster #1211)

> Headline: this is **not a new problem** — the mechanism and its fix are already
> characterized (#1008) and tracked (#1046 fix, #630 decision). #1335 is a concrete
> repro. Recommendation: fold, don't re-research. (§4)

---

## 1. The defect (repro from this session)

`/fruit-agent-orchestrate` assigned **#1322** to INCABERRY while it was live in
DRAGONFRUIT's worktree (`dragonfruit/issue-1322-process-ice-keep-ice-scores`). The
subsequent `npm run claim -- 1322 --as incaberry` was correctly **rejected** by the
claim guard ("issue #1322 is already live in worktree …"). So no actual collision
occurred — but the orchestrator *emitted a double-booked assignment* it should never
have produced.

## 2. Root cause

The orchestrator has no **hard exclusion gate** for already-claimed tickets:

- The skill's "Inputs To Gather" lists *"local worktrees and claimed branches"* as a
  soft input (prose), but the assignment step does not filter the assignable pool by
  live claim state — so a claimed ticket can still be assigned.
- The authoritative claim signal already exists: **`npm run puzzle:status -- --json`**
  reconciles markers × worktrees × GitHub and reports each issue's status
  (`AVAILABLE | CLAIMED | IN-PROGRESS | LOCKED | BLOCKED | STALE`). A `CLAIMED` /
  `IN-PROGRESS` row is exactly "owned by another live agent."
- f-a-o does **not** consume that JSON. It re-derives queue state from a raw
  `gh issue list` dump + per-issue reasoning, which has no notion of "claimed right now."

So the double-booking is a direct consequence of f-a-o not gating on `puzzle:status`'s
CLAIMED state.

## 3. This is already-known ground (the dedup)

| Source | What it already says |
|---|---|
| **#1008** (research, *fruit-orchestrate-redesign*) | Headline rec **R1**: "Consume `puzzle:status --json`; delete the raw dump + per-issue loop." Notes that one call "already returns CLAIMED / IN-PROGRESS states" and that f-a-o currently *duplicates, more expensively, what one `puzzle:status --json` provides." |
| **#1046** (OPEN, feat) | "f-a-o should consume `puzzle:status --json` instead of raw dump + per-issue loop." **This is the fix** — consuming it makes CLAIMED issues drop out of the assignable pool for free. |
| **#630** (OPEN, decision) | "f-a-o — detect and skip in-flight agents before assignment." **This is the decision** #1335 needs: skip-entirely vs surface-as-in-flight (the two options #1335's "Should have" already lists). |
| **#1134** (CLOSED) | "f-a-o still yields overlapping work … concurrent sessions." Related overlap class; #1335 shows the *claimed-worktree* sub-case is still open. |
| `orchestration-failure-modes.md` | Has "Category B: worktree/claim lifecycle failures" (B-1 stale worktree, B-2 waiting-on-external, B-3 closed issue) — but **not** the "assign a currently-live-claimed ticket to a second agent" sub-mode. #1335 is that missing entry. |

## 4. Recommendation

**Fold #1335 into the existing cluster — do not run a parallel redesign (it's #1008).**

1. **Fix = #1046.** Consuming `puzzle:status --json` and building the assignable pool
   only from `AVAILABLE` rows (excluding `CLAIMED`/`IN-PROGRESS`/`LOCKED`) eliminates
   the double-booking by construction. #1335 is the BDD repro that motivates #1046.
2. **Decision = #630 (human).** #630 is still an open `decision`: should a claimed
   ticket be *skipped silently* or *surfaced as in-flight/unavailable*? #1335's "Should
   have" proposes "skip OR surface, never double-assign" — that is the ruling #630
   needs. A human should rule #630 so #1046 can implement against it.
3. **One small doc fix worth doing regardless** (independent of #1046's larger refactor):
   add the missing failure mode to `orchestration-failure-modes.md` Category B — "B-4:
   assigning a live-claimed ticket to a second agent (no hard CLAIMED-exclusion gate)."
4. **#1335 disposition:** keep it open as the bug-repro-of-record **linked to #1046**
   (fix) and **#630** (decision), or close it as folded once those are cross-linked.
   Reporter's call (`yegor-bdd`).

### Why no new fix ticket

Filing a fresh "exclude claimed tickets" fix ticket would duplicate **#1046** (which
already prescribes the mechanism). Filing fresh redesign research would duplicate
**#1008**. The gap is not knowledge — it is that #1046/#630 are unresolved. The
highest-leverage next step is a **human ruling on #630**, which unblocks #1046.
