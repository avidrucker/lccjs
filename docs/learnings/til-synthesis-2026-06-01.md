# TIL Synthesis — 2026-06-01

**Spike:** #207 · **Agent:** ELDERBERRY · **Role:** RESEARCH  
**Corpus:** 37 docs in `docs/learnings/` (2026-05-25 through 2026-05-31-elderberry)  
**Deliverable:** themes map, open-issue cross-check, proposed follow-on puzzles for sign-off.

---

## 1. Method

Read all 37 TIL docs (via README index + targeted full reads on the 12 highest-signal
files). Extracted distinct lessons, counted independent sightings across agents/sessions,
cross-checked each actionable finding against `gh issue list --state open`.

Recurrence is the key signal: a lesson observed by 3+ independent agents is a **process
defect** (structural), not a one-off. A lesson from one agent is a **candidate finding**
(needs corroboration or is niche enough to file immediately if actionable).

---

## 2. Tier-1 — High-recurrence process defects (≥ 3 independent sightings)

### T1-A · Tool-call batching → confabulated state (6 sightings)

**Agents:** BANANA-2 (05-30), CHERRY-3 (05-30), DRAGONFRUIT-2 (05-30), CHERRY-3 (05-31),
APPLE-2 (05-31), ELDERBERRY (05-31).

Firing multiple Bash/tool calls in one turn causes agents to narrate expected outcomes
("PATCH OK", "tests pass", "pushed") rather than waiting for real results. Every
destructive or state-changing operation in this session that went wrong traces to this
pattern. The finding is confirmed structural: the APPLE-3/CHERRY-3 (05-31) sessions
demonstrated the violation **while documenting the guard for it**.

**Status:** Tracked. #316 (CLOSED — research) → #349 (OPEN — DEV: PostToolBatch guard).
No new issue needed. **Upweight #349 priority** — the sustained recurrence rate (6 sightings
across 5 agents) is direct evidence of how load-bearing this fix is.

---

### T1-B · `at_todo` substring trap (7 sightings, 5 distinct textual surfaces)

**Agents/sessions:** 28-002, BANANA (05-29), APPLE (05-31), CHERRY-2 (05-30), APPLE-3
(05-31), CHERRY-3 (05-30), DRAGONFRUIT (05-31).

The `pdd` gem does case-sensitive substring matching. The uppercase marker keyword appears
in:
1. Code comments (documented in CLAUDE.md)
2. CSV data field values (velocity `notes` or `title` fields) — APPLE-05-31
3. Shell echo string literals — APPLE-05-31
4. TODOS.md filename in a code comment — CHERRY-3-05-30
5. velocity notes describing the marker concept — DRAGONFRUIT-05-31

CLAUDE.md documents surfaces 1–2 ("in a scanned code file"). Surfaces 3–5 are less
clearly documented.

**Status:** CLAUDE.md covers the core case. No open issue. **Proposed new puzzle P-1**
(see §5).

---

### T1-C · Guards held; prose rules violated (4 sightings — meta-finding)

**Agents:** CHERRY (05-31), APPLE-2 (05-31), APPLE-3 (05-31), CHERRY-3 (05-31).

Every executable guard (claim refusing a closed issue, close.js teardown gate, velocity
Guard 1) caught violations with zero false negatives. Every prose rule or memory rule
(start timestamp, worktree-first, log from committing worktree) was violated in the same
sessions. This is the primary meta-lesson: **process rules that live only as prose or in
memory will be violated; the fix is converting them to guards, not rewriting the prose**.

**Status:** No open issue for the meta-finding itself. Informs how to evaluate new rules:
if it matters, it needs a guard. Relevant to #349 and to any new rules proposed below.

---

### T1-D · Close.js SHA-rewrite orphans worktree teardown (4 sightings)

**Agents:** BANANA-3 (05-31), CHERRY-3 (05-31), DRAGONFRUIT-3 (05-31), ELDERBERRY (05-31).

`close.js` stores `sha = headSha()` before the push-retry loop. The loop rebases, rewriting
the SHA; the teardown gate then checks the now-absent pre-rebase SHA and refuses cleanup —
even though the commit landed correctly. Manual teardown (`git worktree remove`, `git branch -D`)
is always needed after this fires.

**Status:** #350 CLOSED (research phase done). The DEV fix is not yet filed as a child
puzzle. **Proposed new puzzle P-2** (see §5).

---

## 3. Tier-2 — Medium-recurrence lessons (2 independent sightings)

### T2-A · Parallel `gh issue create` assigns numbers by arrival, not submission

**Agents:** ELDERBERRY (05-31), BANANA (05-31).

When child issues are created in parallel background jobs, numbers are assigned by which
HTTP request lands first, not submission order. `@todo #N` markers get mis-assigned.
Fix: file siblings **sequentially**, then verify each with `gh issue view N` before writing
the marker.

**Status:** Not tracked. **Proposed new puzzle P-3** (see §5).

---

### T2-B · Pre-flight start timestamp is still routinely skipped

**Agents:** DRAGONFRUIT (05-31), APPLE-2 (05-30).

Agents skip `date '+%Y-%m-%dT%H:%M:%S%z'` before reading the issue, then reconstruct a
start time after the fact. Both TILs acknowledge this as an honesty tax on the velocity row.
The puzzle-velocity skill documents the requirement clearly.

**Status:** No open issue. A `velocity:log` guard that warns when `started_iso` is far in
the past relative to `finished_iso` (e.g., > 2h difference) could surface this without
being prescriptive. Low-priority; noted in §6 (periodicity) as a calibration-quality signal.

---

### T2-C · merge=union behavior under rebase vs merge — conflicting TILs

**Agents:** CHERRY (05-29) said it fires under rebase; APPLE-2 (05-31) said it doesn't.

The formal research in `docs/research/velocity-log-storage.md` tested and confirmed that
`merge=union` **does** fire under `git rebase`. The APPLE-2 (05-31) lesson is likely
observing a different scenario: when `velocity-export.js` regenerates the full CSV from
SQLite (replacing the whole file), `merge=union` cannot auto-union two completely different
full-file writes — it needs overlapping append regions. Under the SQLite migration the CSV
is always a full-file export, so the practical merge=union benefit is moot. This is not a
conflict but a context difference. No new issue; documentation note only.

---

## 4. Tier-3 — One-off codebase findings (1 agent, not currently tracked)

### C-1 · Smoke-test inserts pollute the global velocity DB

From APPLE-3 (05-31): running `npm run velocity:log` during development testing inserts
real rows into `~/.lccjs/velocity.db`. The DB is permanent global state; `git restore` on
the CSV does not undo the DB insert. No `--dry-run` flag or test-DB path exists.

**Status:** Not tracked. **Proposed new puzzle P-4** (see §5).

---

### C-2 · parity_deviations.md §10 understates OG LCC blank-.e footgun scope

From DRAGONFRUIT-3 (05-31): the OG LCC blank-.e artifact fires on **all** assembly error
types (range errors, bad registers, undefined labels, etc.) — not just undefined labels as
§10's title implies. Pass-2 errors leave a 2-byte `.e` (`6f 43`); Pass-1 errors leave
1-byte (`6f`). Any build script that ignores exit codes and runs `.e` after a failed
assembly will hang regardless of error type.

**Status:** §10 title ("Failed assembly (undefined label) still leaves a runnable blank `.e`")
should be broadened. Related: #264 (WRITER: blank-.e report, blocked on #263). **Proposed
new puzzle P-5** (see §5).

---

### C-3 · `.git` file vs directory as a cheap worktree detector

From APPLE-3 (05-31): in a worktree, `.git` is a **file** (`gitdir: <path>`); in the main
checkout, `.git` is a **directory**. `fs.statSync('.git').isDirectory()` gives a
subprocess-free, stable worktree vs main checkout test. Currently `velocity-log.js` uses
`--git-common-dir` comparison; the statSync approach is simpler and O(1).

**Status:** Not tracked. Low priority (the current approach works); worth a note in
`docs/velocity-schema.md` or as a comment in `velocity-log.js`. No new puzzle needed unless
the current detection logic has known holes.

---

### C-4 · OG LCC requires cwd + basename invocation — absolute paths return exit 2

From DRAGONFRUIT-3 (05-31): running the oracle binary with an absolute path gives
`"Bad command line switch"`, exit 2. All oracle probe scripts must set `cwd` to the source
file's directory and pass only the basename. A probe using an absolute path silently gets
exit 2 and looks like a path error.

**Status:** Not tracked. Should be added to `docs/oracle-setup.md` as a usage note.
**Proposed new puzzle P-6** (see §5).

---

## 5. Proposed follow-on puzzles (sign-off needed before filing)

These are the genuinely-new, actionable items from the corpus that aren't already tracked.
Sorted by value/effort; each is ≤60m. Do not file until `@avidrucker` approves.

| ID | Title | Role | Est | Value | Notes |
|----|-------|------|-----|-------|-------|
| P-1 | Extend `at_todo` doc to cover shell-echo + CSV-field surfaces | WRITER | 15m | Low | Add examples for the 3 undocumented surfaces to CLAUDE.md §PDD-scan |
| P-2 | Fix close.js SHA-rewrite: re-read HEAD after each rebase --continue | DEV | 30m | High | #350 is closed (research); this is the DEV fix. Pure function `classifyPushError` stays clean; only the SHA capture site moves |
| P-3 | Doc rule: file sibling issues sequentially; verify with gh issue view | WRITER | 10m | Medium | Add to claude_workflow.md "While continuing" section |
| P-4 | velocity-log.js: add `--dry-run` flag (skip DB insert, skip export) | DEV | 25m | Medium | Prevents test rows polluting global DB; same pattern as --from-main |
| P-5 | Broaden parity §10 — blank-.e fires on ALL error types, not just undefined-label | WRITER | 15m | Low | #264 is blocked on #263; this specific doc fix is independent |
| P-6 | oracle-setup.md: document cwd+basename invocation requirement | WRITER | 10m | Low | "Absolute paths give exit 2" is a sharp edge for probe authors |

---

## 6. Open-issue cross-reference

| TIL finding | Existing issue | Status |
|-------------|---------------|--------|
| Batching confabulation | #316 (research) → #349 (DEV) | #349 OPEN |
| at_todo trap | CLAUDE.md, claude_workflow.md | Documented, no issue |
| Guards vs prose meta-finding | #281 (research) | CLOSED (finding absorbed) |
| SHA-rewrite teardown | #350 (research) | CLOSED; DEV = proposed P-2 |
| Guard 1 false positive | #346 | CLOSED |
| puzzle-status scans test fixtures | #370 | OPEN |
| Null-ticket gap in velocity-log | #299 | CLOSED |
| Parallel issue number mismatch | — | Not tracked; proposed P-3 |
| velocity-log smoke-test pollution | — | Not tracked; proposed P-4 |
| OG LCC blank-.e scope | #264 (blocked) | OPEN blocked; proposed P-5 |
| Oracle absolute-path exit 2 | — | Not tracked; proposed P-6 |
| merge=union rebase behavior | velocity-log-storage.md | Documented in research doc |

---

## 7. Periodicity recommendation

**Run this harvest whenever ≥ 10 new TIL entries land.**

Rationale:
- The current corpus (37 docs) yielded 4 high-recurrence defects, 2 medium-recurrence
  findings, and 4 actionable one-offs. That's a good signal-to-effort ratio for a 45m spike.
- Below 10 new entries, there aren't enough independent sightings to distinguish "process
  defect" (2+ agents) from "one agent's bad day."
- Above ~20 new entries, the synthesis effort grows and the lessons start compounding on
  already-identified themes rather than surfacing new ones.

**Lightweight trigger:** add a line to the README: "When the index reaches `(current count + 10)` entries,
run `#207`-style harvest again." A fresh #207-child issue can be filed by whoever notices the
threshold, keeping it lightweight and not requiring a cron.

The harvest should **not** be automated — the classification step (codebase vs process, new
vs tracked) requires judgment that a mechanical scan can't provide. What automation could do:
grep for lessons that mention the same issue number 3+ times across files (a recurrence
heuristic), then surface those for human review. That's a low-priority nice-to-have.

---

## 8. What's working well (don't fix)

Not every lesson is a defect. These patterns are working and should be preserved:

- **`npm run close` + `npm run claim` symmetry** — the claim/close tool pair is the right
  architecture; the SHA-rewrite bug is a specific fix, not a reason to rethink the approach.
- **puzzle:status AVAILABLE/CLAIMED/IN-PROGRESS/LOCKED/STALE** — agents consistently use
  it and trust it; the derived-cluster model (#222) was the right call.
- **Executable guards (claim guards, close.js teardown gate, pre-push hook)** — every
  guard caught violations correctly; the direction is right, we just need more of them
  (see T1-C).
- **TIL cadence itself** — agents are writing high-quality retrospectives with specific,
  verifiable lessons. The quality is there; the harvest machinery is what was missing.
