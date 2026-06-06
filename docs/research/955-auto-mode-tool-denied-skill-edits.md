# RESEARCH: auto-mode TOOL_DENIED on skill-file edits (#955)

**Date:** 2026-06-06  
**Agent:** DRAGONFRUIT  
**Parent:** #955

---

## Summary

Auto-mode blocks `Edit`/`Write` calls to `~/.claude/skills/**` as "Self-Modification"
unless the current task description explicitly names that file. This fires even when
the procedure the task is executing (e.g. `docs/errors-schema.md` "Adding new
error_type values") requires the skill-file edit as step 2. Two mitigations are
available: a project-level permission allowlist entry (technical, covers future
work automatically) and a documentation update to the procedure (procedural,
requires agents to remember). Both should be implemented.

---

## When does TOOL_DENIED fire on skill-file edits?

Claude Code's auto-mode classifier assigns each planned tool call a risk category.
Writes to `~/.claude/**` are categorized as **Self-Modification** because those
paths contain Claude Code's own configuration (settings, keybindings, skills).
In auto-mode, the classifier permits an action only when:

1. It is in the project `permissions.allow` list, OR
2. The current task description explicitly scopes the action (e.g. the issue
   body names `~/.claude/skills/log-error/SKILL.md`), OR
3. The action falls outside the protected categories (most source code edits).

If neither (1) nor (2) applies, the classifier emits TOOL_DENIED with a message
like: *"Editing `~/.claude/skills/log-error/SKILL.md` is Self-Modification
(`.claude/skills/` is an explicitly protected path) and the user's task only
authorized writing to `docs/errors-schema.md`…"*

**This fires silently in auto-mode.** The agent never gets a confirmation prompt;
the edit simply does not happen. If the agent doesn't check for this, step 2 of
the procedure is silently skipped.

---

## Scope of the problem

lccjs has four skill files that may legitimately need editing during puzzle work:

| Skill | When edits are needed |
|-------|-----------------------|
| `~/.claude/skills/log-error/SKILL.md` | Adding new `error_type` codes (`docs/errors-schema.md` step 2) |
| `~/.claude/skills/puzzle-velocity/SKILL.md` | Velocity protocol changes |
| `~/.claude/skills/lccjs-assembly/SKILL.md` | ISA-coverage or procedure updates |
| `~/.claude/skills/write-til-doc/SKILL.md` | TIL format changes |

All four are in `~/.claude/skills/` and thus subject to the Self-Modification block.

---

## Mitigation 1 — project `permissions.allow` (recommended)

Add explicit Edit permission entries to `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(gh issue comment *)",
      "Bash(npm run puzzle:status)",
      "Edit(~/.claude/skills/log-error/SKILL.md)",
      "Edit(~/.claude/skills/puzzle-velocity/SKILL.md)",
      "Edit(~/.claude/skills/lccjs-assembly/SKILL.md)",
      "Edit(~/.claude/skills/write-til-doc/SKILL.md)"
    ]
  }
}
```

**Pros:** covers all future puzzle work automatically; agents don't need to remember
to name the skill file in puzzle descriptions; minimal ongoing cognitive load.

**Cons:** grants standing permission to all sessions in this project; a miscreant
puzzle could overwrite skill files without any friction. Low real risk since the
skill files are tracked and edits would be visible.

**Alternative broader form:** `Edit(~/.claude/skills/*/SKILL.md)` — covers any
skill whose SKILL.md needs updating. Expands the risk surface slightly but reduces
the maintenance burden when new lccjs-relevant skills are added.

---

## Mitigation 2 — procedural: explicit file naming in issue descriptions

Update `docs/errors-schema.md` "Adding new `error_type` values" to say:

> 2. Add a row to the valid-values table in this file **and** in the `log-error`
> skill. **Important:** the puzzle description must explicitly name
> `~/.claude/skills/log-error/SKILL.md` for auto-mode to allow the edit.

Similarly, update any `@todo` marker templates for these procedures to name the
skill file.

**Pros:** zero settings changes; self-documenting in the procedure itself.

**Cons:** relies on every agent reading step 2 carefully and writing their puzzle
description accordingly; silent failure if forgotten (auto-mode skips the edit
without error in the agent output unless the agent checks).

---

## How to write puzzle descriptions that pre-authorize skill-file edits

When a task requires editing a skill file, include the explicit path in the
issue body's "Should have" section or the `@todo` description. Example:

```
## Should have
- `docs/errors-schema.md` valid-values table updated with new code
- `~/.claude/skills/log-error/SKILL.md` vocabulary table updated with same code
```

The auto-mode classifier reads the task description to determine scope. An explicit
file path in "Should have" is recognized as an authorized target.

---

## Recommended action

1. **Immediate (procedural):** File a DEV ticket to add the four explicit skill
   file paths to `.claude/settings.json` `permissions.allow` (#956 or a new
   number). See the JSON snippet in Mitigation 1 above.

2. **Immediate (docs):** Update `docs/errors-schema.md` step 2 to name the
   skill file explicitly and note the auto-mode constraint.

3. **Convention:** Add a bullet to `docs/do-this-not-that.md`: when a puzzle
   requires a skill-file edit, name the skill file path in the issue's
   "Should have" section.

---

## Implementation ticket

A follow-up DEV ticket should apply Mitigation 1 (the settings.json change).
Estimated H: 10m, C: 5m.
