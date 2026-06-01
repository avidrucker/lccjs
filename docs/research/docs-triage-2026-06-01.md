# docs/ Triage — 2026-06-01 (FIG, #383)

Survey of all 113 markdown files across 7 subdirectories. Verdict per file:
**KEEP** (current, standalone, needed as-is) · **UPDATE** (relevant but stale) ·
**ARCHIVE** (purpose served, safe to delete — git history preserves content) ·
**DELETE** (fully superseded, no unique content).

No files were mutated. This document is the input for follow-on cleanup puzzles.

---

## Summary

| Verdict | Count |
|---------|-------|
| KEEP    | 76    |
| UPDATE  | 3     |
| ARCHIVE | 22    |
| DELETE  | 0     |
| **Total** | **101*** |

\* TIL session entries (42 files) counted as one group.

---

## ARCHIVE — safe to delete (22 files + 1 group candidate)

These are spike outputs whose questions have been answered, one-shot reports
whose work is resolved, or snapshots superseded by later docs. Git history
preserves everything.

### docs/research/ (17 files)

| File | Reason |
|------|--------|
| `agent-instruction-compliance.md` | Root-cause analysis of agent compliance drift (#281 closed); findings applied, historical only |
| `blank-e-on-failed-assembly.md` | Oracle characterisation probe (#263); findings in parity_deviations.md, spike done |
| `closed-issue-audit-2026-05-31.md` | Cross-reference audit (#294 closed); historical snapshot, work resolved |
| `close-protocol-gaps.md` | Gap analysis feeding #357; recommendations implemented, spike complete |
| `close-sequence-hardening.md` | Process-hardening research for close.js (#242); all recommendations shipped |
| `close-time-guard-design.md` | Guard design for close-time velocity check (#301); implementation filed and shipped |
| `csv-from-main-footgun.md` | Root-cause of CSV-read footgun (#319); guard implemented (#320), done |
| `hex-ux-feedback.md` | UX feedback on .hex messaging (#368); recommendation executed, DEV ticket filed+resolved |
| `ilcc-interactive_lccjs.md` | External project survey (aidanod3/web_ilcc); no lccjs implementation, archived |
| `jmp-condition-suffix-mnemonics.md` | Probe of jmp suffix acceptance (#151); answer documented in lcc-isa.md |
| `label-length-limit.md` | Label-length limit probe (#245); no limit found, research complete |
| `lccjs-i18n-research.md` | Non-ASCII feasibility exploration; architectural constraint identified, deferred/abandoned |
| `process-adherence-self-audit-2026-05-29.md` | Agent self-audit (#203); findings applied, historical |
| `sqlite-schema-questions.md` | Schema questions from #289/#290; all 5 resolved by BANANA in #284 |
| `velocity-log-storage.md` | CSV→SQLite migration research (#186); SQLite canonical store shipped (#290), done |
| `web-ilcc.md` | External project survey (SUNY New Paltz); no lccjs implementation, archived |
| `worktree-teardown-regression-testing.md` | Design spike on teardown regression (#317); approach decided, done |
| `xstate-iinterpreter.md` | xstate feasibility for iinterpreter (#134); investigation complete, deferred/abandoned |

### docs/ top-level (2 files)

| File | Reason |
|------|--------|
| `commit-quality-findings.md` | Conventional-commits audit snapshot (2026-05-31); historical record, work resolved |
| `init_code_review.md` | See UPDATE section — borderline archive, needs a stale-snapshot banner first |

### docs/learnings/ (1 candidate)

| File | Reason |
|------|--------|
| `2026-05-25-lcc-oracle-e2e-bst-redundancy.md` | Historical investigation record; findings actioned; borderline — see UPDATE note below |

---

## UPDATE — keep but needs a fix (3 files)

| File | What needs updating |
|------|---------------------|
| `docs/puzzle-velocity.md` | Header/setup section describes CSV-only storage; SQLite migration (#290) made SQLite canonical. Update storage description and reflect current `velocity.db` + `velocity-export.js` architecture. |
| `docs/init_code_review.md` | Codebase assessment frozen at commit 87f41d4 (2026-05-24). Many bugs listed have since been fixed (#211, #31, #32, #59, #375). Add a dated-snapshot banner ("Assessment as of 2026-05-24; several items resolved — see linked issues") rather than deleting, since it remains the only systematic baseline quality scan. |
| `docs/learnings/2026-05-25-lcc-oracle-e2e-bst-redundancy.md` | Findings actioned but the doc has no "resolved" marker. Either archive or add a one-line "resolution: test simplified in #X" note. Borderline — archive is fine if the clean-up pass prefers fewer files. |

---

## KEEP (76 files)

All files not listed above. For reference, the key "always keep" categories:

**Core protocol docs (live, enforced):**
`claude_workflow.md`, `puzzle-lifecycle.md`, `pitfalls.md`, `parity_deviations.md`,
`oracle-setup.md`, `velocity-schema.md`, `puzzle-velocity.md` (after UPDATE)

**Module technical references:**
`assembler.md`, `interpreter.md`, `linker.md`, `lcc.md`, `assemblerplus.md`,
`interpreterplus.md`, `lccplus.md`, `api.md`, `artifacts-summary.md`,
`core-behavior-matrix.md`, `status.md`

**ISA references:**
`lcc-isa.md`, `lccplus-isa.md`

**User-facing docs:**
`tutorial_01_intro.md`, `who_lccjs_is_for.md`

**Skill docs:**
`lccjs-assembly-skill-design.md`, `lccjs-assembly-skill-validation.md`

**Design decisions (open or live):**
`design-agent-worktree-identity.md`, `worktree-multi-agent-findings.md`,
`trunk-vs-pr-decision.md`

**Upstream bug reports (keep until Prof. Dos Reis responds or closes):**
`cuh63-ldr-str-silent-miscompile-bug-report.md`,
`cuh63-line-length-silent-split-bug-report.md`,
`cuh63-mov-immediate-bug-report.md`

**Glossary (4 files):** all KEEP — live vocabulary for code readers

**cuh63/ chapters (15 files):** all KEEP — reference material paired with on-disk `.a` files

**agent-priorities/ (4 files):** all KEEP — live working-session constraints

**Research docs kept (12 files):**
`agent-identity-guidance-reconciliation.md`, `claim-fruit-session-scope.md`,
`codebase-quality-hotspots.md`, `debugger-ilcc-dry.md`, `debugger-oracle-parity.md`,
`interpreterplus-off-tty-stdin-contract.md`, `jmp-missing-operand-segfault.md`,
`line-length-limit.md`, `og-lcc-author-name-noninteractive.md`,
`sext-semantics-report.md`, `string-escape-parity.md`, `worktree-teardown-regression-testing.md`

Wait — `worktree-teardown-regression-testing.md` was classified as ARCHIVE above. Corrected keep list:
11 research docs kept (remove that one from this list).

**Learnings/ (45 files):** all KEEP as a group — session retrospectives feed periodic #207-style synthesis; README and `til-synthesis-2026-06-01.md` explicitly KEEP; `2026-05-26-pdd-adoption.md` is KEEP (canonical PDD rationale); the 42 TIL entries are KEEP as a group.

---

## Suggested follow-on puzzles

1. **CHORE (30m):** Delete the 17 archived `docs/research/` files + `commit-quality-findings.md` in a single commit.
2. **WRITER (20m):** Add dated-snapshot banner to `docs/init_code_review.md`; update `docs/puzzle-velocity.md` storage description to reflect SQLite-canonical architecture.
3. **WRITER (15m):** Archive or annotate `docs/learnings/2026-05-25-lcc-oracle-e2e-bst-redundancy.md`.
