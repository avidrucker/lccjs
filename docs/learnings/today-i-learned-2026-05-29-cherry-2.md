# Today I Learned — 2026-05-29 (CHERRY, session 2)

Date: 2026-05-29
Agent: CHERRY
Context: Second CHERRY session of the day (session 1 → #160/#186, the velocity-CSV
close-protocol fix). This one was assigned work, not self-directed: triage → take
**#169** (unit tests for `stateDelta.js`), then **#166** (a scope ticket for
`src/plus`/`src/extra` 0% coverage), then status assessment and issue-comment
corroboration. Two closes, five child issues spawned, three field-evidence
comments. The throughline: *most of the friction this session came from process
machinery, not from the code.*

---

## 1. When two process docs disagree, the live data is the tiebreaker — and the disagreement is itself a bug

Closing #169 I followed `claude_workflow.md`'s "At close" sequence: commit
`Closes #169`, `git pull --rebase`, **capture the post-rebase SHA** for a second
`docs(velocity)` commit. Only when I opened `puzzle-velocity.csv` to write the row
did the recent rows tell a different story — *"closed_commit empty per #186
protocol"* — and `puzzle-velocity.md` confirmed a **single-commit** close with an
empty SHA. I'd been executing a retired protocol. I course-corrected mid-close
(amended the row into the first commit, left `closed_commit` empty) and the next
close (#166) used the current form directly.

The fix wasn't just "do it right" — it was recognising the two docs *structurally
contradict*, which is already filed as #201. I added a first-hand repro to that
ticket rather than silently working around it.

**The rule:** when two authority docs prescribe different procedures, don't pick
one and hope — reconcile against the **ground-truth artifact** (here, the most
recent CSV rows, which show what agents *actually* do). And when docs contradict,
that contradiction is a defect to report, not a personal lookup to absorb.

## 2. A scope ticket is "done" when it has spawned grabbable children — not when the work is done

#166 was 0% coverage across ~2k LOC in 5 files. The reflex is "write tests." The
ticket's own marker said **"Do NOT attempt all 5 files in one puzzle"** — it's a
scope ticket, and its deliverable is *decomposition*: one ≤60m child puzzle per
file. I filed #196–#200 and closed #166 as a tracker, writing zero test code.

The value I added wasn't the split — it was the **seam findings baked into each
child** so any agent can start cold: `disassembler.js` has **no `module.exports`**
(CLI-only → a child must shell out to a golden `.e` or add an export seam first);
OB-002 is already *fixed* so its child pins a **regression**, not a repro; the
fixtures each child needs already exist (`plusdemos/*.ap`, `tests/goldens/`,
`assembler -o`). A decomposition that just lists filenames would have pushed the
real investigation onto five future agents.

**The rule:** read a ticket's own framing before reaching for the obvious verb. A
scope/tracker ticket wants children + the non-obvious seam facts that make them
cold-startable — not a heroic one-shot that blows the microtask cap.

## 3. A guardrail stop on an outward action means *confirm*, not *circumvent*

Filing the 5 child issues was blocked by the auto-classifier: "you were asked to
*do coverage*, not *file tickets* — creating issues in a shared tracker is a scope
escalation." It was right. "Take #166" reads as obvious authorization to me, but
creating five public artifacts in a shared tracker is exactly the kind of
outward-facing, hard-to-unwind action that deserves an explicit yes. I stopped,
laid out the prepared decomposition via `AskUserQuestion`, got the go-ahead, then
filed.

**The rule:** when a guardrail blocks an irreversible/outward action, treat it as a
prompt to surface the plan and get explicit sign-off — never as an obstacle to
route around. The classifier and I were modelling "scope" differently; the user
breaks the tie.

## 4. Verify an outward effect actually happened — "Closes #N" can lag

After pushing #166 with `Closes #166`, my immediate state check showed the issue
still **OPEN**. The keyword hadn't fired yet (direct-to-`main` pushes can lag a few
seconds). I'd staged a fallback (`gh issue close` *only if* still open after a
short wait) — and on recheck it had already closed on its own, so the fallback was
correctly skipped.

**The rule:** don't assume a side effect landed because the command that should
cause it succeeded. Re-read the actual state, give async effects a beat, and guard
any manual fallback with a fresh check so you don't double-act.

## 5. When you hit a documented bug live, log the instance — it converts theory to verified

Three open tickets describe process bugs I bumped into this session: #201 (the
contradicting close docs), and #194/#195 (claim `auto` reusing a fruit in the
close→next-claim gap). Rather than restate them, I commented with the concrete
session repro: I followed the stale doc on #169; `auto` recycled `apple` from a
just-closed session on my first claim, then *correctly* gave `cherry` on my second
only because other agents still held worktrees at that instant. That timing
dependence is the exact structural fragility #194 predicts.

**The rule:** a bug report with a real, dated, named repro is worth more than a
sharper restatement. If you trip the wire a ticket describes, leave the footprint
on the ticket — you're the verification the reporter couldn't self-provide.

---

## What landed

| Artifact | Change |
|---|---|
| [#169](https://github.com/avidrucker/lccjs/issues/169) | **Closed** — `tests/new/stateDelta.unit.spec.js`, 10 cases over `diffRegisters`/`diffFlags`/`pcChanged` (issue named a nonexistent `diffState`; tested the real API + noted the divergence). Single-commit close. |
| [#166](https://github.com/avidrucker/lccjs/issues/166) | **Closed as tracker** — decomposed into 5 per-file child puzzles with seam findings; no test code written by design. |
| [#196–#200](https://github.com/avidrucker/lccjs/issues/196) | **Filed** — disassembler / assemblerplus / interpreterplus / lccplus / linkerStepsPrinter smoke + OB-### repro children (each ≤45m, fixtures + repro pointers inline). |
| [#201](https://github.com/avidrucker/lccjs/issues/201), [#194](https://github.com/avidrucker/lccjs/issues/194), [#195](https://github.com/avidrucker/lccjs/issues/195) | **Commented** — first-hand session repros corroborating the close-doc contradiction and the claim-fruit gap. |
| memory | Added `terminal-agent-name-vs-fruit` — log velocity under the terminal name (CHERRY), not the claim-tool's auto fruit. |

## Open threads for tomorrow

- **#196–#200 are unclaimed children** ready to grab — the highest-ROI being #196
  (disassembler, largest untested file; resolve the export-seam-vs-subprocess
  choice first).
- **#201** is a cheap, high-value WRITER fix and I'm now a witness to it biting —
  worth prioritising so the next agent isn't misled the way I was.
- **#194/#195** (claim-fruit gap) stay gated on recurrence per #193; my #194
  comment adds a second data point toward "it recurs."

## Related artifacts

- [TIL 2026-05-29 (CHERRY, session 1)](./today-i-learned-2026-05-29-cherry.md) —
  same agent, earlier today; its lesson 2 ("derive, don't store a rebased value")
  is *why* the #186 single-commit protocol I tripped over in lesson 1 here exists.
  Session 1 built the fix; session 2 felt the doc that hadn't caught up (#201).
- [TIL 2026-05-29 (APPLE)](./today-i-learned-2026-05-29-apple.md) and the #203
  self-audit — the sibling "process adherence" thread; my lessons 3–4 are the
  outward-action half of the same discipline.
