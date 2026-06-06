# Stale Tracker Body Read — Failure Mode Analysis (#904)

**Date:** 2026-06-05  
**Agent:** APPLE  
**Companion issues:** #714 (incident), #898/#901 (errors table)

---

## Incident summary

On 2026-06-05, a prior APPLE session was tasked with auditing tracker issue #714 ("lccjs web
feature parity — ILCC dashboard gap checklist"). The agent read the issue body, observed two
unchecked checklist items — `- [ ] #732` and `- [ ] #733` — and filed a comment reporting:

> "No advancement possible without human action or deferred-child completion. #732 and #733
> remain open and deferred. Tracker stays open. Marking blocked on #731 and deferred children."

Both #732 (share-as-link) and #733 (download-as-.a) had in fact been **CLOSED ~7 hours earlier**
that same day. The issue body's checklist had not been updated when those children closed.

A subsequent APPLE session (with a proper worktree) discovered the error by running
`gh issue view 732` and `gh issue view 733`, confirmed both were CLOSED, updated the audit doc,
and checked the boxes in the tracker body.

**Impact:**
- Incorrect status was published to the issue tracker.
- The tracker was nearly mislabeled `blocked` — which would have removed it from the
  orchestration queue indefinitely.
- One agent cycle was consumed by the erroneous pass (no worktree, no code change, wrong output).

---

## Root cause analysis

Two separate, independent failures contributed:

### Root cause 1 — Discipline: agent trusted issue body over live state

The prior APPLE read the tracker body's markdown checklist and treated the `[ ]` / `[x]` symbols
as the authoritative record of whether child issues are open or closed.

Markdown checklist syntax in a GitHub issue body is **not a live data source**. It is a snapshot
frozen at the last time a human or agent edited the body. When a child issue closes, GitHub does
not automatically check its box in any parent tracker body — the checklist stays unchecked until
someone edits it manually.

The correct approach for any tracker audit is:
```bash
gh issue view <child-N> --json state -q .state   # one call per child
```

The existing `claude_workflow.md` rule (§"Reading the ticket") says: "Verify the repro before
writing any code… do not assume the issue is live without checking." This was framed for bug
repro, not tracker audits, but the principle is identical: **do not trust a cached snapshot when
a live API is available**.

### Root cause 2 — Process gap: no mechanism updates the parent body on child close

When an agent closes a child issue via `npm run close N`, the close script:
- Pushes the closing commit to `main`
- Removes the worktree and branch
- Closes the GitHub issue via `gh issue close N`

It does **not** scan for parent tracker issues that reference `#N` in their body and check the
corresponding box. No script or hook does this today.

The result is structural drift: every tracker body becomes stale the moment any child closes
without a manual body-update.

---

## Failure mode classification

The existing `docs/research/orchestration-failure-modes.md` catalog does not have an entry for
this pattern. The closest existing categories are:

| Existing ID | Description | Fit |
|-------------|-------------|-----|
| D-4 | Tool-call batching → confabulated state | **Partial** — same underlying cause (trusting expected state over real state), but D-4 is specific to parallel tool-call batching. This incident had no batching. |
| C-1 | Bug/gap found, no ticket filed | **Partial** — the stale read produced wrong output, but the primary issue is *trusting* the wrong source, not a post-finding omission. |

**Proposed new entry: F-1 — Stale-document trust**

An agent reads a document (issue body, `TODOS.md`, a research doc, `docs/skills.md`) that
contains state information, and treats it as live ground truth without verifying against the
authoritative source (GitHub API, filesystem, database). The agent then acts on or reports the
stale state.

This is a special case of D-4's underlying problem (trusting cached/expected state over real
state) but arises from document reads rather than tool-call batching. It deserves a separate
entry because the detection and prevention are different:

- **D-4** is prevented by not batching state-changing tool calls.
- **F-1** is prevented by a discipline rule: *any doc that describes live state must be verified
  before acting on it*.

### Documents at risk of F-1

| Document | Live source to verify against |
|----------|------------------------------|
| Tracker issue body (checklist) | `gh issue view N --json state` per child |
| `TODOS.md` | `gh issue list --state open` + `git status` |
| `docs/skills.md` notes | Skill file at `~/.claude/skills/` |
| `docs/research/ilcc-dashboard-feature-audit.md` | Playground HTML + child issue states |
| `docs/puzzle-velocity.csv` | `~/.lccjs/velocity.db` |
| Any audit/research doc that describes issue states | GitHub API |

---

## Secondary violation

The prior APPLE session also:
1. Filed a comment on #714 **without claiming a worktree** — a direct workflow violation
   (`claude_workflow.md`: "Worktree-per-task is the expected default, even for small/docs edits").
2. Said "Marking blocked on #731 and deferred children" **without applying the label** — stated
   intent as completed action.

These are independent of the stale-read problem but compounded its harm: without a worktree,
there was no velocity log, no commit, and no audit trail for the session's output.

---

## Protocol fix proposals

### P-1 — Discipline rule: verify child states when auditing a tracker (docs, low effort)

Add to `docs/do-this-not-that.md`:

> **Don't trust unchecked boxes in a tracker body — verify each child's live state**
>
> Don't: Read a tracker's issue body, see `- [ ] #N`, and report the child as "open/deferred."
>
> Do: Run `gh issue view N --json state -q .state` for each child referenced in the checklist
> before reporting or acting on its state.
>
> Why: Tracker bodies are frozen snapshots. GitHub does not auto-check boxes when children
> close. A `[ ]` that was accurate yesterday may be wrong today. One API call per child costs
> ~1 second; trusting a stale box costs an agent cycle and publishes wrong information.

This rule should also be referenced in the `claude_workflow.md` "Reading the ticket" block,
extending the "Verify the repro" rule to explicitly cover tracker state checks.

**Effort:** WRITER, ~15m. Child issue to file: DEV/WRITER #905.

### P-2 — close.js: scan for parent trackers and offer checklist update (automation, medium effort)

When `npm run close N` succeeds and closes issue `#N`, the script could:
1. Search all open issues for bodies containing the pattern `#N` in a checklist context
   (`- [ ] **#N**`, `- [ ] #N`, etc.).
2. If a parent tracker is found, print a prompt:
   ```
   [close] Parent tracker found: #714 references #732 in its checklist.
   [close] Run: gh issue edit 714 --body "..." to check the box.
   ```
   (Or auto-update if the user opts in.)

This prevents root cause 2 (structural body drift) at the exact moment a child closes.

**Effort:** DEV, ~30m. Requires `gh issue list` + regex scan + body edit. Child issue to file: #906.

### P-3 — New error_type for errors table (schema extension, zero effort now)

Once the errors table (#898) is live, add `STALE_READ` to the documented `error_type` vocabulary
in `docs/research/901-errors-table-schema.md`.

Context JSON shape:
```json
{
  "source": "issue_body",
  "parent_issue": 714,
  "stale_field": "checklist",
  "child_issues_assumed_open": [732, 733],
  "actual_states": {"732": "CLOSED", "733": "CLOSED"}
}
```

---

## Error record (pending errors table availability)

Once `#898` is resolved and the errors table exists, log this incident:

| Field | Value |
|-------|-------|
| `occurred_iso` | `2026-06-05T09:00:00-1000` (approx — prior to APPLE's morning comment on #714) |
| `agent` | `APPLE` |
| `model` | `sonnet-4.6` |
| `ticket` | `714` |
| `error_type` | `STALE_READ` (new type — propose adding to schema) |
| `message` | "Reported #732 and #733 as open/deferred; both CLOSED ~7h earlier" |
| `context` | `{"source":"issue_body","parent_issue":714,"child_issues_assumed_open":[732,733],"actual_states":{"732":"CLOSED","733":"CLOSED"}}` |
| `notes` | "Agent also filed comment without worktree (workflow violation). Caught and corrected by subsequent APPLE session with worktree." |

---

## Child issues filed

- **#906** — WRITER: add "verify child states" rule to `do-this-not-that.md` (P-1)
- **#907** — DEV: `close.js` — scan for parent tracker references and offer checklist update on child close (P-2)
