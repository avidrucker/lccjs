# TIL 2026-06-07 — FIG

**Context:** A long session of mostly research/process work: closing an already-finished research ticket (#1120), auditing agent HONEYDEW's Hermes/nemotron-3-ultra work (#1130), synthesizing those audits into recommendations (#1136), and filing a run of follow-up tickets (#1152, the #1157→#1156→#1155 chain, the rename #1166). The most durable lessons were about my *own* mechanics, not the subject matter.

---

## 1. In a worktree, write new files to the worktree path — not the main-checkout path

**What happened:** Writing the #1130 findings doc, I called the Write tool with the **main-checkout** absolute path (`/…/lccjs/docs/research/1130-….md`) while my claimed worktree was at `/…/lccjs/.claude/worktrees/fig-issue-1130/`. The file landed in the main checkout. The worktree `git add docs/research/1130-….md` then failed: `fatal: pathspec '…' did not match any files`. I recovered by `mv`-ing the file into the worktree before committing, and got it right on the next ticket (#1136) by writing straight to the worktree path.

**What I learned:** The Write/Edit/Patch tools take an absolute path and will happily write *anywhere* — being "in" a worktree (via a prior `cd`) does not redirect an absolute main-checkout path. The file silently strands on `main` (untracked junk), and the only symptom is the later `git add` miss. This is not just my slip: **INCABERRY and ELDERBERRY hit the identical trap the same day** (see their TILs; INCABERRY's stranded TIL became cleanup ticket #1162), so it's a recurring cross-agent footgun, not a one-off.

**The rule:** **When working in a claimed worktree, point file writes at the worktree path (`.claude/worktrees/<agent>-issue-N/…`), and if a `git add` misses, suspect a file stranded on main before anything else.** Filed for `docs/project-gotchas.md` as #1169.

---

## 2. File chained tickets in reverse order so each forward link resolves

**What happened:** Asked to file three tickets that each link to the next (convert → test → assess), I created them **last-first**: assess (#1155), then test (#1156, body links #1155), then convert (#1157, body links #1156). Every forward link pointed at an already-existing number, and GitHub auto-created the back-references.

**What I learned:** You can't forward-link a ticket that doesn't exist yet. Creating a chain in narrative order forces a second pass to edit in the numbers; creating it in reverse means each body can name its successor at creation time.

**The rule:** **To build a forward-linked ticket chain, create the tickets in reverse (tail first) so each one can reference the next by its real number.** (Worth a line in `docs/do-this-not-that.md` — open thread.)

---

## 3. Check whether the work is already done before redoing it

**What happened:** Handed #1120 ("RESEARCH: showcase highlighting is wrong"), I read the issue comments first and found a prior session had already reproduced the bug in-browser, posted a full findings comment, and spun out the fix as #1124 — with the reporter saying "safe to close once #1124 is on the board." Rather than re-run the whole browser investigation, I re-verified the root cause against the *current* source (confirmed no `Compartment` in `build-site.js`), confirmed #1124 was on the board, asked the user how to proceed, and closed it.

**What I learned:** "Take ticket X" doesn't mean "do X from scratch" — the deliverable may already exist. Reading the issue + git + sibling tickets first turned a multi-step browser task into a verify-and-close. And for an outward, hard-to-reverse action (closing), I confirmed with the user even though the reporter had pre-authorized it.

**The rule:** **Before executing a ticket, read its comments and linked tickets — the work may be done; verify the existing deliverable against current ground truth instead of duplicating it.**

---

## 4. Verification that runs but concludes wrong is worse than no verification

**What happened:** Auditing HONEYDEW's #1074 work (#1130), the standout defect was a *false* verification: after corrupting a markdown table (`||` leading pipes), HONEYDEW ran `cat -A`, saw the `||`, and concluded the file was "actually correct" and the `||` was a "read_file display artifact." It shipped the broken edit as "complete." I confirmed against the live file that every sibling row starts with a single `|` — the corruption is real and still there.

**What I learned:** A check only helps if you read its output against a *reference*. `cat -A` showing `||` next to siblings showing `|` is the bug, not proof of correctness. HONEYDEW had no baseline to compare to, so it anchored on its own output and manufactured false confidence. This is the project's existing "test against artifacts, not memory" digest item, sharpened: also test against a *known-good baseline*, not just any artifact.

**The rule:** **When verifying an edit, diff the changed line against an adjacent unchanged sibling; a tool showing a deviation from the baseline is the defect — never explain it away as a display artifact.**

---

## What landed

| Artifact | Change |
|---|---|
| #1120 | Closed — research already complete; re-verified root cause, closed trunk-based |
| `docs/research/1130-research-findings-honeydew-1074-review.md` | Audit of HONEYDEW's #1074 work (#1130) |
| `docs/research/1136-honeydew-recommendations-synthesis.md` | Synthesis + tiered recommendations across HONEYDEW audits (#1136) |
| Tickets filed | #1152, #1155/#1156/#1157 (chain), #1166 (rename), #1169 (this gotcha) |

## Open threads
- Add the reverse-chaining tip (lesson 2) to `docs/do-this-not-that.md`.
- The worktree-write trap (lesson 1) needs the central `project-gotchas.md` entry tracked in #1169 — three agents hit it in one day.

## Related artifacts
- Sibling same-day TILs that independently hit lesson 1: [INCABERRY](./today-i-learned-2026-06-07-incaberry.md), [ELDERBERRY](./today-i-learned-2026-06-07-elderberry.md)
- Issues #1120, #1130, #1136, #1162, #1169
