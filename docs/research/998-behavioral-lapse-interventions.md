# Behavioral-Lapse Interventions — the "clear-but-failed" subset (#998)

**Author:** BANANA · **Date:** 2026-06-06 · **Type:** RESEARCH (research-only)

Sibling to **#1007** (APPLE's behavioral-error audit). #1007 classified all 40
effective `errors`-table rows by root cause and explicitly **deferred the
category-D "clear-but-failed" rows to this ticket** — failures where a clear,
correct rule already exists yet the agent didn't follow it. This doc takes that
subset and asks the one question that matters for it: *since more documentation
won't help (the rule is already clear), what **structural** intervention reduces
recurrence?*

It does **not** re-run #1007's SQL/TIL/memory cross-reference — that data is the
input here. Read `docs/research/1007-behavioral-error-audit.md` first.

---

## 1. The category-D subset (from #1007 §1)

| D pattern | Rows | Count | Current structural status |
|---|---|---|---|
| `claim` missing `--as` / wrong args | 7, 21, 26, 31 | 4 | **Owned** — identity persistence is decision #829 (+ #1010, #630). A persisted identity removes the need to retype `--as`, eliminating the lapse at its source. |
| Push-then-close → "no unpushed commit" / already-closed | 10, 15, 23, 36 | 4 | **Fixed** — #995 added the graceful-exit recovery path to `close.js`; an already-pushed/auto-closed issue now exits 0 instead of erroring. |
| `velocity:log` from main checkout while worktrees exist | 37, 38 | 2 | **Guarded** — `velocity-log.js:108` already blocks this and prints the cause. The guard fired correctly; the row is the *blocked attempt*, not a bad write. Working as designed. |
| close "working tree not clean" (forgot to commit CSV) | 28 | 1 | **Guarded** — `close.js` already refuses to proceed on a dirty tree (RULES 15). Caught at the gate. |
| Edit attempted without prior Read (EDIT_PRECOND) | 11, 32 | 2 | **Harness constraint** — the Read-before-Edit rule is enforced by the Claude Code harness, not this repo. No repo-side structural fix is possible; the harness already hard-errors (it cannot be silently skipped). |

### The finding

The clear-but-failed subset is **already largely neutralized**, and not by
documentation:

- **2 of 5 patterns are caught by an existing point-of-action guard** (`velocity-log` main-checkout block; `close` dirty-tree + Guards/Checks). The guard converts a silent mistake into a loud, immediate, self-correcting error. This is the model that works.
- **1 pattern was fixed structurally during this session** (#995, push-then-close).
- **1 pattern is owned by an open decision** (#829 identity persistence) whose resolution removes the lapse's *cause*, not just its symptom.
- **1 pattern is a harness invariant** with no repo-side lever.

So the high-severity behavioral gaps are not in the D-subset — #1007 already
routed those (PII, worktree teardown, `rm`-bundling, empty error rows → #1019–#1022).
What the D-subset shows is a **design principle**, not a backlog.

---

## 2. The design principle: guard at the point of action, don't document at rest

Every D pattern that is *neutralized* shares one mechanic: a check that fires
**at the moment of the action**, in the tool the agent is already running, and
**fails loudly** so the mistake cannot pass silently. Every D pattern that still
*recurs* lacks such a check (or the check lives only in a reference doc the agent
has to remember to consult).

This matches #1007's category C (not-visible guidance): the cure for a
behavioral lapse is not more prose — it is **moving the rule to the point of
action**. `close.js` is the exemplar: it doesn't *document* "log velocity before
closing," it *checks* for the row and refuses otherwise.

### Where the asymmetry is

`close.js` (task **end**) is heavily guarded — Guard 1/2 (ticket+keyword match),
Check A/B (velocity row exists, marker deleted), dirty-tree refusal, graceful
already-closed exit. The task **start** has no equivalent single guard. The
recurring start-of-task lapses #998's own issue body lists —

- `started_iso` not captured before `gh issue view` (#652, reconstructed timestamps)
- `git worktree list` skipped before claiming
- issue OPEN-state not verified before claiming

— are exactly the un-guarded start-of-task steps. They recur for the same reason
the *end*-of-task steps **don't**: no point-of-action check.

---

## 3. Proposed intervention (one concrete child)

**Mirror the close-time guard discipline at task-start.** A single `npm run
preflight <issue>` wrapper that, in one command:

1. Stamps `started_iso` (`date '+%Y-%m-%dT%H:%M:%S%z'`) to a session scratch file
   so the closing velocity row reads a real captured timestamp instead of a
   reconstructed one (#652).
2. Runs the start-of-task reads the agent is supposed to do anyway —
   `git status`, `git worktree list`, `gh issue view <N> --comments` — and
   asserts the issue is **OPEN**, failing loudly if not.

This makes the correct start-of-task behavior a **single command** instead of
four separately-remembered steps — the same "one loud tool, not four remembered
rules" move that already works at close time. It is additive to `claim.js` (it
does not claim; it front-loads the reads that should precede a claim) and so does
not collide with the in-flight claim.js work (#1013, #1017).

→ **Child filed: see closing comment.** Scoped as one new script + one npm
entry; implementation can be declined or merged into claim if preferred.

### Not filed (with reason)

- **claim `--as` / identity** → already owned by #829/#1010/#630; a competing
  ticket would duplicate the decision.
- **push-then-close** → already fixed (#995).
- **velocity-from-main / dirty-tree-close** → already guarded; working as
  designed.
- **Edit-without-Read** → harness invariant, no repo-side lever.
- A claim-time area/identity nudge → folds naturally into the in-flight
  #1013/#1017 claim.js changes; filing a third concurrent claim.js ticket now
  would collide. Recommend the preflight wrapper (above) instead, which is a
  separate file.

---

## 4. Headline conclusion

The "clear-but-failed" behavioral subset is **mostly already solved** — by
point-of-action guards, by #995, and by the #829 decision — not by documentation.
The one residual, high-leverage intervention is to **extend the close-time guard
pattern to task-start** via a `preflight` wrapper, collapsing the recurring
start-of-task lapses (timestamp, worktree-list, open-check) into a single loud
command. The durable lesson for future guardrails: when a rule is already clear
but still gets skipped, don't rewrite the rule — **move it into the tool at the
point of action.**
