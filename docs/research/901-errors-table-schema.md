# errors table schema — research deliverable (#901)

**Parent spike:** #898 (agent error tracking)

## Error categories agents encounter

Before fixing columns, enumerate what gets logged:

| Category | Examples |
|---|---|
| `TOOL_DENIED` | User rejects a tool permission prompt (Bash, Edit, Write, etc.) |
| `HOOK_BLOCK` | pre-commit / commit-msg / pre-push hook exits non-zero |
| `CLAIM_FAIL` | `npm run claim` fails (closed issue, already claimed, missing `--as`) |
| `BASH_FAIL` | Any Bash command exits with non-zero status |
| `GIT_FAIL` | `git push`, `git rebase`, `git commit` fails (conflict, auth, etc.) |
| `GH_FAIL` | `gh` CLI / GitHub API error (rate limit, network, not found) |
| `DB_FAIL` | `velocity:log` or any SQLite operation fails |
| `FILE_FAIL` | Read / Write / Edit tool failure (path not found, permission denied) |
| `SKILL_FAIL` | Skill invocation errors or unexpected skill output |
| `NETWORK_FAIL` | Timeout or connectivity error on web fetch / API call |
| `VALIDATION_FAIL` | Schema validation error (velocity:log field check, etc.) |
| `OTHER` | Uncategorized |

---

## Proposed DDL

```sql
CREATE TABLE errors (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_iso TEXT    NOT NULL,
  agent        TEXT,
  model        TEXT,
  ticket       INTEGER,
  repo         TEXT    DEFAULT 'lccjs',
  error_type   TEXT,
  message      TEXT,
  context      TEXT,
  notes        TEXT
);

CREATE INDEX errors_agent_time ON errors (agent, occurred_iso);
CREATE INDEX errors_type       ON errors (error_type);
CREATE INDEX errors_ticket     ON errors (ticket);
```

---

## Column rationale

| Column | Type | Nullable | Rationale |
|---|---|---|---|
| `id` | INTEGER PK | NO | Surrogate key, auto-incremented — matches velocity table convention |
| `occurred_iso` | TEXT | NO | ISO 8601 timestamp (with offset) captured at the moment of error. NOT NULL — an undatable error row is nearly useless for trend analysis |
| `agent` | TEXT | YES | Terminal/worktree name (e.g. `ELDERBERRY`). Nullable: errors from automated scripts or hooks may have no agent identity |
| `model` | TEXT | YES | Claude model short-form (e.g. `sonnet-4.6`). Nullable: non-model errors (hook blocks, bash failures) aren't model-specific |
| `ticket` | INTEGER | YES | GitHub issue active at error time. Nullable: errors outside any puzzle context (e.g. pre-claim failure) have no ticket |
| `repo` | TEXT | YES | Repository context. Default `lccjs`; use `claude-config` for cross-repo ops. Matches velocity convention |
| `error_type` | TEXT | YES | Controlled vocabulary code from the table above. Nullable only for legacy/migration rows — new rows should always set this |
| `message` | TEXT | YES | Raw error message or stderr text. Free text; no truncation at insert time |
| `context` | TEXT | YES | JSON blob with type-specific fields (e.g. `{"cmd":"npm run claim 901","exit_code":1}` for BASH_FAIL, `{"tool":"Edit","path":"/foo.js"}` for FILE_FAIL). JSON keeps the schema stable as error types grow |
| `notes` | TEXT | YES | Free-form agent annotation. Same purpose as velocity's `notes` |

---

## Normalization decisions

**`error_type`: constrained vocabulary as TEXT, not an enum.**
SQLite has no native ENUM. A TEXT column with a documented valid-values list (same pattern as velocity's `role`) is the right call: it's queryable, groupable, and can be extended by adding a row to the docs without a schema migration. An application-layer CHECK constraint is optional and can be added later.

**`context`: JSON blob, not flat columns.**
Different error types need different supplementary fields — a BASH_FAIL needs `cmd` and `exit_code`; a TOOL_DENIED needs `tool_name`; a HOOK_BLOCK needs `hook` and `stderr`. A flat-column approach would leave most columns NULL for most rows (sparse anti-pattern). A JSON blob in `context` keeps the table at a stable width while allowing rich, type-specific data. SQLite's `json_extract()` makes the blob queryable without full expansion.

**`occurred_iso` NOT NULL.**
The only column that must be present. An error row with no timestamp is useless for the primary use-case (trend analysis over time). All other fields are nullable for forward-compatibility (automated hooks may not have agent/model context).

---

## Index and query-pattern considerations

Three indexes cover the expected query patterns:

| Index | Covers |
|---|---|
| `errors_agent_time (agent, occurred_iso)` | "All errors for agent X in the last N days" — the most common operations query |
| `errors_type (error_type)` | "How many CLAIM_FAIL errors total?", "All HOOK_BLOCK rows" |
| `errors_ticket (ticket)` | "All errors that occurred while working puzzle N" |

A full-table scan is fine for infrequent analytical queries (e.g. "errors by model", "errors per day"). Add indexes only if query latency becomes noticeable — the table is expected to stay small (hundreds to low thousands of rows).

---

## Compatibility with velocity table conventions

| Convention | velocity | errors (this design) |
|---|---|---|
| Primary key | `id INTEGER PK AUTOINCREMENT` | Same |
| Timestamps | ISO 8601 TEXT with tz offset | Same (`occurred_iso`) |
| Agent column | `agent TEXT` nullable | Same |
| Model column | `model TEXT` nullable | Same |
| Ticket column | `ticket INTEGER` nullable | Same |
| Repo column | `repo TEXT DEFAULT 'lccjs'` | Same |
| Notes column | `notes TEXT` nullable | Same |
| Controlled vocab | `role` TEXT with documented values | `error_type` TEXT with documented values |

One deliberate difference: `occurred_iso` is NOT NULL here (vs. all columns nullable in velocity). This is intentional — velocity timestamps are sometimes omitted for multi-turn idle sessions; error timestamps have no excuse to be absent.

---

## Implementation notes (out of scope for this ticket)

- The write path (how agents produce rows) is in scope for #898, not this ticket.
- Migration script (`ALTER TABLE` or fresh `CREATE TABLE`) belongs in `scripts/velocity-seed.js` or a new `scripts/errors-seed.js`.
- Export script analogue to `velocity-export.js` is optional — the errors table is local-only like velocity; a CSV export may not be needed.
