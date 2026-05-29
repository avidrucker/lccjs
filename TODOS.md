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
- [ ] writer task: per-module glossary for `assembler.js`, `interpreter.js`, `linker.js` (parent #107; spike+write puzzles #108–#113; stubs in `docs/glossary/`)
- [ ] document the cross-repo `closed_commit` convention in `docs/puzzle-velocity.md` (5 rows so far reference claude-config SHAs)
  <!-- @todo #161:15m/WRITER add a sentence to the closed_commit row in docs/puzzle-velocity.md noting cross-repo SHAs (claude-config skill closes); see #161 -->

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
- [ ] lock in `.e`-path LST hex-only parity vs oracle (no source/comments), whitespace-lenient
  <!-- @todo #156:45m/DEV add a whitespace-lenient TDD parity test: extend the oracle helper to run on a .e, run lccjs interpreter.js vs oracle on the same .e; assert machine words match AND no .a comment/mnemonic text leaks into the .e .lst. Closes the .e-path oracle-coverage gap noted in #145. See #156 -->

## Claude Skills

A Claude skill that teaches Claude (and other LLM agents) to write idiomatic,
correct LCCjs assembly. Base LCC ISA first; LCC+ deferred. Sequenced as
research → build → validate so the design is pinned down before implementation.
Charlie's textbook-demo conventions (#104) are an input to the design.

- [x] research the skill: scope, source materials, structure, evaluation criteria — design in `docs/lccjs-assembly-skill-design.md` (#115 closed)
- [x] build the skill per the design — split into #116a–d (see design §7) (#116 closed)
- [x] validate the skill: end-to-end + known-pitfall coverage — first-pass validation in `docs/lccjs-assembly-skill-validation.md`; 5/6 assembled, all 4 pitfall classes steered correctly; one different-axis miss (N3 invented `puts`) filed as follow-up #148 (#117 closed)
- [ ] incorporate #117 validation findings into the skill — refine SKILL.md based on observed failures and reasonable-but-suboptimal patterns
  - [x] enumerate legal LCC trap set in SKILL.md so agents stop inventing `puts`/`printf` (#148 closed; skill 0.5.0)
  <!-- @todo #149:30m/DEV surface `nl` as the canonical newline idiom + tighten house-style scoping language in SKILL.md; see #149 -->
- [ ] tighten validation methodology — make future fan-out passes leave a cleaner working tree
  <!-- @todo #160:15m/WRITER add 'do not write files to disk; return text only' to subagent validation prompts in docs/lccjs-assembly-skill-validation.md; see #160 -->
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
- [ ] DRY the core symbolic debugger (`interpreter.js` debugMode) vs the `ilcc`/`iinterpreter` extension; ROI-rank reimplemented step/diff/dispatch logic, propose shared modules (do before #134 so the statechart targets consolidated code)
  <!-- @todo #146:60m/ARC research: map overlapping logic between interpreter.js debugMode (step loop, <reg=old/new>/<NZCV>/<pc> diff render) and src/interactive/ilcc.js + iinterpreter.js (prompt dispatch, mode flags); ROI-rank, propose shared module(s). Findings in docs/research/debugger-ilcc-dry.md; hand module boundaries to #134. See #146 -->

## Nice-to-Have Cleanup

- [x] refactor mnemonic / machine-word constants into clearer shared definitions where it improves readability (16 base opcode constants in assembler.js)
- [ ] add a lightweight benchmark script for large assembly / interpretation runs
- [ ] add optional observability hooks for parse/runtime counters if they can stay low-noise
