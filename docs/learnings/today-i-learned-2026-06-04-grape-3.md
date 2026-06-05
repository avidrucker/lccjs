# TIL 2026-06-04 — GRAPE 3

**Context:** Continuation of GRAPE's second session. Closed three issues (#765,
#427, #770), performed a tracker audit (#751), and ran /fruit-agent-orchestrate
twice. All work was PM/CHORE/RESEARCH — no code changes.

---

## 1. Two closes in a row that needed no new work

**What happened:** Both #765 (allow `gh issue comment` in project settings) and
#427 (Tier 2 tracker) turned out to be already complete when I arrived. #765
had been fixed by #637 on 2026-06-03; #427 had all three children closed before
my session started. In both cases I committed a velocity row or an empty commit
with `Closes #N` and used `--skip-velocity-check` / `--skip-keyword-check` flags
to get through the close script.

**What I learned:** "Already done" is a valid close outcome. The close script's
keyword guard fires when the commit subject doesn't echo the issue title — the
correct bypass is `--skip-keyword-check`, not `--no-verify`. Similarly,
`--skip-velocity-check` exists for tracker closes where children already own
all the logged work. Both flags are intentional escape hatches, not signs of
process failure.

**The rule:** When arriving at a ticket and finding it already resolved, close
it cleanly with an explanatory commit and closing comment rather than leaving
it open. Use the script's bypass flags for their intended purposes and document
why in the closing comment.

---

## 2. Tracker audits: the close gate includes human-required children

**What happened:** Auditing #751 (CodeMirror follow-on tracker) showed four of
five children closed (#753, #754, #755, #768) — but #752 (HUMAN DECISION)
remained open. The tracker body says "stays open until all four children close."
Since #752 is `human-decision-required`, it cannot be closed by an agent. The
tracker therefore could not close.

**What I learned:** A tracker's close gate doesn't distinguish between
agent-closeable and human-required children. Even one open human-required child
blocks the whole tracker. The right response is a status comment — not an
attempt to close the tracker prematurely — so the human knows exactly what's
blocking and what's already done.

**The rule:** Before claiming a tracker for closure, check every child's state
AND its `human-decision-required` / `humans-only` label. If any human-required
child is open, post a status comment and leave the tracker open; don't claim a
worktree.

---

## 3. Agent-scoped memory is an invisible failure mode

**What happened:** #770 asked me to audit `.claude/memory/` for files scoped
to a named agent. The grep found exactly one: `elderberry_c_min_priors.md`.
The content — per-role c_min priors — was useful to any agent, but the filename
and slug meant it only surfaced in ELDERBERRY sessions. Any other agent doing
RESEARCH or SPIKE work would anchor to the wrong prior or none at all.

**What I learned:** Memory files are keyed by filename in `MEMORY.md`. If the
filename encodes a fruit identity, the memory is effectively invisible to six
of seven agents. The calibration data was correct; only its scope was wrong.
The fix was a rename and slug update — the body was left mostly intact (the
fruit name is allowed as a data-provenance note, not as a scope marker).

**The rule:** Memory file names and `name:` slugs must describe the concept or
role, never the agent. Fruit names may appear in the body as provenance only.
New memories should be reviewed against this rule before writing to `MEMORY.md`.

---

## 4. /fruit-agent-orchestrate: cluster separation prevents merge conflicts

**What happened:** Running /fruit-agent-orchestrate twice in this session, the
most important constraint was avoiding two agents in the same code cluster
simultaneously. The playground/build cluster (#772 FIG), testing cluster
(BANANA + CHERRY on different files), data cluster (DRAGONFRUIT), process
cluster (GRAPE), and docs-site cluster (APPLE after #762) were each given to
one agent.

**What I learned:** The skill's "avoid assigning two agents to the same code
cluster" heuristic requires file-level reasoning, not just worktree isolation.
Even though worktrees prevent git conflicts at commit time, two agents editing
the same file in separate worktrees create a rebase conflict that must be
resolved manually. Upstream assignment is cheaper than downstream resolution.

**The rule:** When orchestrating agents, identify the primary file or directory
each ticket touches and treat that as its cluster. Assign at most one agent per
cluster per round.

---

## What landed

| Artifact | Change |
|---|---|
| #765 | Closed (already fixed by #637; no code change needed) |
| #427 | Closed (all Tier 2 children resolved before session) |
| #770 | `elderberry_c_min_priors.md` → `c_min_priors_by_role.md`; MEMORY.md updated |
| #751 | Status comment posted; tracker left open pending #752 human decision |
| #777 | Filed: inline `.a` strings in tests should be fixture files (252 occurrences, 11 files) |

## Open threads

- FIG has a stale worktree for the now-closed #772 that needs teardown:
  `git worktree remove .claude/worktrees/fig-issue-772 --force && git branch -D fig/issue-772-fix-github-pages-showcase-broken`
- #751 will close once the human rules on #752.
