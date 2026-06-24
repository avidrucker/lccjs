# TIL 2026-06-24 — APPLE

**Context:** I was driving the pmtools-migration cluster (#1456) — switching lccjs's PM chores (claim/status/preflight/logging) from local `npm run` shims to the shared `pmtools` harness — and then built `npm run release` (#1437). What started as "flip four config lines" turned into finding three live-environment blockers and shipping two switches, one tool, and a multi-language port proposal.

---

## 1. Verify a drop-in replacement against PRODUCTION state, not fresh fixtures

**What happened:** The migration's readiness review (#1451) green-lit the switch — "verdict: go" — because pmtools' ports were schema-identical and byte-for-byte parity-tested. But that testing ran against *fresh, seeded* DBs and *clean* fixtures. Against the **live** repo, three of four switches broke on pre-existing state the review never exercised:
- **#1453 (logging):** `pmtools velocity log` died with `UNIQUE constraint failed` — its `connect()` recreates `uq_velocity_session` on every write, but the live `~/.lccjs/lccjs.db` holds 6 legacy duplicate `(ticket,agent,started_iso)` rows that block the index. Filed #1457 + pmtools#10.
- **#1454 (status):** `pmtools status` reported **94** STALE markers vs `npm run puzzle:status`'s **1** — it runs a bare `git grep` and ignores `.pddignore`, so it scrapes every `@todo` mention out of `docs/**/*.md`. Filed/handed to #1458.
- **#1454 (preflight):** worked, but stamped `~/.pmtools/<worktree-basename>/` instead of `~/.pmtools/lccjs/` because it keys its scratch dir off `basename(repoRoot)`, which under a worktree is the worktree name.

Every one of these is invisible on a fresh fixture and obvious against the live repo (legacy rows, real ignore-rules, worktree layout).

**What I learned:** "Schema-identical + parity-passing" is necessary but nowhere near sufficient for a drop-in claim. The bugs all lived in the *gap between the test environment and production state*: legacy data, project-specific ignore-rules, and the worktree topology the tool runs inside. A readiness review that only sees clean fixtures is a review of the happy path wearing a lab coat.

**The rule:** **Before trusting a "drop-in replacement," run it against production state — legacy data, real ignore-rules, actual worktrees — not just fresh fixtures.** (Authority: extends #1360's "verify the common interaction path, not just the scriptable one"; reinforces #1285's "probe the prescribed fix mechanism before implementing.")

---

## 2. The `at_todo` PDD trap bites tool *authors*, and the pre-push hook is a feature

**What happened:** Writing `scripts/release.js`, I put a literal `@todo #N` in a doc comment explaining marker-revert. The moment I tried to push, the pre-push hook's `pdd` scan rejected it: `@todo must have a leading space to become a puzzle`. The same failed scan *also blocked the claim-ref deletion* — a `git push :refs/claims/...` runs the hook too, so my own malformed file blocked its own cleanup path.

**What I learned:** The `at_todo` placeholder convention (CLAUDE.md, `.pddignore`) isn't just for prose docs — any *scanned* file (`scripts/**`) that mentions the keyword in a comment trips it. And the pre-push hook running on a *ref-deletion* push means an abandoned, malformed tree can block its own teardown. That's why `release.js`'s claim-ref delete needed `--no-verify` (an abandon-path ref-deletion shouldn't be gated by content hooks) plus `2>&1` to read git's real `[deleted]`/error output (it goes to stderr, which `execSync` drops — the bug that made my first version falsely report success).

**The rule:** **In any scanned file, write keyword *mentions* as the `at_todo` placeholder; and abandon-path cleanup (`release`) must `--no-verify` its ref-deletion so a broken tree can't block its own teardown.** (Authority: `at_todo` rule already in CLAUDE.md/`.pddignore`; the `--no-verify` decision is captured in #1437 and proposed for the port in pmtools#22.)

---

## 3. Decompose a half-and-half ticket so the ready half can ship

**What happened:** #1454 bundled two chores in one file edit — status (no-go, blocked on #1458) and preflight (go). As written it couldn't close: the blocked half held the ready half hostage. I split it — narrowed #1454 to status-only (sequenced after #1458) and filed #1459 for the preflight switch, which I then shipped.

**What I learned:** A ticket that *can't close because one of its parts is blocked* is a decomposition smell, not a "wait" state. Splitting let me bank a real close instead of parking the whole thing. This is the microtask rule applied to a mid-flight discovery, not just up-front planning.

**The rule:** **When a ticket bundles a blocked sub-task with a ready one, split it — don't let the blocked half hold the ready half hostage.** (Authority: yegor-microtasks discipline; tracked concretely in #1459.)

---

## 4. Build destructive tooling guard-first, then trust it by dogfooding

**What happened:** Two halves of building `release.js`. (a) My first cut deleted the claim ref *before* the data-loss guard ran, so a refused release would have freed the claim while leaving the abandoned worktree — a half-done state. I reordered so the guard runs *first* and a refusal touches nothing. (b) To claim the #1437 worktree I used `pmtools claim --lane-check --copy-env` — the exact command I'd just switched lccjs to in #1455 — validating that switch in anger instead of on a fixture (lesson #1, applied to my own work).

**What I learned:** For anything that *discards* state, the guard belongs before the first side-effect, so the failure mode is "nothing happened," never "half happened." And the cheapest real-world test of a config switch is to *use it for your next task*.

**The rule:** **In destructive tooling, run the safety guard before any side-effect; and validate a config switch by dogfooding it on your next real task.** (Authority: encoded in `release.js`'s structure + its 15 unit tests, #1437.)

---

## What landed

| Artifact | Change |
|---|---|
| `.claude/orchestrate.json` | claim → `pmtools claim --lane-check --copy-env` (#1455); preflight → `pmtools preflight` (#1459) |
| `scripts/release.js` + `npm run release` | abandon a claim/worktree without closing the issue (#1437) |
| `tests/new/release.unit.spec.js` | 15 unit tests for the parse/match seams (#1437) |
| #1457 / #1458 / pmtools#10 / pmtools#22 | live-state blockers + the multi-language `release` port proposal |

## Open threads
- The pmtools "faithful twin" robustness gaps (#1458, pmtools#10) are GRAPE's to close before #1453/#1454 can switch; the #1457 live-DB dedup is a human-gated destructive op.

## Related artifacts
- Issues #1437, #1455, #1459, #1457, #1458, #1456; pmtools#10, pmtools#22
