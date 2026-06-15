# TIL 2026-06-15 — FIG

**Context:** A single-ticket session: reviewed #1340 (WRITER: `agent-patterns.md`) with the `issue-review-skill`, scored it 15/15, took it on, and shipped the new doc. The lessons below are mostly about the *close-and-log tail* of the workflow rather than the writing itself — that's where the friction was.

---

## 1. A backgrounded `npm run close` reports "failed" (exit 1) even when the close fully succeeded

**What happened:** I ran `npm run close 1340` with `run_in_background: true` and got a `<task-notification>` with `status=failed`, exit code 1. The actual output, though, was unambiguous: `CLOSE OK`, commit confirmed on `origin/main`, claim ref deleted, `#1340 is CLOSED`. The exit 1 came from a trailing `pwd` that ran *after* the script re-rooted the shell out of the now-deleted worktree directory — `getcwd: cannot access parent directories`.

**What I learned:** This getcwd-after-teardown quirk is old and known-benign — #360, #434, and #533 (`fix(close): suppress harmless getcwd pwd error after worktree removal`) all chased it, and a prior TIL (#1163) already flagged "benign close exit-1." The *new* wrinkle is that when close runs as a **backgrounded** Bash task, the harness surfaces that exit code as a task-notification `status=failed` — which is far more alarming than the inline case, where you just see the line scroll past. The status field lies; the stdout doesn't.

**The rule:** **On a backgrounded `npm run close`, read the output for `CLOSE OK` before believing a `failed` status — the benign getcwd-after-teardown exit-1 (#360/#434/#533) gets mislabeled as a task failure.** (Tactically: closes are short enough that running them in the foreground avoids the false alarm entirely.)

---

## 2. `velocity:log --from-main` is the correct override once your own worktree is closed but siblings remain

**What happened:** After closing #1340 (which deletes my worktree and re-roots me to the main checkout), I ran `npm run velocity:log` from main and it refused: *"logging from main checkout while active worktrees exist."* Two *other* agents' worktrees (cherry-1371, dragonfruit-1160) were still live, so the guard fired. `--from-main` cleared it: the row went into `~/.lccjs/lccjs.db` and CSV export was skipped (deferred to the next worktree-close export).

**What I learned:** The guard exists to prevent the two-checkout CSV race (#320 — committing `puzzle-velocity.csv` from main while a worktree also holds it). But its trigger is "*any* worktree exists," not "*your* worktree exists." Post-close, your worktree is already gone while siblings persist — so the honest, intended path is exactly `--from-main`, which writes the DB row (the canonical store) and deliberately skips the CSV export. The CSV is a read-only projection; it'll be regenerated at the next close. This is not a workaround — the script self-documents it as the override for "a row with no worktree of your own."

Same-day siblings already touched `--from-main`: GRAPE logged it for a no-worktree PM row (#1266), and APPLE today even classified *hitting the guard* as a loggable `R021` errors-table event ("guard-block forcing a retry/override, even working-as-designed"). My added nuance is the timing tension: in the **post-close** case the override isn't an error to log — it's the only correct path left, because your worktree no longer exists by the time you log. So whether `--from-main` is "an override worth an errors row" depends on *why* you're on main: deliberately working main with no worktree (APPLE's R021 framing) vs. legitimately post-teardown (just the documented path).

**The rule:** **When logging velocity after your own close (worktree already torn down) and other agents' worktrees are still live, use `npm run velocity:log -- --from-main` — the DB row is what counts; the CSV regenerates later.**

---

## 3. A 15/15 ticket with minor non-blocking review notes → apply the tweaks in-flight, don't round-trip the issue

**What happened:** The `issue-review-skill` scored #1340 a clean 15/15 (READY) but surfaced two *non-blocking* improvements: the acceptance criterion said "link from the index (e.g. CLAUDE.md Gotchas or …)" — a soft, non-deterministic target — and the seed-harvest scope was unbounded against a 45m box. Rather than revise the ticket and wait for re-approval, I applied both while writing: pinned the link to a single deterministic location (CLAUDE.md Gotchas, beside `do-this-not-that.md`) and capped the harvest at 3 patterns, then recorded both choices in the close comment.

**What I learned:** A round-trip to revise a ticket is only worth it when a gap *blocks the start of work* — that's the whole point of the READY/NEEDS-WORK/BLOCK split. For a READY ticket, non-blocking notes are best resolved by the implementer in-flight, with the decision logged in the close comment so it's auditable. Revising a 15/15 ticket first would have been process for its own sake.

**The rule:** **On a READY (13–15) ticket, fold non-blocking review suggestions into the implementation and document them in the close comment — reserve ticket revisions for gaps that actually block starting.** (Promotion candidate: this belongs as a "worked well" entry in `docs/agent-patterns.md`, the very doc shipped this session — see Open threads.)

---

## What landed

| Artifact | Change |
|---|---|
| `docs/agent-patterns.md` | New working-practice doc: 3 patterns + 2 required anti-patterns, fixed What/Example/Why shape (#1340) |
| `CLAUDE.md` | Gotchas pointer to `agent-patterns.md` beside `do-this-not-that.md` (#1340) |

## Open threads

- **Promote lesson 3 into `docs/agent-patterns.md`.** The "apply non-blocking review notes in-flight on a READY ticket" practice is a natural "worked well" entry for the doc created this session. No ticket filed yet — flagging it here as the doc's first organic promotion candidate.
- The backgrounded-close `status=failed` surfacing (lesson 1) is more a harness-display wrinkle than a script bug (#533 already suppresses the inline error). Natural home if anyone wants it indexed: #1179 (open — single discoverable index for worktree/multi-agent footguns), not a fresh ticket.

## Related artifacts

- Issue #1340 — the WRITER ticket shipped this session
- Issues #360 / #434 / #533 — the close getcwd-after-teardown lineage
- Issue #320 — the two-checkout CSV race the velocity `--from-main` guard protects against
- [Prior TIL noting benign close exit-1](./today-i-learned-2026-06-07-dragonfruit.md) (#1163)
- [APPLE 2026-06-15](./today-i-learned-2026-06-15-apple.md) — same-day work on the same `bc91977`/#1328 root cause; `--from-main` as an R021 guard-override
- [GRAPE 2026-06-14](./today-i-learned-2026-06-14-grape.md) — `velocity:log -- --from-main` for a no-worktree PM row (#1266)
