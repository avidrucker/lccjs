# Puzzle-ticket-resolution workflow — ownership map and ROI ranking (#297)

**Research question:** which steps are deterministic/automated, which require
human judgment, which are AI-assisted, and which are done ad-hoc? Where are the
cheapest improvements?

**Sources:** `docs/claude_workflow.md`, `docs/puzzle-lifecycle.md`,
`docs/puzzle-velocity.md`, `docs/design-agent-worktree-identity.md`,
`RULES.md`, `package.json` scripts, incident history in issues #200 / #242
/ #268 / #376.

---

## Step-by-step ownership map

### Phase 0 — Pre-session setup

| Step | Owner | Tool/mechanism | Automated? |
|------|-------|----------------|-----------|
| Assign an agent identity to a session | **Human** | env var `CLAUDE_AGENT_NAME` or `--as <fruit>` | No — deliberate; see #386 |
| Assign a ticket to an agent | **Human** | `/fruit-agent-orchestrate` skill or direct instruction | Skill-assisted; not enforced |

### Phase 1 — At start

| Step | Owner | Tool/mechanism | Automated? |
|------|-------|----------------|-----------|
| Pre-claim git status check | **AI** | `git status` (Bash) | No — discipline |
| Capture start timestamp (`t₀`) | **AI** | `date '+%Y-%m-%dT%H:%M:%S%z'` | No — discipline; skipping forces reconstructed timestamps |
| Set C estimate (before reading) | **AI** | judgment | No — discipline; no enforcement |
| Read ticket | **AI** | `gh issue view N` | No |
| Check puzzle:status | **AI** | `npm run puzzle:status` | No — discipline; easy to skip |
| Claim worktree | **AI** | `npm run claim N --as <fruit>` | **Yes** — `claim.sh` creates branch + worktree, guards closed issues |
| Flip `@todo → @inprogress` in source | **AI** | manual Edit | No — easy to forget; no enforcement |
| Read referenced docs/source | **AI** | judgment | No |
| Create sub-tasks (3+ steps) | **AI** | `TaskCreate` (optional) | No |

### Phase 2 — While continuing

| Step | Owner | Tool/mechanism | Automated? |
|------|-------|----------------|-----------|
| Do the work | **AI** | judgment | No |
| File follow-up tickets for out-of-scope finds | **AI** | `gh issue create` (RULES.md #10) | No — discipline; documented in `claude_workflow.md` §"While continuing" |
| Correct sibling issue descriptions (redline) | **AI** | `gh issue edit` + comment | No — convention in `yegor-tickets` |
| Wrap LCC/oracle calls in `lccrun.sh` | **AI** | `scripts/lccrun.sh` | No — discipline; caused 28-min hang in #376 |
| Verify as you go | **AI** | tests / assemble / re-read | No |
| Brief status updates | **AI** | plain text | No |

### Phase 3 — At close

| Step | Owner | Tool/mechanism | Automated? |
|------|-------|----------------|-----------|
| Capture finish timestamp (`t₁`) | **AI** | `date '+...'` | No — discipline; often forgotten |
| Final verification | **AI** | judgment | No |
| Log velocity row | **AI** | `npm run velocity:log -- '{...}'` | **Partial** — tool validates + inserts + exports CSV; but the JSON payload must be hand-composed |
| Delete `@todo`/`@inprogress` marker | **AI** | manual Edit | No — easy to forget; STALE markers accumulate |
| One commit: marker deletion + CSV + `Closes #N` | **AI** | `git add; git commit` | No |
| Land and teardown | **AI** | `npm run close N` | **Yes** — loops rebase/push/verify, tears down worktree (#268 fixed docs here) |
| Post closing comment | **AI** | `gh issue comment` | No — documented in `claude_workflow.md` §"At close" step 3; nothing enforces it |
| Mark TaskCreate tasks complete | **AI** | `TaskUpdate` | No — often skipped |

---

## Uncharted / under-documented steps

These steps exist in practice but are scattered across docs, memories, or
incidents — no single source teaches them cleanly:

1. **`@todo → @inprogress` flip on claim** — `claude_workflow.md` documents it,
   but `npm run claim` does not do it. Agents frequently forget; markers stay
   `@todo` during active work, making them invisible to the "claimed" signal.

2. **Closing comment requirement** — documented in `claude_workflow.md` but not
   enforced by `npm run close`. A fresh agent reading only `puzzle-lifecycle.md`
   (the "how done is signalled" doc) would not encounter this requirement —
   lifecycle.md step 6 describes a comment but doesn't call it mandatory.

3. **C estimate discipline** — `claude_workflow.md` says "set C before reading
   anything substantive." There is no hook, prompt, or gate; it relies purely on
   agent self-discipline. When skipped, forward-looking calibration is impossible
   for that ticket.

4. **Start/finish timestamp capture** — both are critical for `actual_min` accuracy,
   both are manual Bash calls with no enforcement. Reconstructed timestamps reduce
   the velocity data to estimates-only rows.

5. **Research-findings routing** — "post findings to the issue, not TIL docs" was
   documented in `claude_workflow.md` after incident #437 but is still the step
   agents most often get wrong when closing a research ticket.

6. **Tracker-ticket child-issue requirement** — RULES.md #12 (always file a child
   before working a tracker sub-item) was added recently (#559) and exists only in
   `RULES.md`, not in `claude_workflow.md` or `puzzle-lifecycle.md`.

7. **Multi-agent parallel identity assignment** — documented in
   `design-agent-worktree-identity.md` but not in the main workflow doc. Agents
   who read only `claude_workflow.md` miss the race-condition risk of bare `auto`
   in a fan-out launch.

8. **`lccrun.sh` wrapping obligation** — added to `claude_workflow.md` after the
   #376 incident. Not mentioned in `puzzle-lifecycle.md` or `RULES.md`. Agents who
   read only the lifecycle doc won't know.

---

## ROI ranking — improvement opportunities

### Tier 1 — Low effort, high impact

**A. Auto-flip `@todo → @inprogress` in `npm run claim`**
- What: `claim.sh` already knows the issue number; it could grep the repo for the
  matching marker and flip it atomically on claim.
- Why high ROI: eliminates the most-forgotten step; makes `puzzle:status` accurate
  without agent discipline.
- Cost: moderate — needs a marker-locator (grep + sed); must handle missing markers
  gracefully (not all issues have them).

**B. Auto-post closing comment skeleton from `npm run close`**
- What: after confirming the commit is on `origin/main`, `close.js` could post a
  stub comment (`"Closed in {sha}. Summary: [fill in]"`) or at minimum print a
  reminder with the `gh issue comment N` command ready to copy.
- Why high ROI: closing comments are the cheapest form of async knowledge transfer
  between agents; the current no-enforcement leads to silent closures.
- Cost: low — `close.js` already calls the GitHub API; one more call.

**C. Add `title` auto-fetch to `velocity:log`**
- What: if `title` is omitted from the JSON, `velocity-log.js` fetches it from
  `gh issue view N --json title` before inserting.
- Why high ROI: reduces the hand-typed payload; eliminates a common error where
  the title is wrong or truncated.
- Cost: low — one `gh` CLI call.

### Tier 2 — Moderate effort, moderate impact

**D. Add `puzzle-lifecycle.md` step for closing comment and `lccrun.sh`**
- What: both requirements live only in `claude_workflow.md`. Mirroring them (one-
  liners with cross-refs) in `puzzle-lifecycle.md`'s "Part 3" ensures agents who
  read the lifecycle doc get the full picture.
- Why moderate ROI: docs-only; reduces the "triangulate from multiple docs" problem
  without adding any enforcement.
- Cost: very low — 2–3 lines.

**E. Add tracker-child-issue rule to `claude_workflow.md`**
- What: RULES.md #12 exists but isn't in the workflow or lifecycle docs. A one-
  liner in `claude_workflow.md` §"While continuing" ("for tracker tickets, file the
  child issue before starting work") closes the gap.
- Cost: very low.

**F. `puzzle:status` "before claim" gate in `claim.sh`**
- What: `claim.sh` could run `puzzle:status` internally and abort if the target is
  already `CLAIMED` / `IN-PROGRESS` / `BLOCKED`. Currently it has a best-effort
  GitHub closed-state guard but not a worktree-claim guard.
- Cost: moderate — needs `puzzle-status.js` to support a machine-readable exit code
  or structured output.

**G. Timestamp prompt in `claim.sh` output**
- What: `claim.sh`'s "next:" block could print `date '+%Y-%m-%dT%H:%M:%S%z'`
  (the start-timestamp command) and `gh issue view N` as the very first
  suggested commands, making the pre-flight sequence impossible to miss.
- Cost: trivial — one `echo` line.

### Tier 3 — Higher effort, diminishing returns

**H. C-estimate gate**
- What: require a numeric `c_min` in `velocity:log` (currently nullable). Log
  validation would warn on null rather than hard-fail to avoid blocking retroactive
  rows.
- Why lower ROI: C-estimate discipline is partly intentional (some tickets are too
  uncertain to estimate); a gate would generate noise without improving calibration
  on the tickets where it matters.

**I. Automated calibration reports**
- What: a `npm run velocity:calibrate` script that queries the SQLite DB and emits
  per-role and per-agent ΔC statistics.
- Why lower ROI: the data is already queryable; the bottleneck is interpretation,
  not access. Medium effort for moderate value.

**J. Issue-quality linter**
- What: a script that checks `gh issue view N --json body` for the required
  have/should-have/done-when/estimate sections.
- Why lower ROI: enforcement-only value; the failure mode (bad issue description)
  is caught by the human at assignment time anyway.

---

## Summary

The workflow is well-documented across four docs but the surface area is large.
The highest-leverage gap is the **`@todo → @inprogress` flip** (A) — it's the most
forgotten step and the one that makes `puzzle:status` unreliable. The second is
the **closing comment** (B) — the only required post-close step with zero
enforcement. Both are fixable in the existing `claim.sh` / `close.js` scripts with
moderate effort.

The "triangulate from multiple docs" problem (the #297 repro case) is best
addressed by doc additions (D, E) before investing in enforcement tooling, since
most gaps are missed-convention rather than wrong-tool.
