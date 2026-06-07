# TIL 2026-06-06 — BANANA (session 2)

**Context:** A long process-lane session: fixed `close.js` (#995), swept area
labels (#1003), and ran a chain of research/docs tickets — area-label enforcement
(#1004 → #1012/#1013/#1014), a six-ticket claude_workflow.md + error-docs bundle
(#996, #1014, #1001, #969, #970, #998), and the fruit-skill trio (#978, #1008,
#1009). Also produced a 7-agent orchestration assignment. These are the craft
lessons, not the ticket contents.

---

## 1. A tool error is a checkpoint, not just a retry — verify state before re-issuing

**What happened:** Posting the #1004 research comment, the `gh issue comment` call
came back "Tool result missing due to internal error." Instead of blindly
re-running it, I checked state: the comment had **not** posted (0 comments), and
the child tickets I'd referenced as `#1005/#1006/#1007` already existed — for
unrelated work by other agents. My drafted comment pointed at three wrong issues.

**What I learned:** the failed call was a lucky checkpoint. Had it succeeded, it
would have published wrong cross-references — the exact bug I'd just filed #996
about. When a tool errors mid-action, the first move is to *verify what actually
happened*, not to retype the command. And child-issue numbers are never knowable
in advance: you must create the issues first, then read back their real numbers.

**The rule:** **On a tool error, verify state before retrying; and never cite a
`#N` you haven't created and read back.** (Codified in #996; the consent/verify
discipline is now in claude_workflow.md.)

---

## 2. Build on a sibling's deferred research — don't re-run the audit

**What happened:** #998 (behavioral-failure audit) looked like a near-duplicate of
#1007, which APPLE had already closed. Before redoing the work I read #1007's
deliverable — and its closing note said, verbatim, "clear-but-failed behavioral
lapses → sibling #998." It had *deliberately deferred that subset to me* and left a
data foundation (`docs/research/1007-behavioral-error-audit.md`).

**What I learned:** overlapping-looking tickets are often a deliberate split, not a
duplicate. Reading the sibling's actual deliverable (not just its title) told me
exactly which slice was mine and gave me its data to build on. My #998 then took 3
minutes instead of re-running a 40-minute audit — and found the deferred subset was
*mostly already solved* (push-then-close fixed by my own #995, other lapses already
guarded).

**The rule:** **Before working a ticket that smells like a duplicate, read the
sibling's deliverable and closing comment — the split is usually intentional and
the prior work is your input.** (Pairs with [[verify-issue-open-before-claiming]].)

---

## 3. When agents outnumber area clusters, sub-divide by file-touch

**What happened:** Orchestrating 7 agents, the actionable queue had only 3 `area:*`
clusters (process, web, toolchain) — and `area:process` was a ~30-ticket monster.
Strict "one agent per area cluster" would have idled 3–4 agents.

**What I learned:** the anti-collision rule's *intent* is "no two agents editing the
same file," and `area:*` is just a coarse proxy for that. When the proxy breaks
(agents ≫ clusters), you honor the intent directly by partitioning the big cluster
into **file-touch sets**: all `claude_workflow.md` tickets to one agent, all
`do-this-not-that.md` to another, all `claim.js` to a third. I then kept my own six
claude_workflow.md tickets strictly serialized across worktrees so they never
collided — and steered clear of `claim.js` (CHERRY) and `do-this-not-that.md`
(ELDERBERRY).

**The rule:** **Collision-avoidance is by file, not by label; when agents outnumber
area clusters, sub-divide the big cluster into file-touch bundles and flag that
you're doing so.**

---

## 4. Editing a file outside the repo? Anchor the close to the velocity CSV

**What happened:** Three tickets edited files *outside* the git repo — the
`fruit-agent-orchestrate` SKILL.md (#978) and the home-dir agent-memory
`error-logging-discipline.md` (#970), both under `~/.claude/`. `npm run close`
needs an unpushed in-repo commit referencing `Closes #N`, but the actual change
isn't in the repo.

**What I learned:** the velocity CSV row (always written in-repo by `velocity:log`)
is the natural anchor. Commit the CSV with the `Closes #N` message and note in the
commit body that the substantive change lives outside the repo. The close then
lands cleanly and the work is still traceable.

**The rule:** **For out-of-repo edits (skills, memory), carry the `Closes #N` on the
velocity-CSV commit and say so in the body.** (Same pattern used earlier for the
log-error SKILL.md in #954.)

---

## 5. Separate decisions that are mine from decisions that are the user's

**What happened:** #1009 had two "fails." Fail 2 (logging ad-hoc work) was
mechanical — the null-`ticket` row (#299) and the no-code-logging convention
already existed, so I just recommended a docs clarification. Fail 1 asked *whether
ad-hoc investigation should require the user's consent, and at what threshold* —
that's a rule about how I treat the user's own requests. I did the research but put
the threshold to the user via `AskUserQuestion` rather than ratifying it myself;
they chose the proportional option, which I recorded as user-ratified.

**What I learned:** a research ticket can contain both kinds of question. The test:
*does the output set a rule about our interaction, or about the codebase/process?*
The former is the user's to ratify even when I can form a recommendation. Filing it
as "settled" would overstep; surfacing it via AskUserQuestion is the honest path.

**The rule:** **When a deliverable would set a rule about how I treat the user's
requests, recommend but let the user ratify (AskUserQuestion) — don't self-adopt a
behavioral contract.** (Now codified in #1049.)

---

## What landed

| Artifact | Change |
|---|---|
| `scripts/close.js` | Graceful exit when an issue is already auto-closed via push (#995) |
| `docs/claude_workflow.md` | Verify-#N, area-label requirement, triage-criteria, error-log type list + skip criteria (#996/#1014/#1001/#969) |
| `~/.claude/.../memory/error-logging-discipline.md` | 15-code type list + always-log skip criteria (#970) |
| `~/.claude/skills/fruit-agent-orchestrate/SKILL.md` | Step 2 sequencing-constraint check (#978) |
| `docs/research/{998,1008,1009}-*.md` | Three research deliverables + 8 child tickets |

## Open threads

- Children awaiting pickup: #1012/#1013(landed)/#1014, #1036, #1046/#1047/#1048
  (#1048 `Sequenced after: #1046`), #1049/#1050.
- Lesson 1 and 5 are codified (#996, #1049); lessons 2–4 are craft patterns — if
  they recur, promote to `do-this-not-that.md`.

## Related artifacts

- Sibling TIL (session 1 today): [TIL 2026-06-06 BANANA](./today-i-learned-2026-06-06-banana.md)
- Behavioral audit this builds on: `docs/research/1007-behavioral-error-audit.md`
- Issues #995, #998, #1004, #1008, #1009
