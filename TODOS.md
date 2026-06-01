# TODOs

This file is the current actionable backlog. Completed historical refactor steps were intentionally removed so this list stays readable and trustworthy.

## Active Refactor Work

- [ ] decompose `src/core/assembler.js` into smaller helper modules
  - [ ] extract validation helpers
  - [ ] extract operand parsing helpers
  - [ ] extract serialization / object-output helpers
  - [ ] extract instruction/directive dispatch helpers
- [ ] decompose `src/core/interpreter.js` into smaller helper modules
  - [ ] extract executable loading helpers
  - [ ] extract runtime / loop-detection helpers
  - [ ] extract opcode / trap dispatch helpers
- [ ] continue replacing filesystem-heavy tests with pure seam tests where wrapper behavior is not under test
- [ ] update local progress notes after major refactor milestones land
- [x] extract duplicated CLI scaffolding (`isTestMode` + `fatalExit`/`cliErrorExit`/`cliWrappedErrorExit`) into `src/utils/cliExit.js` (#167 closed — `1a6bd87`)

## Parallel-Agent Coordination

- [x] agent identity on worktree branches: self-assigned fruit names for parallel-agent visibility (#179 closed — `scripts/claim.js` / `npm run claim`, `puzzle-status.js` agent attribution, convention in `docs/claude_workflow.md` + `docs/design-agent-worktree-identity.md`)
- [x] make claim auto session-scoped: stop reassigning a still-alive agent's fruit via a `<fruit>/session` sentinel branch (#194 closed — `dbe180d` — sentinel branch + branch-namespace scan in `takenFruits()` + 7-day stale sweep; 8 new unit tests). Surfaced by the #193 spike → `docs/research/claim-fruit-session-scope.md`.
- [x] document worktree/claim naming + mandatory `--as` for concurrent fan-out, correct the "branch namespace is the source of truth" claim, and add the `[A-Za-z0-9._-]`-only naming rule that keeps the pdd-gate excludes working (#195 closed — folds #232)
- [x] claim.js silently auto-fruits when local main is stale — ignores `CLAUDE_AGENT_NAME` on a pre-#212 checkout (#228 closed — stale-main guard in `scripts/claim.js`: fetch + `rev-list main..origin/main`, abort with a pull hint unless `--allow-stale-main`; pure `assessBaseStaleness()` seam + tests). Surfaced by #223.
- [x] reconcile agent-identity precedence to one canonical source — restated in 6 places, drifted after #212 (#230 closed — design doc is now the single home; claim.js header + claude_workflow.md reduced to one-line summary + link)
- [x] velocity `agent`-column doc says "worktree fruit name", contradicting the terminal-name convention (#229 closed — puzzle-velocity.md now says "human/terminal name")

## Documentation

- [ ] rewrite `docs/assembler.md` to match the current pure-API plus wrapper architecture
- [ ] rewrite `docs/interpreter.md` to match the current pure-API plus wrapper architecture
- [ ] rewrite `docs/lcc.md` to match the current orchestration-only role of `lcc.js`
- [ ] rewrite `docs/linker.md` to document the new typed `LinkerError` seam and current wrapper-oriented linker flow
- [ ] expand `src/utils/utils.md` to document:
  - [ ] `errors.js`
  - [ ] `fileArtifacts.js`
  - [ ] `reportArtifacts.js`
- [ ] label any `progress-report.md` snapshots as historical when they exist
- [x] per-module glossaries for `assembler.js` / `interpreter.js` / `linker.js` — written then QC'd; live in `docs/glossary/` (#107 tracker; written #108–#113, QC/cleanup #162 closed — scaffolding removed, prose de-noised, README Files table rewritten)
- [x] document the cross-repo `closed_commit` convention in `docs/puzzle-velocity.md` (#161 closed — column-reference row + a "Cross-repo closes" callout in the `closed_commit` section)

## Oracle Parity and Research

- [ ] finish deriving the exact oracle `sext` semantics
  - [ ] explain the transform from the observed oracle outputs in `experiments/sext_sweep.a`
  - [ ] explain the transform from the observed oracle outputs in `experiments/sext_boundaries.a`
  - [ ] update implementation and tests to match the oracle
- [ ] finish `.org` parity work
  - [ ] decide whether to support `.orig` as a synonym
  - [ ] decide whether to match oracle’s 1-byte `o` artifact on `.org` assembly failure
  - [ ] add / finalize parity tests for forward-gap, backward-address, and invalid-operand `.org`
- [ ] continue `bp` / debugger parity research
  - [ ] determine whether non-interactive oracle runs always auto-continue after `bp`
  - [ ] decide how closely LCC.js should match oracle breakpoint stdout before full debugger parity work
- [ ] research the original 300-character line-length rule more precisely
  - [ ] whether comments count
  - [ ] whether there is a separate true label-length limit

## Core Behavior and Features

- [ ] implement operand type checking more systematically across mnemonics and directives
- [ ] decide and document linker output-location behavior for:
  - [ ] default `link.e`
  - [ ] custom `-o` output
- [ ] complete LCC / interpreter flag behavior cleanup and documentation
  - [ ] verify `-d`
  - [ ] verify `-m`
  - [ ] verify `-r`
  - [x] verify `-t` (implemented and tested)
  - [ ] verify `-f`
  - [ ] verify `-x`
  - [ ] verify `-l<loadpt>`
- [ ] continue symbolic debugger work
  - [x] implement more debugger commands (Phase 1+2 complete: g/q/r/m/b/i/h/s)
  - [ ] implement numeric step-count command (Phase 3)
  - [ ] decide the intended breakpoint/watchpoint scope for LCC.js
  - [ ] decide final infinite-loop-to-debugger behavior for CLI mode
- [ ] finish linker modernization
  - [ ] decide whether to add more pure seams beyond `parseObjectModuleBuffer(...)`
  - [ ] decide whether linker should remain mostly wrapper-oriented in the short term

## Test Coverage

- [ ] add more direct edge-case tests for assembler numeric and operand forms
  - [ ] malformed sign forms
  - [ ] trailing commas / empty operands
  - [ ] more malformed offset syntax variants
- [ ] add more LCC/linker routing edge-case coverage
  - [ ] mixed extension link scenarios
  - [ ] `-o` edge cases
  - [ ] custom-named output report behavior
- [ ] keep research-marked tests current with oracle findings
- [x] lock in `.e`-path LST hex-only parity vs oracle (no source/comments), whitespace-lenient (#156, closed in 048bff4)
- [x] establish first test coverage for `src/plus/*` and `src/extra/*` — scope ticket #166 decomposed into per-file children #196 (disassembler), #197 (assemblerplus), #198 (interpreterplus), #199 (lccplus), #200 (linkerStepsPrinter)

## Claude Skills

A Claude skill that teaches Claude (and other LLM agents) to write idiomatic,
correct LCCjs assembly. Base LCC ISA first; LCC+ deferred. Sequenced as
research → build → validate so the design is pinned down before implementation.
Charlie's textbook-demo conventions (#104) are an input to the design.

- [x] research the skill: scope, source materials, structure, evaluation criteria — design in `docs/lccjs-assembly-skill-design.md` (#115 closed)
- [x] build the skill per the design — split into #116a–d (see design §7) (#116 closed)
- [x] validate the skill: end-to-end + known-pitfall coverage — first-pass validation in `docs/lccjs-assembly-skill-validation.md`; 5/6 assembled, all 4 pitfall classes steered correctly; one different-axis miss (N3 invented `puts`) filed as follow-up #148 (#117 closed)
- [x] incorporate #117 validation findings into the skill — refine SKILL.md based on observed failures and reasonable-but-suboptimal patterns (skill 0.6.0, both children closed)
  - [x] enumerate legal LCC trap set in SKILL.md so agents stop inventing `puts`/`printf` (#148 closed; skill 0.5.0)
  - [x] surface `nl` as the canonical newline idiom + tighten house-style scoping language (#149 closed; skill 0.6.0)
- [x] tighten validation methodology — make future fan-out passes leave a cleaner working tree (#160 closed)
- [ ] build a sibling `lccplus-assembly` skill for `.ap` programs — stub scaffolded at `claude-config/skills/lccplus-assembly/` (v0.0.1); follow the same research → build → validate pipeline as the base skill
  <!-- @todo #154:60m/ARC research/scope the lccplus-assembly skill — LCC+ pitfalls beyond the base set, extra-trap idioms, design doc mirroring docs/lccjs-assembly-skill-design.md; see #154 -->

## Docs Presentation / Syntax Highlighting

GitHub.com renders `.a`/`.ap` with a remapped stock grammar (`asm`/NASM, see
`.gitattributes`) — consistent but LCC-unaware, and there's no per-repo
custom-grammar hook. Spike whether to surface the real `lcc-tools` TextMate
grammar via Shiki, on a public GitHub Pages site and/or a Tampermonkey
userscript.

- [ ] spike Shiki + custom-grammar approaches for LCC highlighting (Pages site and/or Tampermonkey userscript)
  <!-- @todo #127:60m/DEV spike beautiful LCC highlighting via Shiki + lcc-tools .tmLanguage — evaluate GitHub Pages docs site vs Tampermonkey userscript (or both), then decompose the chosen path into build puzzles. See #127 -->

## Interactive Debugger Architecture

The interactive stepping debugger keeps its "what mode are we in?" state in several
independent flags (`running`, `debugMode`, `efficientMode`, `currentIteration`,
`stackAnchor`, `memDisplay*`, …) reconstructed ad hoc at each prompt. Statechart
modeling (likely XState, the JS-native SCXML-lineage library) could make the active
state the single source of truth — with an orthogonal region for display config — so
illegal mode combinations become unrepresentable and the debugger becomes unit-testable
by replaying events. Scope the idea (adopt XState vs. hand-roll vs. keep flags) before
committing. Full context in `docs/research/xstate-iinterpreter.md`.

- [ ] research a statechart for `iinterpreter.js` modes/UI; decide adopt-XState vs hand-roll vs keep-flags, then decompose into build puzzles
  <!-- @todo #134:60m/ARC research an XState (or hand-rolled) statechart for the interactive debugger's modes/UI in src/interactive/iinterpreter.js — exec region + orthogonal display region; assess dependency cost and snapshot/time-travel coupling; keep the per-opcode step() switch out of scope. Design in docs/research/xstate-iinterpreter.md; see #134 -->
- [x] DRY the core symbolic debugger vs the `ilcc`/`iinterpreter` extension — ROI map in `docs/research/debugger-ilcc-dry.md` (#146 closed). Build puzzles: format.js #163 (done), stateDelta.js #164. Do #164 before #134.

## Velocity / Calibration Analytics

The `stats/` notebooks track estimate-vs-actual calibration off `docs/puzzle-velocity.csv`.
The #206 re-run (74-row CSV) confirmed the ~3× over-pad bias but surfaced two confounds
in the over-time signal — see the open follow-up below.

- [ ] de-confound the velocity over-time drift signal — switch §1 day-bucketing UTC→HST and decide whether TEST needs its own correction constant (for a human; surfaced by the #206 re-run)
  <!-- @todo #208:45m/RESEARCH de-confound velocity over-time drift — the day-02 notebook's rising per-day ratio (2.42→3.33→5.00x, raw rho=+0.299) is confounded by (a) role mix (within-WRITER rho=+0.076 n.s.; TEST 7.5x is a structural outlier vs DEV/WRITER ~2.5x) and (b) UTC day-bucketing that manufactures a spurious 3rd day (UTC-05-30 n=11 is really the 05-29 HST evening session — only 2 HST working days). Re-bucket by HST + re-test; decide per-role correction constants vs one global 0.33x. Evidence in #206 close + stats/day-two-analysis.ipynb. See #208 -->

## Nice-to-Have Cleanup

- [x] refactor mnemonic / machine-word constants into clearer shared definitions where it improves readability (16 base opcode constants in assembler.js)
- [ ] add a lightweight benchmark script for large assembly / interpretation runs
- [ ] add optional observability hooks for parse/runtime counters if they can stay low-noise
