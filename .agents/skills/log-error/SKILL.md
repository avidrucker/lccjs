---
name: log-error
description: Use when a tool, shell command, Git/GitHub operation, claim/close step, database write, validation check, or pre-close audit finds an lccjs agent error to record.
---

# Log Error

Record lccjs agent errors in the shared SQLite database so process problems are visible and reviewable. This Codex skill is repo-local and version-controlled with the lccjs repository.

## When To Use

Use this skill when any of these happen during lccjs work:

- a shell command exits non-zero and affects the work
- a tool call fails, including file read/write/edit failures
- `npm run claim`, `npm run close`, or a hook blocks or fails
- a Git operation fails, including commit, rebase, push, or worktree state errors
- a `gh` command or GitHub API operation fails or reveals a wrong workflow assumption
- `npm run velocity:log`, `npm run error:log`, or any SQLite/database operation fails
- schema validation rejects a value
- a skill or workflow step is invoked incorrectly or produces unexpected output
- the required pre-close self-audit finds an error that has not yet been logged

Always log resolved mistakes too. Resolution belongs in `notes`; it is not a reason to skip the row.

Skip only when the message is a purely informational warning with no work-plan impact, or when the identical error has already been logged for this ticket in this session.

## Sources Of Truth

Read these repo docs instead of relying on memory:

- `RULES.md` for the mandatory pre-close error self-audit
- `docs/claude_workflow.md` for the close protocol and audit wording
- `docs/errors-schema.md` for fields, valid `error_type` values, context JSON shapes, and query examples
- `docs/errors-lookup.md` for error vocabulary guidance
- `scripts/error-log.js` for validation and insert behavior

The canonical database is `~/.lccjs/lccjs.db`. Do not use the legacy `velocity.db` path.

## Immediate Logging Protocol

Capture the timestamp at the moment of failure:

```bash
date '+%Y-%m-%dT%H:%M:%S%z'
```

Then log a row:

```bash
npm run error:log -- '{"occurred_iso":"<ISO8601>","agent":"HONEYDEW","ticket":N,"error_type":"<TYPE>","message":"<short raw error>","context":"<JSON>","notes":"<impact and resolution>"}'
```

`occurred_iso` and `message` are required. `ticket` is required when the error occurred in puzzle context. Leave `model` blank when unknown; do not invent model values.

Use the terminal/worktree agent name in `agent`, e.g. `HONEYDEW`.

## Choosing `error_type`

Use the controlled vocabulary in `docs/errors-schema.md`. Common choices:

- `TOOL_DENIED` for rejected permission prompts
- `HOOK_BLOCK` for pre-commit, commit-msg, or pre-push hook failures
- `CLAIM_FAIL` for `npm run claim` failures
- `BASH_FAIL` for shell command failures with work impact
- `GIT_FAIL` for Git operation failures
- `GIT_STATE` for wrong checkout, deleted cwd, detached HEAD, or not-a-worktree state problems
- `GH_FAIL` for `gh` / GitHub API errors
- `GH_INFO` for GitHub warnings that reveal a wrong workflow assumption
- `DB_FAIL` for SQLite, `velocity:log`, or `error:log` failures
- `FILE_FAIL` for file read/write/edit failures
- `EDIT_PRECOND` for failed edit preconditions
- `SKILL_FAIL` for skill or workflow invocation errors
- `NETWORK_FAIL` for network/API timeouts or connectivity failures
- `VALIDATION_FAIL` for schema validation failures
- `OTHER` when no existing code fits quickly

Prefer a prompt row with `OTHER` over delaying the log to find the perfect type. The type can be corrected later if needed.

## Context JSON

Put machine-readable details in `context`, encoded as a JSON string inside the outer JSON payload. Follow the shapes in `docs/errors-schema.md`.

Examples:

```json
{"cmd":"git push origin HEAD:main","exit_code":1,"stderr":"first useful stderr"}
```

```json
{"tool":"apply_patch","path":".agents/skills/log-error/SKILL.md","error":"failed to create parent directories"}
```

## Pre-Close Self-Audit

Before every closing commit:

1. Re-read the session from claim to now.
2. Enumerate every loggable error, including resolved mistakes.
3. Confirm each already has a row or log it.
4. Include one exact statement in the closing comment:
   - `error self-audit: N row(s) logged (#ids ...)`
   - `error self-audit: no loggable errors this session`

The audit happens before the velocity row and closing commit. `npm run close` cannot see the transcript; the agent must do this manually.

## Guardrails

- Do not delete or modify database rows without explicit human permission.
- Do not create `docs/errors.csv` manually; `docs/errors-schema.md` documents it as a future generated export.
- If `npm run error:log` itself fails, that failure is loggable once logging works again.
- Keep error rows factual: what failed, what command/tool was involved, and how it was resolved.
