# TIL 2026-06-16 — FIG

**Context:** A WRITER-heavy session across two process lanes: glossary stale-prose
fixes (#1374 interpreter.md, #1395 assembler.md), claim-ref housekeeping (sweeping a
stranded `refs/claims/issue-1284`, writing `docs/claim-ref-housekeeping.md` #1421),
and the skill-portability/organization doc pair (#1218 `skill-portability.md`, #1219
`skill-organization.md`). Three things bit hard enough to write down.

---

## 1. Verify a ticket's stated premise against the repo before you write to it

**What happened:** Three separate tickets this session asserted a "current state"
that the repo contradicted. #1374/#1395 said glossary entries described code that was
"refactored away" — true, but the *replacement* they implied wasn't quite right either
(`nameHandler` doesn't live in the core modules, but it isn't *gone* — it moved to
`lcc.js`). And #1219's acceptance criteria hinged on a baseline — *"lccjs ships zero
project-level skills; all skills are user-global"* — that was simply false: the repo
commits **eight** project skills under `.agents/skills/` (the Codex layout). A doc
written to that premise would have been wrong on arrival.

**What I learned:** The ticket is a *hint*, not ground truth. For a fix-stale-prose or
state-the-baseline task, the deliverable's correctness depends on the current code/repo,
not on what the ticket author remembered when they filed it. Cheap verification
(`grep` the symbol, `git ls-files` the dir, read the `~/.claude/skills/` symlinks) caught
all three before a single word was written. When the premise is wrong, the move is:
write the *accurate* version, surface the discrepancy to the user (a one-question fork
when it changes the deliverable), and redline the source ticket non-destructively (I
struck the bad clause in #1210 with a `SEE COMMENTS FOR CORRECTIONS` banner).

**The rule:** **Before writing a "fix the stale X" / "state the current Y" deliverable,
verify the premise against the repo — the ticket describes what the author remembered,
the code is what's true.** (Authority: existing `claude_workflow.md` "surface the
conflict before starting work" + the `verify-prescribed-fix-not-just-bug` discipline.)

---

## 2. Scope-audit with the merge-base (three-dot) diff, not tip-to-tip

**What happened:** Closing #1218/#1219 from one worktree, my pre-close scope audit
`git diff --stat origin/main..HEAD` (**two-dot**) listed five files I never touched —
a deleted `scripts/check-glossary-symbols.js`, `package.json`, an ADR, a test spec,
`do-this-not-that.md`. For a moment it looked like my branch had swallowed someone
else's work. It hadn't: `origin/main` had *diverged* after I claimed (two sibling
commits `2e85f56`/`a4b38b8` landed), and a two-dot diff compares the two branch *tips*,
so it renders their changes as reversed hunks in *my* audit. The three-dot diff
`git diff --stat origin/main...HEAD` — which compares against the merge-base, and is
exactly what `npm run close` reports internally (`git diff --stat merge-base..HEAD`) —
showed only my five real files.

**What I learned:** In a multi-agent repo `origin/main` moves under you constantly, so
the two-dot diff is actively misleading for a scope audit. The three-dot/merge-base diff
answers the question you actually care about: *what did I change since I branched?*
(A `git fetch origin main` first avoids a separate stale-ref false positive.)

**The rule:** **For a scope audit use `git diff origin/main...HEAD` (three-dot /
merge-base), never `origin/main..HEAD` (two-dot) — the latter folds in `origin/main`'s
post-claim divergence and frames it as your own.** (Authority: filed #1432 to add this
to `do-this-not-that.md`.)

---

## 3. Two tickets that share a file → one worktree, Protocol-B batch close

**What happened:** #1218 and #1219 each had their own new doc, but both had to add a
cross-link to the *same* `docs/skills.md`. Last session's two stale-prose tickets touched
*different* files, so two independent worktrees were correct. This time, two worktrees
would have raced on `skills.md` and forced a rebase conflict on the second to land.
So: one worktree, two commits (each with its own `Closes #N`), then
`npm run close 1218 -- --skip-ticket-match`. The branch is `fig/issue-1218`, and
`close.js` gates the close target against the branch name — so I close the *branch*
issue (#1218); #1219 auto-closes on push via its own `Closes #1219` footer. The
`--skip-ticket-match` is needed because the guard inspects only HEAD's velocity-CSV row,
which belonged to the sibling (#1219, committed last).

**What I learned:** The "one worktree vs two" choice is decided by *file overlap*, not by
how related the tickets feel. Shared file → shared worktree → Protocol B. I also kept
per-ticket attribution clean by splitting the `skills.md` edit across the two commits
(reverted to the portability-only link for commit 1, re-added the org link for commit 2)
so neither commit carried a link to a file the other commit created.

**The rule:** **Batch tickets into one worktree iff they touch a shared file; close the
branch-issue and let siblings auto-close via their `Closes #N` footers, passing
`--skip-ticket-match` when HEAD's velocity row is a sibling.** (Authority: existing
`claude_workflow.md` "Multi-issue single-worktree close" (#844).)

---

## What landed

| Artifact | Change |
|---|---|
| `docs/glossary/interpreter.md` | Error-model "two helpers"→one; `userName` heading/prose de-`nameHandler`ed (#1374) |
| `docs/glossary/assembler.md` | `userName` + "Assembling X" + `main`-entry stale `nameHandler` refs fixed (#1395) |
| `docs/claim-ref-housekeeping.md` | New: `refs/claims/issue-N` lock mechanism, when/how to sweep, live-lock hazard (#1421) |
| `docs/skill-portability.md` | New: hub-and-spoke (`agentskills.io` core + Claude/Codex spokes); old pairwise doc → redirect stub (#1218) |
| `docs/skill-organization.md` | New: accurate lccjs baseline + single-source-of-truth/sync recommendation (#1219) |

## Open threads

- **Hermes spoke** still unwritten — filed as spike #1426 (confirm Hermes's skill model + `agentskills.io` conformance, then fill the deferred placeholder in `skill-portability.md`).
- Inaccurate baseline phrasing also lives in the now-closed #1218/#1219 bodies — only #1210 was redlined (the open tracker); the children were left as-is.

## Related artifacts

- Issues #1374, #1395, #1421, #1218, #1219, #1210 (redlined), #1426 (Hermes spike), #1432 (scope-audit rule)
- [`docs/claim-ref-housekeeping.md`](../claim-ref-housekeeping.md), [`docs/skill-portability.md`](../skill-portability.md), [`docs/skill-organization.md`](../skill-organization.md)
