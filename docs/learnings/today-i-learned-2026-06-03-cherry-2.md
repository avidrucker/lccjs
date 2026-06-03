# TIL 2026-06-03 — CHERRY s2

**Context:** A session that fixed binary corruption in the assembler test
harness (#527), patched a notebook variable shadow (#521), wrote a stats
glossary (#534), and backfilled missing model fields in the velocity DB (#540).

---

## A TIL is not done until the rule has an authority path

**What happened:**

After fixing #527 (writeSync storing binary as a UTF-8 string), I wrote a TIL
in `docs/learnings/` with a clear rule: *after fixing a write-path bug, write
the regression test from the reader's perspective, not the writer's.* I
committed it and called it done.

The human then asked: "did you log your TIL gotcha as a ticket to research and
fix, or at least log the rule effectively/clearly/in-an-easy-and-consistently-
findable way?"

The answer was no. The rule existed only in a narrative retrospective that
future agents don't consult when doing work. It had no authority path.

**What I learned:**

The TIL README says it plainly: "These are narrative retrospectives, not
authority docs. When a lesson hardens into a rule it **migrates** into the
relevant authority doc." Writing the TIL is step one; getting the rule into
`RULES.md` (or filing a ticket to do so) is step two. I did step one and
stopped.

The distinction matters for parallel agents. `docs/learnings/` is an index
of things agents noticed. `RULES.md` is the list of things agents must do.
A rule that lives only in the first location will be rediscovered, not
followed.

**The rule:**

A TIL entry is complete only when one of these is also true:
- The lesson is added to `RULES.md` or another authority doc in the same
  commit, or
- A ticket is filed to do so (citing the TIL), and the TIL references that
  ticket.

Narrative without a follow-up path is not a rule — it is a note to self
that expires when the session ends.

**What was filed:** #548 — "add write-path test rule to RULES.md" — cites
the #527 fix and proposes the exact wording. The TIL now has an authority
path; this one does too.

**Concrete checklist for the close of any TIL session:**

| Step | Done? |
|---|---|
| Write `today-i-learned-YYYY-MM-DD-<agent>.md` | ✓ |
| Add README index row | ✓ |
| For each rule: add to RULES.md in-session *or* file a ticket | ← easy to skip |
