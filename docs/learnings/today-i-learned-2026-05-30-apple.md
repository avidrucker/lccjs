# Today I Learned — 2026-05-30 (APPLE)

Date: 2026-05-30
Agent: APPLE
Context: A backlog-grooming + tooling-bug session. Captured untracked `TODOS.md`
work as three trackers (**#218** parity, **#219** docs reconciliation, **#220**
core-behavior/test), logged the curation as **PM #221**. While pushing that
docs-only row the pre-push pdd gate false-failed — root-causing that became the
spine of the session: **#224** (the bug) + **RESEARCH #226** (the diagnosis).
Filed **#232** to document the workaround, then folded it into **#195** and
logged the consolidation as **PM #235**. Multiple agents (CHERRY, BANANA) were
working the same coordination cluster concurrently.

---

## 1. A guardrail that reliably false-fails on the common path trains everyone to disable it

The pre-push pdd scan false-fails from **every** worktree under
`.claude/worktrees/` — and worktree-per-task is the *mandated* default. So the
gate fires wrongly on the normal workflow, and the only way past is
`git push --no-verify`, which skips the **entire** hook — including the #205
in-progress-rebase / conflict-marker gate. A guardrail that cries wolf on the
common path doesn't just annoy; it conditions the whole fleet to bypass, taking
the *real* protections down with it. That makes a false-failing gate **worse than
no gate** (filed #224, `severity:medium`).

**The rule:** a guardrail's false-positive rate on the *common* path is a
first-class severity input, not a polish item. If the mandated workflow trips it
every time, fix that before it normalises the bypass.

## 2. Trace to the mechanism — the right fix is often a different layer than where the error prints

The error printed at `current_issues.md:9` ("malformed TODO"). The *cause* was
nowhere near there: pdd compiles `.pddignore` excludes to regexps from the
**absolute** worktree path, and `Glob#to_regexp` emits literal path chars
**unescaped** — so the `+` that `EnterWorktree` puts in `<fruit>+<slug>` dir
names becomes a regex quantifier and silently no-ops *all* excludes. Proven both
ways (`with +` → excludes miss; `without +` → match) and behaviourally (passes
from a clean checkout, fails from `apple+pm-221`). And the fix follows the
*entry point*, not the symptom: a `claim.js` naming guard (fix #1) only covers
`npm run claim` — agents using `EnterWorktree` directly still get the `+`, so the
durable fix is making the **scan** path-robust (`run-pdd.sh`, fix #2).

**The rule:** don't fix where the error prints; trace to the mechanism, then
pick the layer that closes *every* entry point. A fix that only covers one path
into the bug leaves the door open.

## 3. Capture t0 live — a reconstructed start is an honesty tax you pay in every notes field

I reconstructed the start time on **#221** and **#226** (the F1 finding from my
2026-05-29 self-audit, recurring), and each row had to carry a flagged
"`started_iso` RECONSTRUCTED (~HH:MM)" caveat. On **#235** I finally stamped t0
*live* at the turn's start — two seconds of work — and the row's times are both
exact, no apology. The recurrence is itself the signal: a lesson I'd already
written down still wasn't habitual, which is exactly the defect class #207 exists
to catch.

**The rule:** `date` first, before reading or doing anything. A start you have to
reconstruct is never as trustworthy as one you captured, and the caveat follows
the row forever.

## 4. Dogfood the fix the moment you discover it — your own next action is the cheapest test

Once I knew `/`→`+` broke the gate, I named the next two worktrees **without** a
slash (`apple-research-226`, `apple-pm-235`). Both pushed with the pdd gate
**passing** and **no `--no-verify`** — validating #224's fix #1 twice, for free,
while doing unrelated work (logging a research row, folding a ticket). The
workaround stopped being a claim in a ticket and became demonstrated fact.

**The rule:** when you find a workaround, apply it to your *very next* action and
watch it work. Validation you get as a side-effect of real work costs nothing and
turns "should fix it" into "verified fix."

## 5. Consolidation should converge on the existing convergence point — not spawn a competitor

Asked to bind #232+#195 into "a new single ticket," the tempting move was a fresh
umbrella. Triage showed why that's wrong: **#195/#229/#230/#232 are one
doc-surface** (agent-identity + worktree/claim naming), and **#230 already
exists** specifically to de-duplicate that surface. A new binding ticket would
*re-fragment* the thing #230 unifies. So I reused #195 (expanded it, folded #232
in, bumped its marker 15m→30m) and left #230 a **coordination comment** rather
than absorbing it — because that cluster is CHERRY's active territory (#228
claimed).

**The rule:** before creating a ticket to unify others, look for the ticket that
*already* unifies them and converge there. And when the surface is another
agent's active cluster, coordinate (a comment) — don't annex it.

## 6. The worktree-per-task default isn't ceremony — it's what prevents a stale-base clobber under concurrency

My #221 worktree branched **fresh from `origin/main`**, which had already advanced
to **#217** via CHERRY/BANANA while I worked. Had I appended the velocity row onto
my *local* `main` (`d2ff450`, three commits stale), I'd have either lost their
rows or produced a messy non-union merge. `merge=union` on the CSV plus a
fresh-from-origin worktree is the combination that makes blind concurrent appends
safe — the worktree is the mechanism, not a formality. (It also fixed the
duplicate-#210 row I'd flagged from stale local data — already cleaned upstream
in #217.)

**The rule:** under concurrency, always work from a fresh-from-origin base. The
"is my local main current?" question disappears entirely if you never edit from
it — which is the whole point of the worktree default.

---

## What landed

| Artifact | Change |
|---|---|
| [#218](https://github.com/avidrucker/lccjs/issues/218) / [#219](https://github.com/avidrucker/lccjs/issues/219) / [#220](https://github.com/avidrucker/lccjs/issues/220) | **Filed** — three trackers capturing untracked `TODOS.md` work (oracle-parity / stale-checklist reconciliation / core-behavior+test), following the #144 no-marker-on-tracker convention. |
| [#221](https://github.com/avidrucker/lccjs/issues/221) | **PM row** — the backlog-grooming unit (reconstructed start). |
| [#224](https://github.com/avidrucker/lccjs/issues/224) | **Filed** (`bug`, `severity:medium`) — pre-push pdd gate disables all `.pddignore` excludes from a `+`-containing worktree path; repro + 3 fix paths; bidirectionally cross-linked #205/#188/#194/#195. |
| [#226](https://github.com/avidrucker/lccjs/issues/226) | **Closed** (RESEARCH) — the root-cause spike (`Glob#to_regexp` unescaped path chars); exact-from-GitHub finish timestamp. |
| [#232](https://github.com/avidrucker/lccjs/issues/232) | **Filed then folded** — worktree-naming doc workaround, closed into #195. |
| [#195](https://github.com/avidrucker/lccjs/issues/195) | **Expanded** — now "worktree/claim naming + `--as` fan-out guidance (folds #232)"; marker 15m→30m/WRITER; carries a suggested cluster sequencing comment. |
| [#235](https://github.com/avidrucker/lccjs/issues/235) | **PM row** — the fold/consolidation unit (live start timestamp). |
| Coordination comments | #205, #188, #194, #195, #230 — context-bearing cross-links across the cluster. |

## Open threads for tomorrow

- **#224 is the durable win** and the top of the cluster. Suggested order (logged
  as a comment on #195): **#195 (doc, 30m) → #224 (prefer fix #2, the
  `run-pdd.sh` path-robust approach) → #194 + the fix-#1 `claim.js` guard (one DEV
  pass) → close #188**. Docs-before-fix here *inverts* "root cause first" on
  purpose: the doc is a 30-min fleet unblock and the code fix's workaround is
  already proven.
- **The identity/naming doc-surface** (#195/#229/#230/#232) wants **#230** (CHERRY's
  dedup) to absorb or sequence it — heads-up left; her call.
- **#225** ("which issues earn a velocity CSV row — stop double-logging") is the
  meta-ticket that would settle the PM-row question I kept hitting all session.
  Worth prioritising so the logging convention stops being re-derived per agent.

## Related artifacts

- [#224](https://github.com/avidrucker/lccjs/issues/224) — the bug this session's
  lessons 1–2 distill; [#226](https://github.com/avidrucker/lccjs/issues/226) —
  its root-cause close.
- [TIL 2026-05-29 (APPLE s2)](./today-i-learned-2026-05-29-apple-2.md) — lesson 4
  there (capture t0 / F1) is the *same* lesson that recurred here as lesson 3;
  recurrence is the #207 signal.
- Agent memory `process-adherence-fixes` — F1 (live t0) lives there; this session
  is the recurrence datapoint.
