# TIL 2026-06-04 — GRAPE 2

**Context:** First moments of a new GRAPE session. Dispatched to pick up #427
(Tracker: Tier 2 research scoping — velocity analytics, M2 oracle-CI spike, H5
disassembler flatten). Session ended immediately on discovery that #427 is
blocked by #426 (Tier 1 tracker). User then requested this TIL.

---

## 1. Read the full issue body before claiming — blockers live in prose, not markers

**What happened:** `npm run puzzle:status` showed zero claimable puzzles (six
blocked markers, all from #252 and #255). But #427 had no `@todo` marker in
source — it's a tracker. The reconciler gave a clean-ish signal, so I nearly
ran `npm run claim 427`. Then `gh issue view 427` arrived: the very first line
of the body reads *"Do not start until #426 is closed."*

**What I learned:** `puzzle:status` scans `@todo`/`@inprogress` markers in
source files. A tracker/epic with a prose "blocked by" constraint is invisible
to it. The two signals are complementary, not redundant: `puzzle:status` catches
code-site claims; the issue body catches milestone gates. Both checks are
required.

**The rule:** Before claiming any issue, read the full body — especially the
first paragraph and any "Blocked by" lines — even when `puzzle:status` shows it
as unclaimed.

---

## 2. The PostToolBatch hook flags batched Bash calls — even read-only ones

**What happened:** I batched `git status + npm run puzzle:status` with
`gh issue view 427` in a single message (two parallel Bash calls). The
PostToolBatch hook fired immediately:

> "Batched ≥2 state-changing Bash calls — stale-read footgun. Re-issue serially."

**What I learned:** The hook is conservative — it flags any pair of concurrent
Bash tool invocations, not only writes. The reason is documented in the
`deliberate-tool-pacing` memory: batching calls makes an agent confabulate
successes, because results are processed together rather than read one-at-a-time
before deciding the next step. Even "read-only" calls like `git status` or
`gh issue view` are gated because the *response* is state that must be read
before acting.

**The rule:** Issue Bash calls one at a time and read each result before the
next call. The only exception is genuinely independent, non-decision-gating
commands (e.g., two reads of different static files that don't inform each other).

---

## 3. Untracked build artifacts on main don't carry into worktrees

**What happened:** `git status` on main showed several untracked files
(`experiments/bp_basic.e`, `textbook_demos/*.lst`, etc.) — assembled outputs
that were never `.gitignore`d.

**What I learned:** Untracked files stay on the filesystem of whichever checkout
they sit in. A new worktree spun from the same commit starts clean — those
artifacts are absent. If a session needs them, they must be regenerated in the
worktree. This is normally fine (they're build products), but easy to forget if
you've been using them interactively on main.

**The rule:** Untracked build artifacts on main are session-local; they don't
follow into new worktrees. Regenerate or `.gitignore` as appropriate.

---

## Open threads

- #426 (Tier 1 tracker) must close before #427 work can begin. Check back once
  #426 closes.
- The assembled artifacts in `experiments/` and `textbook_demos/` may warrant a
  `.gitignore` entry — they're cluttering `git status`.
