# TIL 2026-06-06 DRAGONFRUIT — multi-bug sprint across process/toolchain

**Date:** 2026-06-06  
**Agent:** DRAGONFRUIT  
**Tickets closed:** #944, #927, #943, #928, #955, #975, #976, #977, #979, #933

---

## The own-fix verifies the prior fix

The `--update-trackers` multi-ref guard (#944) went out first. Two tickets later, when #927 and #928 closed, the new guard correctly printed hint-only output for the batch-2 tracker line in #938 — six refs on one checkbox, skipped cleanly. The fix validated itself in production before any e2e test could.

Lesson: **close in dependency order, and watch the real output**. A fix to a shared tool is proven not just by its own tests but by every close that follows.

---

## An orphan directory with one spec file fooled jest — and I almost fool myself explaining it

The Jest config excluded `.claude/worktrees/` from test discovery (#247 fix), but a directory at `.claire/worktrees/apple-issue-874/tests/new/lezer-grammar.unit.spec.js` was still being picked up. Jest's `tests/new` pattern is a substring match, so any path containing that segment qualifies.

Post-fix investigation revealed: `.claire/` was **never a convention**. The claim script has always used `.claude/worktrees/` — there is zero git history of `.claire/` in any script or config. The directory is a plain orphan with no `.git` file, not registered in `git worktree list`, containing exactly one spec file. APPLE created it on 2026-06-05 via a manual `mkdir` or aborted worktree setup — it's not a "legacy location," it's a one-time accident.

I initially wrote in this TIL that `.claire/` "was `.claude/`'s predecessor." That was a confabulation — I inferred a history that doesn't exist from a directory name that sounds plausible. Post-session research (prompted by the user questioning it) confirmed the reality.

The fix (#943) was a one-liner: add `<rootDir>/.claire/worktrees/` alongside `.claude/`. The actual lesson: **exclusion patterns don't cover directories they've never seen**, and **an untracked directory with no `.git` file can still contain files that tools will pick up**. Check `git worktree list` before assuming an unfamiliar directory is a registered worktree.

---

## `until grep` is the wrong wait primitive for background tasks

An `until grep -q "CLOSE OK\|conflict\|error" <file>` loop exits on the *first* match — including intermediate text that happens to contain the word "conflict" while the close is still running. The harness fires a `<task-notification>` when any `run_in_background` task finishes; polling the output file is always redundant and always racy.

Documented in `docs/do-this-not-that.md` (#927). The pattern shows up most dangerously when the monitored command itself writes words like "conflict" or "error" as part of normal progress reporting.

---

## Auto-mode's "Self-Modification" block is per-task, not per-path

Auto-mode blocks edits to `~/.claude/skills/**` unless the current task description explicitly names the file — not because the path is globally forbidden, but because the classifier scopes permission to the stated task. A procedure that says "update the skill file" without naming the path is invisibly incomplete: the edit is denied, the agent moves on, and the skill is never updated.

The fix (#955) is two-layered: add explicit `Edit(~/.claude/skills/<name>/SKILL.md)` entries to `.claude/settings.json` for the four lccjs-relevant skills (#972), and update `docs/errors-schema.md` step 2 to name the skill file explicitly so puzzle descriptions inherit the scope.

---

## A tracker's checkboxes are frozen snapshots

Tracker #890 had two items marked done in comments (A and F) but no child issues existed for the remaining six. The checkboxes in the body don't update when children close — GitHub doesn't wire them. I had to read the comments to know the real state, then verify each child's live `gh issue view` state before filing new ones.

The pre-flight protocol already says "don't trust unchecked boxes," but this session was a clean demonstration: the tracker body was misleading in both directions (no box for A/F that were done, no issues for B–H that needed filing). **The authoritative state is always `gh issue view N --json state` for each child.**

---

## Research triage is faster when you know the defer thresholds in advance

The #933 data-analysis triage had 14 items across four priority tiers. The issue body provided explicit decision criteria (is it a fix to an existing artifact? a new analysis? blocked on data volume?). That made the triage mechanical: two DATA tickets (header bugs, data integrity), one RESEARCH ticket (confound-corrected drift), nine explicit deferrals with thresholds (day 10+, ≥15 tasks/cell). Total time: ~2 minutes.

The lesson isn't that triage is easy — it's that **pre-stated decision criteria collapse a judgment call into a lookup**. Writing the criteria into the issue body before handing it to an agent is the bottleneck worth investing in.
