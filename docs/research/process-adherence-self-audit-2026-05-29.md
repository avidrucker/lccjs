# Process-adherence self-audit — APPLE, 2026-05-29 session

**Issue:** #203 (RESEARCH / AI self-audit) · **agent:** apple · **date:** 2026-05-29
**Audited against:** [`claude_workflow.md`](../claude_workflow.md), [`puzzle-velocity.md`](../puzzle-velocity.md),
the `yegor-*` skills · **cross-checked against:** git history (commit timestamps & diffs).

## Scope

One session, in which APPLE closed **#168** (TEST), **#167** (DEV), **#193** (SPIKE),
filed and graduated **#194/#195**, and did two on-`main` hygiene edits (stale #167
marker, the #194/#195 markers). The question (per #203): *where was process
adherence inconsistent or wrong, and what fixes it?*

Honest over flattering — the value is in the gaps.

## Scorecard

| Protocol step | #168 | #167 | #193 | Verdict |
|---|---|---|---|---|
| Capture start ts before reading | ✅ | ✅ | ✅ | OK |
| Set **C before reading the issue** | ❌ | ❌ | ❌ | **Systemic miss** |
| Worktree-per-task | ✅ | ✅ | ✅ | OK (but see F3 for the *non*-puzzle edits) |
| Flip `@todo`→`@inprogress` **on main** | ❌ | ❌ | n/a | **Systemic miss** |
| Stay in scope / no gold-plating | ✅ | ✅ | ✅ | OK |
| Verify as I go (tests/smoke) | ✅ | ✅ | ✅ | OK (strength) |
| Capture finish ts before close | ✅ | ✅ | ✅ | OK |
| Single-commit close (#186) | ✅ | ✅ | ✅ | OK (strength) |
| Honest `actual_min` | ✅ | ✅ | ✅ | OK (strength — verified vs git) |
| Rebase on push-race | n/a | ✅ | ✅ | OK (strength — #167 hit a race, recovered) |
| Issue comment at close | ✅ | ✅ | ✅ | OK |
| Worktree + branch cleanup | ✅ | ✅ | ✅ | OK (strength) |
| Invoke `puzzle-velocity` skill | ❌ | ❌ | ❌ | **Systemic miss** |

## Findings (ranked by impact)

### F1 — C estimate set *after* reading the issue (systemic; all 3 tasks)
**Protocol:** set C "*before* reading anything substantive… a forward-looking
prediction" (`claude_workflow.md` At-start §2). **What I did:** every task, I
batched `date` and `gh issue view <N>` in a *single parallel tool block*, so the
issue body was in front of me before I stated C. **Why it matters:** the entire
point of C is to measure my prediction against reality; predicting *after* reading
the spec inflates apparent accuracy and destroys the calibration signal.
**Root cause:** optimising for round-trips (parallel calls) silently violated an
ordering constraint. **Cost:** the C column for #168/#167/#193 is not a real
prediction — it's a post-hoc guess. *(This task, #203, set C before the analysis —
the corrected behavior.)*

### F2 — the `@inprogress` claim signal never reached `main` (systemic; all tasks)
**Protocol:** "flip the puzzle's marker from `@todo` to `@inprogress` the moment I
check it out, so the marker **on main** reads as claimed." **What I did:** for #168
I flipped it *in the worktree*, ran tests, then **deleted** the marker before the
single close commit — so the `@inprogress` state was never committed/pushed. For
#167 I went straight `@todo`→deleted. For #193 there was no marker. **Evidence:**
no commit in the session history flips any marker to `@inprogress`. **Net effect:**
on `main`, every marker I worked read `@todo` (i.e. *grabbable*) for the whole
duration of my work. **What saved me:** `puzzle:status` infers the claim from the
*worktree branch*, so other agents running it still saw `CLAIMED by apple`.
**Important nuance:** banana got the same `"consider flipping to @inprogress"`
nudge on #152 — so this is a *cross-agent* gap, which suggests the on-`main` flip
step has quietly become **vestigial** now that `puzzle:status` reads worktrees.
This is as much a **process-doc drift** problem as an agent-discipline one (and it
neighbours #201, which already flags `claude_workflow.md` drift).

### F3 — edited `main` directly for "small" / bookkeeping changes (2 instances)
**Memory/convention:** worktree-per-task is the *expected default*, **explicitly
"not optional, don't skip for small/docs edits."** **What I did:** the stale-#167
marker cleanup (`77a31bf`) and the #194/#195 marker filing (`474c62e`) were both
done on `main` with a tight rebase+push, which I rationalised as "PDD bookkeeping."
**Why it matters:** `TODOS.md` is a *hot* file — banana and cherry both edit it —
so a direct-on-`main` edit races them; `merge=union` only protects the CSV, not
`TODOS.md`. **Root cause:** I invented an exception the convention specifically
forecloses. **Fix:** either use a worktree even here, or get a *documented*
carve-out for close-hygiene-on-already-closed-tickets (so the exception is a rule,
not a judgement call I re-litigate each time).

### F4 — hand-rolled velocity logging; never invoked the `puzzle-velocity` skill (systemic)
**Protocol:** the skill "auto-triggers when an agent picks up or closes a puzzle"
and carries guards (e.g. the 0.4.0 grep guard against committing rebase-conflict
markers — the exact failure that shipped raw conflict markers in `cb798a7`). **What
I did:** captured timestamps and appended CSV rows by hand. **Cost:** no harm
materialised, but I ran every close with the safety net switched off. **Fix:**
actually invoke the skill on pickup/close.

### F5 — C estimates poorly calibrated even allowing for F1 (systemic)
Logged C = 20 / 25 / 25 min; actual = 2 / 5 / 4 min — a **5–10× over-estimate**.
The tell: my C values hug ~⅔ of the *marker's human-cap* (30 / 60), i.e. I anchored
on the human estimate instead of predicting *my* speed. This is the #191 over-pad
finding, but worse, because anchoring is an avoidable mechanism. **Fix:** predict
from my own recent actuals — the CSV now has them (TEST ≈ 2m, DEV ≈ 5m, SPIKE ≈ 4m).

### F6 — didn't use `TaskCreate` for multi-step work (minor)
#167 touched 8 files; the harness nudged repeatedly. The protocol makes this
*optional* (3+ sub-steps), so this is a consistency note, not a violation — but a
visible task list would have made the 8-site sweep auditable.

## What went right (so the fixes don't regress it)

- **Honest `actual_min`** — verified against commit timestamps (appendix); no
  rounding games.
- **Single-commit #186 close**, finish-ts-before-commit, `closed_commit` left empty:
  correct and consistent across all three.
- **Push-race recovery** — #167 hit a non-fast-forward; rebased onto the new
  `origin/main` and let `merge=union` absorb the parallel CSV row. No clobber.
- **Worktree + branch cleanup** on every close; no orphaned worktrees left.
- **PDD graduation** of #194/#195 from the #193 spike, with markers backed by real
  issues that pass `pdd` — textbook yegor-pdd.
- **BDD ticket framing** (Have/Should/Repro) on every issue filed.
- **Self-caught** the stale #167 mirror-marker and cleaned it.
- **Findings → docs**, not chat (yegor-nohelp): two research docs this session.

## Process-doc problems vs agent-discipline problems

Separating these matters because they have different fixes:

- **Agent discipline** (I knew the rule, slipped): **F1, F3, F4, F5, F6.** These are
  fixed by *me changing behavior* — no doc change needed.
- **Process-doc drift** (the doc itself is stale or impractical): **F2.** The
  on-`main` `@inprogress` flip predates `puzzle:status` reading worktrees; now that
  the worktree *is* the claim signal, the flip is redundant ceremony that *no* agent
  reliably performs. That's a doc problem, and it sits right next to #201.

## Recommendations (ranked, actionable)

1. **[behavior, 0 cost] Set C before reading.** Stop batching `date` with
   `gh issue view`. Two separate steps: capture start + state C, *then* read. Fixes
   F1 outright.
2. **[behavior] Calibrate C from my own actuals**, not the marker's human cap. Fixes
   F5; sharpens the whole velocity dataset.
3. **[behavior] Worktree for every repo edit**, including bookkeeping — or write the
   carve-out down. Fixes F3.
4. **[tooling/behavior] Invoke `puzzle-velocity` on pickup/close.** Fixes F4, restores
   the guards.
5. **[doc] Reconcile the `@inprogress`-flip step** with worktree-as-claim-signal —
   either drop it, or make it a committed+pushed start step. Fold into #201's
   workflow-doc cleanup or file as its own DOCS puzzle. Fixes F2.
6. **[behavior, minor] `TaskCreate` for ≥3-step tasks.** Addresses F6.

## Proposed follow-up puzzles

- **DOCS (~15m):** reconcile the `@inprogress`-flip-on-`main` step in
  `claude_workflow.md` with the now-authoritative worktree claim signal (F2).
  Candidate to **merge into #201** rather than file separately (same file, same
  drift class). *Proposed — awaiting go-ahead before filing, per the user's
  one-at-a-time filing pattern.*
- The remaining fixes (F1, F3, F4, F5, F6) are **agent-behavior changes, not code** —
  better captured as a persisted **feedback memory** than as tickets.

## Appendix — evidence

`actual_min` vs git commit time (start ts from CSV → closing commit author-time):

| Ticket | started (CSV) | closing commit | commit time | Δ | logged actual |
|---|---|---|---|---|---|
| #168 | 16:18:32 | `d8490b7` | 16:20:31 | ~2.0m | 2 ✅ |
| #167 | 16:24:45 | `1a6bd87` | 16:30:06 | ~5.4m | 5 ✅ |
| #193 | 16:58:16 | `ebd531a` | 17:02:32 | ~4.3m | 4 ✅ |

No session commit flips a marker to `@inprogress` (F2 evidence). The two on-`main`
hygiene edits: `77a31bf` (stale #167 marker), `474c62e` (#194/#195 markers) — F3.
