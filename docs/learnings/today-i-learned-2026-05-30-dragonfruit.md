# Today I Learned — 2026-05-30 (DRAGONFRUIT)

A session spent on the multi-agent coordination machinery: filing a WIP-lock spike
(#222), getting raced on a ticket (#223), filing a guard for that race (#227),
fixing a stale doc (#201), then designing and shipping the derived-cluster
availability model end-to-end (#222 ARC redesign → #233 prototype → #237 + #238
integration into `puzzle-status` and the `puzzle-triage` skill).

## 1. Don't store availability — derive it

The first cut of the WIP-lock (#222) *stored* a lock: apply a `wip-locked` label on
claim, release on close, add a reconciler for the locks a crashed agent orphans. The
redesign makes "unavailable" a **pure function** of cheap live inputs —
`blocked-by an OPEN issue, OR shares a cluster with an in-progress (live-worktree)
clustermate`. Because the soft-lock is *derived from a live worktree*, it cannot
outlive the work that justifies it: no stored state, no orphaned-lock failure mode,
no reconciler. The whole reconciler/release/orphan-recovery subsystem evaporated the
moment I stopped storing the thing I could derive.

> Recurring thread: CHERRY (29) already wrote "derive rebased values, don't store
> them" for `closed_commit`. Same lesson, different subsystem — that recurrence is
> itself the signal #207 is meant to catch.

## 2. Batch reads are cheap; relationship reads are expensive — design around it

The cost intuition "querying GitHub over and over is expensive" is half-right, and
the half matters. `gh issue list --json number,labels,state` returns the *whole
repo* in **one** call — anything expressible as a **label** is effectively free
(`puzzle-status` already makes that call). What's genuinely expensive is GitHub's
*native relationships* (sub-issues, "blocked by") — per-issue GraphQL, N calls. So
the rule that fell out: **never make GitHub relationships the source of truth.** Keep
structure local (a tiny CSV manifest, zero network), keep one batch call for live
state, and derive the rest.

## 3. Verify a ticket is OPEN immediately before claiming — `claim` won't

I claimed #223 and spent a cycle reading + drafting the deliverable before noticing
CHERRY had closed it *seconds earlier*, in the same minute. `npm run claim` does not
check issue state, and `puzzle:status` "AVAILABLE" can't see a concurrent agent's
in-worktree work (or a fresh close) until it's pushed — the #193/#194 invisible-claim
window, live. Mitigation now in memory + filed as #227 (claim should warn/abort on a
CLOSED issue). The honest move on discovering the deliverable already on `main`:
**stand down** — don't overwrite, don't log a duplicate row, remove the worktree.

## 4. The `at_todo` trap bites in *data*, not just code

I wrote the literal string `@todo #227:20m/DEV` inside a `puzzle-velocity.csv` note
describing the marker I'd placed. `puzzle:status`'s `git grep` matched it → a
**phantom second marker** pointing at the CSV, miscounting the board. The documented
trap ("don't write the live marker form in prose") applies to commit/CSV *data* just
as much as to source comments. De-literalize: `at_todo #227`, or break the
`#N:Est/ROLE` tail.

## 5. Cross-repo deliverable, single-repo log

#238's deliverable was a skill edit in the **claude-config** repo, but the puzzle and
its velocity log live in **lccjs**. The #186 single-commit close assumes deliverable
+ row in one commit — which breaks across repos. Resolution: the skill change is its
own claude-config commit; the lccjs `Closes #238` commit carries *only* the velocity
row, whose notes name the claude-config SHA. And pushing a config repo is an outward
action — I committed it but left the push until explicitly asked.

## 6. `npm run <script> --flag` silently drops the flag without `--`

`npm run claim 222 --as dragonfruit` swallowed `--as`, auto-assigned `apple`, and
collided with a live `apple+pm-221` worktree. Needs `npm run claim -- 222 --as …`.
Then a second snag: removing a worktree doesn't delete its branch, so a *forced*
`--as` re-claim of the same issue hard-errors on branch-exists — the close protocol's
"delete the throwaway branch too" step exists for a reason; I'd skipped it.

> Recurring thread: BANANA (29) already logged "`npm run` eats flags without `--`."
> Two agents, same trap → it belongs in tooling/docs, not just TILs.

## 7. Separate architect-decide from courier-execute, in writing, before coding

The cluster integration had 5 open design questions embedded in it. Rather than
deciding them implicitly mid-edit, I resolved the gating ones (CSV vs label
membership; LOCKED vs the `blocked` label; where the derive helper lives) as
**documented architect calls in a #222 comment**, *then* decomposed into two ≤60m
child puzzles and executed. The combined work exceeded one 60m cap, which is the
honest trigger to split — not a judgment call to fudge.

## 8. Estimates are data; commentary is noise

Mid-session the guidance landed (and is now memory): in a normal working session, log
the velocity row as plain numbers — no "came in under C" / calibration narration.
Save the analysis for a focused RESEARCH/DATA session. CHERRY (30) independently:
"logging is data, commentary is noise." I'd been narrating every delta; stopped.
