# Today I Learned — 2026-05-30 (CHERRY, session 3)

Context: PM triage + work assignment across BANANA/CHERRY/DRAGONFRUIT, then took
#242 (design how to harden the puzzle close sequence) and implemented its
decomposition #266 (`scripts/close.js` / `npm run close`). The session was
dominated by self-inflicted git churn — most lessons are about *my own process*,
not the code.

## 1. Dogfooding a tool finds the bugs no smoke test will

`close.js` passed every pure-seam smoke test I wrote (9 push cases, the gate, the
conflict classifier). Then I ran it for real to close its own issue and it failed
twice — both real bugs the units missed:

- **The pre-push hook banner defeats string-classification.** The lccjs `pre-push`
  hook prints `[pre-push] scanning…` on *every* push, success or fail. My
  `classifyPushError` had a FATAL pattern `/\bpre-push\b/` to catch hook
  rejections — but it matched the success banner too, so a *successful* push read
  as `rejected-other`.
- **`failed to push some refs` is not a race signal.** It's git's generic summary
  for *any* push failure (including a local hook reject). Having it in the RACE
  list made a hook rejection loop 5× pointlessly.

**Root cause:** I tried to infer push success/failure from *stdout strings* when
the **exit code already says it authoritatively** — a failing hook makes `git
push` exit non-zero, so exit 0 unambiguously means landed. **Takeaway:** when a
command gives you an exit code, trust it over parsing its prose. `classifyPushError`
is now failure-only; `tryLand` returns `ok` on exit 0 and only classifies real
failures. And: **dogfood every tool against its own close before trusting it** —
smoke tests on hand-picked strings can't surface "the banner always prints."

## 2. The `at_todo` substring trap caught me writing `TODOS.md` in a comment

`close.js` had a comment mentioning `TODOS.md` as an example of a non-union
conflict file. The literal string contains the uppercase puzzle keyword as a
substring, so the `pdd` pre-push scan aborted the entire push with a parse error
— exactly the trap `claude_workflow.md` documents (and which my reference
`claim.js` avoids). **Takeaway:** in any *scanned code file*, never write the
uppercase keyword even inside a larger token like a filename; reword (`a
hand-edited doc`) or use lowercase `at_todo`. This is a code-comment hazard, not
just a marker hazard — and DRAGONFRUIT already hit its CSV-data variant, so it
recurs.

## 3. Committing from a worktree path that was never created lands junk on main

The capstone mistake. `npm run claim -- 239` correctly **refused** (#239 was
already closed by an earlier session — my own #227 guard working) so the worktree
was never created. I didn't read that failure carefully, `cd`'d into the
non-existent `.claude/worktrees/cherry-issue-239/` anyway, wrote my TIL there, and
committed — landing two *tracked* files under `.claude/worktrees/…` on `main`,
pushed. `.claude/` wasn't gitignored, so git happily tracked worktree-internal
paths. **Takeaways:** (a) a claim *failure* means there is no worktree — stop, do
not proceed as if it succeeded; (b) `.claude/` must be gitignored so a stray
write under a worktree path can never be committed (added this session); (c) this
is the same "batched calls → didn't read the real result" failure as #4, with
file-system consequences.

## 4. Batching git/gh calls makes me confabulate state — the #1 recurring failure

Already in my memory (`deliberate-tool-pacing`) and I *still* did it, repeatedly,
this whole session: fired many `git status`/`grep`/`tail`/`python` calls in one
turn, mis-read normal `merge=union` output as "corruption," did an unnecessary
`reset --hard`, and (see #3) acted on a claim I never confirmed succeeded. The
garbled/interleaved output from parallel Bash calls is the tell. **Takeaway
(re-affirmed, with teeth):** for any git/gh state mutation or inspection, run
**one** command and **read its real result** before the next. Every serious error
this session traces back to violating this.

## 5. Editing the velocity CSV in two checkouts splits the work and loses rows

I appended a PM-triage row to the **main checkout's** working CSV early, then did
the close from a **worktree**. The main-checkout row stayed uncommitted; during a
later `pull --ff-only` block I cleared it with `git checkout --` and **discarded
the row**, then had to reconstruct it. (I also briefly wrote a memory note
claiming the two CSVs shared an inode — they didn't; `stat` proved different
inodes. Deleted the false note.) **Takeaway:** log a velocity row in exactly ONE
checkout — ideally the worktree you'll close from, so it rides the close commit.

## 6. Guards that make the unsafe path *impossible* earn their friction

Three safety rails fired correctly and *prevented* loss rather than causing it:
- `npm run claim` refused to stake from a local `main` behind origin (#228) —
  forced a `pull --ff-only` first.
- `npm run claim` refused #239/#278 as CLOSED / stale-main (#227/#228).
- `close.js`'s verify-then-cleanup gate refused to remove the worktree after the
  (buggy) push reported failure — the commit stayed safe and local. The gate did
  its one job even while the classifier above it was wrong.

**Takeaway:** a guard that makes the *unsafe* path impossible (not merely
discouraged) holds even when the layer above it has a bug — the whole thesis of
#242, validated on its own implementation. The contrast with my #3 mistake is
exact: where there was no guard (`.claude/` trackable), the footgun fired; where
there was one, it held.
