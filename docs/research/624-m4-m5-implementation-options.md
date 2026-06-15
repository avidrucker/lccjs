# M4 & M5 Implementation Options — #624 spike

**Parent:** [#624 Tracker: act on #610 orchestration failure mode mitigations](https://github.com/avidrucker/lccjs/issues/624)
**Relevant child issues:** [#628 (M4)](https://github.com/avidrucker/lccjs/issues/628) · [#629 (M5)](https://github.com/avidrucker/lccjs/issues/629)
**Date:** 2026-06-04 · **Agent:** CHERRY

---

## Context

Part of the #624 tracker, which acts on the 13 failure-mode mitigations from `docs/research/orchestration-failure-modes.md`. M1 and M2 are gated on a human ruling (#689). M3 (#627) is already closed. This document covers M4 and M5.

---

## M4 — `puzzle:status` machine-readable output (#628)

### Current state

`scripts/puzzle-status.js` has had a `--json` flag since its very first commit (230bab1, the initial reconciler landing). It is fully functional today:

```bash
node scripts/puzzle-status.js --json
```

Output shape:
```json
{
  "ghAvailable": true,
  "rows": [
    {
      "keyword": "todo",
      "issue": 255,
      "file": "src/core/interpreter.js",
      "line": 47,
      "text": "// <puzzle marker line> …",
      "status": "BLOCKED",
      "stale": false,
      "detail": "open but labeled `blocked` — not grabbable yet"
    }
  ]
}
```

Status values present: `AVAILABLE`, `CLAIMED`, `IN-PROGRESS`, `LOCKED`, `BLOCKED`, `STALE`. The `stale` boolean, `detail` string, and `file`/`line` provenance are all in every row.

The script also exports its internals as a Node module (`scripts/puzzle-status.js:240`):

```js
module.exports = { findMarkers, findWorktrees, findIssueStates, classify, loadClusters, clusterLockers };
```

### Gap

1. **No per-issue filter** — no `--issue N` flag to narrow output to one row. Workaround: `jq '.rows[] | select(.issue == N)'`, or use the module API directly.
2. **Exit-code contract is limited** — `--strict` exits 1 only on STALE markers; no general AVAILABLE vs CLAIMED exit code for callers who just want "can I grab this?".

### Key code sites

- `scripts/puzzle-status.js:37` — `const AS_JSON = process.argv.includes('--json');`
- `scripts/puzzle-status.js:188–193` — JSON branch of `main()`
- `scripts/puzzle-status.js:240` — `module.exports`

### Options for the human decision

| Option | Description | ~Lines |
|--------|-------------|--------|
| **A — Declare done** | `--json` already satisfies the machine-readable contract; close #628 | 0 |
| **A+ — Per-issue filter** | Add `--issue N` flag: filter `rows` to the one entry matching N before printing | +5 |
| **B — Exit codes** | Exit 0 = AVAILABLE, exit 1 = not-AVAILABLE (CLAIMED/IN-PROGRESS/LOCKED/STALE/BLOCKED), exit 2 = unknown issue | +8 |
| **C — Both A+ and B** | Per-issue filter + exit codes | +13 |

### Perceived ROI

**Low for A+/B in isolation.** The module API already covers M5's needs (see below), so neither the per-issue filter nor exit codes are required to unblock M5. If a shell-script consumer appears outside JS, A+ and B are trivial additions at that point.

### Recommendation

**Option A — declare done.** Close #628 with "already resolved." The `--json` output satisfies the machine-readable contract stated in the issue. M5 should use the module API.

---

## M5 — `claim.js` print `puzzle:status` before staking (#629)

### Current state

`scripts/claim.js` performs two pre-stake checks:

1. **CLOSED guard** (`shouldBlockClaim`, line ~235): reads `gh issue view N --json title,state,comments` and dies if the issue is CLOSED. Bypassed by `--force`.
2. **Same-fruit duplicate guard** (`branchExists(branch)`, inside the candidate loop, line ~315): dies if the exact branch name (`<fruit>/issue-N-<slug>`) already exists.

Neither check catches the case where a *different* fruit's worktree already owns the target issue.

### Gap

An agent can claim issue #N even while another agent's worktree is already live on it. Example: BANANA has `.claude/worktrees/banana-issue-628` and CHERRY runs `npm run claim 628 --as cherry`. The `branchExists('cherry/issue-628-…')` check passes (CHERRY has no such branch), so a second worktree is staked and two agents work the same issue in isolation.

### Key code sites

- `scripts/claim.js:main()` — line ~287, `warnOrphanedWorktrees()` call (insertion point for the new check)
- `scripts/claim.js:readIssue()` — line ~222, the existing gh round-trip (already has `--force` bypass pattern to follow)
- `scripts/puzzle-status.js:findWorktrees()` — exported; returns `{ worktrees, byIssue }` where `byIssue` is a `Map<issueNum → worktree>`

### Implementation path

```js
// At top of claim.js, add one require:
const { findWorktrees } = require('./puzzle-status');

// In main(), after warnOrphanedWorktrees() and before the worktree-add loop:
const { byIssue } = findWorktrees();
const existingWt = byIssue.get(Number(issue));
```

Then apply the chosen option:

#### Option A — informational only (~6 lines)

```js
if (existingWt) {
  console.log(`[claim] ℹ issue #${issue} is already claimed in ${existingWt.branch} — proceeding.`);
}
```

No new failure modes blocked; agent is informed but not protected.

#### Option B — warn + `--force` (~10 lines) — **recommended**

```js
if (existingWt && !opts.force) {
  die(`issue #${issue} is already CLAIMED in ${existingWt.branch} ` +
      `(path: ${existingWt.path}). Pass --force to stake a second worktree anyway.`);
}
if (existingWt) {
  console.error(`[claim] ⚠ issue #${issue} already CLAIMED in ${existingWt.branch} — proceeding (--force).`);
}
```

Consistent with the existing `--force` bypass for the CLOSED check. Fails safe offline: `findWorktrees()` reads `git worktree list --porcelain` (local, no network), so it never blocks on missing `gh`.

#### Option C — hard block (~8 lines)

```js
if (existingWt) {
  die(`issue #${issue} is already CLAIMED in ${existingWt.branch}. No override available.`);
}
```

Most protective, but breaks the `--force` escape and may over-block legitimate "second pass" workflows (e.g. a second agent deliberately extending a spike).

### Perceived ROI

**High for Option B.** The existing CLOSED guard established the `--force` escape as the project's standard bypass. Option B extends that pattern naturally. The `findWorktrees()` call is local (no network), so it adds near-zero latency. This directly addresses failure modes B-1 and B-3 from `docs/research/orchestration-failure-modes.md`.

### Recommendation

**Option B.** Warn + die unless `--force`. ~10 lines in `claim.js`, no changes to `puzzle-status.js`. Unblocks the M5 DEV ticket.

---

## Open questions

1. **M4 — close or add A+/B?** Depends on whether a shell-script consumer (outside Node) is anticipated. If only `claim.js` and the skill need the data, the module API suffices and `--json` is enough.
2. **M5 — does Option B apply to the `--dry-run` path?** The dry-run branch (`opts.dryRun`) currently prints a plan and returns early. Should it also check and print the CLAIMED status? Probably yes — an agent in dry-run mode still benefits from knowing the issue is already taken.

---

## Summary

| Item | Finding | Recommended action |
|------|---------|-------------------|
| M3 (#627) | Pre-close finding audit landed as step 4 in `claude_workflow.md` (55c12411) | Already closed ✓ |
| M4 (#628) | `--json` shipped in original commit 230bab1; full status data available today | Close as already resolved (Option A) |
| M5 (#629) | Cross-fruit duplicate claim gap confirmed; `findWorktrees()` already exported | Adopt Option B (warn + `--force`); ~10 lines |
