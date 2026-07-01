# Skill portability across providers

_Audience: AI agents, contributors · Tier: reference_

How to move an agent skill between providers (Claude Code, Codex, …) without
guessing. The trick is to stop thinking in pairwise comparisons — which go stale
the moment a third tool appears — and think **hub-and-spoke**: a shared core that
ports as-is, plus a small per-provider delta you translate.

> **Last checked:** 2026-06-16. Provider-specific frontmatter keys and paths drift;
> treat every per-provider list below as **non-exhaustive** and verify against the
> linked upstream docs before relying on an exact key.

For the companion question — *where* skills should live across repos and provider
folders so they don't drift — see [`skill-organization.md`](./skill-organization.md).
For the local skill inventory, see [`skills.md`](./skills.md).

---

## The hub: the `agentskills.io` shared core

Both Codex and Claude Code build on the same open standard, **[agentskills.io](https://agentskills.io)**:
a skill is a **directory** whose entry point is a `SKILL.md` file with YAML
frontmatter. The portable core is small and identical across providers:

- **`SKILL.md`** holds the reusable task instructions.
- **Frontmatter `name` + `description`** — the `description` is the selector text
  the agent reads to decide whether the skill applies; make its trigger conditions
  explicit ("use when… / do not use when…").
- **Progressive disclosure** — the agent first sees only the compact list of
  skill names + descriptions + paths; the full `SKILL.md` body is loaded only after
  the skill is selected. Keep the description sharp so selection is cheap.
- **Supporting files** (scripts, references) live beside `SKILL.md` and are loaded
  on demand. Put deterministic behavior in helper scripts, not long prose.

**Porting rule:** the `SKILL.md` body, the `name`/`description` frontmatter, and any
helper files port **as-is**. Only each provider's *extensions* — the keys and
invocation surfaces it adds on top of the standard — need translation. The rest of
this doc documents those deltas, one spoke at a time.

---

## Spoke: Claude Code

**Skill directories** (project → user precedence):

| Scope | Location |
|---|---|
| Project | `.claude/skills/<name>/SKILL.md` |
| User | `~/.claude/skills/<name>/SKILL.md` |
| Plugin / enterprise | Managed by the Claude Code environment |

**Invocation:** `/<name>` (slash-command style), plus model invocation driven by the
`description`.

**Frontmatter extensions on top of the core** (Claude-specific; non-exhaustive as of
2026-06-16):

- `disable-model-invocation` — make the skill user-invocable only.
- `user-invocable` — expose / gate the `/<name>` entry point.
- `allowed-tools` / `disallowed-tools` — restrict the tool surface while the skill runs.
- `model` — pin a model for the skill.
- `argument-hint` / `arguments` — declare expected arguments.
- `context: fork` — run the skill in a forked context.

**Other Claude-specific behavior:**

- **Dynamic context injection** — `SKILL.md` may embed command output that is
  evaluated *before* the model sees the skill body. Do **not** assume another
  provider will execute those snippets.
- **Plugin mechanism** — a plugin declares `.claude-plugin/plugin.json` and exposes
  its skills under a `<name>@skills-dir` namespace. Custom commands are merged into
  the skill surface.
- **Live file watching** — Claude Code picks up most skill-file edits mid-session;
  plugin-level changes may still need a reload.

Upstream: <https://docs.claude.com/en/docs/claude-code/skills>

---

## Spoke: Codex

**Skill directories** — ⚠ the installed Codex CLI (verified v0.139.0) differs from the
published spec. The binary auto-discovers **`$CODEX_HOME/skills`** (default
**`~/.codex/skills`**) and a repo-local **`.codex/skills`**; `.agents/skills` appears
**0×** in the binary. `codex debug prompt-input` confirms skills load only from
`~/.codex/skills`. Use those paths in practice:

| Scope | Location (installed CLI) | Published-spec path |
|---|---|---|
| User | `~/.codex/skills` (`$CODEX_HOME/skills`, auto-discovered) | `~/.agents/skills` |
| Repo-local | `.codex/skills` (workdir) | `.agents/skills` |
| Selectors | `skills.config` entries in `~/.codex/config.toml` | — |
| Plugins | marketplace plugins bundle skills | — |
| System | bundled `.system/` built-ins | Bundled OpenAI skills |

The local source-of-truth repo for these is **`codex-config`**, symlinked into
`~/.codex/skills/` by its `install.sh` (see [`skill-organization.md`](./skill-organization.md)).

**Invocation:** `$<name>`, or `/skills` in the CLI/IDE surfaces; plus implicit
invocation when the request matches the `description`.

**Required frontmatter:** `name` **and** `description` (both mandatory — this is the
core, not an extension).

**Codex-specific extensions** (non-exhaustive as of 2026-06-16):

- **`agents/openai.yaml`** — optional per-skill metadata: Codex-app UI metadata,
  dependency declarations, and invocation policy such as
  `allow_implicit_invocation: false`.
- **Plugins** are the distribution format: a Codex plugin packages skills plus apps,
  MCP server config, hooks, assets, and marketplace metadata.

Upstream: <https://developers.openai.com/codex/skills>,
<https://developers.openai.com/codex/plugins>

---

## Spoke: Hermes

**Deferred.** Hermes is used here too, but its skill directories, invocation surface,
and whether it conforms to `agentskills.io` are not yet source-confirmed. A Hermes
spoke will be added once a source-backed research spike resolves the open questions
(parent #1210 carves Hermes out of the two writing tickets deliberately). Until then,
do **not** assume Hermes matches either spoke above.

---

## Translating the deltas (porting checklists)

The core ports unchanged; these steps cover only the per-provider deltas. The
frontmatter names below are non-exhaustive — re-check the spokes above.

### Claude Code → Codex

1. Place the skill under `~/.codex/skills/<name>/SKILL.md` (installed-CLI path; in
   lccjs's setup, author it in the `codex-config` repo, which symlinks there).
2. Ensure both `name` and `description` are present (Codex requires `name`).
3. Rewrite Claude invocation references `/<name>` → `$<name>` where the prose is
   Codex-facing.
4. Remove or rewrite Claude-only frontmatter (`allowed-tools`/`disallowed-tools`,
   `user-invocable`, `disable-model-invocation`, `context: fork`, `model`, …).
5. Replace dynamic command injection with explicit steps or helper scripts —
   Codex will not evaluate Claude's embedded snippets.
6. If the skill must be shared/bundled with integrations, package it as a Codex plugin.

### Codex → Claude Code

1. Place the skill under `.claude/skills/<name>/SKILL.md` (or the relevant scope).
2. Decide whether `name` is still useful prose or redundant with the directory name.
3. Rewrite `$<name>` → `/<name>` where the prose is Claude-facing.
4. Fold `agents/openai.yaml` behavior into Claude frontmatter or plugin config where
   an equivalent exists (e.g. `allow_implicit_invocation: false` →
   `disable-model-invocation`).
5. Audit Codex plugin dependency assumptions; Claude Code may need separate plugin,
   MCP, or tool configuration.

---

## Appendix: Codex vs Claude Code at a glance

The original pairwise comparison, preserved. Read it as "two spokes side by side";
the hub above is what they share.

| Area | Codex | Claude Code |
|---|---|---|
| Repo path | `.codex/skills` (installed CLI; spec says `.agents/skills`) | `.claude/skills` |
| User path | `~/.codex/skills` (installed CLI; spec says `~/.agents/skills`) | `~/.claude/skills` |
| Explicit invocation | `$<name>`, `/skills`, plugin `@` surfaces | `/<name>` |
| Required frontmatter | `name`, `description` | `description` is the key selector; command name can come from the directory |
| Progressive disclosure | Documented initial skill-list budget, then full `SKILL.md` on selection | Similar lazy-loading, plus Claude-specific skill controls |
| Distribution | Local skills for authoring; plugins for sharing, apps, MCP, hooks, assets | Skills + plugins are Claude Code environment concepts |
| Extra metadata | Optional `agents/openai.yaml` | Claude-specific frontmatter (`allowed-tools`, …) |
| Dynamic command injection | Do not assume support | Supported |

---

## Sources

- agentskills.io — the shared open standard: <https://agentskills.io>
- OpenAI Codex manual — Agent Skills: <https://developers.openai.com/codex/skills>
- OpenAI Codex manual — Plugins: <https://developers.openai.com/codex/plugins>
- Anthropic Claude Code — Skills: <https://docs.claude.com/en/docs/claude-code/skills>
- lccjs local skill inventory: [`skills.md`](./skills.md)
- Skill organization across repos/providers: [`skill-organization.md`](./skill-organization.md)

*This doc supersedes the earlier pairwise `codex-vs-claude-code-skills.md`, whose
content is preserved in the appendix above.*
