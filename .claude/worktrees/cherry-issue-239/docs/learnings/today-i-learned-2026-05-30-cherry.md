# TIL — 2026-05-30 (CHERRY)

> Daily learnings log. Newest entries at the top. One concrete lesson per bullet:
> what broke or surprised me, why, and the durable takeaway.

## Segment 1 — PM triage + close-sequence hardening (#242 → #266)

**Context:** PM-assigned work across BANANA/CHERRY/DRAGONFRUIT, then took #242
(harden the puzzle close sequence) and implemented its decomposition #266
(`scripts/close.js` / `npm run close`). Closed both. The session was dominated
by self-inflicted git churn — most of the lessons are about *my own process*,
not the code.

### 1. Dogfooding a tool finds the bugs no smoke test will

`close.js` passed every pure-seam smoke test I wrote (9 push cases, the gate, the
conflict classifier). Then I ran it for real to close its own issue and it failed
twice — both real bugs the units missed:

- **The pre-push hook banner defeats string-classification.** The lccjs `pre-push`
  hook prints `[pre-push] scanning…` on *every* push, success or fail. My
  `classifyPushError` had a FATAL pattern `/\bpre-push\b/` to catch hook
  rejections — but it matched the success banner too, so every hooked push read as
  `rejected-other`.
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

### 2. The `at_todo` substring trap caught me writing `TODOS.md` in a comment

`close.js:174` had a comment mentioning `TODOS.md` as an example of a non-union
conflict file. The literal string contains the uppercase puzzle keyword as a
substring, so the `pdd` pre-push scan aborted the entire push with a parse error
— exactly the trap `claude_workflow.md` documents (and which my reference
`claim.js` avoids). **Takeaway:** in any *scanned code file*, never write the
uppercase keyword even inside a larger token like a filename; reword (`a
hand-edited doc`) or use lowercase `at_todo`. This is a code-comment hazard, not
just a marker hazard.

### 3. Editing the velocity CSV in two checkouts splits the work and loses rows

I appended my PM-triage row to the **main checkout's** working CSV early, then did
the actual close from a **worktree**. The main-checkout row stayed uncommitted;
during a later `pull --ff-only` block I cleared it with `git checkout --` and
**discarded the row**, then had to reconstruct it. (I also briefly wrote a memory
note claiming the two CSVs shared an inode — they didn't; `stat` proved different
inodes. Deleted the false note.) **Takeaway:** log a velocity row in exactly ONE
checkout — ideally the worktree you'll close from, so it rides the close commit.
Before any `git checkout --` / `reset --hard` on the CSV, check for a row that
exists only in the working file (`comm -13 <(git show origin/main:…|sort) <(sort
…)`). See the memory note `velocity-csv-two-checkouts`.

### 4. Batching git/gh calls makes me confabulate state — the #1 recurring failure

This is already in my memory (`deliberate-tool-pacing`) and I *still* did it: I
repeatedly fired many `git status`/`grep`/`tail`/`python` calls in one turn,
mis-read normal `merge=union` output as "corruption," and did an unnecessary
`reset --hard`. The garbled/interleaved output from parallel Bash calls is the
tell. **Takeaway (re-affirmed, with teeth):** for any git/gh state inspection,
run **one** command and **read its real result** before the next. The cost of one
extra round-trip is trivial next to the cost of acting on a misread.

### 5. The stale-main guard (#228) and the close gate (#266) both earned their keep

Two safety rails fired correctly this session and *prevented* data loss rather
than causing it:
- `npm run claim` refused to stake #266 from a local `main` 4 commits behind
  origin — forced a `pull --ff-only` first (#228). Annoying, correct.
- `close.js`'s verify-then-cleanup gate refused to remove the worktree after the
  (buggy) push reported failure — the commit stayed safe and local. The gate did
  its one job even while the classifier above it was wrong.

**Takeaway:** a guard that makes the *unsafe* path impossible (not merely
discouraged) is worth the friction — it held even when the layer above it had a
bug. That's the whole thesis of #242, validated on its own implementation.
