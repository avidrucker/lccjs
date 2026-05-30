<!-- @todo #207:45m/RESEARCH Mine every TIL below into actionable codebase + process
     improvements: de-dupe lessons that recur across agents/sessions (recurrence =
     a process defect, not a one-off), classify into codebase vs work-process buckets,
     cross-check against open issues so we corroborate rather than re-file, ship a
     synthesis doc (docs/learnings/til-synthesis-<date>.md), and decompose the
     genuinely-new actionable items into ≤60m grabbable follow-up puzzles. Recommend
     whether this harvest should become periodic. Read-only spike — no source changes
     in #207 itself. Marker is documentary: docs/** is .pddignored so the pdd scan
     skips it, but `npm run puzzle:status` (git grep) reconciles it against the issue.
     See #207. -->

# Learnings — `docs/learnings/`

Per-session **"Today I Learned"** (TIL) write-ups: the non-obvious, hard-won
lessons from working this repo — process friction, tooling gotchas, ISA/parity
surprises, and the conventions that emerged to fix them. Each agent writes one
at the end of a working session.

These are **narrative retrospectives**, not authority docs. When a lesson
hardens into a rule it migrates into the relevant authority doc
([`claude_workflow.md`](../claude_workflow.md), [`puzzle-velocity.md`](../puzzle-velocity.md),
the skills) — the TIL is where it's first noticed, not where it's enforced.

> **Standing follow-up:** the lessons here are only mined into tracked work
> ad-hoc. **[#207](https://github.com/avidrucker/lccjs/issues/207)** (marker at
> the top of this file) is the spike that systematically harvests them into
> codebase + process improvements. A lesson learned once by one agent shouldn't
> silently recur for the next.

## Naming

- `today-i-learned-YYYY-MM-DD-<agent>[-<session>].md` — the per-session format
  (agent = the worktree fruit identity: APPLE, BANANA, CHERRY, …).
- `YYYY-MM-DD-<topic>.md` — older topic-scoped retrospectives.

## Index

| Doc | Date | Agent | Themes |
|---|---|---|---|
| [oracle-e2e `.bst` redundancy](./2026-05-25-lcc-oracle-e2e-bst-redundancy.md) | 2026-05-25 | — | A redundant `.bst` golden in the `lcc.oracle.e2e` suite: the bug, the fix, and general golden-hygiene lessons. |
| [adopting PDD on lccjs](./2026-05-26-pdd-adoption.md) | 2026-05-26 | — | Why/how PDD was adopted: the layering architecture, decomposition in practice, resolution lifecycle, and where it deviates from canonical Yegor. |
| [TIL 2026-05-28-001](./today-i-learned-2026-05-28-001.md) | 2026-05-28 | — | Worktree isolation isn't a judgment call; one-shot spike scaffolding; de-noising docs; verify counts vs headings; asserting edit scripts; murky multi-pass velocity. |
| [TIL 2026-05-28-002](./today-i-learned-2026-05-28-002.md) | 2026-05-28 | — | pdd's substring scan trips on uppercase `TODO`; close vs blocked-follow-up; share substrate not presentation; stale-marker debt; retract confident-wrong claims; blocked vs icebox. |
| [TIL 2026-05-28-003](./today-i-learned-2026-05-28-003.md) | 2026-05-28 | — | "File as puzzles" = GH ticket not `@todo` (yet); read the tracker before filing; highest-value test = risk × testability; severity follows failure-visibility. |
| [TIL 2026-05-28-004](./today-i-learned-2026-05-28-004.md) | 2026-05-28 | — | `Closes #N` decouples GitHub from hand-maintained snapshots; quality pass = verification not discovery; sample the whole set before scoping; never hard-code issue numbers under concurrency; fixed-budget = ticket honesty. |
| [TIL 2026-05-29 APPLE](./today-i-learned-2026-05-29-apple.md) | 2026-05-29 | APPLE | Never chain `rebase && push`; a repeated manual workaround is a system bug; recover from outages read-only; prove what your commands touch; dogfood coordination conventions; shortest-estimate is a tiebreak. |
| [TIL 2026-05-29 APPLE s2](./today-i-learned-2026-05-29-apple-2.md) | 2026-05-29 | APPLE | "I followed the protocol" is a hypothesis to test vs artifacts; parallelizing can violate ordering; fleet-wide skips are doc-drift; fix what you predict *from*; a spike's best output is a negative result; match container to finding. |
| [TIL 2026-05-29 BANANA](./today-i-learned-2026-05-29-banana.md) | 2026-05-29 | BANANA | Oracle runs what it assembles (parity programs must terminate); audit the whole class on one glitch; re-assess "epics" vs current code; delete markers wherever they live; public docs mustn't link private repos; `npm run` eats flags without `--`. |
| [TIL 2026-05-29 BANANA s2](./today-i-learned-2026-05-29-banana-2.md) | 2026-05-29 | BANANA | Auto-claim handed a live agent's identity (#193–#195); close-protocol doc drift (#201); `cea` is fp-relative `lea` (#152); `Read` false-positives `.a`/`.ap` as binary; push-gating hook bash/grep gotchas (#205/#188). |
| [TIL 2026-05-29 CHERRY](./today-i-learned-2026-05-29-cherry.md) | 2026-05-29 | CHERRY | `merge=union` fires under rebase too; derive rebased values, don't store them; prefer the project's claim tooling; trust VERSION/CHANGELOG over loaded frontmatter; close a process-changing ticket *using* the new process. |
| [TIL 2026-05-29 CHERRY s2](./today-i-learned-2026-05-29-cherry-2.md) | 2026-05-29 | CHERRY | Live data is the tiebreaker when docs disagree (and the disagreement is a bug); a scope ticket is done when it spawns grabbable children; a guardrail stop means confirm not circumvent; verify outward effects landed; log live repros of documented bugs. |
| [TIL 2026-05-29 DRAGONFRUIT](./today-i-learned-2026-05-29-dragonfruit.md) | 2026-05-29 | DRAGONFRUIT | Triage ranks importance, not what's already taken; precedent ≠ authorization for an external write; closing a ticket has a footprint beyond the tracker; a velocity row belongs to its own unit's ticket; `wontfix` with a forward path. |
| [TIL 2026-05-30 CHERRY](./today-i-learned-2026-05-30-cherry.md) | 2026-05-30 | CHERRY | A tool living on `main` is silently stale on an un-synced checkout (the #212 fix ran inert → #228 guard); "no files changed" ≠ "no logging"; sharpen an existing complaint, don't duplicate it; a guard needs both its decision *and* its trigger proven; logging is data, commentary is noise. |
| [TIL 2026-05-30 APPLE](./today-i-learned-2026-05-30-apple.md) | 2026-05-30 | APPLE | A gate that false-fails on the common path trains everyone to bypass it (#224); trace to the mechanism, fix the layer that closes every entry point; capture t0 live (reconstructed start = honesty tax); dogfood the fix on your next action; consolidate onto the *existing* convergence point, don't spawn a competitor; the worktree default prevents stale-base clobbers. |
| [TIL 2026-05-30 DRAGONFRUIT](./today-i-learned-2026-05-30-dragonfruit.md) | 2026-05-30 | DRAGONFRUIT | Don't store availability—derive it (a lock from a live worktree can't orphan, #222); batch label/state reads are cheap, native relationships expensive—never the source of truth; verify a ticket is OPEN before claiming (raced #223→filed #227); the `at_todo` trap bites CSV *data* too; cross-repo deliverable / single-repo log; `npm run` drops flags without `--` and a leftover branch blocks a forced re-claim; decide-then-execute via documented architect calls; estimates are data, not commentary. |
| [TIL 2026-05-30 BANANA](./today-i-learned-2026-05-30-banana.md) | 2026-05-30 | BANANA | A coverage ticket that cites a bug usually wants a regression *pin*, not a repro (the #166 OB sites were all fixed); "hard to test" is itself a finding (#240/#241 off-TTY + stdin-prompt CLI bugs); when the named path is blocked, drop to the pure seam underneath; cleanup must be gated on a *confirmed* push — a newline is not an `&&` (#242 near-miss); `puzzle:status` only sees marker-backed work, read `git worktree list` for the real board. |

## Recurring threads (informal — #207 will formalize)

A few lessons already recur across multiple agents/sessions — exactly the signal
#207 is meant to catch:

- **Marker hygiene** — closing a ticket isn't done until its `@todo` is deleted
  *wherever it lives* (28-002 #4, 29-banana #4, 29-dragonfruit #3).
- **Close-protocol doc drift** — `claude_workflow.md` vs `puzzle-velocity.md`
  disagree on the close sequence (29-banana-2 #2, 29-cherry-2 #1; tracked as #201).
- **Outward actions need explicit authorization** — precedent isn't a green light
  for writes to shared/external systems (29-cherry-2 #3, 29-dragonfruit #2).
- **Test against artifacts, not memory** — "I followed the protocol" / counts /
  predicted issue numbers must be verified against ground truth (28-001 #4,
  28-004 #4, 29-apple-2 #1).
