# Today I Learned — 2026-05-30 (CHERRY)

Date: 2026-05-30
Agent: CHERRY
Context: A session that started as triage and turned into a run down the
agent-**identity** seam. PM cross-linking of the identity cluster
(#188/#194/#195/#212), a correction on what "logging" means (#216), a research
doc reconciling the two identity mechanisms (#223) — whose *dogfood failed* and
became the session's best finding — then filing the follow-ups (#228/#229/#230,
R3 folded into #195) and fixing the first one (#228, a stale-`main` guard in
`claim.js`). Closed with user feedback to quiet estimate chatter (#234).

---

## 1. A tool that lives on `main` is silently stale on an un-synced checkout — the fix can be "present but inert"

To dogfood #212's new `CLAUDE_AGENT_NAME` mechanism I ran
`CLAUDE_AGENT_NAME=cherry npm run claim -- 223` and got **`agent: apple (auto)`** —
the env var ignored. The cause wasn't the fix; it was *version skew*: my local
`main` predated #212, so `npm run claim` executed the **old** `claim.js` that has
no `CLAUDE_AGENT_NAME` support at all (`grep -c CLAUDE_AGENT_NAME scripts/claim.js`
→ 0 locally, 7 on `origin/main`). After `git pull --ff-only`, the identical
command returned `cherry`. The fix was merged but **inert for the script I was
actually running.**

**The rule:** the tool you execute is whatever your *checkout* has, not what's
merged on the remote. Before running a repo's own tooling, sync `main` —
"fixed on `main`" ≠ "fixed for the copy about to run." Version skew between a
merged fix and the locally-executed file is its own bug class, and it bites
hardest exactly when you're trusting a recent fix. (This became #228 below + a
process note in #195/#230.)

## 2. "No files changed" means "no worktree needed," not "no logging"

I told the user a PM cross-link task didn't need a velocity row because it changed
no repo files. Wrong — and the investigation (#216) made it precise: the only
documented skips are "no velocity files exist" or a sub-minute clarification turn;
PM/RESEARCH/SPIKE rows that ship *zero code* are first-class (the CSV already had
~10). I had silently fused two independent questions: *does this edit the repo?*
(worktrees exist to isolate edits — no edit → no worktree) and *is this trackable
work?* (velocity measures work/time — the row still applies).

**The rule:** "does it change the repo" and "is it loggable work" are different
axes with different answers. A worktree is about file isolation; a velocity row is
about work. Don't let "nothing to commit" collapse into "nothing to record."

## 3. A "new" recommendation may already be an open complaint — sharpen it, don't duplicate

Filing the #223 follow-ups, one of them (R3: the "branch namespace is the source
of truth" claim is false) turned out to be *literally* existing complaint **#195**.
Strict yegor-tickets is one-complaint-one-ticket, so a second issue would have
split the discussion. Instead I commented #195 to refresh its line numbers — which
had drifted, because #212 rewrote the very file #195 cites (`claim.js` header
moved l.26–27 → l.38–39) — and added the second occurrence its body missed.

**The rule:** before filing, search the tracker for the complaint you're about to
report. If it exists, your job is to *add precision* — current line refs, a fresh
repro, a corroborating finding — not to open a parallel ticket. A duplicate looks
like progress and is actually fragmentation.

## 4. A guard has two halves — the *decision* and the *trigger*; prove both

For #228's stale-`main` guard I extracted a pure `assessBaseStaleness(base, behind)`
seam and unit-tested its decision logic (fast, no git). But a passing decision test
doesn't prove the guard *fires*: the `fetch → rev-list → die` wiring could be
broken and the unit test would still be green. So I built a throwaway `/tmp` repo
with local `main` deliberately one commit behind `origin/main` and watched the real
command abort (exit 1, correct message) — and confirmed a current `main` produces
*no* false positive.

**The rule:** a guard is a decision plus a trigger. Unit-test the decision in
isolation, but exercise the trigger at least once against a *constructed* failure
(not just the happy path), or you've only proven half the thing — and the
unproven half is the half that actually protects you.

## 5. Logging is data; commentary is noise — keep them separate, on the user's terms

I'd been appending estimate-vs-actual analysis to ordinary closes ("came in under
C…", "the over-pad pattern holds…"). The user found it both unwanted during normal
work *and* unclear — "under C" is undefined jargon. The fix isn't to stop
logging (the row — role, timestamps, actual — is plain data worth capturing); it's
to stop *editorializing* about the measurement. The analysis is a separate,
deferrable activity for a session the user explicitly calls for (#234).

**The rule:** capture the measurement quietly; don't narrate it. Recording a number
and analyzing it are different acts with different audiences — the log wants the
number, a normal work session doesn't want the essay. And when analysis *is*
wanted, say it in plain words ("faster than I predicted"), not internal shorthand.

---

## What landed

| Artifact | Change |
|---|---|
| [#215](https://github.com/avidrucker/lccjs/issues/215) | **Filed + closed (PM)** — cross-linked the agent-identity cluster (#188/#194/#195/#212) so each issue's thread reaches its siblings. |
| [#216](https://github.com/avidrucker/lccjs/issues/216) | **Filed + closed (RESEARCH)** — confirmed there is *no* "no-file-change = no-logging" rule (lesson 2); added a "What gets logged" note to `puzzle-velocity.md`. |
| [#223](https://github.com/avidrucker/lccjs/issues/223) | **Filed + closed (RESEARCH)** — `docs/research/agent-identity-guidance-reconciliation.md`: audits the 6 places identity is described, reconciles `--as` / `CLAUDE_AGENT_NAME` / `auto`, and reports the stale-`main` finding (lesson 1). |
| [#228](https://github.com/avidrucker/lccjs/issues/228) | **Filed + closed (DEV)** — stale-`main` guard in `claim.js`: a pure `assessBaseStaleness()` seam + a `fetch`/`rev-list` guard that aborts (with a `git pull --ff-only` hint) unless `--allow-stale-main`. 5 new unit tests; full suite green; `/tmp` repro proof (lesson 4). |
| [#229](https://github.com/avidrucker/lccjs/issues/229), [#230](https://github.com/avidrucker/lccjs/issues/230) | **Filed (WRITER, open)** — velocity `agent`-column wording; one canonical identity source. The other #223 follow-ups. |
| [#195](https://github.com/avidrucker/lccjs/issues/195) | **Sharpened, still open** — R3 folded in: refreshed the post-#212 line refs in the comment + its marker (lesson 3). |
| [#234](https://github.com/avidrucker/lccjs/issues/234) | **Filed (open)** — defer/quiet estimate analysis to focused RESEARCH/DATA sessions (lesson 5). |
| memories | `no-code-work-still-logged`, `quiet-estimate-analysis` (new); `parallel-worktree-workflow` de-staled with the sync-`main`-first + `CLAUDE_AGENT_NAME` rule. |

## Open threads for tomorrow

- **#229 / #230** (WRITER) — the velocity `agent`-column wording fix and the
  canonical-identity-source consolidation. Both ≤45m, grabbable.
- **#195** still needs the actual doc edits at all three sites (claim.js l.38–39,
  design doc l.36 + l.70–74) — the comment only sharpened the scope.
- **#228 caveat** — the guard only protects agents *already running it*; an agent
  on a pre-guard stale `main` still runs the old script. The complementary "sync
  `main` before claiming" process note rides #230. The guard narrows the window;
  the discipline closes it.
- **#234** — when the user wants a focused estimate/calibration session, that's
  where the analysis (and a plain-language glossary for the estimate vocabulary)
  belongs.

## Related artifacts

- `docs/research/agent-identity-guidance-reconciliation.md` — the #223 audit, with
  the stale-`main` repro that anchors lesson 1.
- `scripts/claim.js` — `assessBaseStaleness()` + the stale-`main` guard (#228).
- [TIL 2026-05-29 CHERRY](./today-i-learned-2026-05-29-cherry.md) — yesterday's
  "prefer the project's claim tooling" + "dogfood a process-changing ticket on its
  own close" are the parents of today's lessons 1 and 4; the identity seam keeps
  paying out lessons.
- [TIL 2026-05-29 DRAGONFRUIT](./today-i-learned-2026-05-29-dragonfruit.md) — its
  "a velocity row belongs to its own unit's ticket" is the sibling of lesson 2:
  both are about not collapsing distinct concerns onto one another.
