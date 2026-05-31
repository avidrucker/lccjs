# Today I Learned — 2026-05-30 (CHERRY, segment 2)

Date: 2026-05-30
Agent: CHERRY
Context: Fixed #224 — the pre-push pdd gate that false-failed from any worktree
whose path held a regex-special char (the `+` `EnterWorktree` injects). The
root cause was already nailed by #226; my job was choosing the *layer* to fix
and not getting bitten by the scanner I was fixing. Then a gotcha found mid-fix
spun out two follow-ups (#248 DEV, #249 policy/upstream) logged via PM #250.

---

## 1. Root-caused upstream ≠ fix upstream — pick the layer that closes every entry point

The defect lived in the `pdd` gem (`Glob#to_regexp` never `Regexp.escape`s
literal path chars). But the gem is a vendored dependency; the durable,
in-our-control fix was one layer down the call stack at the entry point everyone
actually runs — `scripts/run-pdd.sh` now scans through a special-char-free
symlink when the repo path is unsafe, and **fails loudly** if it can't build a
safe path. Fixing the wrapper fixes every `npm run puzzles` regardless of the
gem. The upstream `Regexp.escape` fix is *correct* but slow (round-trip, release);
it goes to #249, not the critical path.

## 2. A tool that scans source will scan the code that talks about it — twice

The scanner I was fixing bit my own fix two ways: (a) my explanatory comment in
`run-pdd.sh` wrote the literal uppercase keyword → pdd aborted on its own
wrapper; (b) the test's variable `UC_TODO` *contained* the keyword as a
substring. Both were invisible until I ran the gate against my own diff. Rule:
in any file the puzzle scanner reads, the uppercase marker keyword — even buried
in an identifier — is a live landmine. Use the lowercase `at_todo` placeholder or
build the string at runtime (`['T','O','D','O'].join('')`), and **run the gate on
your own change** before trusting it.

## 3. A green regression test proves nothing until it's failed on the unfixed code

Three passing tests against the *fixed* script could mean "fix works" or "test
asserts nothing." I copied `HEAD:scripts/run-pdd.sh` (pre-fix) into the same
synthetic `+`-path scaffold and confirmed it exits non-zero — only then did the
green run mean the fix is load-bearing. Tied to the negative case too: a real
malformed marker must still **fail** through the symlink, or the fix would have
silently neutered the gate.

## 4. Don't shell out to `grep` for a metachar check — the system `grep` may be `ugrep`

My first bracket-class pattern `[][(){}^$|+*?\]` worked in my head and failed in
practice: the system `grep` is `ugrep`, which parses `\]` inside a class as an
escaped bracket, never closing it ("mismatched [ ]"). Portable answer: a quoted
`case` pattern per char (`case "$s" in *"$c"*)`) — quoting forces literal match,
no regex flavour involved. Assume nothing about which `grep`/`sed`/`awk` variant
a host ships.

## 5. The crash was the shallow bug; the doc model being wrong was the real find

Chasing why my synthetic test crashed (`[] + true`, pdd.rb:78) led to
`--skip-gitignore`: it's misnamed — it *reads* `.gitignore` and folds it into the
exclude set, and it's **load-bearing** (excludes build artifacts + `puzzles.xml`
that `.pddignore` doesn't). So scan coverage is really `.pddignore` ∪
`.gitignore` — directly contradicting the docs' "`.pddignore` is the single
source of truth" claim. The crash itself is latent (we always ship a
`.gitignore`); the valuable output was the corrected mental model, not the
one-line guard. Look past the exception to the assumption it exposes. (→ #248
code+doc, #249 policy.)

## 6. Capturing t₀ after the work already happened is an honesty tax

For the PM filing row I grabbed a start timestamp *after* I'd already filed
#248/#249 — it undercounted the cycle to ~0.5 min. Rather than log the convenient
lie, I corrected to an estimated earlier start and noted it as an estimate. Same
lesson APPLE logged today: a reconstructed start is paid for in accuracy; capture
t₀ the moment context-gathering begins, not when you remember to.
