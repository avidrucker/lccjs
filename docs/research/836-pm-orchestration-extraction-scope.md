# SPIKE: Extraction Scope — PM/Agentic-Orchestration System

**Issue:** #836  
**Date:** 2026-06-05  
**Agent:** FIG  
**Role:** SPIKE

---

## Question

The lccjs repo has grown a substantial multi-agent PM/orchestration layer that has nothing to do with a 16-bit assembler. This spike scopes what it would take to extract that layer into a standalone, reusable home.

---

## Q1 — What is genuinely reusable vs lccjs-specific?

### Partition table

**Portability codes:**
- **A** — Fully portable; no lccjs references
- **B** — Portable with minor parameterisation (path constants, repo name)
- **C** — lccjs-specific; keep here

#### Scripts (`scripts/`)

| File | Lines | Portability | lccjs coupling notes |
|------|-------|-------------|----------------------|
| `claim.js` | 583 | **B** | One `.env` copy comment for oracle tests (line 521); comment ref to `docs/claude_workflow.md`; the `FRUITS` list is generic |
| `claim.sh` | ~30 | **B** | Thin shell wrapper for claim.js; delegates to Node |
| `close.js` | 773 | **B** | `~/.lccjs/velocity.db` path hardcoded (line 460); `pdd`-scan call is generic |
| `puzzle-status.js` | 338 | **A** | Zero lccjs-specific references; reads worktrees + GH issues generically |
| `velocity-log.js` | 222 | **B** | `~/.lccjs/velocity.db` default path (line 30); `repo: 'lccjs'` default (line 159); already supports `VELOCITY_DB` env-var override |
| `velocity-export.js` | 85 | **B** | `~/.lccjs/` path reference |
| `velocity-seed.js` | 184 | **B** | Schema + `~/.lccjs/` path; schema itself is generic |
| `velocity-migrate.js` | 61 | **B** | `~/.lccjs/` path |
| `run-pdd.sh` | ~15 | **A** | Just invokes `pdd` gem; no lccjs coupling |
| `setup-hooks.sh` | ~30 | **A** | Symlinks hooks; no lccjs coupling |
| `find-scripts.sh` | ~10 | **A** | Generic utility |
| `lccrun.sh` | ~30 | **C** | Wraps `lcc.js`/assembler/oracle with a timeout; lccjs-specific entirely |
| `build-site.js` | — | **C** | Builds the lccjs docs site |
| `migrate-test-fixtures.js` | — | **C** | Migrates lccjs test fixtures |
| `potato-token-test.js` | — | **C** | lccjs token fuzzer |
| `cluster-triage-proto.js` | — | **C** | References `docs/puzzle-clusters.csv` (lccjs-specific) |

**Summary:** 9 scripts portable (A/B), 5 lccjs-specific (C).

#### Git hooks (`scripts/git-hooks/`)

| Hook | Portability | Notes |
|------|-------------|-------|
| `pre-push` | **B** | Logic is generic (rebase guard, conflict marker check, pdd scan); has one `# Pre-push hook for lccjs` comment |
| `pre-commit` | **B** | Blocks `src/`, `scripts/`, `tests/` changes on main — those path prefixes are conventional but project-configurable |
| `commit-msg` | **A** | Rejects issue-ID scopes and compound types; no lccjs coupling |

#### Skills (`~/.claude/skills/`)

Skills already live globally — not in the lccjs repo. Partition for documentation purposes:

| Skill | Portability | Notes |
|-------|-------------|-------|
| `yegor-pm`, `yegor-pdd`, `yegor-bdd`, `yegor-tickets`, `yegor-velocity`, `yegor-microtasks`, `yegor-review`, `yegor-nohelp`, `yegor-architect`, `yegor-spikes`, `yegor-unit-tests` | **A** | Pure Yegor methodology; no project coupling |
| `fruit-agent-orchestrate` | **B** | Calls `npm run puzzle:status` and `git worktree list` (generic); references lccjs `docs/puzzle-clusters.csv` in its heuristics note |
| `puzzle-triage` | **A** | Generic ranking logic |
| `puzzle-velocity` | **B** | References `~/.lccjs/velocity.db` path in examples; logic is generic |
| `write-til-doc` | **A** | Generic TIL format |
| `handoff`, `handoff-archive` | **A** | Generic |
| `lccjs-assembly` | **C** | LCC ISA-specific; keep here |
| `lccplus-assembly` | **C** | LCC+ ISA-specific; keep here |

#### Docs (`docs/`)

| File | Portability | lccjs references | Notes |
|------|-------------|-----------------|-------|
| `claude_workflow.md` | **B** | 8 | Oracle mention, lccjs-specific examples; ~90% portable |
| `velocity-schema.md` | **B** | 6 | `~/.lccjs/` paths, `repo: 'lccjs'` default; ~85% portable |
| `puzzle-velocity.md` | **B** | 8 | Paths + cross-links to lccjs research; ~80% portable |
| `do-this-not-that.md` | **B** | 9 | `lccrun.sh` section and oracle invocation rules are lccjs-specific (2 of ~12 entries); the rest are generic workflow |
| `skills.md` | **B** | 7 | Lists lccjs-assembly/lccplus-assembly alongside generic skills; ~60% portable |
| `puzzle-lifecycle.md` | **B** | low | Structure generic; examples may reference lccjs |
| `design-agent-worktree-identity.md` | **A** | 0 | Pure identity/worktree protocol |
| `worktree-multi-agent-findings.md` | **A** | low | Generic findings |
| `pitfalls.md` | **C** | all | LCC assembly pitfalls |
| `lcc-isa.md`, `assembler.md`, `interpreter.md` etc. | **C** | all | LCC toolchain docs |
| `parity_deviations.md` | **C** | all | Oracle parity log |
| `learnings/` | **B/C** | mixed | TIL format is generic (B); individual entries reference lccjs details (C) |
| `research/808-orchestrate-*`, `research/827-second-wave-*` | **B** | low | PM/orchestration research; could travel |

#### RULES.md

| Rules | Portability | Notes |
|-------|-------------|-------|
| 1–3 | **A** | Destructive-command discipline |
| 4–5 | **A** | Worktree-per-task, velocity logging |
| 6 | **A** | Scope discipline |
| 7 | **A** | DB delete protection |
| 8–10 | **A** | Close protocol, issue-per-worktree, close-time ticket filing |
| 11 | **C** | `virtualFs` write-path testing — lccjs test harness specific |
| 12 | **A** | Tracker child issue requirement |
| 13 | **C** | `lccrun.sh` wrapper — lccjs-specific |
| 14–16 | **A** | Scope discipline, CSV+close commit, TIL format |
| 17–19 | **C** | `.hex`/`.bin` format, one mnemonic per line, `spawnSync` vs `inputBuffer` — lccjs-specific |
| 20 | **B** | `test.failing` convention — generic testing discipline, references lccjs tickets |

**Portable rules: 1–10, 12, 14–16 (14 of 20). lccjs-specific: 11, 13, 17–19 (5). Borderline: 20 (1).**

#### Velocity DB (`~/.lccjs/velocity.db`)

The schema is **fully generic**. It already has a `repo` column (`DEFAULT 'lccjs'`), added in #438 precisely to support multi-project use. The only coupling is the directory name `~/.lccjs/`. The scripts already support `VELOCITY_DB` env-var override, so the path is already parameterised.

---

## Q2 — What is the right extraction vehicle?

### Options evaluated

**Option A — New standalone repo (`pdd-tools` or `claude-pm`)**

Scripts published as a git repo; projects install via `npm install -D github:avidrucker/pdd-tools` or as a submodule. Each project's `package.json` delegates: `"claim": "pdd-tools claim"`.

- Pro: versioned per project, can diverge, full git history
- Con: dependency management overhead; scripts currently use `__dirname`-relative paths that assume colocation with the repo they manage

**Option B — Dotfiles section** (extending `~/dotfiles/install.sh`)

A `pdd` section installs scripts to `~/bin/pdd-*` and hooks to `~/.config/pdd/git-hooks/`. Projects symlink hooks and delegate `package.json` scripts to `~/bin/pdd-*`.

- Pro: simple, matches existing dotfiles pattern, no npm publishing
- Con: no per-project versioning; all projects share one version of the scripts; less discoverable

**Option C — npm package (`@avidrucker/pdd-tools`)**

Published to npm; pinned as a `devDependency`. Scripts invoked via `npx` or via `node_modules/.bin/`.

- Pro: clean versioning, installable by anyone
- Con: publishing friction; currently these scripts are in active flux (9 days of development, many breaking changes); premature to stabilise an API now

**Option D — Skill bundle only**

Skills stay in `~/.claude/skills/` (already global). Scripts stay per-project with README instructions.

- Con: doesn't solve the copy-per-project problem for scripts

### Recommendation

**Option B (dotfiles section) now, Option A (standalone repo) later.**

The scripts are too actively evolving for npm publishing. A dotfiles section gives immediate reuse without versioning complexity. Once the protocol stabilises (target: after 30+ project-days of multi-agent use), extract to a proper `pdd-tools` repo and have projects install it as a submodule or npm devDependency.

Proposed name: **`pdd-tools`** (reflects the PDD methodology, not an Anthropic product name).

---

## Q3 — What changes in lccjs post-extraction?

Under Option B (dotfiles):
- `scripts/claim.js`, `close.js`, `puzzle-status.js`, `velocity-*.js` move to `~/dotfiles/pdd/scripts/`
- `scripts/git-hooks/{pre-push,pre-commit,commit-msg}` move to `~/dotfiles/pdd/git-hooks/`
- lccjs `package.json` scripts stay identical; they call scripts via `node scripts/claim.js` — which becomes a thin wrapper or a symlink to `~/dotfiles/pdd/scripts/claim.js`
- `docs/claude_workflow.md`, `docs/velocity-schema.md`, `docs/puzzle-velocity.md`, `docs/design-agent-worktree-identity.md` move to `~/dotfiles/pdd/docs/` (or a `pdd-tools` repo); lccjs keeps symlinks or `See also: pdd-tools/docs/` references
- `RULES.md` splits: portable rules 1–10, 12, 14–16 go to `pdd-tools`; lccjs-specific rules 11, 13, 17–20 stay in `RULES.md` here with a preamble pointing to the shared base

Under Option A (standalone repo, later):
- lccjs adds `pdd-tools` as a git submodule at `pdd/`
- `package.json` script bodies become `node pdd/scripts/claim.js` etc.
- lccjs-specific additions (lccrun.sh, cluster-triage-proto.js) stay in `scripts/`

In both cases: skills already live in `~/.claude/skills/` and require no change.

---

## Q4 — Migration cost estimate

| Task | Effort (H) | Notes |
|------|-----------|-------|
| Create `pdd-tools` repo / dotfiles section; scaffold directory structure | 30m | Mechanical |
| Extract + parameterise 9 scripts (replace hardcoded `~/.lccjs` paths; add project-name config) | 90m | ~10m per script; `VELOCITY_DB` env-var is already done |
| Update lccjs `package.json` to delegate to extracted scripts | 30m | Thin wrapper or path change |
| Port 5 portable docs (find/replace `lccjs` → `{{project}}`; strip lccjs-specific sections) | 60m | 4 docs × 15m avg |
| Split `RULES.md` into shared base + lccjs overlay | 20m | 14 portable rules move out |
| Rename `~/.lccjs/` → `~/.pdd/` (or keep with `VELOCITY_DB` override) | 30m | DB migration + update all references |
| Smoke-test: claim + velocity:log + close in lccjs under new structure | 30m | End-to-end validation |
| **Total** | **~5h human** | **≈7–8 child issues at 30–45m each** |

---

## Open questions

1. **DB path:** Should `~/.lccjs/velocity.db` become `~/.pdd/velocity.db` (one global store) or `~/.pdd/lccjs/velocity.db` (per-project isolation)? The current `repo` column already enables multi-project analytics from one DB; a single store is likely the right model.

2. **Multi-project velocity analytics:** If multiple projects share one `~/.pdd/velocity.db`, how do per-project exports work? Does each project's `docs/puzzle-velocity.csv` export only its own rows (`WHERE repo = 'lccjs'`)? That filter already exists in the schema.

3. **fruit-agent-orchestrate references:** The skill's assignment heuristics mention `docs/puzzle-clusters.csv` (lccjs-specific). Does the extracted skill refer to a project-local `docs/puzzle-clusters.csv` by convention, or does it skip the cluster check when the file is absent?

4. **RULES.md split format:** Should the extracted shared rules live in a `RULES-PDD.md` that projects `include` (conceptually), or should projects maintain their own `RULES.md` with a preamble `# Shared rules: see pdd-tools/RULES.md`?

5. **Skills registry:** The yegor-* and puzzle-* skills live in `~/.claude/skills/` and are already shared. Should `pdd-tools` include an install script that symlinks or copies them, or do they stay as a manual install step?

6. **docs/learnings/ ownership:** TIL entries are project-specific in content but the format and README convention are generic. Does the TIL format doc (`write-til-doc` skill + `docs/learnings/README.md` template) belong in `pdd-tools`, with each project providing its own `docs/learnings/`?

7. **Stabilisation threshold:** How many project-days of multi-agent use before the scripts are stable enough to extract? Current trajectory suggests 30–60 days; a concrete threshold would prevent premature extraction.

---

## Recommended extraction order (when ready)

1. Extract velocity scripts first (`velocity-log.js`, `velocity-export.js`, `velocity-seed.js`) — lowest coupling, most useful standalone
2. Extract `puzzle-status.js` — already fully portable (class A)
3. Extract `claim.js` + `close.js` — highest value, most coupling to untangle
4. Port docs (claude_workflow.md, velocity-schema.md) — editorial work, no code risk
5. Split RULES.md — last, because it references the docs and scripts above

Closes #836
