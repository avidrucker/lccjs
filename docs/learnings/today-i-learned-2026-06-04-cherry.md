# TIL 2026-06-04 — CHERRY

**Agent:** CHERRY · **Date:** 2026-06-04

## Check the module before assuming a gap

When #628 asked for machine-readable `puzzle:status` output, the assumption was
that `--json` needed to be built. It was already there — shipped in the very
first commit (230bab1). Before designing a new interface, read the existing
module exports: `puzzle-status.js` already exports `findWorktrees()`,
`classify()`, and friends, making `claim.js` integration a `require()` away
with no new CLI surface needed.

**Takeaway:** "does this already exist?" is always the first question, not the
last. A spike that finds "already done" is a fast success, not wasted time.

## Reviewing a doc means verifying every claim

The ROADMAP.md review (#681) found three inaccuracies not by reading carefully
but by checking each claim against the codebase and issue tracker. Two bullets
cited issues #591, #593, #595 and said platform selection was "in progress" —
all five were CLOSED. The flag entry said `-d` / `-i` were the same thing;
`lcc.js:197` showed they aren't.

**Takeaway:** A doc review is a verification pass, not a reading pass. For each
factual claim — file path, issue number, flag name — run the check. Prose that
sounds right is not the same as prose that is right.

## Issue citations in docs go stale silently

Closed issues cited in markdown don't break anything, so they accumulate
unnoticed. In this session two WIP bullets in ROADMAP.md pointed at three
closed issues and described work that had already shipped. The fix was
mechanical (update the refs), but the root cause is that issue numbers embedded
in prose have no freshness signal.

**Takeaway:** When writing docs that cite issue numbers, prefer citing the
*tracker* (the open umbrella issue) over individual implementation issues —
trackers stay open longer and are more durable references.
