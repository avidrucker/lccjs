# Error Type Lookup — Concrete Scenarios to Vocabulary Codes

**Companion to:** [`docs/errors-schema.md`](./errors-schema.md) (authoritative vocabulary) · [`~/.claude/skills/log-error/SKILL.md`](~/.claude/skills/log-error/SKILL.md) (usage protocol)

This doc expands each `error_type` code with concrete scenarios, expected message patterns, and disambiguation rules. It is a **reader-friendly layer** — if this doc and `docs/errors-schema.md` ever conflict, the schema doc wins.

---

## Quick decision tree

```
What failed?
│
├── A Claude Code tool call (Bash, Edit, Write, Read)?
│   ├── User rejected the permission prompt?  → TOOL_DENIED
│   ├── Bash command returned non-zero?
│   │   ├── The command was `git …`?          → GIT_FAIL
│   │   ├── The command was `gh …`?           → GH_FAIL
│   │   ├── The command was `npm run claim`?  → CLAIM_FAIL
│   │   └── Any other command?                → BASH_FAIL
│   └── Edit/Write/Read returned an error?    → FILE_FAIL
│
├── A git hook (pre-commit / commit-msg / pre-push) exited non-zero?
│                                             → HOOK_BLOCK
│
├── A skill invocation errored or returned garbage?
│                                             → SKILL_FAIL
│
├── A web fetch / API call timed out?         → NETWORK_FAIL
│
├── velocity:log, error:log, or SQLite failed? → DB_FAIL
│
├── A schema/field validation was rejected?   → VALIDATION_FAIL
│
└── None of the above?                        → OTHER (+ note)
```

**Tie-breaker rules:**

| Scenario | Use this, not that |
|---|---|
| `gh` CLI fails (rate limit, not found, auth error) | `GH_FAIL` — not `BASH_FAIL` |
| `git push` / `git rebase` / `git commit` fails | `GIT_FAIL` — not `BASH_FAIL` |
| `npm run claim` fails (closed, already claimed, wrong syntax) | `CLAIM_FAIL` — not `BASH_FAIL` or `GIT_FAIL` |
| pre-push hook blocks because PDD scan finds a stale marker | `HOOK_BLOCK` — not `GIT_FAIL` or `VALIDATION_FAIL` |
| `gh issue edit` denied by auto-mode classifier | `TOOL_DENIED` — not `GH_FAIL` (the classifier blocked the tool call, not GitHub) |
| `velocity:log` or `error:log` fails validation | `VALIDATION_FAIL` — not `DB_FAIL` (validation rejects before DB write) |
| SQLite write fails after validation passes | `DB_FAIL` — not `VALIDATION_FAIL` |

---

## Code reference with examples

### `TOOL_DENIED`

User rejected the permission prompt for a Claude Code tool (Bash, Edit, Write, Read, WebFetch, etc.).

**Concrete scenarios:**
- Agent called `Bash` with `rm -rf /tmp/foo` and the user clicked "Deny"
- Agent called `Edit` on a production config file and user denied
- Agent called `gh issue edit` and the auto-mode classifier blocked it before GitHub was reached
- Agent requested `WebSearch` and the user denied the network call

**Message pattern:** `User denied permission for <tool>` or `Classifier outage — tool call blocked`

**Context shape:** `{"tool": "Bash", "cmd_preview": "rm -rf /tmp/foo"}`

---

### `HOOK_BLOCK`

A git hook (pre-commit, commit-msg, or pre-push) exited non-zero and blocked the commit or push.

**Concrete scenarios:**
- pre-push hook runs PDD scan and finds an `@inprogress` marker for a closed issue
- commit-msg hook rejects a title using the `type(#N):` scope format
- pre-commit hook blocks a direct commit to `main` (source file staged on protected branch)
- pre-push hook detects conflict markers (`<<<<<<<`) in a staged file

**Message pattern:** `[pre-push] PDD scan found stale marker` · `[commit-msg] scope must not be an issue number`

**Context shape:** `{"hook": "pre-push", "stderr": "first ~100 chars of hook output"}`

**Disambiguation:** A pre-push hook blocking is `HOOK_BLOCK` even if the underlying symptom is a PDD issue (`VALIDATION_FAIL`) or a git conflict (`GIT_FAIL`). The hook is the proximate cause.

---

### `CLAIM_FAIL`

`npm run claim` failed — issue already closed, worktree already claimed by another agent, or wrong syntax.

**Concrete scenarios:**
- `npm run claim -- 880 --as CHERRY` when #880 is already closed
- `npm run claim -- 929 GRAPE` (missing `--as` flag) → syntax error
- Two agents raced to claim the same issue; second one finds it already `@inprogress`
- Agent ran `claim` without `--as` in a multi-agent session (auto-name disabled since #386)

**Message pattern:** `[claim] ✗ issue #N is closed` · `[claim] ✗ no agent identity set`

**Context shape:** `{"cmd": "npm run claim -- 880 --as CHERRY", "reason": "issue is closed"}`

---

### `BASH_FAIL`

Any Bash command exited non-zero with work impact — and it was not a `git`, `gh`, `npm run claim`, or SQLite command (those have more specific types).

**Concrete scenarios:**
- `npm test` fails with a Jest assertion error
- `node scripts/puzzle-status.js` exits 1 because of a missing dependency
- `scripts/lccrun.sh` times out and exits 124
- `npm run build:browser` fails because webpack can't resolve a module

**Message pattern:** `Exit code 1` / `Exit code 124` + stderr excerpt

**Context shape:** `{"cmd": "npm test", "exit_code": 1, "stderr": "FAIL tests/new/assembler..."}`

---

### `GIT_FAIL`

A `git` command failed — push rejected, rebase conflict, commit refused, branch not found.

**Concrete scenarios:**
- `git push origin HEAD:main` rejected because remote has new commits (non-fast-forward)
- `git rebase origin/main` produces a merge conflict that the agent cannot resolve cleanly
- `git commit` fails because the working tree is clean (nothing staged)
- `git worktree remove` fails because the worktree has uncommitted changes

**Message pattern:** `rejected — non-fast-forward` · `CONFLICT (content): Merge conflict in docs/claude_workflow.md` · `nothing to commit`

**Context shape:** `{"cmd": "git push origin HEAD:main", "exit_code": 1, "stderr": "rejected — updates were rejected"}`

**Disambiguation:** A rebase conflict is `GIT_FAIL`, not `BASH_FAIL`, even though `git rebase` is a Bash command. Use the most specific type.

---

### `GH_FAIL`

A `gh` CLI call or GitHub API call failed — rate limit, authentication error, resource not found, network issue at GitHub's end.

**Concrete scenarios:**
- `gh issue view 999` returns `404 Not Found` because the issue doesn't exist
- `gh issue create` fails with `422 Unprocessable Entity` (label doesn't exist)
- `gh` CLI returns rate-limit error during a batch of issue reads
- `gh pr create` fails because the branch has no upstream

**Message pattern:** `gh: <resource> not found` · `HTTP 422` · `API rate limit exceeded`

**Context shape:** `{"cmd": "gh issue view 999", "exit_code": 1, "stderr": "issue not found"}`

**Disambiguation:** `gh issue edit` blocked by the auto-mode *classifier* (before GitHub is called) → `TOOL_DENIED`. `gh issue edit` reaching GitHub and getting a 403 → `GH_FAIL`.

---

### `DB_FAIL`

A SQLite operation failed after validation passed — insert error, locked database, schema mismatch, file-permission issue on `~/.lccjs/velocity.db`.

**Concrete scenarios:**
- `npm run velocity:log` fails with `SQLITE_BUSY` because another process holds a write lock
- `npm run error:log` fails because the `errors` table doesn't exist yet (seed not run)
- SQLite returns `SQLITE_CONSTRAINT` on a NOT NULL violation that the application missed
- The `.db` file is on a read-only filesystem

**Message pattern:** `SQLITE_BUSY` · `no such table: errors` · `SQLITE_CONSTRAINT`

**Context shape:** `{"script": "velocity:log", "error": "SQLITE_BUSY"}`

**Disambiguation:** If `velocity:log` or `error:log` rejects the row at the *application* validation layer (bad `model` format, unknown `role`) before touching SQLite → `VALIDATION_FAIL`. If the DB write itself fails → `DB_FAIL`.

---

### `FILE_FAIL`

A Read, Write, or Edit tool call failed — file not found, permission denied, stale file handle.

**Concrete scenarios:**
- `Edit` returns `ENOENT: no such file or directory` on a path that was renamed
- `Write` fails with `EACCES: permission denied` on a file owned by root
- `Edit` returns `File has been modified since read` (stale read — another agent touched the file between Read and Edit)
- `Read` returns an error on a symlink whose target was deleted

**Message pattern:** `ENOENT` · `EACCES` · `File has been modified since read`

**Context shape:** `{"tool": "Edit", "path": "/home/avi/…/docs/skills.md", "error": "File has been modified since read"}`

**Note on stale reads:** The `File has been modified since read` failure is a common multi-agent hazard. It means the edit was **not applied** — the file is unchanged from its pre-Read state. Re-read the file and re-apply the edit. See `docs/claude_workflow.md` "Tool-failure discipline". Consider `STALE_READ` (proposed extension, see below) for rows where the cause was acting on stale *information* rather than a stale *file handle*.

---

### `SKILL_FAIL`

A skill invocation errored, returned unexpected output, or produced output that contradicted real file state.

**Concrete scenarios:**
- `Skill` tool returns an error loading a skill file (path not found, parse error)
- Skill output references a function or flag that no longer exists in the codebase
- A skill's checklist step produces a tool error that blocks the rest of the skill
- Skill content is loaded but the instructions are contradictory and cannot be resolved

**Message pattern:** `Skill not found: <name>` · `Error loading skill content`

**Context shape:** `{"skill": "puzzle-velocity", "error": "file not found at expected path"}`

---

### `NETWORK_FAIL`

A web fetch, API call, or network-dependent tool timed out or failed to connect.

**Concrete scenarios:**
- `WebFetch` times out on a URL (no response within timeout window)
- `WebSearch` fails with a connectivity error
- `gh` CLI fails because GitHub is unreachable (DNS failure, no network) — use `GH_FAIL` instead if the error is GitHub-specific
- A `fetch` call inside `scripts/` fails with `ECONNREFUSED`

**Message pattern:** `ETIMEDOUT` · `ECONNREFUSED` · `fetch failed: network error`

**Context shape:** `{"url": "https://…", "error": "ETIMEDOUT"}`

---

### `VALIDATION_FAIL`

A field or schema validation check rejected a value before any database or network operation — typically from `velocity:log`, `error:log`, or a commit hook validating commit message format.

**Concrete scenarios:**
- `velocity:log` rejects `"model": "claude-opus-4-8"` (must be `opus-4.8` — wrong format)
- `error:log` rejects an unknown `error_type` code (e.g. `STALE_READ` before it is added to the vocabulary)
- `velocity:log` rejects `"role": "COMBO"` if `COMBO` is not in the valid-roles list
- commit-msg hook rejects `fix(#123): description` (issue-number scope)

**Message pattern:** `velocity-log: ✗ invalid model format` · `error-log: ✗ unknown error_type`

**Context shape:** `{"script": "velocity:log", "field": "model", "value": "claude-opus-4-8"}`

---

### `OTHER`

Uncategorized — none of the above types fit.

**Use sparingly.** When using `OTHER`:
1. Always set a `notes` value explaining what happened and why no specific type applied
2. If you believe the scenario warrants a new type, add `"notes": "Proposed error_type: NEW_CODE — <rationale>"` and consider filing a ticket to extend the vocabulary (see "Proposing new codes" below)
3. Query `OTHER` rows periodically: `SELECT message, notes FROM errors WHERE error_type = 'OTHER'` — clusters of similar rows are candidates for a new code

**Concrete scenarios that belong here:**
- An agent acted on stale documentation that was correct when written (no file error, no git error — the information was just outdated). Proposed code: `STALE_READ` — see below.
- An external service (not GitHub, not a URL) returned an unexpected response
- A race condition whose proximate cause is ambiguous between `GIT_FAIL` and `HOOK_BLOCK`

---

## Proposed extension: `STALE_READ`

**Status:** Proposed — not yet in the vocabulary. Use `OTHER` with `notes: "Proposed error_type: STALE_READ"` until this is ratified.

**Source:** #904 session (2026-06-05) — an agent read a document that was factually correct at write time but stale by session time, then acted on the wrong information. Logged as `OTHER` because no specific type covered the failure mode.

**Proposed definition:** Agent acted on a document, ticket, or schema that was stale (correct when written, outdated at read time), leading to a wasted action or incorrect output. Distinct from `FILE_FAIL` (the file was read successfully — the content was just outdated) and from `TOOL_DENIED` (no tool was blocked).

**Proposed context shape:**
```jsonc
{"doc": "docs/research/901-errors-table-schema.md", "stale_field": "error_type vocabulary", "acted_on": "STALE_READ as if valid"}
```

**To ratify this code:** Add `STALE_READ` to `VALID_ERROR_TYPES` in `scripts/error-log.js`, add a row to the vocabulary tables in `docs/errors-schema.md` and `~/.claude/skills/log-error/SKILL.md`, and update the backfill row in the errors table (see #904). No schema migration needed — `error_type` is a plain TEXT column.

---

## Proposing new `error_type` codes

1. **First, check the vocabulary.** Read `docs/errors-schema.md` — if an existing code covers the scenario, use it even if the fit is imperfect. Document the imperfect fit in `notes`.
2. **If no code fits**, use `OTHER` with `notes: "Proposed error_type: NEW_CODE — <one-sentence rationale>"`. This makes the row queryable as `OTHER` now and patchable once the type is ratified.
3. **File a ticket** (`WRITER` role) to extend the vocabulary with the proposed code, the definition, an example scenario, and the context JSON shape. Cross-reference the `OTHER` row's `id` in the ticket for traceability.
4. **To land a new code** once the ticket is accepted:
   - Add to `VALID_ERROR_TYPES` in `scripts/error-log.js`
   - Add a row to `docs/errors-schema.md` valid-values table
   - Add a row to `~/.claude/skills/log-error/SKILL.md` vocabulary table
   - Add a section to this file with examples and disambiguation notes
   - Update any historical `OTHER` rows that should have used the new type

---

## Related

- [`docs/errors-schema.md`](./errors-schema.md) — **authoritative vocabulary**, full column reference, DDL, context shapes
- [`docs/research/901-errors-table-schema.md`](./research/901-errors-table-schema.md) — original schema research and rationale
- [`~/.claude/skills/log-error/SKILL.md`](~/.claude/skills/log-error/SKILL.md) — logging protocol (when to log, the `npm run error:log` command)
- [`docs/velocity-schema.md`](./velocity-schema.md) — parallel discipline (velocity table conventions)
