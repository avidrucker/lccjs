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
- [ ] label `progress-report.md`, `progress-report-2.md`, and `progress-report-3.md` as historical snapshots

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
  - [ ] verify `-t`
  - [ ] verify `-f`
  - [ ] verify `-x`
  - [ ] verify `-l<loadpt>`
- [ ] continue symbolic debugger work
  - [ ] implement more debugger commands
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

## Nice-to-Have Cleanup

- [ ] refactor mnemonic / machine-word constants into clearer shared definitions where it improves readability
- [ ] add a lightweight benchmark script for large assembly / interpretation runs
- [ ] add optional observability hooks for parse/runtime counters if they can stay low-noise
