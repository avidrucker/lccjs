# Today I Learned — 2026-05-30 (APPLE) — segment 3

Date: 2026-05-30
Agent: APPLE
Context: A long parity-research run plus two refactors — **#245** (label-length
probe), **#257** (consolidate the oracle bug reports into `reports_summary.md` +
sweep for new divergences), **#265** (file the reports-prep puzzles), **#157**
(`.string` escape parity), **#271** (correct a mis-attribution the human caught),
**#254** (linker `resetState` decomplect) — and declining **#267** as blocked.

---

## 1. #157 — verify the repro before investigating; the premise is a claim, not a given

The headline ("`.string` rejects a `\n` escape with `Missing terminating quote`")
**did not reproduce.** `\n` assembles and runs fine; `git log -L` on the escape
code showed it's been correct since **2024-12-30 — ~17 months before the issue was
filed** — and shipped demos (`demoP.a`, `happy-path.a`) already depend on it. Three
cheap checks (run the exact repro / blame the code vs the filing date / grep demos
for the feature) settle it in minutes.

**Lesson:** a bug ticket's "Have" is a *hypothesis*. Reproduce on current `main`
first. A premise that predates the relevant code's last change by months is almost
certainly stale or misfiled — confirm before spending the session on a fix.

## 2. #157 — when the headline doesn't reproduce, the adjacent truth is the finding

Don't close empty. The real divergence was the **opposite** of the claim: lccjs's
supported escape set is byte-identical to the oracle (`\n \t \r \\ \"`), but for
*unknown* escapes lccjs hard-errors while the **oracle silently drops the backslash**
and keeps the literal char (`\q` → `q`, `\0` → `0`). The ticket pointed the wrong
way; the probe found the right one — and it's BY DESIGN (louder failure beats the
oracle's silent passthrough, same call as #244's line-length).

**Lesson:** a non-reproducible headline is a signal to widen the lens by one notch,
not to stop. The true behavior *next door* is usually the actual deliverable.

## 3. #271 — "split from #X" makes #X the parent, not the claim under test

I wrote "the #150 report was a misdiagnosis." **#150 is about `sext` semantics;**
#157 was merely *split from* it. The misdiagnosis was #157's own premise (a
side-observation carried over from the #150 work). The human caught the conflation.

**Lesson:** attribute a debunked claim to the ticket that **asserts** it, not the
investigation that spawned it. A confident issue-reference in a shipped artifact is
itself a claim — open the referenced issue and read its title before naming it. And
correct the reader-facing record (the doc + a public comment) even when the commit
message that carried the error is now immutable history.

## 4. #267 — "depends on #N" can be a typo; ground-truth the block, don't trust the prose

#267 said "depends on #257" — but #257 was my own *closed* reports ticket,
unrelated. The real dependency was **#266** (`scripts/close.js`), in-flight by
CHERRY, and the file didn't exist on `main` yet. The honest test of "is this
blocked" was *does the artifact I'd build on exist* + `git worktree list`, not the
cited number.

**Lesson:** verify a dependency by its **substance** (does the code/file under test
exist?) and the live worktree board, not by the issue body's prose. A stale `#N`
will happily send you to write tests against an API another agent is still
designing.

## 5. #257 — a report's "might share a root cause" is a probe spec; sweep the whole family

The `ldr`/`str` silent-miscompile report *guessed* the no-comma parser flaw might be
shared. A differential sweep across every immediate/offset instruction confirmed it
— and showed it's bigger and **two-faced**: silent-drop-to-0 on the whole
`baser,offset6` family (`jmp`/`blr`/`jsrr`, not just `ldr`/`str`), but a hard
*reject* on `imm5`/`imm9`. First-noticed instance ≠ blast radius.

**Lesson:** when a finding hypothesizes a shared mechanism, treat the hypothesis as
a test matrix and run the full family. The same root cause can surface differently
by operand position — silent on a trailing offset, loud on an immediate field.

## 6. Triage — highest-severity is not the same as best-next

Severity-first ranking floated two mediums to the top, but **#269** was a
`decision`-labeled, owner-gated ticket and **#188** an undecomposed epic — neither
completable solo. The right grab was a self-contained low (**#254**).

**Lesson:** read a ticket's *labels* (`decision`, `blocked`) and *size* before
committing. An owner-gated or epic ticket ranks high but isn't **grabbable**; drop
to the highest self-contained, collision-free item.

## 7. Process

- **The shared `main` checkout can hold another agent's *uncommitted* work.** Three
  times this session it carried CHERRY's uncommitted velocity row, so a plain
  `git pull --ff-only` (or the claim stale-main guard) would have collided with it.
  The fix each time: `--allow-stale-main`, then rebase the **worktree** onto
  `origin/main`. Treat the main checkout's tree as possibly-dirty with someone
  else's WIP; do all work on a clean worktree base and never pull it out from under
  them.
- **A "no behavior change" refactor and a "non-reproducible" investigation both
  still earn a regression test** — one pins the invariant you just made structural
  (#254: a fresh `Linker` and `resetState()` produce the same field set), the other
  pins that the headline stays dead (#157: `\n` works, unknown escape errors
  clearly). The test is where the lesson stops being re-learnable.
- **A research probe's deliverable can be a confirmed non-bug.** #245 found OG LCC
  has *no* label-length cap (labels bounded only by line length) — parity, no
  change. The output is the documented verdict + the converted skip-test, not a
  code edit. A negative result is still a result worth pinning.
