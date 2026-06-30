# Project Initiative Overview — lccjs

**Issue:** #952 · **Role:** RESEARCH · **Agent:** FIG · **Model:** sonnet-4.6
**Date:** 2026-06-06
**Refreshed:** 2026-06-29 · **Agent:** APPLE · **Model:** opus-4.8 · for #1217 (epic taxonomy)

---

## Purpose

This document catalogues every active initiative in the lccjs project at a high level. It serves two goals:

1. **(Original, 2026-06-06)** Inform a deliberate focus/prioritization decision: if 3–4 things done well beats 6–8 done poorly, which 3–4 should they be?
2. **(Refresh, 2026-06-29 — #1217)** Define the **feature-level epic set 1:1**. Each initiative judged "major" enough becomes one `EPIC:` tracker issue that collects its open work. The area labels (`area:toolchain`, `area:process`, …) are too coarse for this — `area:process` alone spans 81 of 114 open issues across orchestration, skill-ports, RULES, pmtools migration, and telemetry.

Sources mined (original): ROADMAP.md, CLAUDE.md, open issue list, recent 80 commits, `docs/research/`, `docs/status.md`, `stats/README.md`, tier tracker issues (#428–#430). Refresh adds: the live 114-issue open set (2026-06-29), the Hermes/Codex skill-port work (#1065–#1226), the pmtools PM-harness migration (#1456 + ICE #1526–#1528), and the RULES.json source-of-truth system (#1521).

---

## What changed since the 2026-06-06 enumeration (refresh for #1217)

The original listed **10 initiatives**. Reality has moved on, so three repartitions were applied:

- **Core toolchain (orig #1) split into three** — the `ilcc` interactive debugger and the verbose-errors/`--explain` diagnostics work have each grown a distinct ticket cluster and a distinct "done" shape, so they are lifted out of "core correctness" into their own initiatives (the #1217 ticket flagged exactly this candidate split).
- **Agentic orchestration (orig #7) split into four** — what was one "process infrastructure" bucket is now four separately-trackable efforts: the **core orchestration/claim-close workflow**, the **skill ecosystem & cross-provider ports** (Hermes/Codex — did not exist at 2026-06-06), the **PM-harness migration to `pmtools`** (the current `priority:critical` thrust, #1456), and the **RULES system** (`RULES.json` source-of-truth + mint/maintain/render, #1521).
- **Everything else kept** — architecture/DDD, test infra, web, education, data/telemetry, human-decision queue, and upstream comms carry forward largely unchanged.

Net: **13 active initiatives + 2 debt categories** (was 10). The debt categories (human-decision queue, upstream comms) are *not features* — whether they warrant an `EPIC:` tracker or stay as labels/existing narrow trackers is the human call captured in #1217's acceptance.

---

## All active initiatives (enumerated)

### A. Product / toolchain features

#### 1. Core toolchain correctness & oracle parity

**What:** Assembler/linker/interpreter bug-fixes to match the reference `cuh63/lcc` oracle. Differential testing, parity-deviation docs, shift/div/sext edge cases. **Done shape:** converging but unbounded (oracle has undiscovered bugs too). **Zombie risk:** low. **Open tickets (sample):** #517/#518 (shift-count masking), #1378 (div/rem guard), #1402 (sext probe), #1481 (`--oracle-compat`).

#### 2. Interactive debugger — `ilcc` *(split out of #1)*

**What:** The `-i` stepping debugger (`src/interactive/`): step/run/breakpoints, reverse-step, replay-input log, statechart modelling. **Done shape:** feature-by-feature; reverse-step is the current arc. **Open tickets:** #1088 (`g` + breakpoints), #1129 (reverse step), #1405/#1532 (`{-N}` friendly alias + decision), #980 (statechart spike), #1135 (relabel).

#### 3. Verbose errors & `--explain` / diagnostics *(split out of #1)*

**What:** Friendly diagnostics — "did you mean?" suggestions, stable error IDs, char-literal message fixes, `--explain` forwarding. **Done shape:** coverage-driven (per-diagnostic). **Open tickets:** #891 (did-you-mean coverage tracker), #1480 (stable error IDs), #1479 (char-literal messages), #1266 (review `--explain` LCC+ forwarding).

#### 4. LCC+ extended toolchain

**What:** `.ap` dialect — extended pseudo-instructions (sound mnemonics, `clear`/`sleep`/`cursor`/…), games, and the unbuilt `src/plus/linkerplus.js`. **Done shape:** unbounded (per-mnemonic) + one big milestone (the linker). **Open tickets:** #1492/#1493 (register-flexible sound mnemonics), #1444 (port LCC+ trap handlers onto base registry).

#### 5. Architecture / DDD refactoring (the pure-seam boundary)

**What:** Pure in-memory APIs (typed errors, no I/O) vs CLI wrappers; table-driven interpreter trap/eopcode registry; interpreter decomplect; DDD naming. **Done shape:** tiered (#428–#430), staged. **Open tickets:** #252 (decomplect H1b), #428–#430 (Tier 3/4/5 trackers), #1443/#1445/#1447 (trap registry + tests + Charlie sign-off).

#### 6. Test infrastructure

**What:** Jest suite, oracle-parity e2e + golden cache, potato fuzzing (#589/#590), test-runner (`lcc --test`), Lezer grammar tests. **Done shape:** bounded tickets. **Open tickets:** #1402/#1406 (oracle probes/report), #1276/#1336 (test-runner reviews), #1481 (oracle-compat), label-area test #1058.

#### 7. Web / browser experience (playground & site)

**What:** Browser playground edit-assemble-run, syntax-highlighted demo site, Pages deploy, `lcc.bundle.js`, code-in-slides injector. **Done shape:** near parity; ship-it pending. **Open tickets:** #677 (browser execution tracker), #707 (web-vs-dashboard parity).

#### 8. Educational content & curriculum

**What:** Tutorial, textbook (`docs/cuh63/`), ISA refs, pitfalls, demoA–Z, LCC+ games, slides. **Done shape:** partially defined; no graduation criterion. **Open tickets:** few currently open (mostly shipped); cross-listed with #4/#7. *(Candidate to keep as a roadmap section rather than an epic — low open-ticket count.)*

### B. Process / meta initiatives

#### 9. Agentic orchestration & multi-agent workflow

**What:** Fruit-agent system, claim/close scripts, worktree-per-task, `fruit-agent-orchestrate` skill, worktree/branch naming scheme, work-sequencing recommender. **Done shape:** evolving. **Open tickets:** #625/#633/#1035/#1115 (claim/close mechanics), #1046–#1048/#1200/#1201/#1211 (orchestrate skill), #1213 (sequencing), #1461/#1465 (`br-`/`wt-` naming), #1534 (uncategorized-claim gate).

#### 10. Skill ecosystem & cross-provider ports *(NEW — split out of #9)*

**What:** Porting Claude skills to **Hermes** (nemotron) and **Codex** formats, skill portability across providers (agentskills.io), `-hermes` disambiguation, config-driven generalization so skills work in any repo. **Done shape:** per-skill port + verify. **Open tickets:** #1065 (9-skill Hermes convert), #1081–#1084/#1156 (Hermes verifies), #1105/#1126/#1166/#1226 (audit/hygiene/suffix), #1210 (portability), #1220/#1426 (Hermes model spike), #1440 (config-driven generalization), #1315 (log-error dup/drift).

#### 11. PM-harness migration → `pmtools` *(NEW — split out of #9; current `priority:critical` thrust)*

**What:** Migrate lccjs's bespoke PM commands (claim/close/velocity/error/status) onto the shared, portable **`pmtools`** harness; ICE-scoring port; lccjs↔pmtools lifecycle-parity. **Done shape:** tracked migration with a no-regression gate. **Open tickets:** #1456 (migration tracker, `priority:critical`), #1466 (no-regression gate), #1518 (lifecycle parity), #1526–#1528 (portable ICE + `ice-triage` skill + `storage.ice`).

#### 12. RULES system *(NEW — split out of #9)*

**What:** `RULES.json` as source-of-truth for project rules; mint/maintain/render pipeline; the "logged lesson → durable rule" promotion loop. **Done shape:** spike → extract a standalone config-driven system. **Open tickets:** #1521 (extract rules mint/maintain/render), #1029 (promotion loop for non-TIL lessons), #1202 (promote TIL #1197 rule-lines).

#### 13. Data analysis, velocity & error telemetry

**What:** `stats/` notebooks (H/C calibration, throughput), the velocity DB, the errors table, context-row normalization, CSV-mirror hygiene. **Done shape:** unbounded (meta). **Zombie risk:** med-high. **Open tickets:** #838 (activity viz), #1033 (velocity migration-shim retire), #1144 (self-audit efficacy), #1234 (detect missing `error self-audit:`), #1411 (normalize malformed context rows), #1484 (untrack velocity CSV), #1030 (STALE_READ).

### C. Debt / waiting categories (not features — epic-or-label is the human call)

#### 14. Human-decision / review queue

**What:** Tickets blocked on the owner's input — formatter rulings, RULES adoption, artifact-quality criteria, busywork-flagging, scratch-file cleanup policy. **Cross-cutting** (each belongs to a feature too). **Zombie risk:** high. **Open tickets:** #636/#681/#741/#841/#968/#1002 + every `human-decision-required`/`human-required`-labelled ticket. *(Recommend: keep as the `human-decision-required` **label** + a single review meta-issue, not a feature epic.)*

#### 15. Upstream communications (cuh63 → Prof. Dos Reis)

**What:** Bug reports about the OG LCC binary. **Done shape:** bounded; mostly waiting on the owner to send. **Open tickets:** #40/#159 (old upstream tracking), #507 (long-line report), #867/#868 (sra shift-by-zero), #1406 (outstanding-oracle-bugs tracker). *(Candidate: fold under #1 as a sub-section, or a single narrow tracker — already #1406.)*

---

## Summary table

| # | Initiative | Class | "Done" shape | Zombie risk | Epic candidate? |
|---|-----------|-------|-------------|-------------|-----------------|
| 1 | Core toolchain & oracle parity | feature | Converging | Low | ✅ strong |
| 2 | Interactive debugger (`ilcc`) | feature | Per-feature | Low | ✅ strong |
| 3 | Verbose errors & `--explain` | feature | Coverage | Low | ✅ strong |
| 4 | LCC+ extended toolchain | feature | Unbounded + linker | Low | ✅ strong |
| 5 | Architecture / DDD refactoring | feature | Tiered/staged | Low-med | ✅ strong |
| 6 | Test infrastructure | feature | Bounded | Low | ✅ strong |
| 7 | Web / browser experience | feature | Near-parity | Med | ✅ strong |
| 8 | Educational content & curriculum | feature | Unbounded | Med | ⚠️ low open count |
| 9 | Agentic orchestration & workflow | process | Evolving | Med-high | ✅ strong |
| 10 | Skill ecosystem & cross-provider ports | process | Per-skill | Med | ✅ strong |
| 11 | PM-harness migration (pmtools) | process | Tracked migration | Low | ✅ strong (critical) |
| 12 | RULES system | process | Spike→extract | Med | ✅ moderate |
| 13 | Data / velocity / error telemetry | process | Unbounded | Med-high | ✅ moderate |
| 14 | Human-decision / review queue | debt | Growing | High | ✅ epic #1549 (cross-cut, label-backed) |
| 15 | Upstream communications | debt | Bounded/stale | High | ✅ epic #1550 (nests #1406) |

---

## Epic set (CONFIRMED 2026-06-29, #1217 — all 15 filed)

The human decision (#1217) confirmed the **maximal 15-epic set** — every initiative below, including Educational (#8) and both debt categories (#14/#15), becomes its own `EPIC:` tracker (marker: an `epic` label + the `EPIC:` title prefix + the `area:*` label). Index meta-issue: **#1551**.

| Initiative | Epic issue | ≈ open children |
|------------|-----------|-----------------|
| 1 Core toolchain & oracle parity | **#1536** | 7 |
| 2 Interactive debugger (`ilcc`) | **#1537** | 6 |
| 3 Verbose errors & `--explain` | **#1538** | 4 |
| 4 LCC+ extended toolchain | **#1539** | 3 |
| 5 Architecture / DDD refactoring | **#1540** | 7 |
| 6 Test infrastructure | **#1541** | 3 |
| 7 Web / browser experience | **#1542** | 2 |
| 8 Educational content & curriculum | **#1543** | 0 (roadmap umbrella) |
| 9 Agentic orchestration & workflow | **#1544** | 35 |
| 10 Skill ecosystem & cross-provider ports | **#1545** | 21 |
| 11 PM-harness migration (pmtools) | **#1546** | 7 |
| 12 RULES system | **#1547** | 3 |
| 13 Data / velocity / error telemetry | **#1548** | 9 |
| 14 Human-decision / review queue | **#1549** | 16 (cross-cut) |
| 15 Upstream communications (cuh63) | **#1550** | 6 |

Debt categories #14/#15 are filed as epics per the confirmed maximal choice, but are *backed* (not bare): #14 is the `human-decision-required`-label cross-cut (its children also live in their feature epics) and #15 nests the existing #1406 tracker. Narrow cluster trackers (#1211, #428–#430, #677, #1406, #1456) **nest under** their epic rather than being replaced.

### Rough bucketing snapshot (the analysis behind the above)

Open-ticket bucketing (2026-06-29; fuzzy — final child assignment was hand-reconciled at filing):

| Epic candidate | ≈ open | Notes |
|----------------|--------|-------|
| Core toolchain & oracle parity | ~4 | + folds upstream-comms (#40/#159/#507/#867/#868/#1406) if #15 not its own epic |
| Interactive debugger (`ilcc`) | ~6 | reverse-step arc is live |
| Verbose errors & `--explain` | ~4 | coverage tracker #891 already exists |
| LCC+ extended toolchain | ~3 | linkerplus is the big milestone |
| Architecture / DDD refactoring | ~7 | nests tier trackers #428–#430 |
| Test infrastructure | ~6 | |
| Web / browser experience | ~2 | nests #677 tracker |
| Agentic orchestration & workflow | ~15 | nests #1211 cluster tracker |
| Skill ecosystem & cross-provider ports | ~12 | the biggest *new* cluster |
| PM-harness migration (pmtools) | ~6 | `priority:critical`; nests #1456 |
| RULES system | ~3 | |
| Data / velocity / error telemetry | ~7 | |

_(Filing note: the agent's pre-decision recommendation was a 12-epic set — initiatives 1–7 + 9–13, with Education as a ROADMAP section and #14/#15 as labels/trackers. The human chose the **maximal 15** instead; that is the confirmed set recorded in the table above.)_

---

## Focus analysis (carried from 2026-06-06, still applicable)

If narrowing to a core 3–4 by leverage + boundedness: **(1) Core toolchain correctness, (6) Test infrastructure, (7) Web/playground, (5) Architecture** — correctness + tests + learner-access + maintainability. The meta-work categories (#10–#13) and debt categories (#14–#15) are the most creep-prone; the immediate unblocking action remains clearing the **human-decision queue (#14)**, which gates rulings the other initiatives route around.

> Note: the epic set and the *focus* set are different questions. Epics organize **all** active work for visibility; the focus set is a prioritization overlay on top. A feature can have an epic and still be deliberately deprioritized.
