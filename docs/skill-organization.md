# Skill organization across repos and providers

Where skills should *live* so they stay discoverable and don't drift as they
multiply across providers (Claude Code, Codex, …) and repos. The companion doc
[`skill-portability.md`](./skill-portability.md) covers how to *translate* a skill
between providers; this doc covers *layout and single-source-of-truth*.

> **Last checked:** 2026-06-16, for the lccjs repo. The baseline below is what this
> repo and the local machine actually do today; the recommendation is the target.

---

## The two questions

1. **Repo-local vs user-global.** A skill that only makes sense inside one project
   (it knows that project's scripts, tickets, conventions) belongs **committed in
   that repo**, so it versions and travels with the code it serves. A skill that is
   useful everywhere (language idioms, document tooling, generic workflows) belongs
   **user-global**, shared across every project.
2. **One skill, many providers.** The same logical skill often has to be visible to
   more than one provider, each of which reads a *different* directory
   (`.claude/skills/` vs `.agents/skills/`, `~/.claude/skills/` vs `~/.agents/skills/`
   — see the [portability spokes](./skill-portability.md)). Storing a separate copy
   per provider is where drift starts.

---

## The lccjs baseline (what we do today)

Accurate as of 2026-06-16:

- **Project-specific workflow skills are committed in-repo, in the *Codex* layout.**
  lccjs tracks eight skills under **`.agents/skills/`** — `fruit-agent-orchestrate`,
  `guide-human-decision`, `issue-review`, `log-error`, `next-best-action`,
  `puzzle-triage`, `puzzle-velocity`, `write-til-doc` — each lccjs-specific (they
  encode this repo's tickets, scripts, and conventions). This is correct placement:
  project skills versioned with the project. (`#1307` records the first such port.)
- **There is no in-repo `.claude/skills/`.** So the ticket-era shorthand "lccjs ships
  zero project-level skills, all skills are user-global" is **not accurate** — the
  project *does* ship project skills; they live in the Codex dir, not the Claude dir.
- **Claude Code sees skills via a user-global symlink assembly.** `~/.claude/skills/`
  is not a folder of real skill files — it is a set of **symlinks** pointing at the
  real sources (a versioned `claude-config` skills repo, the user-global
  `~/.agents/skills/`, and a few other skill repos). When Claude Code runs in lccjs,
  the skills it offers come from that user-global assembly, **not** from the repo's
  `.agents/skills/`.

### The drift this creates

Because Claude reads the user-global assembly and Codex reads the repo's
`.agents/skills/`, a project skill that must serve **both** providers ends up with
**two copies**: a Codex-format copy committed in `.agents/skills/`, and a
Claude-format copy in the user-global `claude-config` source that `~/.claude/skills/`
links to. Two copies of one logical skill = two things to keep in step. This has
already bitten: `log-error` exists as both a tracked Codex copy and an untracked
Claude copy that can drift apart (`#1315`).

---

## Recommendation: single source of truth + sync

**Yes, the baseline should change** — not the *placement* (in-repo for project skills
is right), but the *duplication*. Keep **one source of truth per skill** and make
every provider directory a **link** to it, never a hand-maintained second copy.

1. **One authored copy per skill.** For a project skill, that copy is committed in the
   repo (today: `.agents/skills/<name>/`). For a user-global skill, it is one entry in
   the versioned skills repo (`claude-config`). Never two editable copies.
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
   (`puzzle-velocity` in `.agents/skills/`, `~/.claude/skills/`, and the source repo —
   not `puzzle-velocity` here and `velocity-tracker` there). The directory name is the
   identity; keep it stable across the move.

### Target layout (lccjs)

```
lccjs/.agents/skills/<name>/SKILL.md   ← source of truth for PROJECT skills (committed)
~/.claude/skills/<name>  → symlink →    one source (claude-config repo, ~/.agents/skills, or a repo)
~/.agents/skills/<name>/                user-global source for cross-project skills
```

No in-repo `.claude/skills/` is needed: Claude Code already gets project skills through
the user-global assembly. The work is to ensure each project skill has **one** editable
source and that the Claude-visible entry is a **link** to it, eliminating the
`log-error`-style double copy.

---

## See also

- [`skill-portability.md`](./skill-portability.md) — translating a skill between providers.
- [`skills.md`](./skills.md) — the local skill inventory.
