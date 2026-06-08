# Review: HONEYDEW's Codex-vs-Claude-Code Skills Doc (#1188)

**Ticket:** #1199 (RESEARCH) · **Reviewer:** FIG (Claude) · **Date:** 2026-06-07
**Under review:** `docs/codex-vs-claude-code-skills.md` (commit `f7b2448`, closed #1188 by Codex agent HONEYDEW)

## TL;DR

The doc is **accurate and ships the #1188 spec** — locations, invocation syntax, frontmatter, plugin/distribution, and a porting checklist are all present and, where checkable, correct. I found **no factual errors**. Every Claude Code frontmatter field it names (`disable-model-invocation`, `user-invocable`, `allowed-tools`) is real, and its nuanced claim that `name` "can come from the directory" is exactly right per the official docs.

The gaps are **omissions, not mistakes** — and one of them is significant: **both tools explicitly build on the same open standard (agentskills.io)**, which the doc never mentions. That single fact reframes the whole comparison (porting is mostly trivial; the differences are each tool's *extensions* to a shared base). Recommended next steps are small and additive; no rewrite is warranted.

**Verdict:** Sound doc, keep it. Apply ~4 additive enhancements + 1 discoverability link.

---

## How this was verified

| Source | Used for |
|---|---|
| `docs/codex-vs-claude-code-skills.md` | the deliverable itself |
| 74 installed `SKILL.md` files under `~/.claude/skills/` | which frontmatter fields are real & used in practice |
| `code.claude.com/docs/en/skills` (official Claude Code skills docs) | authoritative Claude Code frontmatter/location/invocation facts |
| `developers.openai.com/codex/skills` (the doc's own cited Codex source) | confirming the Codex half |
| `docs/skills.md`, repo grep | discoverability / placement |

---

## 1. Accuracy — Claude Code half (verified against official docs)

Everything the doc asserts about Claude Code holds up:

- **Locations** — Project `.claude/skills/<name>/SKILL.md`, user `~/.claude/skills/<name>/SKILL.md`. ✅ Matches docs exactly.
- **Invocation `/skill-name`** plus model auto-invocation. ✅
- **`description` is the key selector; the command name can come from the directory.** ✅ The official reference says `name` is **not required** and "Defaults to the directory name"; the directory name (not `name`) sets what you type after `/`, except for a plugin-root `SKILL.md`. The doc captured this subtle point correctly — better than most summaries do.
- **Claude-specific controls `disable-model-invocation`, `user-invocable`, `allowed-tools`** — all three are real fields. (I initially suspected `user-invocable` was invented because **0 of the 74** installed skills use it; the official docs confirm it is a genuine field — default `true`, set `false` to hide from the `/` menu. Lesson: absence in-repo ≠ nonexistent.)
- **Dynamic context injection** and **live file-watching** — both real Claude Code features. ✅

One **minor imprecision** worth a one-line fix: the doc says "Plugin-level changes may still require a plugin reload." The actual rule is narrower — *editing* an existing skill is live within the session; creating a **new top-level skills directory that didn't exist at session start** requires a restart. Low stakes.

## 2. Accuracy — Codex half (verified against the doc's cited source)

I fetched the doc's own cited URL (`developers.openai.com/codex/skills`). The Codex claims are **confirmed**: the four scopes (`.agents/skills`, `~/.agents/skills`, `/etc/codex/skills`, system), `name`+`description` frontmatter, `$skill` / `/skills` invocation, and optional `agents/openai.yaml` with `allow_implicit_invocation` (default `true`) all match. No Codex install exists in this repo, so this rests entirely on the cited docs — but those docs corroborate the doc verbatim.

## 3. The one material omission: the shared open standard

Both pages independently state they **build on the same open Agent Skills standard (agentskills.io)**:

- Claude docs: *"Claude Code skills follow the Agent Skills open standard, which works across multiple AI tools. Claude Code extends the standard with … invocation control, subagent execution, and dynamic context injection."*
- Codex docs: *"Codex skills build on the open agent skills standard."*

The deliverable's "Shared model" section observes that both use `SKILL.md` but never names the **formal common standard**. This matters because it changes the doc's thesis: the two systems aren't parallel inventions that happen to look alike — they're the **same base standard plus per-tool extensions**. That makes the real, durable guidance: *"the `SKILL.md` core ports as-is; only each tool's extensions need translation."* Adding this would make the porting checklist more trustworthy and shorter to reason about.

## 4. Completeness gaps vs. #1188 spec (all additive)

The spec (locations, invocation, frontmatter/config, plugin/distribution, migration notes) is **substantially met**. Smaller gaps:

- **Claude frontmatter fields omitted** — the doc lists a representative subset. Real fields not mentioned: `when_to_use`, `argument-hint`, `arguments` (+ `$ARGUMENTS`/`$name` substitution), `disallowed-tools`, `model`, and `context: fork` + `agent` (subagent execution). Fine for a comparison overview, **but the porting checklist step "Remove or rewrite Claude-only frontmatter such as `allowed-tools`, `user-invocable`, and `disable-model-invocation`" reads as exhaustive when it isn't** — worth a "(non-exhaustive; see official reference)" hedge.
- **Asymmetric plugin depth** — the Codex plugin story is rich (apps, MCP, hooks, assets, marketplace); the Claude side is hand-waved as "Skills and plugins are Claude Code environment concepts." The concrete Claude mechanism is omittted: add `.claude-plugin/plugin.json` to a skill folder → it loads as a plugin `<name>@skills-dir` and can bundle agents, hooks, and MCP servers. Filling this in would balance the table.
- **Custom commands ≡ skills** — Claude Code merged custom commands into skills: `.claude/commands/deploy.md` and `.claude/skills/deploy/SKILL.md` both create `/deploy`. A migration-notes doc should mention legacy `.claude/commands/` still works.
- **Repo-grounding** — the doc says lccjs "refers to global skills under `~/.claude/skills/`." Confirmed *and* worth stating outright: **this repo ships zero project-level `.claude/skills/`; all 74 skills are user-global.** A reader porting *this project's* skills should know there's nothing committed under the repo to move.

## 5. Placement / discoverability — the highest-ROI fix

`docs/codex-vs-claude-code-skills.md` is **linked from nowhere** (repo grep finds no inbound reference). The natural home is `docs/skills.md`, whose first line is literally *"Skills live globally at `~/.claude/skills/`."* A reader there has exactly the question this doc answers. One cross-link makes the doc findable; without it the doc risks the very fate #1188 set out to prevent ("future agents cannot reference it from the repo docs").

---

## Recommendations / next best steps (prioritized)

1. **[do now, trivial] Add a discoverability link.** One line in `docs/skills.md` (and optionally a docs index/README) pointing to `docs/codex-vs-claude-code-skills.md`. Highest ROI; without it the doc is orphaned. *Out of #1199's review-only scope — file as a `docs` micro-ticket or fold into rec #2.*
2. **[file a ticket] Additive enhancement pass** on the doc: (a) name the shared **agentskills.io open standard** and reframe porting around "shared core + per-tool extensions"; (b) flesh out the **Claude plugin mechanism** (`.claude-plugin/plugin.json` → `<name>@skills-dir`); (c) note **custom-commands-merged-into-skills**; (d) hedge the porting checklist's frontmatter list as non-exhaustive and fix the "plugin reload" line. Est ~20m, WRITER. *Edits the deliverable, so it belongs in its own ticket, not #1199.*
3. **[optional] Add the omitted frontmatter fields** (`when_to_use`, `argument-hint`, `arguments`, `disallowed-tools`, `model`, `context: fork`) as a short reference table — only if the doc is meant to be authoritative rather than orientational. Lower priority; the official reference already covers them.
4. **[no action needed]** No factual corrections required, and **#1188 should stay closed** — it delivered its spec. These are enhancements, not a reopen.

**Follow-up filed:** recs 1 + 2 are captured in **#1210** (WRITER: link + enrich the doc). Rec 3 is noted there as optional; rec 4 is "no action."

## Scope note

Per #1199, this pass is review + findings only. I did **not** edit `docs/codex-vs-claude-code-skills.md` or reopen #1188. Recs 1–3 are proposed follow-up work, to be filed as their own tickets.
