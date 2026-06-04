# RESEARCH: Orchestration failure modes — 6-agent loop (#610)

**Date:** 2026-06-03  
**Agent:** CHERRY  
**Role:** RESEARCH  
**Companion:** #601 (scope discipline — one specific failure mode)

---

## Evidence sources

- `docs/learnings/` — 84 TIL entries (2026-05-25 through 2026-06-03)
- `docs/learnings/til-synthesis-2026-06-01.md` — cross-agent recurrence analysis over first 37 TILs
- `docs/puzzle-velocity.csv` — notes column (53 rows with process-relevant notes extracted)
- `docs/worktree-multi-agent-findings.md` — retro of the 2026-05-29 3-agent session (7 failure modes)
- `docs/research/297-workflow-ownership-map.md` — step-by-step ownership map + ROI ranking
- `docs/research/601-scope-discipline.md` — scope creep failure mode taxonomy (FM-1/FM-2/FM-3)
- `gh issue view 598` — concrete "waiting on external" ticket example
- Issue #610 comment (Avi, 2026-06-03) — post-close "next-best-action" skill proposal

---

## Part 1 — Failure mode catalogue

Thirteen failure modes identified across the seed list and evidence sweep. Organized by category; each entry includes a concrete example and root-cause classification.

---

### Category A: Communication / notification failures

#### A-1 — Wrong GitHub handle in issue mentions

**Description:** Issues and comments reference `@charlie` (a generic name) instead of the actual collaborator handle `@ItBeCharlie`. GitHub notifications are never sent; the mention is silently inert.

**Concrete example:** Multiple issues referencing Charlie over several months used the wrong handle. No ticket was filed to fix this until noticed incidentally.

**Root cause:** Tooling gap — no validation that a GitHub handle resolves to a real collaborator.

**Frequency/impact:** One documented instance, likely under-counted (authors don't see their own silent failures). Impact: medium — collaboration signals break silently, no error, no audit trail.

---

### Category B: Worktree / claim lifecycle failures

#### B-1 — Stale worktrees block next orchestration cycle

**Description:** An agent closes an issue but the worktree persists (crash, interruption, or wrong teardown). The next orchestration cycle sees the stale worktree as in-flight, incorrectly blocking other claims.

**Concrete example:** The 2026-05-29 session documented transient worktree churn (mode #7 in `docs/worktree-multi-agent-findings.md`): an agent restarting a re-scoped ticket looked like abandoned work to polling agents. `npm run close` was later built to gate cleanup on a confirmed push (#242).

**Root cause:** Workflow gap — cleanup was not gated on push success; crashes left worktrees behind with no automatic expiry.

**Status:** Partially mitigated. `npm run close` (#266) gates worktree removal on a confirmed push. Stale worktrees from crashes can still persist; `puzzle:status` shows them as STALE but requires manual cleanup.

---

#### B-2 — Claiming a waiting-on-external ticket

**Description:** An agent claims a ticket that is structurally waiting on a human or external party (a question for a collaborator, a decision-gated blocker). The agent has nothing to implement; the worktree slot is consumed; the question remains unanswered.

**Concrete example:** Issue #598 ("Q: What generates .bst/.lst — assembler, interpreter, or both?") is a question directed at `@ItBeCharlie`. It has `Role: RESEARCH / question for @ItBeCharlie` in the body. An agent claiming it would have nothing to deliver without a response from Charlie.

**Root cause:** Two sub-causes: (1) no label that signals "unactionable by an AI agent now"; (2) the orchestration skill's ticket-triage path does not check for these signals.

---

#### B-3 — Claiming a closed issue

**Description:** The `claim` script has a best-effort closed-state guard but it can miss: (a) a concurrent just-closed-but-unpushed close (the close hasn't propagated to GitHub yet), or (b) an offline `gh` invocation where the guard skips.

**Concrete example:** DRAGONFRUIT claimed #223 seconds after CHERRY closed it in the same session (#227 notes: "claim.js does not check issue state"). This filed a wasted worktree and required manual cleanup. The DEV guard was subsequently implemented (#227).

**Root cause:** Race condition (concurrent close + claim) plus offline fallback that lets the guard silently pass.

**Status:** Guard implemented (#227) — refuses unless `gh` is unavailable (offline-first, proceed on null). Racing concurrently is still possible within the guard's API-call window.

---

### Category C: Process gap / no-ticket-filed failures

#### C-1 — Bug or gap found mid-session, no ticket filed

**Description:** An agent notices something wrong (parity deviation, glossary error, hook false-positive, pre-existing bug) and either silently ignores it, mentions it in a comment, or fixes it inline — without filing a ticket. The finding evaporates.

**Concrete example 1:** `#580` (scope discipline, #601): an agent fixed `resetState()` clobbering `verboseModeOn` in `linker.js` while implementing an integration test for a different ticket. The fix had no parent ticket, no estimate, no velocity row (#601 FM-1: "bug tax").

**Concrete example 2:** Velocity CSV note on #152 (BANANA): "Found+fixed a doc defect: glossary immediate-width table listed CEA under pcoffset9; it uses imm5." — the fix landed in the same commit as the research deliverable, no separate ticket.

**Root cause:** No checklist item at close time forces the agent to scan for out-of-scope findings before writing the close commit. The rule exists in `claude_workflow.md` ("while continuing") but is not repeated at the close gate.

**Recurrence:** 3+ confirmed instances in the #601 close review; likely the most frequent category given velocity CSV evidence.

---

#### C-2 — Mistake made, no process-improvement ticket filed

**Description:** An agent makes a recoverable error (wrong commit type, velocity logged from main, stale claim raced). The mistake is fixed but no ticket is filed to prevent recurrence. The process-improvement finding evaporates.

**Concrete example 1:** #281 (CHERRY): "filed a meta-ticket to root-cause why an agent repeatedly violates instructions it demonstrably knows" — filed *at user request*, not autonomously by the agent after the violations occurred.

**Concrete example 2:** Velocity CSV note: "velocity logged from main" appears in at least one session's notes. A process-improvement ticket was not filed; the finding was captured only in the velocity notes field.

**Root cause:** Same as C-1 — no close-time prompt to check whether the session produced process failures that warrant tickets.

---

#### C-3 — Research finding not propagated

**Description:** A finding from one agent's TIL or research session is relevant to another ticket or agent but is not cross-referenced or actioned. The finding ages in the TIL corpus without being filed as a ticket or updating the relevant doc.

**Concrete example 1:** TIL synthesis (#207, ELDERBERRY) uncovered 4 high-recurrence process defects across 37 TILs, 2 medium-recurrence findings, and 4 one-offs that were not tracked in any issue. The synthesis was needed precisely because agents were not propagating findings from individual TILs.

**Concrete example 2:** `docs/research/297-workflow-ownership-map.md` identifies 8 "uncharted / under-documented steps" (#297, ROI mapping). Several were not filed as child tickets until much later.

**Root cause:** Orchestration gap — no prompt or hook that asks "does this finding affect another ticket, doc, or process?" before closing.

---

### Category D: Tooling / scripting failures

#### D-1 — `npm run close` keyword-check false-block

**Description:** The close script checks that the commit subject contains a word from the issue title. Research/docs commits with paraphrased subjects trip this check. The `--skip-keyword-check` flag exists but is easy to forget under close-sequence pressure.

**Concrete example:** Velocity CSV note on #311 (DRAGONFRUIT): "extractKeywords + keywordsOverlap pure seams + checkKeywordMatch I/O wrapper + --skip-keyword-check flag; 80 tests pass." The flag was needed to close research tickets whose commit messages use natural language rather than mirroring the issue title word-for-word.

**Root cause:** Heuristic mismatch — keyword overlap assumes a 1:1 word relationship between issue title and commit subject, but research/docs titles often use different vocabulary.

---

#### D-2 — Velocity log from wrong directory

**Description:** `npm run velocity:log` must be run from inside the relevant worktree when multiple worktrees exist; running it from `main` triggers a guard error and breaks the close flow.

**Concrete example:** The `velocity-csv-two-checkouts` memory and velocity CSV notes both document this pattern. The guard was added (velocity-log.js checks `.git` file vs directory) but the failure still occurs when agents cd to main mid-session.

**Root cause:** Tooling gap — velocity:log must infer which worktree's work the row belongs to; the only reliable signal is CWD. No workaround exists.

---

#### D-3 — Pre-push hook false-positive on column-0 doc examples

**Description:** The pre-push conflict-marker grep fires on documentation examples that show `<<<<<<< HEAD` / `=======` / `>>>>>>> branch` as literal text in a code block or instruction guide.

**Concrete example:** Fixed in #577. Root cause: no file-type filter in the conflict-marker grep; it scanned all tracked files including markdown that deliberately shows conflict-marker syntax.

**Status:** Fixed (#577). Included here because the delay in noticing the root cause (no file-type filter) illustrates D-category pattern.

---

#### D-4 — Tool-call batching → confabulated state

**Description:** Firing multiple Bash calls in one turn causes the agent to narrate expected outcomes ("PATCH OK", "pushed") rather than reading the actual tool result. Every destructive operation that goes wrong in this project traces to this pattern.

**Concrete example:** TIL synthesis T1-A: 6 independent sightings across 5 agents (BANANA-2 05-30, CHERRY-3 05-30, DRAGONFRUIT-2 05-30, CHERRY-3 05-31, APPLE-2 05-31, ELDERBERRY 05-31). Demonstrated again during the #278 session. Confabulated push successes led to landed-but-not-committed artifacts and difficult recovery.

**Root cause:** Model behavior under parallel tool calls — the model outputs expected outcomes without waiting for real results. A PostToolBatch guard hook (#349) exists as the DEV fix; the root problem is that the harness does not prevent batching of state-changing calls.

**Recurrence:** Highest by raw sighting count (6); confirmed structural.

---

### Category E: Skill / orchestration gaps

#### E-1 — No "waiting on external" ticket state

**Description:** The orchestration skill (`/fruit-agent-orchestrate`) has no mechanism to detect that a ticket is unactionable by an agent. Question tickets, human-decision-required issues, and external-party-gated tickets get assigned or claimed.

**Labels already in the schema:** `decision`, `human-decision-required`, `humans-only`, `blocked`. None of these are checked by the orchestration skill before assignment.

**Root cause:** Orchestration skill gap — the assignment logic does not filter by actionability signals. Requires a label convention AND a skill update.

---

#### E-2 — No automatic follow-up ticket prompt at close

**Description:** When an agent finishes a ticket and produces a closing summary, there is no checklist item or hook that asks whether the output surfaces findings that warrant a child/follow-up ticket. Findings evaporate.

**Concrete example:** Issue #610 comment (Avi, 2026-06-03) proposes a "next-best-action" skill that runs over the closing summary and asks: bug noticed but not filed? process gap recurred? finding contradicts an existing doc? decision deferred with no ticket?

**Root cause:** No enforced close-time gate for finding propagation. The TIL-synthesis work-around (#207) runs periodically but cannot catch every session's evaporated findings in real time.

---

#### E-3 — Orchestration assigns to in-flight agents

**Description:** The `/fruit-agent-orchestrate` skill has a STUB for detecting in-flight agents from worktree branch names; until implemented, the human must manually track which agents are busy.

**Root cause:** Skill gap — the detection logic reads `git worktree list` in principle but does not parse fruit identities from branch names to produce a "busy agents" filter before assignment.

---

## Part 2 — Research questions answered

### Q1: Frequency ranking (most → least recurrent)

| Rank | ID | Failure mode | Sightings / evidence |
|------|----|-------------|---------------------|
| 1 | D-4 | Tool-call batching confabulation | 6 sightings, 5 agents (T1-A) |
| 2 | C-1 | Bug/gap found, no ticket filed | 3+ confirmed closes (#601); likely under-counted; most common velocity note pattern |
| 3 | B-3 | Claiming a closed issue | 2 confirmed race incidents (#223/#227); guard now installed |
| 4 | C-2 | Mistake made, no process-improvement ticket | 4 sessions with agent meta-violations not self-filed (#281 filed at user request) |
| 5 | C-3 | Research finding not propagated | TIL synthesis #207 needed precisely because of this; recurrent across all agents |
| 6 | B-1 | Stale worktrees | 4 sightings pre-close.js (#242); 1–2 post-close.js crashes |
| 7 | D-1 | `close` keyword-check false-block | 2+ documented; harder to count since `--skip-keyword-check` silently resolves it |
| 8 | E-1 | No waiting-on-external label | 1 concrete example (#598); likely more untracked |
| 9 | B-2 | Claiming a waiting ticket | 1 confirmed (seed list); 1 probable (#598 type) |
| 10 | A-1 | Wrong GitHub handle | 1 confirmed; silent by nature |
| 11 | D-2 | Velocity log from wrong directory | 1–2 confirmed |
| 12 | E-2 | No follow-up ticket prompt | Structural; every session is a data point |
| 13 | E-3 | Orchestration assigns in-flight agent | 1 documented; human workaround every session |

---

### Q2: Impact ranking (wasted cycles, bugs shipped, human time)

**High impact:**

- **D-4 (tool-call batching)** — leads to incorrect commits, difficult recovery, partial state on main. Every destructive incident traces here. Highest total human recovery time.
- **C-1 (no ticket for bug/gap)** — corrupts velocity calibration data; silently reduces project observability; bugs shipped without tracker records. 
- **E-3 (in-flight agent not detected)** — wastes one agent's full puzzle slot; human must manually manage the collision.
- **B-3 (claiming closed issue)** — wastes worktree slot; agent produces a commit targeting a closed ticket; creates cleanup work.

**Medium impact:**

- **C-2 (no process-improvement ticket)** — same mistake recurs; overhead compounds over sessions.
- **C-3 (finding not propagated)** — knowledge siloed in TIL docs; periodic synthesis required as a workaround.
- **E-1 (no waiting-on-external state)** — wastes agent cycle; question ticket still unanswered; worktree left behind.
- **B-1 (stale worktree)** — misleads `puzzle:status`; human cleanup required.

**Low impact (contained or fixed):**

- **D-1 (keyword false-block)** — blocked close, bypass flag exists, no bugs shipped.
- **D-2 (velocity from wrong dir)** — fails loudly, no data corruption, recoverable.
- **D-3 (pre-push false-positive)** — fixed #577.
- **A-1 (wrong handle)** — communication failure, no code impact.
- **B-2 (waiting ticket)** — wasted slot, no corrupted artifacts.

---

### Q3: Which can be detected automatically?

| Failure mode | Detect at claim | Detect at close | Detect at push |
|-------------|----------------|-----------------|----------------|
| A-1 wrong handle | — | At close: `gh api /users/<handle>` (101 = non-existent) | — |
| B-1 stale worktree | claim: check `puzzle:status` STALE | — | — |
| B-2 waiting ticket | **Yes** — check issue labels for `decision`, `human-decision-required`, `humans-only`, `blocked`, `waiting-on-external` | — | — |
| B-3 closed issue | **Yes** — `claim.js` already does this (#227) | — | — |
| C-1 no ticket for bug | — | **Yes** — pre-close scope audit: `git diff origin/main` vs ticket scope | — |
| C-2 no process-improvement ticket | — | **Yes** — "next-best-action" skill at close gate | — |
| C-3 finding not propagated | — | **Yes** — same "next-best-action" skill | — |
| D-1 keyword false-block | — | At close: partial — already detected and reported | — |
| D-2 velocity from wrong dir | — | `velocity-log.js` detects and errors (#247 guard) | — |
| D-3 pre-push false-positive | — | — | **Fixed** (#577) |
| D-4 tool-call batching | — | — | **Partial** — PostToolBatch hook (#349, OPEN) |
| E-1 no waiting-on-external state | **Yes** — orchestration skill checks labels | — | — |
| E-2 no follow-up prompt | — | **Yes** — "next-best-action" skill at close gate | — |
| E-3 in-flight agents | **Yes** — `claim.js` checks `puzzle:status` CLAIMED/IN-PROGRESS | — | — |

**Summary:** 5 failure modes are automatable at claim-time; 4 at close-time; 1 at push-time. The highest-ROI detection window is **close-time**, where C-1/C-2/C-3/E-2 all converge on one mechanism: a pre-close checklist or skill.

---

### Q4: Label convention for waiting-on-external tickets

**Recommended convention:**

Add a `waiting-on-external` label (distinct from existing `blocked` which signals blocked-by-another-issue):

| Label | Meaning | Agent action |
|-------|---------|-------------|
| `waiting-on-external` | Needs a response from a person outside the agent loop (Charlie, Prof. Dos Reis, an external API) | **Skip at orchestration** — do not assign |
| `humans-only` | Already exists — requires human decision/action only | **Skip at orchestration** — already labeled |
| `decision` | Already exists — needs architectural ruling | **Skip at orchestration** — do not assign unless a child ticket exists |
| `blocked` | Already exists — blocked by another open issue | **Skip at orchestration** — check block resolution first |

The `/fruit-agent-orchestrate` skill should filter out tickets carrying any of these labels in its "available now" check. The minimum viable implementation is a label-set intersection check before the assignment output.

**Why `waiting-on-external` vs `question`:** The `question` label (already in schema) marks issues that ARE questions; `waiting-on-external` marks issues that are BLOCKED waiting on a response. Orthogonal signals.

---

### Q5: Minimum viable changes to claim / close / puzzle:status

**Top-3 failure modes by impact:** D-4 (batching confabulation), C-1 (no ticket for bug), E-3 (in-flight agent assignment).

D-4 is a model behavior / harness problem; the PostToolBatch hook (#349) is the right fix and is already scoped. The two tool-level changes that would prevent the most waste:

**Change 1 — `claim.js`: filter unactionable tickets** (addresses B-2, E-1)

```
Before staking a worktree, fetch the issue labels:
  gh issue view N --json labels
If labels include any of: waiting-on-external, humans-only, decision, human-decision-required
  → die() with:  "Issue #N is not agent-actionable (label: <label>). Assign to a human."
```

Effort: low (~20 lines in the existing `shouldBlockClaim` seam pattern). Impact: high — prevents the most embarrassing wasted cycles.

**Change 2 — `npm run close`: add a pre-close scope reminder** (addresses C-1, C-2, C-3, E-2)

After the commit is ready but before `npm run close N`, the close checklist in `claude_workflow.md` should include a mandatory step:

> **Pre-close finding audit:**
> Before running `npm run close N`, answer:
> 1. Did you notice any bug, regression, or process failure not in this ticket's scope? → File a ticket now.
> 2. Does this close change anything that contradicts an open ticket, doc, or TIL entry? → Cross-reference or file.
> 3. Is there a follow-up question that needs routing to a human? → File a `waiting-on-external` ticket.
>
> Green-light only when all three are "no" or "filed #N for it."

This is a docs-only change with zero code cost. Converts the close-time discipline into a named checklist; matches the guard vs prose pattern observed in T1-C (guards catch, prose teaches).

Longer-term: implement this as the "next-best-action" skill proposed in the #610 comment.

**Change 3 — `puzzle:status` or `fruit-agent-orchestrate`: in-flight agent detection** (addresses E-3)

`puzzle:status` already shows CLAIMED/IN-PROGRESS per issue. The orchestration skill needs to read this before emitting assignments:

```
puzzle:status output → parse "CLAIMED by <fruit>" entries
→ mark those fruits as busy
→ skip busy fruits in assignment output
```

Effort: moderate (requires `puzzle:status` to emit machine-readable output, or the skill to parse its current human-readable format). Impact: high — eliminates the primary reason the human acts as middle-manager between orchestration cycles.

---

### Q6: Balance "file a ticket for every gap" vs backlog flooding

**The tension:** Yegor-PM discipline says file a ticket for every gap. Every session produces gaps. Unconstrained filing can flood the backlog with meta-tickets whose cost (triaging, assigning, closing) exceeds their value.

**Observed mechanisms that work:**

1. **File-and-defer:** file the ticket immediately (preserving the finding), but don't block the current session on it. The ticket number appears in a velocity notes field or the closing comment. Cost: one `gh issue create` call; value: finding is never lost.

2. **Severity gating:** only file a ticket if the gap recurs (2+ sightings across agents) OR if the impact is medium/high (wasted cycle, shipped bug, data corruption). One-off tool behavior is documented in a TIL, not filed.

3. **Batch PM sessions:** instead of filing 5 micro-tickets mid-session, note findings in the velocity `notes` field, then run a short PM cycle at session end to file any with severity ≥ medium. This matches the "#231 PM: file follow-ups" pattern seen in the velocity CSV.

4. **Use the tracker label discipline:** `severity:low` tickets accumulate until a human decides to act or close; `severity:medium/high` get prioritized immediately. The backlog stays navigable because severity signals separate "good to fix someday" from "needs an agent now."

**Recommended threshold:** File a ticket unconditionally for: (a) any bug or regression encountered, regardless of severity; (b) any process failure that could cause another agent to repeat the mistake. Defer to a batch PM cycle: (c) tooling improvements with severity:low; (d) doc corrections that affect no current workflow.

This matches RULES.md Rule 12 (child issue always required for tracker sub-items) while avoiding backlog flooding on cosmetic improvements.

---

## Part 3 — Mitigation proposals, ranked by effort vs impact

### Tier 1 — Low effort, high impact (automate or docs-only)

| # | Mitigation | Target | Effort | Addresses |
|---|-----------|--------|--------|-----------|
| M1 | `claim.js`: refuse tickets with `waiting-on-external`, `humans-only`, `decision` labels | claim.js — `shouldBlockClaim` seam | ~20 lines | B-2, E-1 |
| M2 | `fruit-agent-orchestrate` skill: filter unactionable labels before assignment | skill file | ~10 lines | E-1, B-2, E-3 partial |
| M3 | `claude_workflow.md` "At close": add mandatory 3-question pre-close finding audit | docs | 0 code | C-1, C-2, C-3, E-2 |
| M4 | `puzzle:status` machine-readable flag (`--json` or exit codes) for CLAIMED/IN-PROGRESS | puzzle-status.js | ~30 lines | E-3 |
| M5 | `claim.js` output: print `puzzle:status` for the target before staking | claim.js | ~10 lines | B-1, B-3 |

### Tier 2 — Moderate effort, high impact

| # | Mitigation | Target | Effort | Addresses |
|---|-----------|--------|--------|-----------|
| M6 | `fruit-agent-orchestrate` skill: parse busy agents from `puzzle:status` output before assigning | skill | ~30 lines | E-3 |
| M7 | "Next-best-action" skill: post-close checklist that scans the session summary for evaporated findings | new skill | ~50 lines + doc | C-1, C-2, C-3, E-2 |
| M8 | Add `waiting-on-external` label to the repo label set; document in `claude_workflow.md` | GH + docs | ~5 lines | B-2, E-1 |
| M9 | PostToolBatch hook enforced by harness (#349) | harness / settings | tracked | D-4 |

### Tier 3 — Lower effort, lower impact (hygiene)

| # | Mitigation | Target | Effort | Addresses |
|---|-----------|--------|--------|-----------|
| M10 | `close.js`: post closing comment skeleton after confirmed push (#297-B) | close.js | ~10 lines | C-3 (routing) |
| M11 | `close.js` keyword-check: widen to n-gram overlap or use description instead of title | close.js | ~30 lines | D-1 |
| M12 | Document `@handle` validation step in issue-filing guidance | docs | 5 lines | A-1 |
| M13 | TIL corpus harvest on 10-entry cadence (per #207 recommendation) | cron/docs | docs only | C-3 |

---

## Part 4 — Can be automated vs requires human judgment

**Can be automated (hook, script, or skill):**
- Refusing unactionable tickets at claim-time (M1) — label check, no judgment needed
- Filtering busy agents at orchestration time (M6) — worktree parse, no judgment needed
- Pre-push conflict-marker check — already automated (pre-push hook, #205)
- Closed-issue guard at claim (M5) — already automated (#227)
- Stale worktree detection — already automated (`puzzle:status` STALE)
- Velocity log from wrong dir — already detected and errored (velocity-log.js)
- PostToolBatch hook (#349) — a harness-level enforcement, automatable

**Requires human judgment:**
- Whether a finding rises to "file a ticket" vs "note in TIL" — context-dependent (M3 provides the checklist, not the answer)
- Whether a ticket that's "waiting on external" can be partially actioned by an agent — depends on the specific issue
- Severity labeling — `severity:medium` vs `severity:low` is a human call
- Whether a process-improvement finding duplicates an existing ticket or warrants a new one — requires reading the open queue

**In the middle (skill-assisted):**
- "Next-best-action" post-close scan (M7) — the skill can prompt, but the agent decides whether a finding warrants a ticket. Reduces the cognitive load without removing agency.

---

## Part 5 — Summary verdicts

1. **Most frequent:** Tool-call batching confabulation (D-4, 6 sightings) and no-ticket-for-bug (C-1, structural).
2. **Highest impact:** D-4 (hard-to-recover state), C-1 (corrupted calibration + invisible bugs), E-3 (wasted cycles + human overhead).
3. **Most automatable at claim-time:** unactionable-label filter (M1) and in-flight agent detection (M4/M6).
4. **Most automatable at close-time:** the pre-close finding audit (M3, docs-only now; M7, skill later).
5. **Label recommendation:** add `waiting-on-external`; have `fruit-agent-orchestrate` filter it alongside `humans-only`, `decision`, `blocked`.
6. **Minimum viable script changes:** M1 (`claim.js` label filter), M4 (`puzzle:status` machine-readable), M3 (`claude_workflow.md` pre-close checklist). These three changes together address 8 of the 13 failure modes with under 80 lines of code + docs.
7. **Backlog discipline:** file tickets unconditionally for bugs + process-recurrence failures; batch cosmetic improvements into a PM session; use `severity:low` as the "someday" bin.

This ticket is itself an example of the pattern it studies: it was filed because a human noticed the gap during a session rather than an agent proactively filing it (stated in #610 body). M7 (next-best-action skill) is the structural fix for that irony.
