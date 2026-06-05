# fruit-agent-orchestrate: improvement analysis

**Date:** 2026-06-05  
**Session:** /fruit-agent-orchestrate invocation for 7-agent roster  
**Related issues:** #808 (timing spike), #810 (efficacy assessment, blocked by #808)

## Context

During the 2026-06-05 /fruit-agent-orchestrate session the user noted that the skill "takes a little while." No timing data exists to identify the slow step. This doc records the six pain points surfaced in that session and their proposed fixes, so the follow-up assessment (#810) has a concrete baseline to evaluate against.

## Pain points and proposals

### P1 — No self-timing (highest priority to fix first)

**Problem:** The skill emits no per-step timing. It is impossible to know whether the bottleneck is the `gh issue list` network call, the `npm run puzzle:status` file scan, or the LLM reasoning pass over the full issue list.

**Proposal:** Add start/end timestamps to the skill invocation (or wrap it in a harness script) that emits a timing summary line per step, e.g. `gh issue list: 2.1s | puzzle:status: 1.4s | assignment: 0.8s`.

**Tracked:** #808 — SPIKE to measure wall-clock time per step.

---

### P2 — All 100 issues arrive unfiltered; LLM does all the filtering

**Problem:** `gh issue list --limit 100` returns blocked, deferred, proposal, and human-required issues. The LLM must read all of them before the actionable set (typically ~6–10 issues) can be identified. This inflates context and reasoning time.

**Proposal:** Add a `jq` pre-filter at query time that excludes issues whose labels include any of: `blocked`, `proposal`, `deferred`, `humans-only`, `human-required`, `human-decision-required`. The filter runs before the output reaches the LLM.

**Estimated impact:** reduces LLM input by ~80% for a typical open queue.

---

### P3 — `puzzle:status` full file scan on every invocation

**Problem:** `npm run puzzle:status` walks all source files to find `@todo`/`@inprogress` markers. As the repo grows this scan grows with it.

**Proposal:** A post-commit hook writes a lightweight JSON index of markers (file, line, issue number, state) after each commit. `puzzle:status` reads the index rather than scanning; the hook keeps it fresh.

**Caveat:** Only helps if the index is always current. Hook failure → stale index. Needs a fallback full-scan mode.

---

### P4 — Human-required detection is fragile

**Problem:** Some issues carry a `humans-only` or `human-decision-required` label; others encode the same signal only in the title ("HUMAN DECISION:", "REVIEW: human decisions needed"). The jq pre-filter from P2 only catches the labelled ones.

**Proposal:** Back-fill all human-required issues with a single canonical label (`humans-only`). Document in CLAUDE.md that this label is required for any issue that cannot be actioned by an agent alone.

**Estimated impact:** enables P2's filter to catch the full human-required set; reduces LLM triage burden further.

---

### P5 — Agent state detection is entirely manual

**Problem:** The skill always assumes all seven agents are available. The user must provide context about in-flight work. If they forget, assignments overlap with active worktrees.

**Proposal:** Parse `git worktree list` branch names (which encode the fruit name: e.g. `banana/issue-801-...`) to auto-detect which agents have live worktrees, then mark those agents as in-flight and skip them from new assignments. This implements the STUB documented in the skill.

**Tracked:** #630 — decision on whether to implement this STUB.

---

### P6 — Cluster overlap is checked manually

**Problem:** `docs/puzzle-clusters.csv` exists and maps issues to code clusters, but the skill instructions do not consult it. The orchestrator must remember to check it manually. In the 2026-06-05 session, the APPLE/BANANA displayWithSeparator cluster overlap was caught by the LLM noticing the issue titles — not by a systematic check.

**Proposal:** Add a triage step that reads `puzzle-clusters.csv`, identifies which clusters are represented in the candidate assignment list, and flags any two candidates in the same cluster.

---

## Observation order (for #810 to assess)

If timing data from #808 shows that the LLM reasoning pass is the dominant bottleneck, P2 and P4 are the highest-ROI fixes (they reduce LLM input directly). If network latency (`gh issue list`) dominates, a cached issue index updated by a GitHub webhook or cron would be more impactful than any of the above. P3, P5, and P6 are lower-urgency quality improvements regardless of timing results.

## Assessment gate

#810 is blocked by #808. Once the timing spike lands, #810 should rate each proposal above as: **high ROI / low ROI / already implemented / no longer relevant** based on the measured data.
