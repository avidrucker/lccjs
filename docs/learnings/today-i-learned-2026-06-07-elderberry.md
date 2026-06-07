# TIL 2026-06-07 — ELDERBERRY

**Context:** A process session in the `area:process` lane. The main work was #1117
("make error-logging discipline reliable") — deciding *how* to stop agents from forgetting
to log errors. It turned into a small case study in dogfooding: the mechanism I was designing
caught my own mistakes while I was building it. Three follow-up tickets fell out of it
(#1132, #1144, #1151).

---

## 1. A reliability mechanism should live with the party that has the information

**What happened:** #1117 asked me to pick a mechanism that makes "did you log your errors?"
hard to skip. My first instinct was the obvious enforcement point: a gate in `npm run close`,
mirroring the existing velocity-row gate (`checkVelocityRowExists`, #359). I drafted that as
"Option A" and offered it. The user steered me to a different framing ("Option D"): *the agent
re-reads its own history before closing.*

**What I learned:** The close script **cannot see the transcript**. It runs as a plain Node
process, so it can only check whether `errors` rows *exist* — it can never know whether errors
actually *occurred*. A gate built there enforces a check it's structurally incapable of
performing; it just adds friction to every clean close. The agent, by contrast, has the full
conversation and reconstructs its misfires reliably when prompted (that's literally how the
#1108 backfill of rows 49–51 happened). So the check belongs to the agent, not the script. The
recurring human prompt "did you log your errors?" gets *internalized* as a required close step
rather than automated into a place that can't do it.

**The rule:** **Put a verification step where the information lives. If the enforcement point
can't observe the thing it's checking, you've picked the wrong point.** (Landed as RULES.md 16 /
R021 + `claude_workflow.md` close step 7.)

---

## 2. After `npm run claim`, the Edit tool still writes to the *main* checkout

**What happened:** I claimed a worktree for #1117, then edited `RULES.md`, `RULES.json`, and
`docs/claude_workflow.md`. The Edit calls took absolute paths — and I passed the bare
`.../lccjs/RULES.md` (the main checkout) instead of
`.../lccjs/.claude/worktrees/elderberry-issue-1117/RULES.md`. The edits silently landed on
**main**. I only caught it when I ran `git -C <worktree> status` and saw an empty worktree.

**What I learned:** Claiming a worktree changes nothing about where my *tools* point. The shell
stays in main and Write/Edit go wherever the absolute path says. This is the same wrong-checkout
trap that bites after `npm run close` re-roots — but it also fires at the *start*, right after
claim. Recovery was clean: `git stash push -- <files>` in main (carefully scoped so it didn't
grab a pre-existing `dist/` change), then `git stash pop` in the worktree (stashes are shared
across worktrees via the common `.git`). No re-claim needed since the worktree already existed.

**The rule:** **After claiming, note the worktree path and route every Read/Write/Edit through
it; verify with `git -C <worktree> status` before committing.** (Memory updated; close.js reminder
tracked in #1035.)

---

## 3. Dogfood the discipline you just shipped — in the same session

**What happened:** Having just written the pre-close error self-audit, I ran it on my own #1117
close. It caught the wrong-checkout slip from lesson 2, which I logged as `errors` row 60 with the
honest note "would be `COMPLIANCE_FAIL` once #1118 lands." Later, when the user asked "is there a
follow-up to assess the results of #1117?", I realized I'd closed without filing the
effectiveness-assessment ticket — a `next-best-action` Q4 miss caught by a human prompt, the exact
failure pattern #1117 targets. Logged as row 64, ticket filed as #1144.

**What I learned:** A process change is just prose until it survives contact with real work — and
the fastest, most honest test is the session that created it. The audit immediately produced two
real rows it would otherwise never have captured. The explicit acknowledgement line
(`error self-audit: N logged` / `no loggable errors this session`) is the part that matters: it
converts *silence* into a checkable signal, so "I hit no errors" and "I forgot to log" stop looking
identical in the record.

**The rule:** **The first test of a new discipline is applying it to the session that produced it;
if it doesn't catch anything, you don't yet know it works.**

---

## 4. Search all issue states, and map a request onto existing seams, before filing

**What happened:** The user asked for two new tickets (an assessment of #1117, and a hard lane
gate at claim). Before filing the lane gate I searched `gh issue list --state all` and found the
`needsAreaLabel()` lineage: creation auto-applies `area:uncategorized` (#1012) → claim *warns*
(#1013, built deliberately as warn-only) → and my request was simply "promote that warn to a
block with a bypass flag." So #1151 became a precise one-function change (`scripts/claim.js:633`),
not net-new machinery — and I noted it revisits #1013's deliberate choice. The all-states search
also matched a just-surfaced memory: dup-check before filing (someone had recently filed #1146–48
as dups of completed work).

**What I learned:** A feature request usually has a history. Finding the existing seam makes the
ticket cheaper, scopes it exactly, and surfaces whether you're *revisiting a deliberate decision*
(which deserves a sentence acknowledging it) rather than discovering a gap.

**The rule:** **Before filing, `gh issue list --state all` for dupes/lineage, then point the
ticket at the existing seam it should modify — don't describe new machinery for a change that's an
upgrade.**

---

## What landed

| Artifact | Change |
|---|---|
| `RULES.md` / `RULES.json` | New rule 16 / stable id R021 — pre-close error self-audit (#1117) |
| `docs/claude_workflow.md` | Close step 7 + "Pre-close self-audit" subsection (#1117) |
| `~/.claude/skills/log-error`, `next-best-action` | Operative encoding: self-audit section + Q6 (#1117) |
| `errors` table | Rows 60, 64 — dogfooded misfires |

## Open threads

- Whether R021 (manual self-audit) is enough or should escalate to the rejected close.js gate —
  that's exactly what #1144 will measure once enough closes accumulate (~2026-07-05).

## Related artifacts

- Issues #1117 (parent decision), #1118 (`COMPLIANCE_FAIL` type), #1113 (Hermes telemetry),
  #1132 (stale `velocity.db` path in skill), #1144 (assessment), #1151 (lane gate), #1035 (claim reminder)
- Sibling wrong-checkout lesson: [TIL 2026-06-07 INCABERRY](./today-i-learned-2026-06-07-incaberry.md)
