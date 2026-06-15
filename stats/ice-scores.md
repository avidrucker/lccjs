# ICE Scores — lccjs open issues

**Generated:** 2026-06-15   **Issues scored:** 101



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


## Normal queue

| Rank | Issue | Title | I | C | E | ICE | Act |
|---|---|---|---|---|---|---|---|
| 1 | #956 | feat: replace RICE with ICE scoring + override tiers + scoring script | 2 | 0.8 | 5 | 8.0000 | Y |
| 2 | #948 |  | 1 | 0.8 | 7 | 5.6000 | Y |
| 3 | #1088 | DEV: ilcc — 'g' run-to-end + minimal breakpoints (bp {addr|label}) | 1 | 0.8 | 5 | 4.0000 | Y |
| 4 | #1133 | bug: velocity-log numeric metrics are defined/validated inconsistently — unclear sign conventions, no validation on h/c/actual, doc vs code mismatch on delta_h_min | 1 | 0.8 | 5 | 4.0000 | Y |
| 5 | #1177 | process: stop source edits + builds on the shared main checkout (clean-gate + worktree discipline) | 1 | 0.8 | 5 | 4.0000 | Y |
| 6 | #1180 | process(pm): triage claude-bugs-audit-2026-06-06.md findings into actionable investigation tickets | 1 | 0.8 | 5 | 4.0000 | Y |
| 7 | #1189 |  | 1 | 0.8 | 5 | 4.0000 | Y |
| 8 | #1322 | process(ice): keep ICE scores current — score new tickets at file time or via periodic sweep | 1 | 0.8 | 5 | 4.0000 | Y |
| 9 | #1323 | feat(skills): wire ice_score into puzzle-triage ranking (and fruit-agent-orchestrate) | 1 | 0.8 | 5 | 4.0000 | Y |
| 10 | #1050 | docs(workflow): clarify ad-hoc/unclaimed time-consuming work still gets a velocity row | 0.5 | 1 | 7 | 3.5000 | Y |
| 11 | #1056 | chore(docs): commit the deep-code-review brainstorm + annotate it as triaged via #931 | 0.5 | 1 | 7 | 3.5000 | Y |
| 12 | #1057 | chore(docs): commit improving-data-analysis-research.md + annotate its lineage (origin + follow-ups #981/#982/#983) | 0.5 | 1 | 7 | 3.5000 | Y |
| 13 | #1063 | docs(oracle-parity): correct stale 'auto-skip' claim + add stdout-mirroring convention | 0.5 | 1 | 7 | 3.5000 | Y |
| 14 | #1192 | docs: add 'verify the load-bearing premise before ratifying a superseding decision' to do-this-not-that.md | 0.5 | 1 | 7 | 3.5000 | Y |
| 15 | #1242 | docs(do-this-not-that): add 'check current main before chasing a worktree test red' diagnostic | 0.5 | 1 | 7 | 3.5000 | Y |
| 16 | #1311 | docs(do-this-not-that): probe the real CLI before asserting; verify end-to-end | 0.5 | 1 | 7 | 3.5000 | Y |
| 17 | #1316 | next-best-action skill frontmatter still says "run before every close" — contradicts the #1279 approval gate | 0.5 | 1 | 7 | 3.5000 | Y |
| 18 | #1049 | docs(workflow): add proportional consent threshold for ad-hoc investigation | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 19 | #1062 | claude_workflow.md Protocol A's final 'npm run close B' hits the same branch-gate as #1052 | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 20 | #1094 | docs(test-runner): teacher/student usage guide for lcc --test | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 21 | #1166 | refactor(skills): suffix Hermes-specific skills with -hermes for disambiguation | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 22 | #1179 | docs: single discoverable index for worktree & multi-agent concurrency footguns | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 23 | #1265 | REVIEW: apply issue-review-skill to #1238 (resetAssemblyState listingLoadPoint leak) | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 24 | #1266 | REVIEW: apply issue-review-skill to #1102 (--explain forwarding in LCC+ driver) | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 25 | #1271 | Hermes-only tickets have no runtime label — Claude Code agents can claim+stall on them (add runtime:hermes) | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 26 | #1276 | REVIEW #1093 — test(test-runner): e2e suite for --test mode | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 27 | #1296 | docs: document assembleSource() per-call config contract in core.md (listingLoadPoint/verbose/explain/userName) | 0.5 | 0.8 | 7 | 2.8000 | Y |
| 28 | #1029 | decision: close the 'logged lesson → durable rule' promotion loop for non-TIL sources | 1 | 0.5 | 5 | 2.5000 | Y |
| 29 | #1074 | chore(skills): add nemotron-3-ultra to log-error model examples | 0.25 | 1 | 10 | 2.5000 | Y |
| 30 | #872 | DEV: interpreter state grouping — diag bucket, internal-only (phase 1 of #255) | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 31 | #967 | research: investigate puzzle-cluster.csv — existence, references, and necessity | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 32 | #1033 | chore(db): retire the velocity.db migration shim + VELOCITY_DB alias once environments are migrated | 0.5 | 0.8 | 5 | 2.0000 | N |
| 33 | #1035 | feat(close): remind to claim a fresh worktree for the next task after re-root | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 34 | #1046 | feat(skills): fruit-agent-orchestrate should consume puzzle:status --json instead of raw dump + per-issue loop | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 35 | #1047 | refactor(skills): fruit-agent-orchestrate Step 3 should compose puzzle-triage, not re-embed it | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 36 | #1078 | feat(plus): verbose-context enrichment for LCC+ runtime-error display (req 4 of #1011) | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 37 | #1087 | DEV: ilcc reverse step — truncate Output pane (programOutput) on backward step (Gap C) | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 38 | #1089 | DEV: ilcc — 'sb'/'b' alias for {-N} + help line documenting reverse execution & the determinism boundary | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 39 | #1111 | chore(claim): node_modules symlink in worktrees slips past .gitignore and blocks npm run close | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 40 | #1115 | close.js scope audit shows phantom deletions when branch base is behind origin/main | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 41 | #1118 | process: add COMPLIANCE_FAIL/BEHAVIORAL_FAIL error_type — record when a discipline (e.g. error logging itself) is missed | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 42 | #1126 | chore(skills): authoring-hygiene sweep on the 8 ported Hermes skills (config abstraction, scaffolding, related_skills) | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 43 | #1135 | PM: triage relabel — reconcile area:/type/severity on the #1043 ilcc reverse-step family | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 44 | #1186 | docs: migrate rule citations to stable animal-color IDs (Rule N / R0NN → name) | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 45 | #1195 | refactor+test(error-log): apply #1184 notice-not-prevent to the model gate & cover the untested branches | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 46 | #1196 | test(claim): main() orchestration is untested (~34% line coverage) — add integration coverage or a pure plan seam | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 47 | #1200 | feat(skills): fruit-agent-orchestrate — assignment paragraphs must be self-contained & boilerplate-free (per-agent legibility) | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 48 | #1201 | docs(skills): author an assignment-criteria rubric for fruit-agent-orchestrate Step 5b | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 49 | #1226 | REVIEW: audit #1222 for missed Claude/Hermes leftovers | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 50 | #1234 | process: detect closes missing the `error self-audit:` line — the #1117 audit artifact is unenforced | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 51 | #1235 | bug(skills): Hermes next-best-action draft dropped Q6 (Error self-audit) from source | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 52 | #1246 | feat(ci): label-area.yml should infer the lane from issue content, not default to area:uncategorized | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 53 | #1306 |  | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 54 | #1308 | UX: sync Sandbox terminal theme with page theme and make Run button primary green | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 55 | #1315 | fix(process): log-error skill is duplicated & drifted — untracked ~/.claude Claude copy vs tracked lccjs Codex copy | 0.5 | 0.8 | 5 | 2.0000 | Y |
| 56 | #625 | decision: claim.js — which labels should block agent claims (M1, #610)? | 0.5 | 0.5 | 7 | 1.7500 | Y |
| 57 | #626 | decision: fruit-agent-orchestrate — filter unactionable labels before assignment (M2, #610) | 0.5 | 0.5 | 7 | 1.7500 | Y |
| 58 | #630 | decision: fruit-agent-orchestrate — detect and skip in-flight agents before assignment (M6, #610) | 0.5 | 0.5 | 7 | 1.7500 | Y |
| 59 | #633 | decision: close.js — auto-post closing comment skeleton after confirmed push (M10, #610) | 0.5 | 0.5 | 7 | 1.7500 | Y |
| 60 | #636 | decision: adopt 10-entry TIL harvest cadence from #207 recommendations (M13, #610) | 0.5 | 0.5 | 7 | 1.7500 | Y |
| 61 | #829 | decision: define orchestrator-session fruit identity convention for npm run claim | 0.5 | 0.5 | 7 | 1.7500 | Y |
| 62 | #841 | decision: how to leverage artifact-quality-criteria.md (skill ingredient, review checklist, or automated gate?) | 0.5 | 0.5 | 7 | 1.7500 | Y |
| 63 | #40 | [OB-008] Track upstream: cuh63 6.3 mov rejects negatives that its mvi accepts | 1 | 0.5 | 3 | 1.5000 | Y |
| 64 | #1065 | feat(skills): convert 9 Claude skills to Hermes format | 1 | 0.5 | 3 | 1.5000 | Y |
| 65 | #1160 | research(process): catalog 'behavioral errors' — undesirable agent actions distinct from technical tool failures | 1 | 0.5 | 3 | 1.5000 | Y |
| 66 | #1000 | SPIKE: can puzzle:status flag tracker issues that have CLOSED children still shown as unchecked? | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 67 | #1030 | decision: adopt or reject STALE_READ error_type — resolve the #904 half-state | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 68 | #1077 | test(skills): verify next-best-action Hermes skill end-to-end | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 69 | #1079 | test(skills): verify guide-human-decision Hermes skill end-to-end | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 70 | #1080 | test(skills): verify log-error Hermes skill end-to-end | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 71 | #1081 | test(skills): verify write-til-doc Hermes skill end-to-end | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 72 | #1082 | test(skills): verify yegor-pm Hermes skill end-to-end | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 73 | #1083 | test(skills): verify puzzle-velocity Hermes skill end-to-end | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 74 | #1084 | test(skills): verify puzzle-triage Hermes skill end-to-end | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 75 | #1113 | process: decide Hermes↔lccjs telemetry policy — close the velocity/error-logging gap (Rule 5 vs Hermes exemption) | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 76 | #1152 | feat(skills): author a Hermes agent operating checklist for nemotron-3-ultra agents | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 77 | #1156 | test(skills): exercise the Claude-authored Hermes write-til-doc skill in the Hermes runtime | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 78 | #1157 | feat(skills): convert the Claude write-til-doc skill into a Hermes skill (Claude-authored) | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 79 | #1202 | decision: promote any of TIL #1197's four rule-lines to RULES.json (or route to docs)? | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 80 | #1210 | WRITER: skill portability + organization across providers (agentskills.io hub; Claude/Codex/Hermes) | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 81 | #1218 | WRITER: skill portability hub doc (agentskills.io; Claude Code and Codex spokes) | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 82 | #1219 | WRITER: skill organization strategy across providers and repos | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 83 | #1220 | SPIKE: confirm Hermes skill paths, invocation, and extension model | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 84 | #1285 | process: consider a RULES.md rule — verify a ticket's prescribed fix mechanism before implementing | 0.5 | 0.5 | 5 | 1.2500 | Y |
| 85 | #252 | Decomplect (H1b): lift trace + register-diff display out of interpreter step() into an observer | 0.5 | 0.8 | 3 | 1.2000 | Y |
| 86 | #255 | Decomplect (H4): group interpreter constructor state into cpu/io/diag sub-objects | 0.5 | 0.8 | 3 | 1.2000 | Y |
| 87 | #873 | ARC/DEV: breaking public-API regroup of interpreter state (1b — future) | 0.5 | 0.8 | 3 | 1.2000 | Y |
| 88 | #1129 | DEV: ilcc reverse step — replay program input via per-step consumed-input log (corrected Gap B) | 0.5 | 0.8 | 3 | 1.2000 | Y |
| 89 | #1319 | docs(process): add scope-overrun pre-action-gate rule to RULES.json (after #1185) | 0.5 | 0.8 | 3 | 1.2000 | Y |
| 90 | #159 | Act on Prof Dos Reis's reply re: `sext` semantics (follow-up to #150) | 0.5 | 0.5 | 3 | 0.7500 | Y |
| 91 | #810 | RESEARCH: assess efficacy and utility of fruit-agent-orchestrate improvement proposals (2026-06-05) | 0.5 | 0.5 | 3 | 0.7500 | Y |
| 92 | #980 | SPIKE: try statechart skill for #134 ilcc debugger statechart work — does it add value? | 0.5 | 0.5 | 3 | 0.7500 | Y |
| 93 | #1048 | feat(skills): fruit-agent-orchestrate — delegate Steps 3-5 reasoning to a subagent (conditional) | 0.5 | 0.5 | 3 | 0.7500 | Y |
| 94 | #1144 | research(process): assess whether #1117's pre-close error self-audit reduced error-logging under-reporting | 0.5 | 0.5 | 3 | 0.7500 | N |
| 95 | #1155 | research(process): assess the Claude-authored Hermes write-til-doc port (quality, outcomes, vs nemotron) | 0.5 | 0.5 | 3 | 0.7500 | Y |
| 96 | #1213 | enhancement(process): a system to RECOMMEND (not enforce) work sequencing across ticket clusters | 0.5 | 0.5 | 3 | 0.7500 | N |
| 97 | #1221 | research(process): target ratio of feature progress vs process improvement — measure current, propose a budget so process doesn't starve product | 0.5 | 0.5 | 3 | 0.7500 | Y |
| 98 | #1255 | SPIKE: evaluate Tony Kay's escapement — statechart-driven LLM agent framework — for regulating lccjs's multi-agent workflow | 0.5 | 0.5 | 3 | 0.7500 | Y |
| 99 | #1291 | external: version-control & fix stale velocity.db path in untracked Claude Code skill copies (~/.claude/skills) | 0.5 | 0.5 | 3 | 0.7500 | Y |
| 100 | #1292 | external: stale velocity.db path in Hermes log-error skill copy (~/.hermes) — no owned repo yet | 0.5 | 0.5 | 3 | 0.7500 | Y |
| 101 | #1305 | RESEARCH: evaluate ASCII-friendly + accessibly-renderable diagram formats (Mermaid, D2, m2, etc.) | 0.5 | 0.5 | 3 | 0.7500 | Y |
