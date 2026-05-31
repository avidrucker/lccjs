# Closed-Issue Audit — 2026-05-31

**Agent:** BANANA · **Ticket:** #294 · **Method:** git log + GitHub API cross-reference

## Scope

233 closed issues audited as of 2026-05-31.

- **185 (79%)** closed via `git log` `Closes #N` / `Resolves #N` / `Fixes #N`
- **48 (21%)** closed without a git commit reference (manual UI close or parent-issue resolution)

---

## Findings

### FINDING 1 — Confirmed mis-close (unresolved work) · #278

**Status:** OPEN / REOPENED

**What happened:** Commit `ef8a0a96` ("TIL 2026-05-30 CHERRY s3 — close-sequence hardening") carried `Closes #278` via digit transposition. Issue #278 is a DATA ticket — "complete + document the model column migration in puzzle-velocity.csv (123 rows un-backfilled, #275 row misaligned)" — which had no work done on it. The TIL's real issue was #279, which stayed open. Caught manually; #278 was reopened, #279 closed correctly against `ef8a0a96`.

**Current state:** #278 is OPEN/REOPENED. Work (123-row backfill + column documentation) has not been done. This is the only confirmed case of real work being silently dropped.

**Evidence:** `stateReason: REOPENED`; no velocity row for #278; issue body describes 123 unbackfilled rows.

---

### FINDING 2 — Partial-scope close · #188

**Status:** OPEN / REOPENED

**What happened:** Commit `df6c1c2c` ("feat(hooks): gate pre-push on in-progress rebase/merge + conflict markers") closed #188 alongside #205. Issue #188 is a broad scope ticket — "Adopt a concurrency-safe work-tracking/coordination process for multi-agent worktree development." The git-hooks commit addressed one concrete sub-problem (conflict-marker gate) but not the full coordination process. Issue was subsequently reopened.

**Current state:** #188 is OPEN/REOPENED with an `@todo` marker at `docs/worktree-multi-agent-findings.md:6`. This is an architectural scope issue, not a transposition error. No dropped deliverable — it is actively tracked.

---

### FINDING 3 — Issues closed without git commit reference (48 issues)

**Low risk overall.** Breakdown:

| Group | Count | Assessment |
|---|---|---|
| Early issues (#4–#89) | ~35 | Pre-PDD-convention era; manually closed or closed before `Closes #N` discipline established. No concern. |
| Tracker / parent issues (#107, #108, #111, #116, #166, etc.) | ~10 | Legitimately closed when child issues completed (e.g. #166 decomposed to #196–#200; #108 parent of glossary children). |
| Skill-build issues (#137–#140, #148, #149) | 6 | Velocity rows confirm work done; manually closed after deliver. |
| Research assessed by sibling tickets (#243) | 1 | #243 (skipped-suite assessment) closed after #244 + #245 resolved both underlying questions. Manual close appropriate. |
| Intentional NOT_PLANNED (#118, #232, #274) | 3 | Explicit wontfix decisions. |

No undelivered work found in this group.

---

### FINDING 4 — False positives from keyword heuristic

The following 7 issues showed low keyword overlap between commit subject and issue title, but investigation confirmed all are legitimate closes:

| Issue | Why flagged | Why it's fine |
|---|---|---|
| #125 | "glossary" ≠ "E/e/V types" | Research was embedded inline in the glossary commit; both #122 + #125 were addressed. |
| #126 | ".bst binary listing" ≠ "what is .bst" | Commit title *is* the research answer, abbreviated. |
| #153 | "malloc/free leak" ≠ "chore pm" | Intentionally closed NOT_PLANNED (wontfix). |
| #166 | "coverage" ≠ "test scope" | Scope decomposition close — child tickets #196–#200 carry the work. |
| #204 | "velocity row re-key" ≠ "PM ticket" | PM ticket; commit explicitly re-keyed the row to match. |
| #215 | "cross-link cluster" ≠ "velocity log" | Retroactive tracking ticket — issue body says "work already done; filed so velocity row has a ticket key." |
| #275 | "snapshot accuracy" ≠ "model column" | DRAGONFRUIT verification result was logged in the same commit alongside the model-column add. |

---

## Coverage statement

The audit covered all 233 closed issues. The only undelivered-work finding is **#278** (1 issue). The only structural gap is **#188** (already tracked with a `@todo` marker). No other silent drops detected.

Commits that close multiple issues (9 found) were individually verified — all multi-closes are thematically related or intentional scope merges.

---

## Guard recommendations

These tie directly to the #278 failure mode and the broader `Closes #N` transposition risk.

### Guard 1 — velocity-row / Closes #N ticket-match check in `npm run close` (HIGH ROI)

When the close script builds the commit, assert that the velocity-row JSON's `ticket` field equals the `Closes #N` in the commit message. A transposition (TIL commit logging ticket 279 while `Closes #278`) is caught before it fires.

**Ties to:** #281 ("convert prose rules into executable guards"), #276 field-count guard, `scripts/close.js`.

### Guard 2 — issue-title keyword spot-check at close time (MEDIUM ROI)

Pull the issue title from `gh issue view N --json title` inside `npm run close` and verify that ≥1 non-trivial word from the title appears in the commit subject. Low-precision but catches gross mismatches (TIL vs CSV-migration). Allow a `--skip-keyword-check` escape hatch for legitimate low-overlap closes (e.g. retroactive tracker tickets like #215).

### Guard 3 — `puzzle:status` closed-state reconciliation sweep (LOW ROI, deferred)

A periodic script that: for each CLOSED issue that has a velocity row, confirms the `closed_commit` (if non-null) references a commit whose diff plausibly matches the issue subject. Expensive to run and low-precision; deferred until Guard 1 + 2 are in place.

---

## Reopen recommendations

| Issue | Action |
|---|---|
| **#278** | Already OPEN/REOPENED. Needs: 123-row agent-column backfill + column documentation in `docs/puzzle-velocity.md`. File a child DATA ticket if the scope is >60 min. |
| **#188** | Already OPEN/REOPENED with `@todo`. No action from this audit. |

No other reopens recommended.
