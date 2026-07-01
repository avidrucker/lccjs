# Docs — Audience & Tier Index

_Audience: AI agents, contributors · Tier: reference-only_

The authoritative classification of every project doc on **two axes** — who it's
for (**audience**) and how important it is (**tier**) — plus the labeling
conventions that keep the two straight. Child of #1570 (D1); reconciles the
prior #1123 Pages audit and the onboarding docs.

## The two axes

### Axis A — Tier (importance)

| Tier | Meaning |
|------|---------|
| **Required** | read before contributing / using in earnest |
| **Recommended** | read when relevant; not gating |
| **Reference** | consult on demand |
| **Public** | deployed to the public GitHub Pages site (via `scripts/build-site.js` `DOCS_SECTIONS`) |

A doc may hold several tiers (e.g. Required **and** Public).

### Axis B — Audience (who it's for)

| Code | Audience | For |
|------|----------|-----|
| **AI** | AI agents | the "for-AI" side — workflow / process / harness docs written for the coding agents |
| **L** | Students / learners | people learning assembly & how a toolchain works |
| **E** | Assembly enthusiasts | hobbyists / power users of the ISA |
| **C** | Contributors | developers working on lccjs itself |
| **T** | Educators / teachers | people teaching with lccjs |

Human personas (L / E / C / T) track [`who_lccjs_is_for.md`](./who_lccjs_is_for.md);
**AI** is the fifth, "for-AI" audience. A doc may serve several audiences or one.

> **⚑ Orphan rule:** a doc that fits **no** audience is listed under
> [Orphans & retire-candidates](#orphans--retire-candidates) for the maintainer
> to decide — **flagged, never deleted** by an agent.

## The three labeling mechanisms

1. **Per-doc header line** (source of truth). Immediately under the H1:
   `_Audience: <list> · Tier: <list>_`. Local, survives file moves,
   human- and machine-readable.
2. **Public-site = the human divider.** `build-site.js DOCS_SECTIONS` is the
   deliberate "written for people" boundary: **published ⇒ human audience**
   (L/E/T); **unpublished ⇒ internal / for-AI-and-contributors** (AI/C). See
   [Public-Pages reconciliation](#public-pages-reconciliation).
3. **This index** — the single audience-grouped view below.

---

## Master classification — root & top-level `docs/*.md`

| Doc | Tier(s) | Audience(s) |
|-----|---------|-------------|
| `README.md` | Required · Public | L E C T |
| `CLAUDE.md` | Required | AI C |
| `RULES.md` | Required | AI C |
| `onboarding.md` | Required | C L |
| `docs/orientation.md` | Required | C |
| `docs/who_lccjs_is_for.md` | Required · Public | L E T |
| `docs/claude_workflow.md` | Required | AI C |
| `ROADMAP.md` | Recommended | C E |
| `docs/agent-patterns.md` | Recommended | AI C |
| `docs/do-this-not-that.md` | Recommended | AI C |
| `docs/project-gotchas.md` | Recommended | AI C |
| `docs/pitfalls.md` | Recommended · Public | L E |
| `docs/common-workflows.md` | Recommended | C AI |
| `docs/skills.md` | Recommended | AI C |
| `docs/issue-commenting-policy.md` | Recommended | AI C |
| `docs/issue-title-convention.md` | Recommended | AI C |
| `docs/lcc-isa.md` | Reference · Public | L E T |
| `docs/lccplus-isa.md` | Reference · Public | L E T |
| `docs/lccjs-unique-features.md` | Reference · Public | L E T |
| `docs/tutorial_01_intro.md` | Recommended · Public | L T |
| `docs/dynamic-memory.md` | Reference · Public | L E |
| `docs/parity_deviations.md` | Reference · Public | E C |
| `docs/assembler.md` | Reference | C E |
| `docs/interpreter.md` | Reference | C E |
| `docs/linker.md` | Reference | C E |
| `docs/lcc.md` | Reference | C |
| `docs/assemblerplus.md` | Reference | C E |
| `docs/interpreterplus.md` | Reference | C E |
| `docs/lccplus.md` | Reference | C E |
| `docs/core-behavior-matrix.md` | Reference | C AI |
| `docs/cross-cutting-concerns.md` | Reference | C AI |
| `docs/api.md` | Reference | C E |
| `docs/oracle-setup.md` | Reference | C |
| `docs/showcase-local-dev.md` | Reference | C |
| `docs/site-generation.md` | Reference | C |
| `docs/web-feature-parity.md` | Reference | C |
| `docs/status.md` | Reference | C E |
| `docs/debugger-command-registry.md` | Reference | C E |
| `docs/error-ids.md` | Reference | C AI |
| `docs/errors-lookup.md` | Reference | AI C |
| `docs/errors-schema.md` | Reference | AI C |
| `docs/velocity-schema.md` | Reference | AI C |
| `docs/puzzle-lifecycle.md` | Reference | AI C |
| `docs/puzzle-velocity.md` | Reference | AI C |
| `docs/ticket-lifecycle-spec.md` | Reference | AI C |
| `docs/claim-ref-housekeeping.md` | Reference | AI C |
| `docs/project-initiatives.md` | Reference | C AI |
| `docs/artifact-quality-criteria.md` | Reference | AI C |
| `docs/skill-organization.md` | Reference | AI C |
| `docs/skill-portability.md` | Reference | AI C |
| `docs/design-agent-worktree-identity.md` | Reference | AI C |
| `docs/worktree-multi-agent-findings.md` | Reference | AI C |
| `docs/lccjs-assembly-skill-design.md` | Reference | AI C |
| `docs/lccjs-assembly-skill-validation.md` | Reference | AI C |
| `docs/cuh63-*-bug-report.md` (8 files) | Reference · (curated) Public | E C |
| `reports_summary.md` | Reference | C E |
| `open_bugs.md` | Reference | AI C E |
| `current_issues.md` | Reference | AI C |
| `TODOS.md` | Reference | AI C |

## Subdirectory buckets

| Directory | Files | Tier(s) | Audience(s) | Notes |
|-----------|-------|---------|-------------|-------|
| `docs/guides/` | 4 | Public | L E T | deployed |
| `docs/glossary/` | 5 | Reference · Public | L E T | deployed |
| `docs/cuh63/` | 15 | Reference · (curated) Public | E C | oracle bug reports |
| `docs/research/` | 133 | Reference | AI C | internal spikes; **#1123 recommends curating ~10–15 for Public** |
| `docs/learnings/` | 173 | Reference | AI C | agent TILs; **#1123 recommends curating ~5–15 for Public** |
| `docs/adr/` | 1 | Reference | C AI | architecture decisions |
| `docs/agent-priorities/` | 4 | Reference | AI | per-agent priorities |
| `docs/logs/` | 2 | Reference | AI C | work logs |
| `docs/retros/` | 2 | Reference | AI C | retrospectives |
| `docs/handoffs/` | 1 | Reference | AI C | session handoffs |
| `docs/themes/` | 1 | Reference | C | site theming |
| `docs/www/` | 5 | Reference | C | site source |
| `docs/userscript/` | 1 | Reference | E C | user script |
| `docs/site/` | 268 | — | — | **generated build output — not classified (not source)** |

## Orphans & retire-candidates

Surfaced for the **maintainer's** decision — none deleted by the agent.

### True orphans (no current audience)
- **`docs/codex-vs-claude-code-skills.md`** — title is literally "Codex vs Claude Code Skills — **moved**"; content appears relocated. Serves nobody as-is → **retire or redirect**.

### Superseded (audience fulfilled by newer work)
- **`docs/github-pages-docs-audit.md`** — the #1123 point-in-time Pages audit; **this index supersedes it**. Keep only as historical record, or retire.

### Stale point-in-time snapshots (weak historical-only audience)
Dated one-shot artifacts whose only remaining audience is "contributor reading history." Candidates to move to an archive folder rather than sit in top-level `docs/`:
- `docs/backlog-triage-2026-06-03.md`
- `docs/test-suite-snapshot-2026-06-04.md`
- `docs/init_code_review.md` (May 2026 review)
- `docs/improving-data-analysis-research.md`
- `docs/lccplus-mnemonic-brainstorm.md` (brainstorm, likely mined out)
- `docs/deep-code-review-claude-2026-06-03.md`, `docs/orchestration-review-2026-06-16.md` (currently untracked)

## Public-Pages reconciliation

Current deploy set (`scripts/build-site.js` `DOCS_SECTIONS`): whole folders
`guides/`, `research/` (133), `learnings/` (173), `glossary/`, plus an explicit
`parity` file list (`lccjs-unique-features.md`, `parity_deviations.md`, 5 cuh63
reports).

**Discrepancy with #1123:** the audit recommended deploying only ~10–15 curated
pages from `research/` and `learnings/`; the build still ships **all** of both
folders (~306 internal pages, many with agent codenames / velocity minutiae).

**Recommendation (maintainer decision — feeds #1570 D1):** apply the #1123
curation — replace the `research/` and `learnings/` folder deploys with explicit
curated file lists. **Implementing the `build-site.js` change is a separate DEV
child** (this index only records the decision).

## Required-onboarding set (explicit)

Every new contributor/agent should read, in order:

1. `README.md` — what LCC.js is
2. `docs/who_lccjs_is_for.md` — find your persona
3. `onboarding.md` / `docs/orientation.md` — the 2-minute tour
4. `CLAUDE.md` — repo conventions & architecture
5. `docs/claude_workflow.md` — the per-puzzle protocol
6. `RULES.md` — the hard rules

## Related

- [`who_lccjs_is_for.md`](./who_lccjs_is_for.md) — persona anchor for L/E/C/T
- [`github-pages-docs-audit.md`](./github-pages-docs-audit.md) — the #1123 audit this supersedes
- [`site-generation.md`](./site-generation.md) — how the public site is built
- #1570 (parent decision), #1123 (Pages audit), #1568 (cross-cutting-concerns)
