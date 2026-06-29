# ICE Scores — lccjs open issues

**Generated:** 2026-06-29   **Issues scored:** 169



## Rubric

| Dimension | Scale |
|---|---|
| **I (Impact)** | 3=massive · 2=high · 1=medium · 0.5=low · 0.25=minimal |
| **C (Confidence)** | 1.0=high · 0.8=medium · 0.5=low |
| **E (Ease)** | 10=trivial · 7=easy · 5=moderate · 3=hard · 1=very hard |

**Formula:** `ICE = I × C × E`  (higher Ease ⇒ higher ICE)
**Tiebreaker:** `+ 1 / (issue × 1000)` — earlier issues win ties but cannot flip a higher-scored ticket.

## Override tiers

Two tiers sit above the normal ICE queue:

| Tier | Label | Who can set | Meaning |
|---|---|---|---|
| Critical | `priority:critical` | Human only | Do before everything else — SLA breach, legal risk, blocking all agents |
| Elevated | `priority:elevated` | Human or PM agent | Do this sprint, before all normal-queue items |

**Audit trail required:** every time `priority:critical` or `priority:elevated` is applied, post a comment on the issue with:
- **Who** escalated it
- **Why** (one sentence)
- **Expiry** — stays elevated until when, or until what event?

Use: `npm run ice:score -- --set-tier elevated --issue N`


## Critical  _(do before everything else)_

| Rank | Issue | Title | I | C | E | ICE | Act |
|---|---|---|---|---|---|---|---|
| 1 | #1456 | tracker: migrate lccjs PM commands onto the central pmtools harness | 2 | 0.8 | 5 | 8.0000 | Y |

## Normal queue

| Rank | Issue | Title | I | C | E | ICE | Act |
|---|---|---|---|---|---|---|---|
| 2 | #1487 | research(workflow): document lccjs' end-to-end ticket lifecycle and prove byte-parity with pmtools's (independently verified) | 1 | 1 | 10 | 10.0000 | Y |
| 3 | #956 | feat: replace RICE with ICE scoring + override tiers + scoring script | 2 | 0.8 | 5 | 8.0000 | Y |
| 4 | #1335 | RESEARCH: fruit-agent-orchestrate missed live worktree claims and double-booked #1322 | 2 | 0.8 | 5 | 8.0000 | Y |
| 5 | #1360 | PROPOSAL: codify "verify the common interaction path, not just the scriptable one" as a verification rule | 1 | 0.8 | 10 | 8.0000 | Y |
| 6 | #1486 | process: promote 'verify live state, not memory' to RULES.json (recurring learnings theme) | 1 | 1 | 7 | 7.0000 | Y |
| 7 | #938 | TRACKER: apply issue-review-skill to open issues — quality/accessibility/actionability pass | 1 | 0.8 | 7 | 5.6000 | Y |
| 8 | #948 |  | 1 | 0.8 | 7 | 5.6000 | Y |
| 9 | #1426 | SPIKE: confirm Hermes skill model (dirs/invocation/frontmatter; agentskills.io conformance) → write Hermes spoke | 1 | 0.8 | 7 | 5.6000 | Y |
| 10 | #1484 | build(velocity): untrack docs/puzzle-velocity.csv + gitignore CSV mirrors (R2 lccjs-side; mirrors pmtools#68) | 1 | 0.8 | 7 | 5.6000 | Y |
| 11 | #1443 | DEV: base-owned interpreter trap/eopcode registry + convert core switches to table lookups | 1 | 1 | 5 | 5.0000 | Y |
| 12 | #1440 | TRACKER: generalize lccjs-coupled skills to be config-driven (work in any repo) | 2 | 0.8 | 3 | 4.8000 | Y |
| 13 | #587 | Potato Token Testing suite — benchmark .a + two fuzz scripts | 1 | 0.8 | 5 | 4.0000 | Y |
| 14 | #590 | DEV: Potato input testing — per-stdin-prompt fuzzer, reverse order, oracle parity (on-demand) | 1 | 0.8 | 5 | 4.0000 | Y |
| 15 | #677 | TRACKER: browser playground on GitHub Pages — textarea assembly execution | 1 | 0.8 | 5 | 4.0000 | N |
| 16 | #707 | PM: track web front-end feature parity — LCCjs browser vs web_ilcc dashboard | 1 | 0.8 | 5 | 4.0000 | N |
| 17 | #890 | TRACKER: skill-inventory improvements from #886 audit — A through H | 1 | 0.8 | 5 | 4.0000 | Y |
| 18 | #891 | TRACKER: add "did you mean?" suggestions to verbose error messages — full coverage | 1 | 0.8 | 5 | 4.0000 | Y |
| 19 | #1088 | DEV: ilcc — 'g' run-to-end + minimal breakpoints (bp {addr|label}) | 1 | 0.8 | 5 | 4.0000 | Y |
| 20 | #1105 | research(process): audit agent HONEYDEW's Hermes skill-port work (#1066–#1073) [TRACKER] | 1 | 0.8 | 5 | 4.0000 | Y |
| 21 | #1133 | bug: velocity-log numeric metrics are defined/validated inconsistently — unclear sign conventions, no validation on h/c/actual, doc vs code mismatch on delta_h_min | 1 | 0.8 | 5 | 4.0000 | Y |
| 22 | #1177 | process: stop source edits + builds on the shared main checkout (clean-gate + worktree discipline) | 1 | 0.8 | 5 | 4.0000 | Y |
| 23 | #1180 | process(pm): triage claude-bugs-audit-2026-06-06.md findings into actionable investigation tickets | 1 | 0.8 | 5 | 4.0000 | Y |
| 24 | #1189 |  | 1 | 0.8 | 5 | 4.0000 | Y |
| 25 | #1211 | TRACKER: fruit-agent-orchestrate improvement cluster — sequencing + efficacy gate for #810 | 1 | 0.8 | 5 | 4.0000 | Y |
| 26 | #1320 | TRACKER: ICE scoring is built but orphaned — re-adopt for triage/orchestration prioritization | 1 | 0.8 | 5 | 4.0000 | Y |
| 27 | #1322 | process(ice): keep ICE scores current — score new tickets at file time or via periodic sweep | 1 | 0.8 | 5 | 4.0000 | Y |
| 28 | #1323 | feat(skills): wire ice_score into puzzle-triage ranking (and fruit-agent-orchestrate) | 1 | 0.8 | 5 | 4.0000 | Y |
| 29 | #1332 | feat(skills): convert fruit-agent-orchestrate to Hermes skill format | 1 | 0.8 | 5 | 4.0000 | Y |
| 30 | #1333 | BUG: sandbox page theme colors do not fully follow code theme | 1 | 0.8 | 5 | 4.0000 | Y |
| 31 | #1334 | BUG: docs pages ignore the current theme toggle and force light mode | 1 | 0.8 | 5 | 4.0000 | Y |
| 32 | #1336 | REVIEW #1094 — docs(test-runner): teacher/student usage guide for lcc --test | 1 | 0.8 | 5 | 4.0000 | Y |
| 33 | #1411 | data(process): normalize the 50 pre-existing non-behavioral malformed context rows in errors DB | 1 | 0.8 | 5 | 4.0000 | Y |
| 34 | #1420 | feat(skills): fruit-agent-orchestrate should route runtime-locked tickets (runtime:hermes) to matching-runtime agents + support a Claude/Codex/Hermes roster | 1 | 0.8 | 5 | 4.0000 | Y |
| 35 | #1444 | DEV: port LCC+ trap/eopcode handlers onto the base registry; delete InterpreterPlus dispatch overrides | 1 | 0.8 | 5 | 4.0000 | Y |
| 36 | #1461 | TRACKER: adopt br-/wt- self-describing worktree/branch naming scheme (#1460) | 1 | 0.8 | 5 | 4.0000 | Y |
| 37 | #1465 | feat(claim): flip claim/close construction to br-/wt- self-describing names + source project/lang from config | 1 | 0.8 | 5 | 4.0000 | Y |
| 38 | #1479 | Char-literal error messages: '''→"Bad label" is misleading; '\/' divergence + oracle unknown-escape rule (findings, do not close) | 1 | 0.8 | 5 | 4.0000 | Y |
| 39 | #1500 | Make themes dropdown available on all GitHub Pages docs pages with persistent selection | 1 | 0.8 | 5 | 4.0000 | Y |
| 40 | #1506 | DEV: validate and revise LCC+ sound mnemonic mappings | 1 | 0.8 | 5 | 4.0000 | Y |
| 41 | #1507 | WRITER: add Buy Me a Coffee support badge to README | 0.5 | 0.8 | 10 | 4.0000 | Y |
| 42 | #1512 | .env usage is unaudited — no private-vs-public-safe classification of config vars | 1 | 0.8 | 5 | 4.0000 | Y |
| 43 | #1050 | docs(workflow): clarify ad-hoc/unclaimed time-consuming work still gets a velocity row | 0.5 | 1 | 7 | 3.5000 | Y |
| 44 | #1056 | chore(docs): commit the deep-code-review brainstorm + annotate it as triaged via #931 | 0.5 | 1 | 7 | 3.5000 | Y |
| 45 | #1057 | chore(docs): commit improving-data-analysis-research.md + annotate its lineage (origin + follow-ups #981/#982/#983) | 0.5 | 1 | 7 | 3.5000 | Y |
| 46 | #1063 | docs(oracle-parity): correct stale 'auto-skip' claim + add stdout-mirroring convention | 0.5 | 1 | 7 | 3.5000 | Y |
| 47 | #1192 | docs: add 'verify the load-bearing premise before ratifying a superseding decision' to do-this-not-that.md | 0.5 | 1 | 7 | 3.5000 | Y |
| 48 | #1242 | docs(do-this-not-that): add 'check current main before chasing a worktree test red' diagnostic | 0.5 | 1 | 7 | 3.5000 | Y |
| 49 | #1311 | docs(do-this-not-that): probe the real CLI before asserting; verify end-to-end | 0.5 | 1 | 7 | 3.5000 | Y |
| 50 | #1316 | next-best-action skill frontmatter still says "run before every close" — contradicts the #1279 approval gate | 0.5 | 1 | 7 | 3.5000 | Y |
| 51 | #507 | PM: send long-line silent-split report to Prof. Dos Reis (OG BUG #13) | 0.5 | 0.8 | 7 | 2.8000 | N |
| 52 | #741 | orientation.md Mermaid diagrams lack a readability/quality/accessibility review | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 53 | #757 | demo-034 restructuring for testability may have dropped its .global/linker-startup teaching intent | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 54 | #1049 | docs(workflow): add proportional consent threshold for ad-hoc investigation | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 55 | #1062 | claude_workflow.md Protocol A's final 'npm run close B' hits the same branch-gate as #1052 | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 56 | #1094 | docs(test-runner): teacher/student usage guide for lcc --test | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 57 | #1166 | refactor(skills): suffix Hermes-specific skills with -hermes for disambiguation | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 58 | #1179 | docs: single discoverable index for worktree & multi-agent concurrency footguns | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 59 | #1265 | REVIEW: apply issue-review-skill to #1238 (resetAssemblyState listingLoadPoint leak) | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 60 | #1266 | REVIEW: apply issue-review-skill to #1102 (--explain forwarding in LCC+ driver) | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 61 | #1271 | Hermes-only tickets have no runtime label — Claude Code agents can claim+stall on them (add runtime:hermes) | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 62 | #1276 | REVIEW #1093 — test(test-runner): e2e suite for --test mode | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 63 | #1296 | docs: document assembleSource() per-call config contract in core.md (listingLoadPoint/verbose/explain/userName) | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 64 | #1405 | DEV/decision: optional friendly alias for reverse-step {-N} (non-b, non-s) — or decide none | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 65 | #1445 | DEV: unit tests for trap/eopcode registry guards (double-book, override, out-of-band) | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 66 | #1493 | RESEARCH: decide whether LCC+ sound should use literal slots or register operands | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 67 | #1510 | LCC+ docs and tickets misrepresent `boop`: conflated with the `bop` sound alias and documented with wrong output string | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 68 | #1029 | decision: close the 'logged lesson → durable rule' promotion loop for non-TIL sources | 1 | 0.5 | 5 | 2.5000 | Y |
| 69 | #1074 | chore(skills): add nemotron-3-ultra to log-error model examples | 0.25 | 1 | 10 | 2.5000 | Y |
| 70 | #1509 | RESEARCH: profile a1k0n bit-ops donut render cost at R1=R2=4 vs R1=R2=8 → findings doc in experiments/donut/ | 0.5 | 1 | 5 | 2.5000 | Y |
| 71 | #867 | HUMAN: send sra-shift-by-zero summary to Prof. Dos Reis for ISA ruling | 1 | 0.8 | 3 | 2.4000 | Y |
| 72 | #868 | HUMAN: get Charlie's perspective on sra r0, 0 shift-by-zero validity | 1 | 0.8 | 3 | 2.4000 | Y |
| 73 | #1406 | Tracker: report outstanding OG Oracle (cuh63 6.3) bugs/glitches to Prof. Dos Reis | 1 | 0.8 | 3 | 2.4000 | Y |
| 74 | #1447 | ARC/HUMAN: @ItBeCharlie sign-off on 4 design questions for table-driven interpreter dispatch (#1346) | 1 | 0.8 | 3 | 2.4000 | Y |
| 75 | #1466 | tracker: PM-transition no-regression gate — cross-confirm pmtools guardrails + live differential check before each switch | 1 | 0.8 | 3 | 2.4000 | Y |
| 76 | #1480 | Unique, stable error IDs for every diagnostic, surfaced under the verbose/explain flag | 1 | 0.8 | 3 | 2.4000 | Y |
| 77 | #1481 | Add --oracle-compat: opt-in 100% OG-LCC feature-parity (bug-for-bug) mode | 1 | 0.8 | 3 | 2.4000 | N |
| 78 | #450 | No in-browser LCC highlighting on github.com without a separate install | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 79 | #517 | ARCHITECT: follow-up decisions for #512 shift-count masking fix — four open questions | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 80 | #518 | ARC: validate ct=0 shift decision and implication for #512 range-check lower bound | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 81 | #681 | REVIEW: human review of ROADMAP.md rewrite — verify accuracy and decide next steps | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 82 | #872 | DEV: interpreter state grouping — diag bucket, internal-only (phase 1 of #255) | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 83 | #967 | research: investigate puzzle-cluster.csv — existence, references, and necessity | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 84 | #968 | decision: agent scratch-file cleanup vs Bash rm/heredoc permission denials (preserve #434 guardrail) | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 85 | #1002 | decision: flag agent "this is busywork" judgements for human review — don't silently drop declined work | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 86 | #1033 | chore(db): retire the velocity.db migration shim + VELOCITY_DB alias once environments are migrated | 0.5 | 0.8 | 5 | 2.0000 | N |
| 87 | #1035 | feat(close): remind to claim a fresh worktree for the next task after re-root | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 88 | #1046 | feat(skills): fruit-agent-orchestrate should consume puzzle:status --json instead of raw dump + per-issue loop | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 89 | #1047 | refactor(skills): fruit-agent-orchestrate Step 3 should compose puzzle-triage, not re-embed it | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 90 | #1058 | test: confirm label-area.yml auto-applies area:uncategorized on a real opened issue (#1012 follow-up) | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 91 | #1078 | feat(plus): verbose-context enrichment for LCC+ runtime-error display (req 4 of #1011) | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 92 | #1087 | DEV: ilcc reverse step — truncate Output pane (programOutput) on backward step (Gap C) | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 93 | #1089 | DEV: ilcc — 'sb'/'b' alias for {-N} + help line documenting reverse execution & the determinism boundary | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 94 | #1111 | chore(claim): node_modules symlink in worktrees slips past .gitignore and blocks npm run close | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 95 | #1115 | close.js scope audit shows phantom deletions when branch base is behind origin/main | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 96 | #1118 | process: add COMPLIANCE_FAIL/BEHAVIORAL_FAIL error_type — record when a discipline (e.g. error logging itself) is missed | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 97 | #1126 | chore(skills): authoring-hygiene sweep on the 8 ported Hermes skills (config abstraction, scaffolding, related_skills) | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 98 | #1135 | PM: triage relabel — reconcile area:/type/severity on the #1043 ilcc reverse-step family | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 99 | #1186 | docs: migrate rule citations to stable animal-color IDs (Rule N / R0NN → name) | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 100 | #1195 | refactor+test(error-log): apply #1184 notice-not-prevent to the model gate & cover the untested branches | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 101 | #1196 | test(claim): main() orchestration is untested (~34% line coverage) — add integration coverage or a pure plan seam | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 102 | #1200 | feat(skills): fruit-agent-orchestrate — assignment paragraphs must be self-contained & boilerplate-free (per-agent legibility) | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 103 | #1201 | docs(skills): author an assignment-criteria rubric for fruit-agent-orchestrate Step 5b | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 104 | #1217 | PM: create EPIC tracker issues for each major current feature (feature-level roadmap view) | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 105 | #1226 | REVIEW: audit #1222 for missed Claude/Hermes leftovers | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 106 | #1234 | process: detect closes missing the `error self-audit:` line — the #1117 audit artifact is unenforced | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 107 | #1235 | bug(skills): Hermes next-best-action draft dropped Q6 (Error self-audit) from source | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 108 | #1246 | feat(ci): label-area.yml should infer the lane from issue content, not default to area:uncategorized | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 109 | #1306 |  | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 110 | #1308 | UX: sync Sandbox terminal theme with page theme and make Run button primary green | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 111 | #1315 | fix(process): log-error skill is duplicated & drifted — untracked ~/.claude Claude copy vs tracked lccjs Codex copy | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 112 | #1337 | REVIEW: quality control pass on stats/week-03-analysis.ipynb | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 113 | #1339 | BUG: multi-line selection in sandbox CodeMirror editor renders wrong (only one line highlights at a time) | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 114 | #1427 | research(process): backtest inferArea() label accuracy against a 20+ labeled-issue corpus | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 115 | #1448 | process: auto-mode classifier doesn't treat a ticket's acceptance criteria as authorization for external writes (spike → file DEV puzzles) | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 116 | #1449 | RESEARCH: does extracting a pure planClaim() seam from claim.js main() add value? (#1196 option b) | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 117 | #1492 | DEV: make LCC+ sound-like mnemonics register-flexible across the ISA | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 118 | #625 | decision: claim.js — which labels should block agent claims (M1, #610)? | 0.5 | 0.5 | 7 | 1.7500 | Y |
| 119 | #626 | decision: fruit-agent-orchestrate — filter unactionable labels before assignment (M2, #610) | 0.5 | 0.5 | 7 | 1.7500 | Y |
| 120 | #630 | decision: fruit-agent-orchestrate — detect and skip in-flight agents before assignment (M6, #610) | 0.5 | 0.5 | 7 | 1.7500 | Y |
| 121 | #633 | decision: close.js — auto-post closing comment skeleton after confirmed push (M10, #610) | 0.5 | 0.5 | 7 | 1.7500 | Y |
| 122 | #636 | decision: adopt 10-entry TIL harvest cadence from #207 recommendations (M13, #610) | 0.5 | 0.5 | 7 | 1.7500 | Y |
| 123 | #829 | decision: define orchestrator-session fruit identity convention for npm run claim | 0.5 | 0.5 | 7 | 1.7500 | Y |
| 124 | #841 | decision: how to leverage artifact-quality-criteria.md (skill ingredient, review checklist, or automated gate?) | 0.5 | 0.5 | 7 | 1.7500 | Y |
| 125 | #1378 | fix(interpreter): add defensive break/return after div/rem zero-divisor guard (hardening, child of #1180) | 0.5 | 0.5 | 7 | 1.7500 | Y |
| 126 | #40 | [OB-008] Track upstream: cuh63 6.3 mov rejects negatives that its mvi accepts | 1 | 0.5 | 3 | 1.5000 | Y |
| 127 | #1065 | feat(skills): convert 9 Claude skills to Hermes format | 1 | 0.5 | 3 | 1.5000 | Y |
| 128 | #1160 | research(process): catalog 'behavioral errors' — undesirable agent actions distinct from technical tool failures | 1 | 0.5 | 3 | 1.5000 | Y |
| 129 | #1000 | SPIKE: can puzzle:status flag tracker issues that have CLOSED children still shown as unchecked? | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 130 | #1030 | decision: adopt or reject STALE_READ error_type — resolve the #904 half-state | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 131 | #1077 | test(skills): verify next-best-action Hermes skill end-to-end | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 132 | #1079 | test(skills): verify guide-human-decision Hermes skill end-to-end | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 133 | #1080 | test(skills): verify log-error Hermes skill end-to-end | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 134 | #1081 | test(skills): verify write-til-doc Hermes skill end-to-end | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 135 | #1082 | test(skills): verify yegor-pm Hermes skill end-to-end | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 136 | #1083 | test(skills): verify puzzle-velocity Hermes skill end-to-end | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 137 | #1084 | test(skills): verify puzzle-triage Hermes skill end-to-end | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 138 | #1113 | process: decide Hermes↔lccjs telemetry policy — close the velocity/error-logging gap (Rule 5 vs Hermes exemption) | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 139 | #1152 | feat(skills): author a Hermes agent operating checklist for nemotron-3-ultra agents | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 140 | #1156 | test(skills): exercise the Claude-authored Hermes write-til-doc skill in the Hermes runtime | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 141 | #1157 | feat(skills): convert the Claude write-til-doc skill into a Hermes skill (Claude-authored) | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 142 | #1202 | decision: promote any of TIL #1197's four rule-lines to RULES.json (or route to docs)? | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 143 | #1210 | WRITER: skill portability + organization across providers (agentskills.io hub; Claude/Codex/Hermes) | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 144 | #1218 | WRITER: skill portability hub doc (agentskills.io; Claude Code and Codex spokes) | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 145 | #1219 | WRITER: skill organization strategy across providers and repos | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 146 | #1220 | SPIKE: confirm Hermes skill paths, invocation, and extension model | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 147 | #1285 | process: consider a RULES.md rule — verify a ticket's prescribed fix mechanism before implementing | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 148 | #1402 | chore(interpreter): add a committed oracle-probe generator for SEXT_PARITY_TABLE (provenance/reproducibility; child of #1180) | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 149 | #252 | Decomplect (H1b): lift trace + register-diff display out of interpreter step() into an observer | 0.5 | 0.8 | 3 | 1.2000 | Y |
| 150 | #255 | Decomplect (H4): group interpreter constructor state into cpu/io/diag sub-objects | 0.5 | 0.8 | 3 | 1.2000 | Y |
| 151 | #428 | Tracker: Tier 3 — N2 trap constants, M4 commit informativeness, DDD linker/lcc.js naming, Q20, N3 | 0.5 | 0.8 | 3 | 1.2000 | Y |
| 152 | #429 | Tracker: Tier 4 — interpreter decomplect (H1/H4), mnemonic-table ROI, experiment designs | 0.5 | 0.8 | 3 | 1.2000 | Y |
| 153 | #430 | Tracker: Tier 5 — aspirational research (ISA design, educational, DDD domain objects, M8) | 0.5 | 0.8 | 3 | 1.2000 | Y |
| 154 | #838 | TRACKER: GitHub repo activity visualization for lccjs | 0.5 | 0.8 | 3 | 1.2000 | N |
| 155 | #873 | ARC/DEV: breaking public-API regroup of interpreter state (1b — future) | 0.5 | 0.8 | 3 | 1.2000 | Y |
| 156 | #1129 | DEV: ilcc reverse step — replay program input via per-step consumed-input log (corrected Gap B) | 0.5 | 0.8 | 3 | 1.2000 | Y |
| 157 | #1319 | docs(process): add scope-overrun pre-action-gate rule to RULES.json (after #1185) | 0.5 | 0.8 | 3 | 1.2000 | Y |
| 158 | #159 | Act on Prof Dos Reis's reply re: `sext` semantics (follow-up to #150) | 0.5 | 0.5 | 3 | 0.7500 | Y |
| 159 | #810 | RESEARCH: assess efficacy and utility of fruit-agent-orchestrate improvement proposals (2026-06-05) | 0.5 | 0.5 | 3 | 0.7500 | Y |
| 160 | #980 | SPIKE: try statechart skill for #134 ilcc debugger statechart work — does it add value? | 0.5 | 0.5 | 3 | 0.7500 | Y |
| 161 | #1048 | feat(skills): fruit-agent-orchestrate — delegate Steps 3-5 reasoning to a subagent (conditional) | 0.5 | 0.5 | 3 | 0.7500 | Y |
| 162 | #1144 | research(process): assess whether #1117's pre-close error self-audit reduced error-logging under-reporting | 0.5 | 0.5 | 3 | 0.7500 | N |
| 163 | #1155 | research(process): assess the Claude-authored Hermes write-til-doc port (quality, outcomes, vs nemotron) | 0.5 | 0.5 | 3 | 0.7500 | Y |
| 164 | #1213 | enhancement(process): a system to RECOMMEND (not enforce) work sequencing across ticket clusters | 0.5 | 0.5 | 3 | 0.7500 | N |
| 165 | #1221 | research(process): target ratio of feature progress vs process improvement — measure current, propose a budget so process doesn't starve product | 0.5 | 0.5 | 3 | 0.7500 | Y |
| 166 | #1255 | SPIKE: evaluate Tony Kay's escapement — statechart-driven LLM agent framework — for regulating lccjs's multi-agent workflow | 0.5 | 0.5 | 3 | 0.7500 | Y |
| 167 | #1291 | external: version-control & fix stale velocity.db path in untracked Claude Code skill copies (~/.claude/skills) | 0.5 | 0.5 | 3 | 0.7500 | Y |
| 168 | #1292 | external: stale velocity.db path in Hermes log-error skill copy (~/.hermes) — no owned repo yet | 0.5 | 0.5 | 3 | 0.7500 | Y |
| 169 | #1305 | RESEARCH: evaluate ASCII-friendly + accessibly-renderable diagram formats (Mermaid, D2, m2, etc.) | 0.5 | 0.5 | 3 | 0.7500 | Y |
