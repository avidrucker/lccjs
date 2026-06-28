# Handoff — lccjs#1487: document the ticket lifecycle + prove byte-parity with pmtools

- **Issue (full spec + acceptance):** https://github.com/avidrucker/lccjs/issues/1487
- **Sibling (the other half):** avidrucker/pmtools#92 — handoff at pmtools `docs/handoffs/handoff-92-ticket-lifecycle-parity.md`
- **Written by:** APPLE · **For:** whichever agent claims #1487. Read the issue first; this doc is the *execution context*, not the spec (the acceptance list lives in #1487).

## Mission in one line
Produce lccjs' authoritative end-to-end ticket-lifecycle spec (every phase: trigger · inputs · outputs/side-effects · guards · exit codes · ordering), then a reconciliation table proving it matches pmtools's exactly. See #1487 for the checklist.

## ⚠ The independence rule IS the deliverable — do not break it
- You author the **lccjs** side only. A **different** agent authors pmtools#92. **Do NOT read pmtools's docs/code while drafting** — derive lccjs' lifecycle from *lccjs'* own code/scripts. Copying the sibling voids the whole point.
- A **third** agent (or each verifying the other) runs the field-by-field cross-check. The verifier ≠ you, and is named alongside you in the closing comment.
- The ONLY sanctioned difference between repos is the invocation surface (`npm run <cmd>` vs `pmtools <cmd>`). Anything else that differs is a **finding** → file a follow-up ticket; never silently "reconcile" it.

## Your sources — derive the spec from the CODE/scripts, not from memory
- `docs/claude_workflow.md` — the canonical workflow protocol (per-puzzle phases, claim mechanics, the close sequence, tool-failure discipline). Start here, but cross-check it against the scripts below — the doc may lag the code.
- `scripts/close.js` — the real close ordering and guards (velocity-row guard, keyword/subject guard, marker-deleted scan, on-origin-main gate, the detached-subprocess teardown). This is the authoritative ordering for the close phase.
- `scripts/claim.js` — identity (`--as <fruit>`), worktree stake, claim mechanics, marker flip.
- `scripts/velocity-log.js`, the preflight script, and the `npm run` wiring in `package.json` (`claim` / `preflight` / `velocity:log` / `close` → which script each maps to, and the `--` arg-forwarding quirk).
- `docs/skills.md`, `docs/do-this-not-that.md`, `docs/project-gotchas.md` — the workflow conventions + footguns that are *part of* the lifecycle contract.

## The lifecycle, abstractly (orientation — I primarily run the pmtools side, so VERIFY every phase against lccjs's own scripts)
1. **Orchestrate/triage** → assignment.
2. **Verify issue OPEN** (`gh issue view N`).
3. **Claim** — `npm run claim -- N --as <fruit>` → stakes a worktree, marks the claim, flips the `@todo`/`@inprogress` marker. (Confirm the exact ref/marker mechanics in `scripts/claim.js` — pmtools uses an origin `refs/claims/*`; verify what lccjs does, that's exactly the kind of phase-detail the parity check must compare.)
4. **Preflight** — `npm run preflight -- N` (start-time stamp, start-of-task reads, assert OPEN).
5. **Work** in the worktree (TDD; the pure-seam vs CLI-wrapper boundary).
6. **Velocity** — `npm run velocity:log -- '<json>'` before close (the close velocity-row guard).
7. **Commit** `Closes #N`.
8. **Close** — `npm run close -- N` (or `node scripts/close.js N --branch <branch>` from the main root to avoid the getcwd-exit-1 artifact — see `do-this-not-that.md`). Lands trunk-based, then tears down.
9. **Post-close** — comment naming the deliverable.

## Cross-repo notes (from authoring the pmtools side)
- pmtools' close has a **numbered 13-step guard sequence** in `CONTRACT.md §close` — your reconciliation table will want lccjs' close steps in the **same numbered form** so the two line up row-for-row. The interesting comparisons: guard *ordering* (does the velocity-row guard run before or after the keyword guard? before or after the land loop?), exit codes (usage error → 2, operational → 1, success → 0 in pmtools), and the recovery/already-pushed path.
- **Known shared gotcha:** the exit-1-after-`CLOSE OK` getcwd artifact is the *caller's shell*, not the tool, in both repos (lccjs `errors.csv` row 129; pmtools#8) — it's an operational footnote of the close phase, not a guard.

## Suggested skills
- `yegor-spikes` — bounded research/scope spike; produce the spec, don't over-build.
- `yegor-tickets` — the spec + parity result live in the repo + the closing comment.
- `write-til-doc` / `next-best-action` (at close) — capture findings; every divergence is a follow-up ticket.
- `puzzle-velocity` — log the row before closing.

## Done when
#1487's acceptance boxes are all checked AND pmtools#92's are too — they close in **lockstep**, each independently verified by a different agent.
