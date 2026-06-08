# TIL 2026-06-07 — APPLE (session 2)

**Context:** A second APPLE session (the first, #1172, was unrelated test-runner
work). After running `/fruit-agent-orchestrate` to lay out a 7-agent plan, I took
the `area:process` lane and closed three `severity:medium` tickets back to back:
#1125 (puzzle-velocity Hermes port — inverted delta sign), #1145 (close.js scope
audit prints phantom deletions), and #1151 (claim must block on an uncategorized
lane). The lessons below are mostly about *discipline under a multi-ticket streak* —
the failures were process, not code.

---

## 1. Run the pre-close error self-audit BEFORE the close, not after a human asks

**What happened:** I closed #1125 cleanly — fix landed, velocity logged, comment
posted — and moved on. Then the human asked, "did you file your bugs as tickets and
log your errors in the database?" I hadn't. Re-reading the transcript, four loggable
events had gone unrecorded (a `CLAIM_FAIL` from omitting `--as`, an `EDIT_PRECOND`,
the benign close `getcwd` exit-1, and the *skipped audit itself*). I backfilled them
as rows #71–74, the last one as a `COMPLIANCE_FAIL`-class miss.

**What I learned:** This is the exact failure mode RULES R021 / #1117 was written to
catch, and the #1108 repro already documented it: you self-correct a misfire, move
on, and the row never gets written — a clean session and a forgotten log look
identical. The backstop only works if it runs *before* the close, because that's the
one moment the agent (not `close.js`, which can't see the transcript) can enumerate
what happened. Knowing the rule exists is not the same as executing it.

**The rule:** **Before every close, re-read the session from the claim and state the
audit outcome explicitly** — "N rows logged (#ids)" or "no loggable errors." For
#1145 and #1151 I ran it first and put the result in the closing comment; silence is
not an acceptable audit result. (R021 / #1117)

---

## 2. Dog-food a fix in the same session that ships it — the bug becomes its own repro

**What happened:** #1125's close printed a terrifying scope audit: "~367 deletions"
across `lccrun.sh`, `lccjs-unique-features.md`, and files my commit never touched. I
recognized it as the phantom-deletion footgun — which was already filed as **#1145,
the next ticket in my lane.** So I'd just produced a live repro of the very bug I was
about to fix. #1145's fix (diff `merge-base..HEAD`, not the bare `origin/main` tip)
went in with a pure `scopeAuditDiffCommand` seam and four unit tests. Then closing
#1145 ran the *patched* `close.js` and printed a clean three-file audit — and #1151's
close an hour later was clean too.

**What I learned:** When a fix lives in a tool you use every close, the close itself
is a free end-to-end test. The temptation is to trust the green unit tests and move
on; watching the real output turned "the tests pass" into "I saw it work on live
data, twice." It also caught that the old behavior would have *baited a destructive
fix* — an agent seeing "you deleted 387 lines of another agent's research" might
`git checkout` and actually corrupt the close.

**The rule:** **If the fix touches a tool in your own loop, verify it on the next
real invocation, not just in the test runner.** (#1145)

---

## 3. The Read tool — not Bash — satisfies the Edit precondition

**What happened:** Twice (`close.unit.spec.js`, then `claim.js`) I scoped an edit
with `grep -n` / `sed -n` for speed, then fired an `Edit` at the located lines. Both
failed: "File has not been read yet. Read it first." Two wasted Edits, two
`EDIT_PRECOND` rows (#75, #76) — the second a verbatim repeat of the first, *in the
same session*.

**What I learned:** Bash inspection is invisible to the Edit tool's state tracking;
only a real `Read` marks the file as readable. Beyond the mechanic, the `Read` tool
hands back the line-numbered context the Edit needs anyway for a unique `old_string`
match, so the "shortcut" wasn't even faster. I saved this to agent memory after the
second hit, because logging the same error twice in one session is the signal that a
narrative lesson isn't sticking and needs a durable home.

**The rule:** **Locating a line with Bash is fine; before you Edit a file, open it
with the Read tool.** (errors #75/#76; saved to memory)

---

## 4. Implement to the canonical source, not a ticket's imperfect paraphrase

**What happened:** #1125's "Should have" asked me to restore a "Skip when" section
that included a *"skip no-repo-file work"* guard. But the canonical source skill
(`~/.claude/skills/puzzle-velocity/SKILL.md`) carries no such guard, and project
convention (#215/#216) explicitly *logs* no-repo-file PM/triage work. The ticket's
parenthetical was a mischaracterization of the very thing it was porting from.

**What I learned:** A ticket author paraphrasing a source can introduce an error the
implementation would then faithfully encode. The source of truth outranks the
ticket's description of it. Restoring the canonical's actual three bullets — and
*documenting the divergence* in the close comment rather than silently following
either — kept the skill correct without contradicting an established rule.

**The rule:** **When a ticket and the canonical artifact it cites disagree, implement
the artifact and flag the divergence; don't encode a paraphrase that contradicts
established convention.** (#1125)

---

## 5. Live-verify a behavioral gate, isolating it from the guards in front of it

**What happened:** For #1151 (claim hard-blocks uncategorized issues) the unit tests
were green, but I wanted to see the `die()` fire for real. I aimed it at a live
`area:uncategorized` issue (#1174) — which had since been *closed*, so the #227
CLOSED-state guard fired first and masked my new gate. Adding `--force` (which
bypasses only the CLOSED guard) let the lane gate fire in isolation; then
`--force --allow-uncategorized` proved the bypass releases it.

**What I learned:** A new guard often sits behind older ones, so a naive live test can
be intercepted before your code runs. To verify *your* gate you have to neutralize
the guards ahead of it. The same run confirmed `--dry-run` does **not** bypass the
gate — exactly the spec, and something the unit tests alone wouldn't have shown about
the call-site ordering.

**The rule:** **To live-test a new guard, strip away the guards that precede it so you
observe your code path, not an earlier abort.** (#1151)

---

## What landed

| Artifact | Change |
|---|---|
| `~/.hermes/.../puzzle-velocity/SKILL.md` | Delta sign → `estimate − actual`; uppercase agent-name pitfall; restored "Skip when" (#1125, user-local) |
| `docs/research/1105-honeydew-hermes-review/02-skill-quality.md` | Marked the MATERIAL finding resolved (#1125) |
| `scripts/close.js` | Pure `scopeAuditDiffCommand(base)`; audit fetches + diffs `merge-base..HEAD` (#1145) |
| `scripts/claim.js` | Pure `shouldBlockUncategorized(info, allow)`; `:633` warn → `die()`; `--allow-uncategorized` bypass (#1151) |
| `tests/new/close.unit.spec.js`, `tests/new/claim.issue-state.spec.js` | 4 + 9 regression tests |
| `docs/claude_workflow.md` | Noted the new claim lane gate (#1151) |

## Related artifacts

- Issues #1125, #1145, #1151 (the lane), #1190 (this TIL)
- Sibling 2026-06-07 TILs that hit the same footguns: [GRAPE](./today-i-learned-2026-06-07-grape.md) (#1145 phantom-deletion artifact), [ELDERBERRY](./today-i-learned-2026-06-07-elderberry.md) and [DRAGONFRUIT](./today-i-learned-2026-06-07-dragonfruit.md) (R021 self-audit, benign `getcwd` exit-1)
- RULES R021 / #1117 (pre-close error self-audit), #1108 (the under-reporting repro)
