# Process Glossary — workflow / PM acronyms

_Audience: AI agents, contributors · Tier: reference_

Quick expansions of the **workflow / project-management** acronyms and role tags
used in tickets, commits, and agent replies.

> **Methodology terms are defined elsewhere (single source of truth).** The
> *concepts* behind the yegor-derived methodology terms — PDD, BDD, spike, epic,
> microtask, puzzle, velocity, architect/courier mode, "if it isn't in the
> tracker it didn't happen" — live in the canonical **yegor-pm `GLOSSARY.md`**
> (the `yegor-pm-skills` repo, symlinked into `~/.claude/skills/yegor-*`). This
> table only **expands the acronym** and points there; it does not re-define the
> method (which would drift). See the [glossary README](./README.md#process--methodology-terms-yegor-pm).

| Acronym | Expansion | In this project |
|---|---|---|
| **AC** | acceptance criteria | a ticket's definition-of-done checklist (the `- [ ]` boxes). **Not the same as `ARC`.** |
| **ARC** | architect | the architect **role tag** on a ticket (design, not implementation); "architect mode" is a yegor-pm concept → yegor-pm `GLOSSARY.md` |
| **ICE** | Impact × Confidence × Ease | the triage priority score (`I × C / E`); see the triage skills |
| **SSOT** | single source of truth | the one canonical place a fact lives (the tracker, `.env.example` contributor block, etc.) |
| **ADR** | Architecture Decision Record | a recorded design decision (`docs/adr/`, some `docs/research/`) |
| **TIL** | Today I Learned | a session-retrospective entry in `docs/learnings/` |
| **PDD** | Puzzle-Driven Development | the `@todo #N` puzzle workflow — *method:* → yegor-pm `GLOSSARY.md` |
| **BDD** | Bug-Driven Development | frame work as a complaint/bug — *method:* → yegor-pm `GLOSSARY.md` |
| **SPIKE** | — | a bounded (≤60 min) research/scoping investigation — *method:* → yegor-pm `GLOSSARY.md` |
| **PM** | project management | PM-role work / the `pm` commit scope |
| **DEV** | developer | implementation **role tag** |
| **WRITER** | — | documentation **role tag** |
| **RESEARCH** | — | investigation **role tag** (produces findings, not production code) |
| **COMBO** | — | a **role tag** for combined work (e.g. refactor + test) |
| **PDD/velocity/epic/microtask** | — | see yegor-pm `GLOSSARY.md` (methodology SSOT) |

**Role tags** (`PM`, `DEV`, `WRITER`, `RESEARCH`, `ARC`, `COMBO`) label the *kind*
of work a ticket represents and pick the velocity `role` field.

**See also:** [`domain.md`](./domain.md) (LCC/assembly acronyms) · [`tech.md`](./tech.md) (tooling acronyms)
