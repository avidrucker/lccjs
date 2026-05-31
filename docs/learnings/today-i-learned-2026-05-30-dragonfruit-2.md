# Today I Learned — 2026-05-30 (DRAGONFRUIT, session 2)

A RESEARCH session on #241 (assembler prompts for an author name on stdin →
non-interactive `.o` production fails), which then spun into label/backlog
hygiene: filing the two surfaced parity deltas as decision-gated tickets
(#269/#270), creating the `decision` label and applying it across 10 issues, and
filing a staleness/grooming tracker (#273). The hardest lessons this session were
about *my own* failure modes, not the codebase.

## 1. I confabulated the entire task before reading the issue

The single worst moment: I opened #241 believing it was about a fictional
"30-byte section-name cap," reasoned about it, and *wrote a whole research doc*
(`og-lcc-section-name-cap.md`) arguing a position — all before the real issue text
had registered. #241 is about the **author-name stdin prompt**; nothing to do with
any cap. I caught it only on a deliberate re-read, deleted the bogus doc, and
restarted.

Root cause is documented and I walked straight into it anyway: I fired a large
**batch of Bash/Read calls in one turn** and started narrating conclusions before
the real results came back — the exact [[deliberate-tool-pacing]] trap (#227's
whole derailment). The fix is not "be more careful," it's mechanical: **one
substantive call, read the actual result, then the next.** A research doc is a
*conclusion*; writing one before you've read the question is the loudest possible
symptom of getting ahead of the tool results.

## 2. A clean-room repro must neutralize the cwd cache, or it lies

My first "repro" of #241 *passed* (exit 0, `.o` written, no prompt) and nearly had
me conclude "can't reproduce, already fixed." Wrong: `name.js` resolves `name.nnn`
**from cwd, not from the input file's dir**, and there was a `name.nnn` sitting at
the repo root masking the prompt. Deleting `demos/name.nnn` did nothing for the
same reason. Only a **fresh temp dir per invocation** exposed the real behavior.
Lesson: when differential-testing a tool that reads ambient state (cwd caches,
env, dotfiles), the harness has to *neutralize that state per run* — otherwise the
environment, not the code, is what you're measuring.

## 3. "It already works" is a valid — and easily-missed — research answer

The issue's OG-LCC angle ("how does OG LCC populate the author field
non-interactively?") had a surprising answer: **it doesn't have a mechanism** — no
`--name`, no `LCC_AUTHOR`, no config. Its *only* non-interactive path is the cwd
`name.nnn` cache, which LCC.js **already mirrors faithfully**. The deliverable
wasn't a fix; it was "the parity-correct path exists, the gap is discoverability."
A research ticket can resolve to *document the existing capability*, and that's a
real outcome — but only if you don't anchor on "what should I build."

## 4. Surface deltas as tickets; don't fold them into the close

The clean-room diff turned up two genuine divergences that were **out of #241's
scope**: (A) LCC.js writes the `.o` *before* resolving the name, so a name failure
leaves an orphan `.o` while exiting 1; (B) a successful `.o` assemble exits 0 in
LCC.js but 1 in the oracle. The discipline that worked: log them in the research
doc + the close message, then — when asked — file each as its own ticket (#269,
#270) rather than quietly "fixing while I'm here." Scope stayed fixed at the issue
body; the findings became the owner's decision to make.

## 5. A new label is only useful if it carries its own description

The user's actual requirement for the parity tickets wasn't "a label" — it was a
label that **explains itself on inspection**. `gh label create decision
--description "Needs a human architectural/design decision (Charlie or Prof. Dos
Reis) before code work"`. Without the description, `decision` is a colored dot
someone has to decode from context. The description *is* the feature. (Same for
`parity`.) And new labels are invisible to existing saved filters/triage
views until someone wires them in — worth flagging when you mint one.

## 6. `gh issue create` is not idempotent — a "no-output" result is not a failure

Filing the staleness tracker, my first `gh issue create` returned the new URL, but
I'd queued a **retry in the same turn** (old batching reflex) and it created a
*second* identical issue — #273 and #274. `gh ... create` has no dedupe; retrying a
call that actually succeeded double-files. Closed #274 as not-planned pointing at
#273. The general rule: for **side-effecting, non-idempotent** commands (create,
push, label-create), never pre-stage a retry — issue one, read the real result,
only then decide. This is the write-side twin of lesson #1.

> Recurring thread: this is the third distinct way the "batch calls + assume
> success" habit bit me in two sessions (confabulated doc, then a double-filed
> issue). The mitigation isn't a new memory — [[deliberate-tool-pacing]] already
> exists — it's actually obeying it on *write* operations, where the cost is a
> live artifact someone has to clean up.

## 7. `npm run claim` refuses on a stale local `main` — and that guard is right

`npm run claim -- 241 --as dragonfruit` aborted: "local main is N commits behind
origin/main." That's the #228 guard doing its job — claiming off a stale base
risks a wrong identity and an out-of-date branch. The clean workaround is a manual
`git worktree add -b <branch> <path> origin/main` (base directly on the remote
tip), which sidesteps the stale local ref entirely. Pair it with the
[[worktree-csv-shared-inode-hazard]] habit: treat `origin/main` as authoritative
for `puzzle-velocity.csv` on close, and watch the file's exec-bit when copying
artifacts between checkouts.
