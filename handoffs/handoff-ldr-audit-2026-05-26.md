# Handoff: LCC `ldr` negative-offset bug audit

**Date:** 2026-05-26
**Workspace:** `/home/avi/Documents/Study/JavaScript/lccjs`
**Branch:** `improve-docs-branch-2026-may-25-01` (clean at start; uncommitted work is in `/tmp/ldr-probe/` only — nothing written under the repo yet)
**Original conversation goal:** New bug audit under `public_experiments/` for an OG LCC bug Charlie surfaced — `ldr` with space-separated operands and a negative `offset6` silently misassembles.

---

## What's been established (do NOT re-verify; just build on it)

### 1. The bug is real and worse than originally reported

Charlie (former Assembly prof) said OG LCC "does not work properly" on `ldr r1 fp -1` (no commas, negative). The first repro showed it's a **silent miscompile**, not a parse rejection:

| Source line | OG LCC encoding |
|---|---|
| `ldr r1 fp 0` | `6340` ✓ (offset=0) |
| `ldr r1, fp, 0` | `6340` ✓ |
| `ldr r1 fp 1` | `6341` ✓ (offset=+1) |
| `ldr r1, fp, 1` | `6341` ✓ |
| **`ldr r1 fp -1`** | **`6340` ✗ (offset=0 — `-1` silently dropped)** |
| `ldr r1, fp, -1` | `637f` ✓ (offset=−1) |
| **`ldr r1 fp -2`** | **`6340` ✗** |
| `ldr r1, fp, -2` | `637e` ✓ |

Same pattern for `str` (confirmed: `str r1 fp -1` → `7340`; `str r1, fp, -1` → `737f`).

Severity is **high**: no error, no warning, program compiles but does the wrong thing. Worse than the cuh63 `mov` regression already filed (OB-008).

### 2. Scope confirmed by user (`AskUserQuestion` answers)

- Cover: ldr bug + str (sibling) + `ld r0, x+1` label-arithmetic parity + side-by-side OG vs LCC.js.
- Deliverables: subdir README, `docs/cuh63-ldr-negative-offset-bug-report.md`, update `public_experiments/README.md` index.
- For LCC.js findings: only add to `open_bugs.md` if it's a **well-defined discrepancy**. If only doubts/parity-confusion, file in a new `open_questions.md` (or `investigate_parity_issues.md`).

### 3. Patterns to mirror (already read into context)

- `public_experiments/cuh63_audit/probe.sh` — bash sweep, indented assembly, `Error` grep, encoding extraction from `.lst`.
- `public_experiments/cuh63_audit/README.md` and `public_experiments/mov_mvi_parity/README.md` — README structure.
- `docs/cuh63-mov-immediate-bug-report.md` — upstream bug-report structure (Summary, Environment, Minimal repro, Expected behavior, Why it matters, Suggested fix, Scope verification, Other observations, Probe scripts).
- `open_bugs.md` — entry format with ID/GH#/severity/where/description/repro/fix.

### 4. Reusable shell-probe boilerplate that works

```bash
cd /tmp/ldr-probe && probe() {
  printf "    %s\n    halt\n" "$1" > t.a
  out=$("$LCC_ORACLE" t.a </dev/null 2>&1) || true
  if echo "$out" | grep -q "^Error"; then
    enc="REJECT"
  else
    enc=$(grep -E "^[0-9a-f]{4}  [0-9a-f]+" t.lst 2>/dev/null | head -1 | awk '{print $2}')
  fi
  printf "  %-34s => %s\n" "$1" "$enc"
}
```
**Critical:** the source must be **indented** (`    %s`). If you put the instruction at column 0, LCC interprets it as a label, which throws off the assembler in confusing ways.

The first comprehensive probe sweep I tried as a multi-line `for` loop **died after 2 iterations** in the background runner — the working approach is calling `probe "..."` line-by-line.

### 5. Environment

- `LCC_ORACLE=/home/avi/Documents/Study/Assembly/cuh63/lcc` (set in `/home/avi/Documents/Study/JavaScript/lccjs/.env`).
- Probes need `name.nnn` in CWD (LCC writes to it for `.lst`/`.bst` header).
- `/tmp/ldr-probe/` is the working dir for experiments — has `name.nnn` and `t.a`/`t.lst` lying around from session.

---

## What's NOT done yet (the work)

Task list (from `TaskList` — IDs are persistent):
1. ✅ in-progress: Reproduce ldr negative-offset bug on OG LCC (mostly done — confirmed)
2. ⏳ Check LCC.js behavior on the same inputs (NOT STARTED — Charlie claims LCC.js handles it correctly; verify by running the same probes via `node src/core/lcc.js` or whichever CLI entry)
3. ⏳ Explore scope: str (partly done — confirmed same bug), ld/st (pcoffset9, different parser path), lea, label+offset (`ld r0, x+1`)
4. ⏳ Build `public_experiments/ldr_comma_offset/probe.sh` — side-by-side OG vs LCC.js, à la `probe_mvi.sh`
5. ⏳ Subdir README
6. ⏳ `docs/cuh63-ldr-negative-offset-bug-report.md`
7. ⏳ Add row to `public_experiments/README.md` index
8. ⏳ Decide LCC.js doc destination (open_bugs.md vs new open_questions.md)

The user interrupted mid-investigation, before LCC.js parity was checked and before any files were written into the repo. Decide on the subdir name with the user (proposed `ldr_comma_offset/`) before creating it — they may prefer a more descriptive name now that the bug is known to be a silent miscompile, not a parse issue.

---

## Things to verify / things to remember

- **The `mov`-immediate user message was misleading on one detail:** Avi's exercise program contains `mov r0, 5`, `mov r0, 10`, `mov r0, 15` — those are all positive, so the OB-008 cuh63 `mov`-negative regression is NOT triggered. The program also has a standalone `s` line which is likely a typo or debugger command; ignore it unless it's relevant.
- **Charlie's `ld r0, x+1` example** is a *feature parity* question, distinct from the `ldr` bug. The user wants both covered in this audit but they should be presented as separate findings.
- **Don't write into `open_bugs.md`** unless you can point at a concrete LCC.js bug. The user was explicit: doubts go in `open_questions.md` / `investigate_parity_issues.md` instead.
- **LCC.js CLI**: check `src/core/lcc.js` for the entry point; project uses jest tests, not a published bin. Likely invocation is `node src/core/lcc.js file.a`.

## Open questions for the user (don't assume)

- Subdir name: `ldr_comma_offset/`? `ldr_negative_offset_silent_miscompile/`? Something tighter?
- Bug report filename: `cuh63-ldr-negative-offset-bug-report.md` or `cuh63-ldr-comma-offset-bug-report.md`?
- If LCC.js *also* silently miscompiles `ldr r1 fp -1` (i.e., it has the same bug), that flips the severity narrative — confirm whether to file as OB-### immediately or fold it into the same investigation doc.

## Suggested skills for the next session

- **diagnose** — disciplined bug-investigation loop; the silent-miscompile aspect deserves a "hypothesise → minimise → confirm" pass before writing the upstream report.
- **yegor-bdd** — frame the cuh63 upstream report as "have X / should have Y / repro" if the user wants to file it as a ticket rather than a doc.
- **yegor-pdd** — if any sub-problem (e.g. "characterize `lea` / `ld` / `st` with no commas") is being deferred, drop a `@todo #N` puzzle at the code site or in the new subdir's README rather than leaving floating TODOs.

## Files referenced (read once; don't re-read unless changed)

- `/home/avi/Documents/Study/JavaScript/lccjs/public_experiments/cuh63_audit/probe.sh`
- `/home/avi/Documents/Study/JavaScript/lccjs/public_experiments/cuh63_audit/README.md`
- `/home/avi/Documents/Study/JavaScript/lccjs/public_experiments/mov_mvi_parity/README.md`
- `/home/avi/Documents/Study/JavaScript/lccjs/public_experiments/README.md`
- `/home/avi/Documents/Study/JavaScript/lccjs/docs/cuh63-mov-immediate-bug-report.md`
- `/home/avi/Documents/Study/JavaScript/lccjs/open_bugs.md`
- `/home/avi/Documents/Study/JavaScript/lccjs/.env`
