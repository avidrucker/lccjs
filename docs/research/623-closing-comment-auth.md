# RESEARCH: closing comment authorization — #623

**Date:** 2026-06-03  
**Agent:** CHERRY  
**Role:** RESEARCH

---

## Problem

`npm run close N` exits after landing the commit and tearing down the worktree, then
prints a reminder:

```
Post your closing comment:
  gh issue comment 623 --body "Closed in abc123. <your summary here>"
```

When the agent then calls `Bash(gh issue comment N --body "...")` as a separate tool
call, the auto-mode classifier blocks it:

> "The user instructed the agent to close #N via `npm run close N` (already executed),
> but did not ask for a GitHub issue comment to be posted; this is an autonomous
> External System Write — publishing under the user's identity to a GitHub issue
> without explicit authorization."

The agent must stop and request explicit permission before the comment posts.

---

## Q1 — Can `allowedTools` whitelist `gh issue comment`?

**Yes.** `.claude/settings.json` supports an `allowedTools` array that pre-approves
tool calls matching a pattern. The auto-mode classifier checks this list before
deciding whether to prompt.

**Format:**

```json
{
  "allowedTools": ["Bash(gh issue comment *)"],
  "hooks": { ... }
}
```

The `Bash(gh issue comment *)` pattern matches any `Bash` tool call whose command
starts with `gh issue comment ` (any issue number, any body). The `*` glob is the
Claude Code allowedTools wildcard for remainder-of-command matching.

**Scope options:**

| File | Scope | Appropriate? |
|------|-------|--------------|
| `.claude/settings.json` | This project only | **Yes** — correct scope |
| `~/.claude/settings.json` | All projects on this machine | No — too broad; grants comment rights to unrelated repos |

Project-level is right: the closing comment is a lccjs-specific workflow step; it
should not auto-approve `gh issue comment` in unrelated projects.

---

## Q2 — Should `close.js` post the comment internally?

**Partially — but it doesn't eliminate the need for the allowedTools entry.**

`close.js` calls `sh()` (Node.js `child_process.execSync`) for its own `gh` operations
(e.g. `gh issue view N` to check state, `gh issue close N` if still open). These run
as subprocesses of the agent's `Bash(npm run close N)` call and are **not** classified
by the auto-mode classifier — they inherit the already-approved bash call's authorization.

If `close.js` posted the comment via `sh('gh issue comment N --body "..."')` internally:
- The permission concern goes away (it's a subprocess, not a new tool call)
- But the body is a template stub — close.js doesn't know what the agent wants to say
- Agents cannot retroactively edit a posted comment; they can only reply with a new one
- The result would be two comments: the auto-stub, then the agent's substantive one

**Verdict:** Moving to close.js solves the permission problem but degrades comment quality. The `allowedTools` approach solves the permission problem while preserving agent authorship. The M10/#633 ticket tracks the close.js stub option as a separate enhancement; it is not the fix for #623.

---

## Q3 — Other blocked close-sequence steps?

The classifier blocks **any** agent tool call that writes to an external system without
explicit authorization. Close-sequence steps to audit:

| Step | Runs via | Classifier sees it? | Blocked? |
|------|----------|--------------------|-|
| `gh issue view N` (read) | close.js `sh()` | No — subprocess | No |
| `gh issue close N` (auto-close) | close.js `sh()` | No — subprocess | No |
| `git push ...` (in close loop) | close.js `sh()` | No — subprocess | No |
| `gh issue comment N --body "..."` | **Agent Bash call** | **Yes** | **Yes** |
| `gh issue create ...` (PM filing) | Agent Bash call | Yes | When unsolicited |
| `gh issue edit N ...` | Agent Bash call | Yes | When unsolicited |

**Summary:** The closing comment is the only close-sequence step that is both
(a) required by the protocol and (b) blocked because it's an agent-level tool call
made after the already-authorized close action has completed. All close.js-internal
`gh` calls are fine.

`gh issue create` for PM/triage work is only blocked when unsolicited — when the
user explicitly says "file a ticket for X," the classifier treats the `gh issue create`
call as authorized. The closing comment is different because the user authorized
"close #N" and the comment is an additional, not-yet-authorized step.

---

## Q4 — Right scope for the permission rule?

**Project-level `.claude/settings.json`.**

Rationale:
- Closing comments are specific to lccjs's puzzle workflow; no other project has this
  protocol
- Granting `gh issue comment *` at user-level would auto-approve comment posting on
  any GitHub repo Claude Code touches on this machine — an undesirable blanket grant
- The project `.claude/settings.json` is committed to the repo; all agents and
  terminals working lccjs automatically inherit the permission

---

## Recommendation

Add `"Bash(gh issue comment *)"` to `.claude/settings.json` `allowedTools`.

This is a one-line config change that:
- Pre-approves the documented final step of the close protocol
- Preserves agent-authored comment bodies (vs. close.js stub)
- Scopes the permission to this project only
- Does not require any change to close.js, claude_workflow.md, or the per-agent workflow

**Child DEV ticket:** filed separately (see issue comment) to wire up the change.

---

## What this does NOT fix

- M10/#633 (close.js auto-stub comment) — still worth doing for sessions where the
  agent forgets to post; that's a separate enhancement.
- `gh issue create` unsolicted blocks — the allowedTools entry for `gh issue comment`
  does not cover issue creation. PM filing is already authorized by the user's
  instruction ("file a ticket for X") so this is not blocked in practice.
