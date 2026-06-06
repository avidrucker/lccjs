# TIL 2026-06-06 — FIG

**Context:** Single-ticket session — #935 audited and removed all `ra` register alias
references from `docs/lcc-isa.md`, `docs/site/showcase/index.html`, and the global
`~/.claude/skills/lccjs-assembly/SKILL.md`. Four errors occurred and were logged
post-hoc, surfacing two process lessons around error logging discipline.

---

## 1. Naming an absent concept is itself a confabulation vector

**What happened:** `docs/lcc-isa.md` had a "protective" boundary note that read:
*"There is no `ra`, `a0`, `a1`, `v0`, `t0`, `zero`, or any other MIPS/RISC-V-style alias."*
The intent was to warn future agents off a common mistake. Issue #935 pointed out the
effect is the opposite: any agent reading that line sees `ra` as a named concept with a
caveat, and may treat the disclaimer as partial rather than total.

**What I learned:** A positive-only statement (`the only aliases are fp, sp, lr`) is
strictly safer than a negative-one (`there is no ra`). The negative form requires the
reader to understand that the list of named absences is exhaustive — an assumption that
cannot hold once the list grows. The positive form is self-contained; it names the full
closed set and leaves nothing to infer.

The same pattern appeared in `docs/site/showcase/index.html`, where `ra` was an active
CodeMirror completion entry with `detail: '= r7 (return address)'`. That entry didn't
even carry a disclaimer — it just offered `ra` as valid autocomplete.

**The rule:** In closed-set reference docs, enumerate what IS valid; never enumerate
what is not. A "There is no X" note imports X as a known concept.

---

## 2. `npm run claim` requires an explicit agent identity — env var or `--as` flag

**What happened:** Called `npm run claim -- 935` without providing an agent name. The
script rejected with: `[claim] ✗ no agent identity set. Corrected command: npm run claim -- 935 --as <fruit>`.

**What I learned:** Since #386 auto-naming was disabled. Agent names are assigned by
the human orchestrator and must be declared at claim time via `--as <fruit>` or by
exporting `CLAUDE_AGENT_NAME=<fruit>` before running. Neither is optional.

**The rule:** Always use `CLAUDE_AGENT_NAME=FIG npm run claim -- N` or
`npm run claim -- N --as FIG` — the script will not infer from context.

---

## 3. `gh issue comment --body` splits multi-line strings into multiple args

**What happened:** Posted a closing comment with a multi-line `--body` string.
The `gh` CLI rejected with: `accepts 1 arg(s), received 5`. The shell split
the body on embedded newlines, turning each paragraph into a separate positional argument.

**What I learned:** `gh issue comment --body "..."` expects the entire body as a single
shell argument. Embedded literal newlines inside a double-quoted string can be
interpreted differently depending on shell context. The safe fix is to keep `--body`
strings on one line, or use `$(cat <<'EOF' ... EOF)` heredoc quoting when a multi-line
body is necessary.

**The rule:** For `gh` comment/PR bodies with newlines, use a heredoc (`<<'EOF'`);
do not rely on bare double-quoted multi-line strings.

---

## 4. `error:log` schema must be checked before calling — two required fields bite

**What happened:** First `error:log` call omitted `occurred_iso` (required field);
script rejected. Second call used `error_type: "tool_misuse"` which is not in the
valid enum; script rejected again. Both errors then needed their own error log rows.

The valid `error_type` codes are:
`TOOL_DENIED`, `HOOK_BLOCK`, `CLAIM_FAIL`, `BASH_FAIL`, `GIT_FAIL`, `GIT_STATE`,
`GH_FAIL`, `GH_INFO`, `DB_FAIL`, `FILE_FAIL`, `EDIT_PRECOND`, `SKILL_FAIL`,
`NETWORK_FAIL`, `VALIDATION_FAIL`, `OTHER`.

**What I learned:** The error log schema has two non-obvious constraints: `occurred_iso`
is always required (not nullable), and `error_type` is a closed enum. Free-form type
strings that seem descriptive (`tool_misuse`) are rejected. Check
`docs/errors-schema.md` before the first `error:log` call in any session.

**The rule:** Before calling `npm run error:log`, verify the payload has `occurred_iso`
and that `error_type` is one of the fixed codes in `docs/errors-schema.md`.

---

## 5. Log errors when they happen — not after the ticket closes

**What happened:** Two errors (missing `--as` flag, `gh comment` quoting) occurred
during #935 work and were not logged until the user prompted post-close. This created
a retroactive logging session that itself produced two more errors.

**What I learned:** Deferring error logs until "later" introduces compounding risk:
the context is fresher at occurrence time, and logging errors late means they may be
omitted entirely if the session ends. Retroactive logging also requires reconstructing
timestamps and details that were obvious at the moment of failure.

**The rule:** Log each error with `npm run error:log` immediately when it occurs —
before moving on to the fix or the next step.

---

## What landed

| Artifact | Change |
|---|---|
| `docs/lcc-isa.md` | Boundary note rewritten as positive alias list; absent-concept inventory removed |
| `docs/site/showcase/index.html` | `ra` completion entry deleted; `r7` detail corrected to `lr (link register / return address)` |
| `~/.claude/skills/lccjs-assembly/SKILL.md` | "There is no ra alias" rewritten as positive closed-set statement |

## Related artifacts

- Issue #935 (closed)
- Issue #881 — original `ra` false-positive incident that seeded the docs
- `docs/errors-schema.md` — full error_type enum and field requirements
