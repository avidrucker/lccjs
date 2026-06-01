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
| [TIL 2026-05-30 CHERRY s2](./today-i-learned-2026-05-30-cherry-2.md) | 2026-05-30 | CHERRY | Root-caused upstream ≠ fix upstream — fix the layer that closes every entry point (#224 run-pdd symlink); a source scanner scans the code that *talks about* it (the keyword bit my own fix twice — comment + `UC_TODO` substring); a green regression test proves nothing until it's failed on the unfixed code; don't shell to `grep` for a metachar check (system `grep` may be `ugrep`) — use quoted `case`; the crash was shallow, the wrong doc model (`.pddignore` ∪ `.gitignore`, not SSOT) was the real find (#248/#249); reconstructed t₀ is an honesty tax. |
| [TIL 2026-05-30 DRAGONFRUIT](./today-i-learned-2026-05-30-dragonfruit.md) | 2026-05-30 | DRAGONFRUIT | Don't store availability—derive it (a lock from a live worktree can't orphan, #222); batch label/state reads are cheap, native relationships expensive—never the source of truth; verify a ticket is OPEN before claiming (raced #223→filed #227); the `at_todo` trap bites CSV *data* too; cross-repo deliverable / single-repo log; `npm run` drops flags without `--` and a leftover branch blocks a forced re-claim; decide-then-execute via documented architect calls; estimates are data, not commentary. |
| [TIL 2026-05-30 BANANA](./today-i-learned-2026-05-30-banana.md) | 2026-05-30 | BANANA | A coverage ticket that cites a bug usually wants a regression *pin*, not a repro (the #166 OB sites were all fixed); "hard to test" is itself a finding (#240/#241 off-TTY + stdin-prompt CLI bugs); when the named path is blocked, drop to the pure seam underneath; cleanup must be gated on a *confirmed* push — a newline is not an `&&` (#242 near-miss); `puzzle:status` only sees marker-backed work, read `git worktree list` for the real board. |
| [TIL 2026-05-30 BANANA s2](./today-i-learned-2026-05-30-banana-2.md) | 2026-05-30 | BANANA | Batching tool calls makes me confabulate results — one command → read the real block → proceed (#227); don't invent an external cause (output "corruption") for a self-inflicted discipline failure; a classifier denial is a feature catching a scope escalation; I re-committed the very lesson I was fixing (claimed a CLOSED issue without checking, #239). |
| [TIL 2026-05-30 BANANA s3](./today-i-learned-2026-05-30-banana-3.md) | 2026-05-30 | BANANA | Fix the chokepoint, not the line in the stack trace (#259 `resetProcessStdin` hit via 4 paths); check whether the contract already exists before designing one (`nbain`→0 was the off-TTY answer); split the crisp fix from the fuzzy decision — ship one (#259), file the other (#272); a test forces adjacent correctness you'd wave off as "optional" (cursor-escape leak); Edit/Write mangle literal control bytes — anchor on ASCII, assert via `String.fromCharCode(27)`; don't clobber another agent's uncommitted work to satisfy a guard (`--allow-stale-main`); "available" ≠ "ready" — the gate can live in the body, not a label (#268 dep on #266). |
| [TIL 2026-05-30 APPLE s2](./today-i-learned-2026-05-30-apple-2.md) | 2026-05-30 | APPLE | "Match the oracle" is wrong when the oracle silently corrupts — a louder/earlier failure is BY DESIGN, not a parity bug (#244 no line-length limit, 298-char buffer splits silently); before adding an exclude over a path the tool can run *from*, check the symmetric self-exclude case — anchor with `<rootDir>`, prove it with `--listTests` (#247 jest worktree leak); convert a permanently-skipped test into an active assertion or a deleted placeholder pointing at a findings doc. |
| [TIL 2026-05-30 APPLE s3](./today-i-learned-2026-05-30-apple-3.md) | 2026-05-30 | APPLE | A bug ticket's premise is a claim — reproduce on current `main` first (#157 `\n` worked for ~17mo, demos depend on it); when the headline doesn't reproduce, the *adjacent* truth is the finding (oracle silently drops unknown-escape backslashes, lccjs errors — BY DESIGN); "split from #X" makes #X the parent, not the claim (mislabeled #150 the misdiagnosis — human caught it); "depends on #N" can be a typo — ground-truth a block by whether the artifact exists + `git worktree list` (#267 → really #266); a report's "shared root cause" is a probe spec, sweep the family (#257 no-comma spans `jmp`/`blr`/`jsrr` + `imm5`/`imm9`); highest-severity ≠ best-next (owner-gated/epic rank high but aren't grabbable); the shared `main` checkout can hold another agent's uncommitted WIP — worktree on clean `origin/main`. |
| [TIL 2026-05-30 DRAGONFRUIT s2](./today-i-learned-2026-05-30-dragonfruit-2.md) | 2026-05-30 | DRAGONFRUIT | I confabulated #241 as a fictional "30-byte cap" and wrote a whole doc before reading the issue — the batch-calls-assume-success trap on the *write* side; a clean-room repro must neutralize the cwd `name.nnn` cache or it lies; "it already works" (OG has no author flag, only `name.nnn`, already mirrored) is a valid research answer; surface out-of-scope deltas as tickets (#269/#270) not as a while-I'm-here fix; a label is only useful with a self-explaining `--description`; `gh issue create` isn't idempotent — a queued retry double-filed (#273/#274); the stale-main claim guard is right, base the worktree on `origin/main`. |
| [TIL 2026-05-30 CHERRY s3](./today-i-learned-2026-05-30-cherry-3.md) | 2026-05-30 | CHERRY | Dogfooding `close.js` (#266) found two bugs the smoke tests missed — the `pre-push` banner prints on every push so success can't be string-matched (exit code is the authority), and "failed to push some refs" is git's generic any-failure summary, not a race; the `at_todo` trap bit a `TODOS.md` mention in a code comment; committing from a worktree path a *failed* claim never created landed tracked junk under `.claude/` on main (now gitignored) — a claim failure means there's no worktree, stop; batched calls → confabulated state (the root of every error this session, re-affirmed `deliberate-tool-pacing`); a guard that makes the unsafe path *impossible* (#227/#228/#266 gate) holds even when the layer above it is buggy. |
| [TIL 2026-05-31 BANANA](./today-i-learned-2026-05-31-banana.md) | 2026-05-31 | BANANA | No validated write path = recurring CSV corruption; SQLite eliminates the format-error class that CSV tooling cannot; auto-export on write keeps the generated file always current; DB location outside the repo solves cross-worktree access; run velocity-log from the committing worktree, not main; atomic writes (tmp + rename) are non-negotiable for generated files; walk architectural decisions phase-by-phase with the user, not as one front-loaded approval. |
| [TIL 2026-05-31 APPLE](./today-i-learned-2026-05-31-apple.md) | 2026-05-31 | APPLE | `at_todo` trap bites shell script echo strings (third surface: code comments, CSV data, now string literals); parallel issue filing breaks cross-links — file siblings sequentially; git worktree `.git` is a file, use `--git-common-dir` in hook installers; committed derived artifacts create silent staleness + crash risk; two-tier approach prevents artifact catalogs from becoming file-tree dumps; document *why* a workaround exists so its retirement condition is clear (`merge=union` → SQLite). |
| [TIL 2026-05-31 CHERRY](./today-i-learned-2026-05-31-cherry.md) | 2026-05-31 | CHERRY | Exit code is the authority, don't parse git prose to decide success; dogfood a tool against its own close before trusting it; a tool failure means the precondition didn't happen — stop; every error traced to batching tool calls (enforcement-asymmetry lesson: guards held, prose didn't — that's the fix); re-verify the board before reporting it, stale worktrees lie. |
| [TIL 2026-05-31 DRAGONFRUIT](./today-i-learned-2026-05-31-dragonfruit.md) | 2026-05-31 | DRAGONFRUIT | Pre-flight start timestamp is not optional — proved by skipping it (empty `started_iso`); the `at_todo` trap is meta-recursive in velocity notes (a row describing having dropped a marker contained the live form); two omissions, not one — the velocity row and the worktree for the row are independent obligations; `puzzle:status` + `git worktree list` are complements not alternatives; stale worktrees outlive closed issues. |
| [TIL 2026-05-31 BANANA s2](./today-i-learned-2026-05-31-banana-2.md) | 2026-05-31 | BANANA | A dirty `package-lock.json` alone is safe to force-remove; do the data-integrity audit before the process-mapping research (concrete evidence first); keyword-overlap mismatch heuristic finds gross transpositions but has a high false-positive rate (7/9); only 1 unrecovered mis-close in 233 issues — the system is more robust than feared; file the ARCHITECT follow-up immediately, don't leave guard recs as stranded prose. |
| [TIL 2026-05-31 APPLE s2](./today-i-learned-2026-05-31-apple-2.md) | 2026-05-31 | APPLE | CSV is read-only generated (never hand-edit conflict markers in it); null-ticket gap fixed (#299); `merge=union` only fires on merge, not rebase; guards held 8/8, prose rules violated 8/8 — the fix is converting prose to guards. |
| [TIL 2026-05-31 APPLE s3](./today-i-learned-2026-05-31-apple-3.md) | 2026-05-31 | APPLE | Prose violations happen even mid-documentation — guards are structural, not discipline; `.git` file vs directory is the clean worktree detector; research deliverables should name the exact implementation site; smoke-test inserts pollute the global DB; N-location prose drifts, N=1+links doesn't. |

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
