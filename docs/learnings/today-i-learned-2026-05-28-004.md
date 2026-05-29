# Today I Learned — 2026-05-28-004

Date: 2026-05-28
Context: A code-quality assessment pass on lccjs that turned into a reconciliation
job. Answered "what can you assess at this stage?", discovered the bug log was
stale in the *good* direction, then filed the three highest-value next moves as
tickets (#165 docs reconcile, #166 plus/extra coverage scope, #167 CLI-scaffolding
refactor) and executed #165. Filed #170 when the staleness turned out
comprehensive. Closed `#165` and logged velocity (actual 6.5m vs H 45 / C 12).

---

## 1. `Closes #N` silently decouples GitHub state from a hand-maintained snapshot

`open_bugs.md` listed OB-001..OB-026 as `Status: open`. Every one was actually
fixed. The mechanism, once I dug for it, was mundane and important: fix commits
wrote `Closes #N` in their messages, so GitHub **auto-closed** issues #31–#59 the
moment they merged — but nobody hand-edits the `open_bugs.md` `Status:` lines, so
the markdown snapshot froze at its 2026-05-25 state while reality moved on. All 10
GH issues for the core bugs were already `CLOSED` when I checked.

**The rule:** when a project keeps *both* a live tracker (GitHub) and a curated
prose mirror (a markdown bug log), the automated one is the source of truth and
the hand-maintained one is *always* lagging. Assess against git history + `gh
issue view`, never against the prose file's open-count. A snapshot's age stamp
(`Last updated: …`) is the tell — treat anything older than the last fix commit
as suspect by default.

## 2. On a mature, well-tracked project a "quality pass" is verification, not discovery

My instinct was to read the source and *find bugs*. That would have been wasted —
and worse, actively misleading. `docs/init_code_review.md` (a frozen May review)
and `open_bugs.md` had already catalogued every bug I'd have "found." If I'd
trusted the `Status: open` lines I'd have re-reported seven fixed bugs as live
findings. The actual value was the **delta**: which catalogued items still hold.
The whole task reframed from "audit the code" to "reconcile the tracker against
the code," and that only became visible *after* reading the existing review first.

**The rule:** before auditing, read what the project already knows about itself.
On a tracked codebase the scarce output is the diff against the last assessment,
not a fresh re-derivation of it.

## 3. Sample the whole set cheaply before you scope a reconcile — not the first N you happened to verify

I verified OB-001..OB-007 were fixed, scoped #165 to "those seven plus OB-012,"
and wrote into the ticket that OB-009..OB-026 were "pending verification." Then a
single `git log --all -i --grep="OB-0"` showed **all** of them had dedicated
`fix/refactor/docs/test(OB-NNN)` commits. My scope estimate was an artifact of
which entries I'd sampled first, not of the real distribution. The cheap
whole-set signal existed the entire time and I ran it too late — after the ticket
body was already written around the wrong assumption.

**The rule:** when scoping "clean up the stale entries," spend ten seconds
characterising the *entire* set (one grep across all IDs) before you write the
ticket. Verifying a prefix and extrapolating from it under-scopes.

## 4. Never hard-code a predicted issue number under concurrent agents

I wrote `#168` into two committed docs as the follow-up reference, reasoning "167
was the last one I created, so the next is 168." Wrong — parallel agents (the
til-002/004 and #164 sessions) had taken 168 and 169 in between, so `gh issue
create` handed me **#170**. I had to chase and correct the references before the
push.

**The rule:** issue numbers are a shared monotonic counter you don't control.
Create the issue *first*, read the number it actually got, *then* write any
reference to it. Predicting "current + 1" is only safe with no other writers — and
on this repo there are always other writers.

## 5. Fixed-budget discipline is about ticket honesty, not my wall-clock

Reconciling all 24 entries would have cost me minutes — trivially under any human
budget. The pull to "just do it all in #165" was strong. But the user chose strict
yegor (8 now + #170 for the rest), and the point landed: the ≤60m cap governs
*human* decomposition and *ticket reviewability*, not agent speed. Keeping #165 to
its scoped eight made its commit and velocity row mean exactly one thing. The cost
of splitting was made near-zero by deferring **with evidence** — #170 carries the
full OB→commit map, so its executor reconciles mechanically with no rediscovery.

**The rule:** "I can finish it in one breath" is not a reason to widen a ticket's
scope. Defer the overflow as a ticket carrying enough evidence that resuming is
mechanical.

---

## What landed

| Artifact | Change |
|---|---|
| [#165](https://github.com/avidrucker/lccjs/issues/165) | Filed + **closed** — reconciled OB-001..007 + OB-012 in `open_bugs.md` to `FIXED` w/ resolving SHAs; updated `current_issues.md` headline. Commits `9ed4fca`/`8a1d6c5`/`0c77cf0` |
| [#166](https://github.com/avidrucker/lccjs/issues/166) | Filed — scope ticket for first `src/plus`/`src/extra` test coverage (0% today); QA |
| [#167](https://github.com/avidrucker/lccjs/issues/167) | Filed — extract duplicated CLI scaffolding → `src/utils/cliExit.js`; `pdd-tracked`, `@todo` marker at `src/core/lcc.js:17`; DEV |
| [#170](https://github.com/avidrucker/lccjs/issues/170) | Filed — reconcile remaining OB-009..OB-026 (all have resolution commits; commit-map attached); WRITER |
| severity sweep | Added `severity:low` to #161, #160, #100, #99 — every open issue now carries a severity |
| velocity | `docs/puzzle-velocity.csv` row for #165 (WRITER, actual 6.5m, ΔC −5.5m) |

## Open threads for tomorrow

- **#167** is claim-ready: the live `@todo` marker is on `main` at `src/core/lcc.js`.
- **#170** is mechanical given its commit map; **#166** needs the per-file child
  puzzles spun out before coding.
- `open_bugs.md` still shows 17 `Status: open` = OB-009..026 (16, → #170) + OB-008
  (upstream, leave as-is).

## Related artifacts

- `open_bugs.md` / `current_issues.md` — the reconciled snapshots; their `Status:`
  lines are now authoritative per-entry even where the file's count still lags.
- `git log --all -i --grep="OB-0NN"` — the one-line signal that maps any OB-### to
  its resolution commit (lesson 3).
- [TIL 003](./today-i-learned-2026-05-28-003.md) — same-day session on the PDD
  filing conventions (`@todo` marker on *claim*, not on filing) that I followed for
  #166/#167.
