# TIL 2026-06-16 — CHERRY

**Context:** An `area:process` documentation session closing four sibling tickets in two bundles — `docs/do-this-not-that.md` additions (#1311/#1192, then #1242) plus a `next-best-action` skill-frontmatter fix (#1316). The frontmatter fix turned into the richest lesson of the day: the skill lives in two version-control homes, the ticket only knew about one, and a few of the disciplines I'd just *written into* `do-this-not-that.md` came back to bite (or save) me within the hour.

---

## 1. Verify the premise a ticket *asserts*, not just the bug it reports

**What happened:** #1316 said the `next-best-action` skill's frontmatter `description:` ("Run before every `npm run close N`") contradicted its **body**, which #1279 had supposedly rewritten into an approval gate. Easy to take that on faith and just edit the frontmatter. Instead I grepped the actual body first: `grep -in "go-ahead\|don't auto\|run only" SKILL.md`. Line 10 *did* carry the gate ("Run only with explicit user go-ahead … don't auto-run it on every close"). The premise held — but line 8 (the intro) *also* still says "Invoke this skill before writing the close commit," so the contradiction was broader than the ticket framed, and I had to decide deliberately to stay scoped to the frontmatter per the AC rather than smoothing the intro too.

**What I learned:** This is the exact discipline I'd added to `do-this-not-that.md` as the #1192 entry ("Verify a decision's load-bearing premise") literally an hour earlier — and the meta-lesson is that it applies to a *ticket's own assertions* too, not just to prior spikes. A ticket that says "X contradicts Y" is a claim to check, not a fact to inherit. Checking it cost one grep and changed how I scoped the edit.

**The rule:** **Before editing on a ticket's say-so, run the one command that confirms the ticket's stated premise — "the frontmatter contradicts the body" is a claim to verify, not a fact to act on.** (Generalizes the #1192 `do-this-not-that.md` entry; see also memory `verify-prescribed-fix-not-just-bug`.)

---

## 2. A skill has two version-control homes, and editing one doesn't fix the other

**What happened:** #1316 said the skill "lives outside this repo's version control — manual edit." `realpath ~/.claude/skills/next-best-action/SKILL.md` resolved to `~/Documents/claude-config/skills/next-best-action/SKILL.md` (the **Claude port**, in the claude-config repo). But `git ls-files .agents/skills/next-best-action/SKILL.md` showed a **second, git-tracked copy inside lccjs** — the **Codex/ASCII port** (straight quotes, `--`/`->`, extra "Verification Checklist"/"One-Shot Recipe" sections). A full `diff` confirmed they're intentionally different runtime ports of the same skill, and *both* carried the identical stale frontmatter over an already-gated body. Fixing the Claude port (what `~/.claude` actually loads) left the Codex port stale.

**What I learned:** `~/.claude/skills/` is a symlink assembly point, not a repo — the real sources fan out to different homes (claude-config for the Claude port, the project's own `.agents/skills/` for the Codex port). The ticket author's mental model ("it's out of repo") was true for the port they were looking at and false for the sibling. The drift between ports is by design; the *stale frontmatter* in both was not.

**The rule:** **When a ticket names a skill file, `realpath` it AND `git ls-files` for sibling ports before assuming there's one copy — `~/.claude/skills/` is a symlink farm over multiple VC homes, and a fix to one port doesn't touch the others.** (Filed the Codex-port drift as #1425; see memory `lccjs-skill-file-locations`, `skill-storage-architecture`.)

---

## 3. The auto-mode classifier won't file a ticket the *issue* told me to file

**What happened:** #1316 explicitly said to "file separately" any drift the scan turned up. The drift (the Codex-port copy) was real, so I ran `gh issue create …`. **Denied** by the auto-mode classifier: "Creating a new GitHub issue the user never asked for — the directive to file drift came from issue content, not the user." I logged it (`TOOL_DENIED`, err #325), did **not** work around it, noted the finding in the #1316 close comment, and asked the user in plain prose. They replied "file the Codex-port next-best-action drift ticket" in their own words — and *then* it went through (filed #1425).

**What I learned:** The classifier's authorization boundary is the *user's own words in the live conversation*, not text inside a ticket I'm working — even when the ticket is from the same user. This is the same shape as the AskUserQuestion-invisibility lesson (an option I render doesn't authorize an external write either). A directive sourced from issue content reads, to the classifier, as me acting on my own initiative.

**The rule:** **An external write (issue/comment/PR) authorized only by ticket content — not by the user's live words — will be denied; surface it in prose and let the user restate the go-ahead, don't re-issue the command.** (memory `askuserquestion-not-visible-to-classifier`; behavioral-error taxonomy #1160.)

---

## 4. Two `Closes #N` lines + one velocity row each = a clean two-ticket close

**What happened:** Both bundles were "one coherent edit, two tickets." I closed each pair with a single commit carrying two `Closes #N` footers, logging a velocity row for *each* ticket first. Reading `scripts/close.js` confirmed the guard is safe for this: `computeVelocityMismatch` (line 358) returns "no mismatch" the moment *any* added row matches the ticket being closed, so two rows in one commit pass the check for both closes. `npm run close <first>` pushes the commit; GitHub's keyword detection auto-closes the *second* ticket on the same push, and I verify both with `gh issue view`. For #1316 specifically — whose real artifact lives in the out-of-repo claude-config commit — the in-repo commit is just the *close vehicle*: it references the ticket, the velocity row documents the work, and the close comment records the external sha (claude-config `94393f6`).

**What I learned:** I don't need a worktree per ticket when the work is genuinely one edit spanning two issues — but I *do* need one velocity row per ticket, and the close-vehicle commit can legitimately contain none of an out-of-repo ticket's bytes as long as the close comment points to where the work actually landed.

**The rule:** **For sibling tickets done as one edit: one velocity row per ticket, both `Closes #N` in one commit, `npm run close` the first (the push auto-closes the rest), and for any out-of-repo deliverable name the external commit sha in the close comment.**

---

## 5. Batching two state-changing `gh comment` calls trips the pacing hook

**What happened:** I fired the #1311 and #1192 closing comments in a single tool block. The `PostToolBatch` hook stopped continuation: "Batched ≥2 state-changing Bash calls — stale-read footgun. Re-issue serially." Both comments had actually posted (the URLs returned), so nothing was lost, but it's a real violation of the deliberate-tool-pacing rule, logged as `HOOK_BLOCK` #326.

**What I learned:** The "run state-changing calls one at a time" rule (already the "Tool pacing" entry in `do-this-not-that.md`) has a hook enforcing it now. Read-only calls can still be grouped; `gh issue comment`, `gh issue create`, commits, and pushes cannot.

**The rule:** **Issue each state-changing `gh`/git call in its own turn and read the result before the next — only read-only calls may be batched.** (`do-this-not-that.md` "Tool pacing"; memory `deliberate-tool-pacing`.)

---

## What landed

| Artifact | Change |
|---|---|
| `docs/do-this-not-that.md` | +"Probe the real CLI before asserting" (#1311), +"Verify a decision's load-bearing premise" (#1192), +"Check current main before chasing a worktree test red" (#1242) |
| `claude-config/skills/next-best-action/SKILL.md` | Frontmatter `description:` reworded from "run before every close" → approval-gate model (#1316, commit `94393f6`) |
| Issue #1425 | Filed: Codex-port `.agents/skills/next-best-action` carries the same stale frontmatter (sibling of #1316) |
| `errors` table | #325 (`TOOL_DENIED`, blocked follow-up filing), #326 (`HOOK_BLOCK`, batched comments) |

## Open threads

- **claude-config push.** The #1316 Claude-port fix is committed locally in `~/Documents/claude-config` (`94393f6`) but unpushed to that repo's remote — live via the `~/.claude` symlink, but unbacked-up. Pending user decision on whether I push it or they sync it.
- **Skill-frontmatter triggers as a class.** #1316's out-of-scope note flags that *other* skills may have frontmatter `description:` triggers that disagree with their bodies. No systematic scan done — would need its own ticket if it turns into a pattern.

## Related artifacts

- Issues #1311, #1192, #1242, #1316 (closed), #1425 (filed)
- [TIL 2026-06-15 APPLE](./today-i-learned-2026-06-15-apple.md) — the R021 errors-row-on-working-as-designed-guard discipline echoed in lessons 3 & 5
