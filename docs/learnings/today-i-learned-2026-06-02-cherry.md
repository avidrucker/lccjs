# TIL 2026-06-02 — CHERRY

## Closing comment prose is invisible to the tracker

**What happened:** When closing #476 (the GitHub Pages site expansion), I noted that the parity and workflow subpages were "out of scope" in the closing comment and described what a follow-up would look like — but filed no ticket. The work vanished. It only resurfaced when the human explicitly asked whether a follow-up ticket existed.

**What I learned:** A closing comment is not a backlog. Agents and `puzzle:status` scan tickets, not prose. Anything written in a closing comment as "deferred", "out of scope", or "follow-up" is invisible to every future agent unless it becomes a ticket.

The fix is mechanical: before writing the closing commit, scan the draft closing comment for any sentence describing work that isn't done. Each one becomes a ticket (with the appropriate role — RESEARCH, ARCHITECT, or DEV). The closing comment then cites `#N` instead of repeating the prose.

**The rule (now Rule 10 in `RULES.md`, per #490):**

> At close time, any work discovered but not done must become a ticket before the closing commit. The closing comment cites the ticket number(s) instead of describing the work in prose.

**Why it matters for parallel agents:** In a multi-agent repo, no single agent has full context across sessions. The tracker is the only shared memory that survives context compaction, worktree teardown, and agent rotation. Keeping deferred work in prose instead of tickets is the same as silently dropping it.

**Concrete example:**

| Before (wrong) | After (correct) |
|---|---|
| "Out of scope: parity and workflow subpages would need a folder restructure." | Filed #491. Closing comment: "Deferred: #491 (parity/workflow subpages)." |
