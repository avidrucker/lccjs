---
name: log-error
description: "Protocol for recording agent errors into the lccjs errors table — when to log, what fields to populate, the exact command, and when to skip. Use whenever a tool call fails, a hook blocks, a claim fails, or any non-trivial error occurs during puzzle work."
---

# Error Logging Protocol (lccjs)

When a non-trivial error occurs during puzzle work, log it to `~/.lccjs/lccjs.db` using `npm run error:log`.

## Triggers — log when any of these occur

- A Bash command exits non-zero and the failure affects the work (not just a harmless grep miss)
- A tool call (`Edit`, `Write`, `Read`, `Bash`) returns an error result
- A `npm run claim` fails (closed issue, already claimed, wrong syntax)
- A git operation fails (`push`, `rebase`, `commit`)
- A `gh` CLI call returns an error (rate limit, not found, auth)
- A SQLite / `velocity:log` / `error:log` call fails
- A skill invocation errors or returns unexpected output
- A pre-commit / commit-msg / pre-push hook exits non-zero and blocks the commit

## Always log

Log every error, misfire, glitch, and mistake — including those immediately retried and resolved with no lasting impact. A single resolved conflict is noise; ten resolved conflicts in a week is a pattern. Use the `notes` field to record how it was resolved, not as a reason to skip the row.

## Skip when (de-duplication only)

- The error message is a purely informational warning with no work-plan impact (e.g. `[MODULE_TYPELESS_PACKAGE_JSON]`, deprecation notices) — these are not errors; log nothing
- The same error has already been logged for this ticket in this session

## The command

```bash
npm run error:log -- '{"occurred_iso":"<ISO8601>","agent":"<NAME>","model":"<model>","ticket":<N>,"error_type":"<TYPE>","message":"<raw message>","context":"<JSON>","notes":"<annotation>"}'
```

Capture `occurred_iso` with `date '+%Y-%m-%dT%H:%M:%S%z'` at the moment of failure.

## Field guide

| Field | Required | Value |
|---|---|---|
| `occurred_iso` | **YES** | ISO 8601 with tz offset, captured at moment of error |
| `agent` | yes | Terminal/worktree name (e.g. `CHERRY`) |
| `model` | yes | Canonical short-form: `sonnet-4.6`, `opus-4.8`, `haiku-4.5` |
| `ticket` | if in puzzle context | Active GitHub issue number (integer) |
| `error_type` | yes | One of the controlled values below |
| `message` | yes | First ~200 chars of the raw error or stderr |
| `context` | recommended | JSON object with type-specific fields (see below) |
| `notes` | optional | Free-form annotation about impact or workaround |

### `error_type` vocabulary

| Code | When to use |
|---|---|
| `TOOL_DENIED` | User rejected a tool permission prompt (Bash, Edit, Write, etc.) |
| `HOOK_BLOCK` | pre-commit / commit-msg / pre-push hook exited non-zero |
| `CLAIM_FAIL` | `npm run claim` failed (closed issue, already claimed, missing `--as`) |
| `BASH_FAIL` | Any Bash command exited non-zero with work impact |
| `GIT_FAIL` | `git push`, `git rebase`, `git commit` failed |
| `GIT_STATE` | Git/shell state mismatch: getcwd errors (cwd deleted), "not a working tree", detached HEAD, etc. |
| `GH_FAIL` | `gh` CLI / GitHub API error (rate limit, network, not found) |
| `GH_INFO` | `gh` returned a non-error warning that revealed a wrong workflow assumption ("already closed", "already merged") |
| `DB_FAIL` | `velocity:log`, `error:log`, or any SQLite operation failed |
| `FILE_FAIL` | Read / Write / Edit tool failure (path not found, permission denied) |
| `EDIT_PRECOND` | Edit/Write precondition not met: `old_string` not found, file not read before edit, "no changes to make" |
| `SKILL_FAIL` | Skill invocation errored or produced unexpected output |
| `NETWORK_FAIL` | Timeout or connectivity error on web fetch / API call |
| `VALIDATION_FAIL` | Schema validation error (velocity:log field check, etc.) |
| `COMPLIANCE_FAIL` | A required discipline / protocol step was not followed — skipped pre-close self-audit, missing worktree / velocity row, didn't use `npm run close`, wrong convention. Set `context.behavioral = true` + a `failure_mode` (#1118). |
| `BEHAVIORAL_FAIL` | A non-ideal action or claim the agent chose — unrequested action / scope overstep, fabricated content, confidently-wrong claim. Set `context.behavioral = true` + a `failure_mode` (#1118). |
| `OTHER` | Fallback for errors that resist quick categorization. Use when no existing code fits and picking the right one would take more than a few seconds — log promptly with `OTHER` rather than delaying to find the perfect type. `error_type` may be corrected retroactively via a DB UPDATE once the right code is known. Behavioral / process errors now have the two dedicated codes above — prefer those. |

### `context` JSON shapes by type

```jsonc
// BASH_FAIL / GIT_FAIL / GH_FAIL
{"cmd": "git push origin HEAD:main", "exit_code": 1, "stderr": "first ~100 chars"}

// TOOL_DENIED
{"tool": "Bash", "cmd_preview": "rm -rf /tmp/foo"}

// HOOK_BLOCK
{"hook": "pre-push", "stderr": "first ~100 chars of hook output"}

// CLAIM_FAIL
{"cmd": "npm run claim -- 880 --as CHERRY", "reason": "already claimed by GRAPE"}

// FILE_FAIL
{"tool": "Edit", "path": "/src/core/assembler.js", "error": "ENOENT"}

// EDIT_PRECOND
{"tool": "Edit", "path": "/src/core/assembler.js", "error": "no changes to make"}

// GIT_STATE
{"cmd": "git worktree remove .claude/worktrees/foo", "exit_code": 128, "stderr": "not a working tree"}

// GH_INFO
{"cmd": "gh issue close 924", "exit_code": 0, "stderr": "Issue #924 is already closed"}

// DB_FAIL / VALIDATION_FAIL
{"script": "velocity:log", "field": "model", "value": "claude-opus-4-8"}
```

## Example row

```bash
npm run error:log -- '{
  "occurred_iso": "2026-06-05T16:30:00-1000",
  "agent": "CHERRY",
  "model": "sonnet-4.6",
  "ticket": 880,
  "error_type": "BASH_FAIL",
  "message": "git push: rejected — updates were rejected because the remote contains work",
  "context": "{\"cmd\":\"git push origin HEAD:main\",\"exit_code\":1}",
  "notes": "resolved via git pull --rebase"
}'
```

## Decision: manual, not hook-triggered

Error logging is a **deliberate manual step**, not an automated hook. Reasons:
1. Not every non-zero exit is an error — harmless informational warnings (e.g. `[MODULE_TYPELESS_PACKAGE_JSON]`, deprecation notices) are not errors and generate no row.
2. The agent has context the hook doesn't: which ticket is active, what the error meant in context, how it was resolved.
3. Hook-triggered logging would double-count identical retries that should be de-duplicated within a session.

Log the row at the moment the error occurs, even if you expect to resolve it immediately.

## Pre-close self-audit (required — RULES.md 16 / R021)

Logging "at the moment of failure" is the ideal, but it is easy to forget: you self-correct a misfire, move on, and the row never gets written — so the table under-reports (the #1108 repro: 3 errors went unlogged until a human asked, then backfilled as rows 49–51). The backstop, mandated as a close step, is a **transcript self-audit** — chosen as Option D in #1117 precisely because `npm run close` cannot see the conversation but **you can**:

**Before the velocity log at every close:**

1. Re-read your session from the point you claimed the ticket to now.
2. Enumerate every event matching the triggers above — *including resolved ones*.
3. For each, confirm a row exists or log it now:
   ```bash
   sqlite3 ~/.lccjs/lccjs.db "SELECT id,error_type,message FROM errors WHERE ticket=N"
   ```
4. State the outcome explicitly in the closing comment — one of:
   - `error self-audit: N row(s) logged (#ids …)`
   - `error self-audit: no loggable errors this session`

The explicit statement is the point: it turns silence into a checkable acknowledgement, so a clean session and a forgotten log stop looking identical. The `next-best-action` pre-close checklist carries this as a question; the `COMPLIANCE_FAIL` type (#1118) makes a *forgotten-then-caught* episode itself recordable — when the audit catches a miss, log both the original error row(s) and one `COMPLIANCE_FAIL` row (with `context.behavioral = true`).

## Querying logged errors

```bash
# Recent errors
sqlite3 ~/.lccjs/lccjs.db \
  "SELECT id, occurred_iso, agent, error_type, message FROM errors ORDER BY id DESC LIMIT 10"

# Errors by type
sqlite3 ~/.lccjs/lccjs.db \
  "SELECT error_type, COUNT(*) as n FROM errors GROUP BY error_type ORDER BY n DESC"

# Errors for a specific ticket
sqlite3 ~/.lccjs/lccjs.db \
  "SELECT id, error_type, message FROM errors WHERE ticket = 880"

# All errors from a specific agent
sqlite3 ~/.lccjs/lccjs.db \
  "SELECT id, occurred_iso, error_type, message FROM errors WHERE agent = 'CHERRY' ORDER BY occurred_iso"
```

## Related

- `docs/errors-schema.md` — canonical field reference and full column rationale
- `puzzle-velocity` skill — velocity row logging (parallel discipline for time tracking)
- `docs/velocity-schema.md` — velocity table schema (models the errors table design)
