# public_experiments

Self-contained, sharable, runnable investigations into LCC behavior
— the kind of thing that can be linked in a bug report, posted in a
discussion thread, or run by someone unfamiliar with the LCC.js
internals.

Each subdirectory is one investigation. Each has its own README
explaining the question, the files, and how to run the probes.

Distinct from:

- **`experiments/`** (top-level): more general parity-research
  programs against the live oracle, integrated with the
  `experiments/runOracleExperiment.js` harness.
- **`scratch/`** (gitignored): in-flight notes and one-off probing
  that isn't ready to share.

## Index

| Investigation | Subject | Status |
|---|---|---|
| [`mov_mvi_parity/`](./mov_mvi_parity/) | cuh63 6.3 `mov` rejects negative immediates that its own `mvi` accepts; LCC.js `mov` silently wraps out-of-range values | both findings documented; LCC.js-side fix tracked in `open_bugs.md`; cuh63-side report drafted in `docs/cuh63-mov-immediate-bug-report.md` |
| [`cuh63_audit/`](./cuh63_audit/) | Broader sweep of cuh63 6.3 (~50 probes) confirming the `mov` regression is isolated and surfacing two undocumented minor behaviors (`.orig` accepted as `.org` synonym; duplicate `.start` last-wins) | audit results referenced from the bug report's "Scope verification" section |
