# Codex vs Claude Code Skills

Last checked: 2026-06-07.

This note compares the skill systems in OpenAI Codex and Anthropic Claude Code so agents can port workflows without guessing from memory.

## Shared model

Both systems use directory-based skills centered on a `SKILL.md` file. The common design is:

- Put reusable task instructions in `SKILL.md`.
- Keep the skill description sharp enough for the agent to select it.
- Add supporting files only when they are useful for the workflow.
- Let the agent load full instructions only when the skill is relevant.

The practical writing advice transfers well: keep one skill focused on one job, make the trigger conditions explicit, and put deterministic helper logic in scripts instead of long prose when exact behavior matters.

## Codex

Codex skills are available in the Codex CLI, IDE extension, and Codex app.

Codex reads skills from several scopes:

| Scope | Location |
|---|---|
| Repo-local | `.agents/skills` from the current directory up to the repo root |
| User | `$HOME/.agents/skills` |
| Admin | `/etc/codex/skills` |
| System | Bundled OpenAI skills |

Codex skill metadata requires both `name` and `description` in `SKILL.md` frontmatter:

```md
---
name: skill-name
description: Explain exactly when this skill should and should not trigger.
---

Skill instructions for Codex to follow.
```

Codex can activate a skill explicitly with `$skill-name` or through `/skills` in CLI/IDE surfaces. It can also invoke a skill implicitly when the user request matches the description.

Codex uses progressive disclosure. It initially receives a compact list of available skill names, descriptions, and file paths. That initial list is budgeted to avoid crowding the main prompt; the full `SKILL.md` is read only after Codex selects a skill.

Codex treats skills as the workflow authoring format. Plugins are the distribution format when a workflow needs to be installed, shared, or bundled with integrations. A Codex plugin can package skills plus apps, MCP server configuration, hooks, assets, and marketplace metadata.

Codex also supports optional `agents/openai.yaml` metadata for a skill. That file can define Codex app UI metadata, dependency declarations, and invocation policy such as `allow_implicit_invocation: false`.

## Claude Code

Claude Code skills are normally stored in Claude-specific skill directories:

| Scope | Typical location |
|---|---|
| Project | `.claude/skills/<skill-name>/SKILL.md` |
| User | `~/.claude/skills/<skill-name>/SKILL.md` |
| Enterprise or plugin | Managed by the Claude Code environment |

In this lccjs repo, project workflow docs also refer to global Claude Code skills under `~/.claude/skills/`. See `docs/skills.md` for the local inventory.

Claude Code invokes skills with slash-command style names such as `/skill-name`. Claude Code also supports model invocation based on the skill description.

Claude Code frontmatter differs from Codex. The directory name can provide the command name, and `description` is the key selector text. Claude Code also supports Claude-specific controls, including:

- `disable-model-invocation`
- `user-invocable`
- `allowed-tools`

Claude Code skills can include dynamic context injection in `SKILL.md`, such as command output that is evaluated before the model sees the skill content. Treat that as Claude-specific; do not assume Codex will run those snippets.

Claude Code watches many skill file changes live during a session. Plugin-level changes may still require a plugin reload.

## Main differences

| Area | Codex | Claude Code |
|---|---|---|
| Repo path | `.agents/skills` | `.claude/skills` |
| User path | `~/.agents/skills` | `~/.claude/skills` |
| Explicit invocation | `$skill-name`, `/skills`, plugin `@` surfaces | `/skill-name` |
| Required frontmatter | `name`, `description` | `description` is the important selector; command name can come from directory |
| Progressive disclosure | Documented initial skill-list budget, then full `SKILL.md` on selection | Similar lazy-loading behavior, with Claude-specific skill controls |
| Distribution | Local skills for authoring; plugins for sharing, apps, MCP, hooks, assets | Skills and plugins are Claude Code environment concepts |
| Extra metadata | Optional `agents/openai.yaml` | Claude-specific frontmatter such as `allowed-tools` |
| Dynamic command injection | Do not assume support | Supported in Claude Code skills |

## Porting checklist

When moving a skill from Claude Code to Codex:

1. Move the skill under `.agents/skills/<skill-name>/SKILL.md` or another Codex skill scope.
2. Add explicit `name` and `description` frontmatter.
3. Replace `/skill-name` references with `$skill-name` where the docs are Codex-facing.
4. Remove or rewrite Claude-only frontmatter such as `allowed-tools`, `user-invocable`, and `disable-model-invocation`.
5. Replace dynamic command injection with explicit workflow steps or helper scripts.
6. If the workflow should be shared or bundled with integrations, package it as a Codex plugin.

When moving a skill from Codex to Claude Code:

1. Move the skill under `.claude/skills/<skill-name>/SKILL.md` or the relevant Claude Code skill scope.
2. Check whether `name` is still useful prose or redundant with the directory name.
3. Replace `$skill-name` references with `/skill-name` where the docs are Claude-facing.
4. Convert `agents/openai.yaml` behavior into Claude Code frontmatter or plugin configuration where possible.
5. Audit any Codex plugin dependency assumptions; Claude Code may need separate plugin, MCP, or tool configuration.

## Sources

- OpenAI Codex manual, Agent Skills section: `https://developers.openai.com/codex/skills`
- OpenAI Codex manual, Plugins section: `https://developers.openai.com/codex/plugins`
- Anthropic Claude Code skills docs: `https://docs.claude.com/en/docs/claude-code/skills`
- lccjs local skill inventory: `docs/skills.md`
