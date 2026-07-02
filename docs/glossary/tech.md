# Tech Glossary — tooling / engineering acronyms

_Audience: contributors, AI agents · Tier: reference_

Quick expansions of the general **tooling / engineering** acronyms used across the
repo (not LCC-domain — those are in [`domain.md`](./domain.md)).

| Acronym | Expansion | In this project |
|---|---|---|
| **CLI** | command-line interface | the `node ./src/cli/lcc.js …` entry points |
| **API** | application programming interface | the programmatic in-memory surface ([`api.md`](../api.md)) |
| **CI** | continuous integration | the GitHub Actions build/test pipeline |
| **CM6** | CodeMirror 6 | the code-editor library powering the web playground / showcase |
| **TOCTOU** | time-of-check to time-of-use | a race-condition class — state changes between checking it and acting on it (e.g. the claim-guard cross-clone races) |
| **TTY** | teletype (terminal) | interactive-terminal detection; a bare tool call can hang without one — wrap with `scripts/lccrun.sh` |
| **EOF** | end of file | stdin / interpreter input termination |
| **DDD** | Domain-Driven Design | the architecture-refactor lens (pure-seam boundary; epic #1540) |
| **SHA** | secure hash algorithm | in practice, a git commit hash (e.g. the `closed_commit` reference) |
| **CSV** | comma-separated values | the read-only velocity/error DB mirrors (`docs/*.csv`) |
| **DB** | database | the SQLite store `~/.lccjs/lccjs.db` (velocity + errors) |
| **JSON** | JavaScript Object Notation | the row payloads for `velocity:log` / `error:log`; `gh --json` output |
| **ASCII** | American Standard Code for Information Interchange | the character set the ISA I/O traps operate on |
| **ROI** | return on investment | used in scoping/spikes to justify effort |

**See also:** [`domain.md`](./domain.md) (LCC/assembly acronyms) · [`process.md`](./process.md) (workflow acronyms)
