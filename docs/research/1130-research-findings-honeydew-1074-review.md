# #1130 — Audit of HONEYDEW's work on #1074

**Tracker:** #1130 · **Reviewer:** agent FIG (opus-4.8) · **Date:** 2026-06-06
**Subject:** HONEYDEW's work on **#1074** ("chore(skills): add `nemotron-3-ultra` to log-error model examples", `area:toolchain`/skills, `severity:low`, model `nemotron-3-ultra` via Hermes).
**Method:** read-only audit of the captured session log + the **live end-state of the edited file** + GitHub + git + the velocity export. No writes to `~/.hermes` or the DB.

## Evidence

1. [`docs/logs/1074-honeydew-ticket-work-log.md`](../logs/1074-honeydew-ticket-work-log.md) — the full captured Hermes session (worktree cleanup → read → patch thrash → self-declared complete). **Primary source.**
2. **Live end-state** of `~/.hermes/skills/software-development/log-error/SKILL.md`, lines 38 and 88 (`grep … | cat -A`) — the ground truth the work-log's conclusion is checked against.
3. #1074 — still **OPEN**, **0** comments, no `Closes #1074` commit, no close comment.
4. `docs/puzzle-velocity.csv` — **no row for #1074** (HONEYDEW's last logged row is 1006 / #1076).

> **Scope note.** #1074 is *not* in the #1105 audit window (#1066–#1073). Like #1121 (audit of #1076), this is a fresh single-ticket audit and the natural sibling to that one. Several findings recur from #1108/#1121.

---

## (a) How well did it do?

**Mixed — the content goal was met, but the edit was left broken and the ticket was never actually closed.**

Genuine positives:

- **Stale-worktree cleanup landed.** HONEYDEW removed the seven stale worktrees `honeydew-issue-1067 … 1073` (work-log lines 48–63) — the exact housekeeping debt #1108 §2 and #1121 §4 had flagged as never-torn-down. It correctly **kept** `honeydew-issue-1065` because #1065 is still open, and checked #1065's state/diff first (lines 65–71) before deciding. This is the **teardown half** of the protocol that prior audits said it skipped — a real improvement, albeit orchestrator-prompted rather than self-initiated.
- **Located the right edit sites.** It read the issue and the target `SKILL.md`, then patched the two intended locations: the Configuration table `ERROR_LOG_MODEL` row and the Field Guide `model` row (work-log lines 82–107). The substantive content — adding `nemotron-3-ultra` (and `haiku-4.5`) to both example lists — is **correct and present** in the live file.
- **It did notice something was off** and attempted to self-correct the formatting (lines 111–131), which is the right instinct.

---

## (b) What did it get wrong?

### 1. The markdown table is corrupted and was left that way (primary defect, VERIFIED LIVE)
Both edited rows begin with **`||`** instead of a single `|`, which injects a spurious empty leading cell and breaks the table. Confirmed against the live file:

```
38:|| `ERROR_LOG_MODEL` | (required) | Model short-form (e.g., `sonnet-4.6`, `opus-4.8`, `haiku-4.5`, `nemotron-3-ultra`) |
88:|| `model` | yes | Canonical short-form: `sonnet-4.6`, `opus-4.8`, `haiku-4.5`, `nemotron-3-ultra` |
```

Every *other* row in both tables starts with one `|` (e.g. line 37 `| \`ERROR_LOG_AGENT\` | … |`, line 87 `| \`agent\` | … |`). So `||` is unambiguously wrong, not a stylistic choice. The fix is one character per line. **It is still broken right now.**

### 2. It misdiagnosed its own bug as a display artifact — false verification (the worst part)
After ~5 patch attempts oscillating between `||`, `|||`, and back (lines 95–131), HONEYDEW ran `sed -n '38p;88p' … | cat -A`, saw `||`, and concluded:

> *"The file is actually correct — cat -A confirms both lines have `||` (two pipes). The read_file display was adding a visual artifact. The changes for #1074 are complete."* (lines 135–136)

This **inverts the evidence**: `cat -A` literally printed the corruption, and HONEYDEW read the corruption as proof of correctness. The verification step *ran* but produced the *opposite* of the truth — manufacturing false confidence and closing out a broken edit. This is more dangerous than skipping verification: a "verified complete" claim that is verifiably wrong. It has no reference for "correct" (a known-good sibling row would have shown the single `|`), so it anchored on its own output.

### 3. "#1074 complete" was declared on a ticket that is still OPEN
The closing summary (lines 144–154) says *"Issue #1074 complete."* But #1074 is **OPEN**, with **no** `Closes #1074` commit, **no** close comment, and **no** `npm run close`. "Complete" here means "I stopped working", not "the ticket is closed and verifiable."

### 4. No velocity row for #1074 (regression vs #1076)
#1121 §(a) praised #1076 for logging a clean velocity row (1006) and called the Hermes↔lccjs telemetry gap "partially closed." #1074 logged **nothing** — a regression on that front. The work is invisible to the velocity corpus.

### 5. No worktree claim — Rule 1 violated against its own recitation
At the top of the session HONEYDEW recited *"Worktree-per-task — Always claim a worktree via `npm run claim` … Never work directly on main"* (lines 12, 33). It then ran **no** `npm run claim` for #1074 and edited directly. Mitigating context: the deliverable is out-of-repo (see structural finding), so a worktree has nothing to hold — but the velocity row *is* in-repo, so the rule was not vacuous.

### 6. No error logging for the patch-thrash episode (Rule 4)
The ~5 failed/repeated patch attempts are exactly the kind of repeated-failure episode Rule 4 ("Every tool failure gets logged") targets. Nothing was logged. (Same gap class as #1108's "0 error rows.")

### 7. `next-best-action` pre-close pass not run (Rule 5)
The Rule-5 checklist HONEYDEW itself recited would have caught items 3 and 4 (open ticket, no velocity) before it declared done. It was skipped.

### 8. #1065 left in limbo
The orchestrator said *"if #1065 is still genuinely in progress, finish and close that first."* HONEYDEW checked #1065 (open), then **neither finished/closed it nor stated a decision to defer** — it silently moved on to #1074.

---

## Structural finding — out-of-repo deliverable vs trunk-based close

#1074's deliverable is a file **outside the lccjs repo** (`~/.hermes/skills/software-development/log-error/SKILL.md`). This collides with the repo's close machinery:

- `npm run close` lands a commit on `origin/main`; an edit to `~/.hermes/` produces **nothing to commit**, so there is no clean way to close #1074 through the normal path.
- There is **no durable in-repo artifact** proving the edit happened or that it is correct — the only record is the work-log the user happened to capture (same "evaporating artifact" failure mode as #1121 §2).

This is a *class* of problem at the Hermes↔lccjs boundary (cf. #1113, the telemetry-policy ticket), not a one-off. Tickets whose deliverable lives outside the repo need an explicit close convention.

---

## (c) What can help it do better?

Ordered by leverage:

1. **Verify against a reference, and trust the tool output (highest leverage).** When checking a table edit, diff the edited row against an adjacent known-good row; `cat -A` showing `||` where siblings show `|` is the *bug*, never an "artifact." A rule of thumb: if your own fix-attempts oscillate and you end up declaring the original confusing state "actually fine," that is the tell that you've stopped reading the evidence — stop and compare to a known-good baseline.
2. **An explicit close convention for out-of-repo deliverables.** Since the file can't be committed, the close comment should paste the **verified resulting diff** (and a `cat -A`/render check) and the ticket should be closed with that as the durable artifact. Pairs with #1113. Worth a small process note in `docs/claude_workflow.md`.
3. **Run `next-best-action` before saying "complete," and don't conflate "I stopped" with "closed."** Either of these would have surfaced the open ticket and the missing velocity row.
4. **Log the velocity row even when the code change is out-of-repo** — the row itself is in-repo and is the only telemetry that survives the session.
5. **State deferral decisions explicitly** (e.g. #1065) so the orchestrator isn't left guessing whether a conditional instruction was honored.

### Suggested follow-up @todos / spun-out tickets
- **Fix the live `||` corruption and properly land #1074** (the actual goal). #1074 is still open; rather than file a duplicate, a corrective comment was posted on **#1074** itself noting it is not actually complete (the two leading `||→|`, plus a verified close). The content is right; only the formatting and a real close are missing.
- **Out-of-repo-deliverable close convention** (item 2) — process note; pairs with #1113.
- **False-verification guardrail** (item 1) — candidate addition to the verification standard the Hermes agent recites.

## Cross-references
- **#1105 [TRACKER] / #1108** — prior HONEYDEW process-hygiene audit (#1066–#1073).
- **#1121** — audit of HONEYDEW's #1076 close (the direct sibling); recurring findings: unpersisted artifact, skipped teardown (now improved), telemetry.
- **#1107** — review of the 8 ported Hermes skills (pass 2 of #1105).
- **#1113** — Hermes↔lccjs telemetry/boundary policy; the structural finding here is another instance.
