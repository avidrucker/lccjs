# Skill organization across repos and providers

Where skills should *live* so they stay discoverable and don't drift as they
multiply across providers (Claude Code, Codex, …) and repos. The companion doc
[`skill-portability.md`](./skill-portability.md) covers how to *translate* a skill
between providers; this doc covers *layout and single-source-of-truth*.

> **Last checked:** 2026-06-17, for the lccjs repo. As of #1439 the target below is
> implemented: lccjs ships **no** repo-local skills; each skill lives in one
> per-runtime source-of-truth repo, symlinked into that runtime's discovery path.

---

## The two questions

1. **Repo-local vs user-global.** A skill that only makes sense inside one project
   (it knows that project's scripts, tickets, conventions) belongs **committed in
   that repo**, so it versions and travels with the code it serves. A skill that is
   useful everywhere (language idioms, document tooling, generic workflows) belongs
   **user-global**, shared across every project.
2. **One skill, many providers.** The same logical skill often has to be visible to
   more than one provider, each of which reads a *different* directory
   (`~/.claude/skills/` for Claude, `~/.codex/skills/` for Codex, `~/.hermes/skills/`
   for Hermes — see the [portability spokes](./skill-portability.md)). Storing a
   separate copy per provider is where drift starts.

---

## The lccjs baseline (current state)

As of **#1439**, lccjs ships **no repo-local skills**. Every skill lives in exactly
one per-runtime source-of-truth repo, symlinked into that runtime's real discovery
path:

| Runtime | Discovery path | Central source-of-truth repo |
|---|---|---|
| Claude Code | `~/.claude/skills/` (symlink assembly) | `claude-config` |
| Codex (OpenAI CLI) | `~/.codex/skills/` (auto-discovered) | `codex-config` |
| Hermes (nemotron) | `~/.hermes/skills/` (recursive scan) | `hermes-config` |

Each `~/.<runtime>/skills/<name>` is a **symlink** to the one on-disk copy in the
matching `*-config` repo, so editing the source updates the runtime in place. The
dotfiles `claude-skills` / `codex-skills` / `hermes` sections clone the repos and run
their installers.

> **Codex discovery correction (#1439).** Earlier revisions of this doc said Codex
> reads `.agents/skills/`. The installed Codex CLI (v0.139.0) does **not** — verified
> that `.agents/skills` occurs **0×** in the binary and that `codex debug prompt-input`
> lists skills only from `~/.codex/skills`. The lccjs `.agents/skills/` "Codex ports"
> were therefore **vestigial** (nothing loaded them); #1439 relocated them to
> `codex-config` → `~/.codex/skills/` and removed `.agents/skills/` from the repo.

### History (what we used to do, and why it changed)

Until #1439, lccjs committed eight "Codex ports" under `.agents/skills/` (`#1307`
recorded the first), on the theory that Codex discovered them there. That created a
per-runtime **drift surface**: the same logical skill maintained as separate copies
in `.agents/skills/`, the `claude-config` source, and `hermes-config`. It bit
repeatedly — `log-error` drifted between its tracked Codex copy and an untracked
Claude copy (`#1315`); see also `#1316`, `#1425`, `#1438`. The fix was to stop
committing skills in the project repo entirely and make each runtime's `*-config`
repo the single source for that runtime's port.

---

## Principle: one source of truth per runtime + links

The implemented model keeps **one authored copy per runtime per skill** and makes every
runtime's discovery directory a **link** to it, never a hand-maintained second copy.

1. **One authored copy per runtime.** Each runtime's port lives once, in that runtime's
   `*-config` repo (`claude-config` / `codex-config` / `hermes-config`). Never two
   editable copies of the same port. (Distinct *ports* per runtime are an accepted cost
   while the formats differ; collapsing to a single shared source + per-runtime
   generator is a possible future step.)
2. **Provider dirs are links, not copies.** Surface the one source into each provider's
   directory with a **symlink** (the mechanism `~/.claude/skills/` already uses) or a
   scripted **sync** step, so editing the source updates every provider at once. A
   skill that is byte-identical across providers links directly; a skill that needs
   provider deltas keeps the *core* shared and applies the delta at the link/sync step
   (see [portability](./skill-portability.md)).
3. **Make the link direction explicit and one-way.** Decide which path is the source
   and which is the link, and write it down per skill — so no one edits the link copy
   and silently forks it. A periodic check (`git status` in the source repo;
   `ls -l ~/.claude/skills/` to confirm entries are still symlinks) catches a copy that
   has detached from its source.
4. **Naming for discoverability.** Use the **same `<name>`** for a skill across every
   provider directory so it is greppable and obviously "the same skill" everywhere
   (`puzzle-velocity` in `~/.claude/skills/`, `~/.codex/skills/`, and each source repo —
   not `puzzle-velocity` here and `velocity-tracker` there). The directory name is the
   identity; keep it stable across the move.

### Layout (achieved, #1439)

```
~/Documents/claude-config/skills/<name>/SKILL.md   ← Claude source of truth
~/Documents/codex-config/skills/<name>/SKILL.md    ← Codex source of truth
~/Documents/hermes-config/skills/<name>/SKILL.md   ← Hermes source of truth
~/.claude/skills/<name>  → symlink → claude-config/skills/<name>
~/.codex/skills/<name>   → symlink → codex-config/skills/<name>
~/.hermes/skills/<name>  → symlink → hermes-config/skills/<name>
lccjs/                   — ships NO skills (no .agents/skills, no .claude/skills)
```

`yegor-pm` and the yegor-* family come from their own upstream (`yegor-pm-skills`),
symlinked into `~/.claude/skills/`. Project-coupling (a skill that hardcodes lccjs
paths like `npm run claim` or `~/.lccjs/lccjs.db`) is being addressed separately by
making such skills read a per-repo config so they work in any repo.

---

## See also

- [`skill-portability.md`](./skill-portability.md) — translating a skill between providers.
- [`skills.md`](./skills.md) — the local skill inventory.
