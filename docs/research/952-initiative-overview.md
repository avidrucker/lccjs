# Project Initiative Overview — lccjs

**Issue:** #952 · **Role:** RESEARCH · **Agent:** FIG · **Model:** sonnet-4.6
**Date:** 2026-06-06

---

## Purpose

This document catalogues every active initiative in the lccjs project at a high level. The goal is to inform a deliberate focus and prioritization decision: if 3–4 things done well beats 6–8 done poorly, which 3–4 should they be?

Sources mined: ROADMAP.md, CLAUDE.md, open issue list, recent 80 commits, `docs/research/`, `docs/status.md`, `stats/README.md`, tier tracker issues (#428–#430).

---

## All active initiatives (enumerated)

### 1. Core toolchain correctness & oracle parity

**What it is:** Fixing assembler/interpreter/linker bugs to match the reference `cuh63/lcc` binary (the oracle). Differential testing, parity deviation documentation, and handling edge cases discovered by oracle runs.

**"Done" shape:** Converging — defined parity deviations are documented; new gaps are found and filed as individual puzzles. Not bounded (oracle has undiscovered bugs too). Currently active.

**Effort load:** Medium-high. Every instruction-path change needs oracle verification. Potato fuzzing (#589/#590) is a planned systematic tool.

**Zombie risk:** Low. New parity gaps keep surfacing. Active.

---

### 2. Architecture / DDD refactoring (the pure-seam boundary)

**What it is:** Refactoring assembler, interpreter, and linker toward a deliberate boundary: pure in-memory APIs throw typed errors; CLI wrappers own I/O. Also includes DDD naming improvements (linker table rename, lcc.js relocation, mnemonic descriptor table, interpreter state grouping).

**"Done" shape:** Partially defined by the tier tracker (#428–#430). DDD Gaps 2 and 4 are in Tier 3; Gaps 1 and domain-object extraction are in Tier 5 (aspirational). H1a/H1b/H4 (interpreter decomplect) are in Tier 4.

**Effort load:** High. Each puzzle is individually small but the overall arc spans many sessions. Currently Tier 1–2 work is in flight; Tier 3–5 are staged but blocked.

**Zombie risk:** Low-medium. The architecture goal is real, but the tiered gating means it could stall if Tier 1–2 tickets aren't closed. Currently active.

---

### 3. LCC+ toolchain expansion

**What it is:** Adding new pseudo-instructions to the LCC+ dialect (`beep`, `ding`, `boop`, `who`, `whodis`, plus more from `docs/lccplus-mnemonic-brainstorm.md`), building demo programs, and eventually writing `src/plus/linkerplus.js` for multi-module `.ap` programs.

**"Done" shape:** Unbounded. New mnemonics are added one-by-one. The linker is a defined but unstarted milestone. LCC+ games (Tetris, Hangman, Roguelike) are in the ROADMAP Planned section.

**Effort load:** Low per mnemonic, but collectively unbounded. The linker would be a significant project.

**Zombie risk:** Low — it's fun and generates quick wins. But it can absorb unlimited time without clear "done."

---

### 4. Web / browser experience (playground & site)

**What it is:** The browser playground editor/runner, the syntax-highlighted demo site, the GitHub Pages deploy, the `lcc.bundle.js` browser API, and code-in-slides via the injector. The ILCC dashboard parity audit (#714) tracks feature gaps against the reference web UI.

**"Done" shape:** The playground is at feature-parity with the ILCC dashboard (confirmed as of 2026-06-05 per #714). Remaining open items: interactive stdin in-browser (#677), dark/light theme toggle, localStorage persistence, LCC+ execution in the playground.

**Effort load:** Medium. Each feature is a self-contained web task. The site already deploys automatically via GitHub Pages CI.

**Zombie risk:** Medium. The ILCC-side unknowns (#731 — human verification pending) and planned playground features could drift open indefinitely without a "ship it" decision.

---

### 5. Test infrastructure

**What it is:** Jest suite expansion, oracle-parity e2e tests, Lezer grammar tests, potato fuzzing (#589/#590), fixing failing tests (19 were diagnosed in #903 into 7 root-cause clusters with child tickets filed), and the outstanding oracle-CI spike (M2 — containerize or mock the oracle binary for CI).

**"Done" shape:** Partially defined. The 903-cluster children are bounded tickets. Oracle-CI is a defined spike in Tier 2. Potato fuzzing is planned. The Lezer grammar test gap (#876) was recently filled.

**Effort load:** Medium. Ongoing. Each failing test cluster is a small bounded puzzle; oracle-CI is a medium spike.

**Zombie risk:** Low. Concrete tickets exist; the work is bounded.

---

### 6. Data analysis & velocity tracking

**What it is:** The `stats/` Jupyter notebooks analyzing the velocity DB (H/C estimate calibration, agent throughput, role distribution, C-ratio trends). Also: RICE scoring (#945–#946), errors table (#898), issue lifecycle analysis (#838), and Observable Plot dashboard prototyping (#859).

**"Done" shape:** Unbounded. Each new day of data enables a new notebook. RICE scoring is a growing ceremony. The analysis is increasingly self-referential (meta-level: studying the process of working on the project).

**Effort load:** Medium. Each notebook pass is a ~1–2 session effort. The data infrastructure (velocity DB, errors table) adds overhead to every puzzle.

**Zombie risk:** Medium-high. Risk of indefinite growth in the meta-analysis layer. Already ~33% of all closed tickets are PM/RESEARCH/DATA/SPIKE. The 2026-06-05 ratio analysis (#825) found this is within historical bounds — but it is a concern.

---

### 7. Agentic orchestration & multi-agent workflow

**What it is:** The fruit-agent system (7 named agents, claim/close scripts, worktree-per-task protocol), `fruit-agent-orchestrate` skill, orchestration improvement analysis (#808, #810), skill authoring and audit (#886–#890), and ongoing PDD/Yegor process refinement.

**"Done" shape:** Continuously evolving. The workflow is functional but has known pain points (P1–P6 in #808 analysis). Skill inventory is living. No explicit "stable release" criterion.

**Effort load:** High — and meta. The process infrastructure is significant and growing. Skills live in `~/.claude/skills/` (a separate repo); TIL docs, the errors table, RULES.md, `claude_workflow.md`, `do-this-not-that.md`, and this analysis are all part of this initiative.

**Zombie risk:** Medium-high. Risk of infinite self-improvement loop. This initiative is genuinely useful (agents are productive because the workflow is good) but also the most prone to expanding without bound.

---

### 8. Educational content & curriculum

**What it is:** The tutorial (`docs/tutorial_01_intro.md`), textbook chapter exercises (`docs/cuh63/`), ISA references, pitfalls catalog, demo alphabet (demoA–demoZ), LCC+ interactive games (Snake, Flappy Bird, Tic-Tac-Toe, Rock-Paper-Scissors), and planned games (Tetris, Hangman, Roguelike).

**"Done" shape:** Partially defined. The 26-demo alphabet is complete. The textbook coverage is extensive but not formally audited. LCC+ games exist and could grow. No graduation criterion defined.

**Effort load:** Low per item but collectively unbounded. Writing new games and demos is fun and showcases the toolchain. Curriculum is hard to declare "done."

**Zombie risk:** Medium. Games and demos accumulate without a natural stopping point. Could deprioritize this entirely without hurting core users.

---

### 9. Human-decision / review queue

**What it is:** A growing set of issues that require the project owner's input: ROADMAP ratification (#681), formatter rulings (#798, #863, #864), RULES.json adoption (#845), artifact quality criteria (#841), orchestrator identity convention (#829), TIL cadence adoption (#636), and more.

**"Done" shape:** Defined per ticket but growing. As of 2026-06-05 there were 11+ open human-decision tickets.

**Effort load:** Low per ticket, but they accumulate if not addressed. They block other work (e.g. formatter tickets block formatter development).

**Zombie risk:** High. Human-decision tickets are often the ones that stall for weeks. This is not an "initiative" in the usual sense — it's more of a debt category.

---

### 10. Communications / upstream bug reports

**What it is:** Bug reports sent to Prof. Dos Reis about the OG LCC binary — `cuh63-*.md` docs in `docs/`. Also: #507 (long-line report pending send), #867/#868 (sra shift-by-zero ISA ruling), #159 (sext follow-up), #40 (upstream tracking). Plus `who_lccjs_is_for.md` and any project positioning work.

**"Done" shape:** Bounded. Each bug report is a specific action. Most are waiting on the owner to send them or follow up. Upstream responses are sporadic.

**Effort load:** Very low. Mostly waiting.

**Zombie risk:** High. These tickets age without clear pressure to act. #40 and #159 are very old.

---

## Summary table

| # | Initiative | "Done" shape | Zombie risk | Currently active? |
|---|-----------|-------------|-------------|------------------|
| 1 | Core toolchain correctness / oracle parity | Converging | Low | ✅ Yes |
| 2 | Architecture / DDD refactoring | Tiered, staged | Low-med | ✅ Yes |
| 3 | LCC+ expansion | Unbounded | Low | ✅ Yes |
| 4 | Web / browser experience | Near feature-parity | Med | ✅ Yes |
| 5 | Test infrastructure | Bounded tickets | Low | ✅ Yes |
| 6 | Data analysis & velocity tracking | Unbounded | Med-high | ✅ Yes |
| 7 | Agentic orchestration & workflow | Evolving | Med-high | ✅ Yes |
| 8 | Educational content & curriculum | Unbounded | Med | ✅ Yes |
| 9 | Human-decision queue | Growing debt | High | ⚠️ Stalling |
| 10 | Upstream communications | Bounded but stale | High | ⚠️ Stalling |

---

## Cognitive overhead analysis

Not all initiatives carry equal daily overhead. These three impose persistent process cost on *every* session:

- **Data analysis / velocity tracking** (#6): every puzzle requires a velocity row. Every few sessions needs a notebook re-run. RICE scores need updating as issues are filed.
- **Agentic orchestration** (#7): every session requires claim, worktree, puzzle-velocity skill, close sequence. The overhead is designed to be small per task but is always present.
- **Human-decision queue** (#9): decisions are not being made, so agents must route around them. This imposes recurring discovery cost.

These are also the three with the highest zombie/drift risk.

---

## The question: 3–4 things or 6–8?

### The honest count

There are currently **10 distinct initiative areas**, of which **8 are actively receiving work**. The two stalling ones (#9, #10) don't close — they accumulate as technical debt and decision debt.

### What the data suggests should be the core 3–4

Based on project purpose (educational ISA toolchain), near-term leverage, and boundedness:

| Rank | Initiative | Rationale |
|------|-----------|-----------|
| 1 | **Core toolchain correctness / oracle parity** | The primary purpose of the project. Every feature depends on a correct interpreter/assembler. |
| 2 | **Test infrastructure** | Protects #1. Without a solid test suite, parity fixes regress silently. |
| 3 | **Web / browser experience** | The primary access path for learners. The playground is nearly done. A focused push could finish it. |
| 4 | **Architecture / DDD refactoring** | Enables everything else to be maintainable. The tiered structure means it can be worked incrementally without sprawl. |

### What could be deferred or constrained

| Initiative | Constraint proposed |
|-----------|-------------------|
| **LCC+ expansion** (#3) | Pause new mnemonics until linker is planned or deprioritized. New pseudo-instructions are fun but don't improve learner access or correctness. |
| **Data analysis** (#6) | Time-box to one notebook re-run per week; defer RICE scoring ceremony unless it demonstrably changes prioritization decisions. |
| **Agentic orchestration** (#7) | Declare workflow "stable enough." Resist new scripts/skills until an existing one is clearly insufficient. |
| **Educational content** (#8) | No new demos or games until the playground lets learners *run* the existing ones in-browser. |
| **Human-decision queue** (#9) | Schedule a dedicated owner review session. Block all tickets that depend on these decisions rather than routing around them. |
| **Upstream communications** (#10) | One action: send the three pending bug reports and close the tickets. Then archive this initiative. |

---

## Conclusion

The project is working on 10 things simultaneously, which is ambitious but fragile. The areas most prone to creep are the meta-work categories (#6, #7, #8) and the stalling debt categories (#9, #10). A deliberate narrowing to core 4 — **correctness + tests + web + architecture** — would concentrate effort where it creates direct value for learners and contributors.

The immediate unlocking action is clearing the human-decision queue (#9), since those decisions gate formatter development, rules adoption, and orchestration improvements that are otherwise routing around the unknowns.
