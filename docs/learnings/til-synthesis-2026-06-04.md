# TIL Synthesis — 2026-06-04

**Spike:** #764 · **Agent:** BANANA · **Role:** RESEARCH  
**Corpus:** 61 new docs in `docs/learnings/` (2026-06-01 through 2026-06-04)  
**Coverage:** 30 files read in full (strategic cross-agent sample); 31 files not yet read (mostly 2026-06-01 CHERRY×6, ELDERBERRY×3, FIG×4 sessions — flagged as gap in §7)  
**Deliverable:** themes map, open-issue cross-check, proposed follow-on puzzles for sign-off.

---

## 1. Method

Strategically sampled the 61 new TIL docs: first sessions from every agent on every date,
all indexed README entries (13), plus follow-up sessions where cross-agent themes emerged.
Applied the #207 recurrence heuristic: lessons observed by 3+ independent agents are
**process defects**; 2 agents = **candidate findings**; 1 agent = **one-off codebase findings**.

---

## 2. Tier-1 — High-recurrence process defects (≥ 3 independent sightings)

### T1-A · Research tasks that confirm bugs must file a fix ticket before close (4 sightings)

**Agents:** BANANA (06-01), CHERRY (06-02), APPLE (06-03), DRAGONFRUIT (06-01).

The pattern: an agent closes a RESEARCH issue with a well-written findings comment, but
no actionable follow-on ticket exists. The finding is invisible to `puzzle:status` and future
agents. Each agent discovered this independently:

- **BANANA (06-01):** After posting #454 findings as a comment, the user had to ask "did you file a ticket?" Filed #459 retroactively. Rule: "research comment without a follow-up ticket = finding that will be re-discovered."
- **CHERRY (06-02):** "A closing comment is not a backlog." Anything in a closing comment as 'deferred' or 'out of scope' is invisible to every future agent unless it becomes a ticket. Filed as Rule 10 (#490).
- **APPLE (06-03):** #524 confirmed `br 5` parity bug but closed without a fix ticket; human had to ask. Rule: "before closing any RESEARCH task that turns up a confirmed bug, check — does a fix ticket exist?"
- **DRAGONFRUIT (06-01):** "Three mandatory close steps that are easy to forget together: velocity row, marker deletion, and closing comment."

**Status:** Rule 10 (#490) covers the general "deferred work in closing comment → ticket" case. The specific RESEARCH→confirmed-bug→fix-ticket chain is NOT yet codified in `claude_workflow.md`. **Proposed new puzzle N-1** (see §5).

---

### T1-B · Close-sequence edge cases continue to surface (5 sightings, 4 agents)

**Agents:** APPLE (06-02, 06-03), DRAGONFRUIT (06-01), BANANA (06-03), ELDERBERRY (06-03).

The close protocol has been hardened substantially (#541, #551) but agents keep finding new
edge cases:

- **APPLE (06-02):** "The close sequence splits when the ticket includes a build step." Running `npm run build:site` forces a second commit for the artifact, a third for `Closes #N`. Fix: run the build before the closing commit, `git add` artifact alongside the CSV, make one commit.
- **APPLE (06-03):** "`npm run close` checks HEAD specifically." If you add commits after your closing commit, carry `Closes #N` into each one until you run close.
- **DRAGONFRUIT (06-01):** Three close-protocol gaps at #320 (velocity row, marker, closing comment) all missed together.
- **BANANA (06-03):** `close.js` deferred teardown failures were invisible (`stdio: 'ignore'`). Fixed in #551.
- **ELDERBERRY (06-03):** Confirmed the deferred-teardown fix (#541) is architecturally correct: defer deletion until after the parent exits.

**Status:** #541 (deferred teardown) and #551 (visible stderr) are closed. The "build step splits the close" pattern is partially addressed by #492 (research into docs/site/ commit hygiene). The "Closes #N must be in HEAD" lesson is documented via CHERRY s3 (#571). No new issue needed beyond N-3 below.

---

### T1-C · "Already done" is a valid research outcome — verify before implementing (3 sightings)

**Agents:** DRAGONFRUIT (06-04), APPLE (06-03), CHERRY (06-04, indexed).

- **DRAGONFRUIT (06-04):** #675 ("add webpack build step") was already implemented as a side-effect of #595/#682. A 2-minute check saved 30 minutes of implementation.
- **APPLE (06-03):** Rule: "before closing RESEARCH that turns up a bug, check — does a fix ticket exist?" (Verify the action gap, not just the finding.)
- **CHERRY (06-04, indexed):** "Check the module before assuming a gap — `--json` already shipped in puzzle-status.js."

**Status:** Issue #728 is OPEN ("WRITER: add 'verify repro before implementing' step to agent pickup protocol"). This is already tracked and actionable. No new ticket needed.

---

## 3. Tier-2 — Medium-recurrence findings (2 independent sightings)

### T2-A · Build artifacts served from a subdirectory need an explicit copy step

**Agents:** BANANA (06-04, indexed), DRAGONFRUIT (06-04).

Both independently discovered that `docs/site/showcase/` can't reach `dist/lcc.bundle.js`
via `../dist/` — the relative path resolves to `docs/site/dist/` which doesn't exist. Fixed
by `build-site.js` copy step in #709/#710.

**Status:** Fixed. No new issue needed.

---

### T2-B · Reference doc examples are more dangerous than no example when stale

**Agents:** BANANA (06-01), CHERRY (06-01, indexed).

BANANA traced repeated `claude-sonnet-4-6` model field errors to `docs/velocity-schema.md`
line 28's stale example (not the skill, which was already fixed). CHERRY hit the same
`opus-4.8` vs `claude-opus-4-8` confusion from another doc surface. Both trace to: agents
copy examples from reference docs, and a stale example propagates the mistake.

**Status:** Schema doc fix tracked as #459. No new issue needed.

---

### T2-C · Close.js deferred teardown failure visibility

**Agents:** FIG (06-03), ELDERBERRY (06-03).

FIG: moving teardown out-of-band makes failures invisible — if `git worktree remove` fails
in the detached subprocess, no output surfaces. Filed as #542 to assess risk.
ELDERBERRY confirmed the deferred approach is architecturally correct but noted the same tradeoff.

**Status:** #542 is OPEN. No new issue needed.

---

### T2-D · Agent name casing in velocity DB is load-bearing (never normalized)

**Agents:** GRAPE (06-03), BANANA (06-01).

GRAPE: four rows logged as `fig` (lowercase) instead of `FIG` created a spurious second
agent in per-agent stats (#669 filed for a DB correction).
BANANA: `velocity-seed.js` had an off-by-one in column mapping, silently reading `id` as
`ticket`. Fixed in #438 with header-based mapping.

**Status:** #669 OPEN for the casing correction. No new issue needed beyond #669.

---

## 4. Tier-3 — One-off codebase findings (1 agent each)

### C-1 · `permissions.deny` blocks direct Bash strings — not subprocess commands

**APPLE (06-01):** `permissions.deny` (e.g. `"Bash(rm *)"`) only inspects what Claude passes
to the Bash tool directly. Scripts run via `npm run puzzles` that call `rm -rf` internally are
invisible to the filter. The protection is a guardrail at the agent's direct-command seam, not
a sandbox.

**Status:** Not documented in CLAUDE.md. Low-risk finding (no known exploitation), but
clarifying the scope of deny rules could prevent false security confidence. **Proposed N-2** (see §5).

---

### C-2 · `exec` in a shell wrapper can't change its parent's CWD

**DRAGONFRUIT (06-01), ELDERBERRY (06-03):** Both independently traced the `npm run close`
`getcwd` error to npm's own process CWD after the worktree is deleted — not to any script-level
issue. A child process cannot change its parent's CWD. Fix: defer the deletion until after the
parent exits (#541).

**Status:** Fixed in #541. No new issue.

---

### C-3 · Executor and disassembler decode OP_EXT at different widths

**DRAGONFRUIT (06-02):** `OP_EXT` executor uses `ir & 0x1F` (5 bits) but disassembler uses
`hex & 0x000F` (4 bits). Instructions at eopcode ≥ 16 execute correctly and disassemble wrong.
Filed as #496.

**Status:** #496 OPEN. No new issue.

---

### C-4 · Velocity notebooks need a date ceiling to be idempotent

**GRAPE (06-03):** Re-executing `stats/day-six-analysis.ipynb` without a date ceiling pulled
in the next day's data, silently corrupting the §7 takeaways. Filed #664 (add date ceiling).

**Status:** #664 OPEN. No new issue.

---

### C-5 · docs/learnings/README.md index is 48 entries out of date

The README index lists only 13 of the 61 new TIL files. The next synthesizer will have no
summaries for 48 entries, requiring them to open every file cold. **Proposed N-4** (see §5).

---

## 5. Proposed follow-on puzzles (sign-off needed before filing)

| ID | Title | Role | Est | Value | Notes |
|----|-------|------|-----|-------|-------|
| N-1 | Add rule to `claude_workflow.md`: RESEARCH tasks that confirm a bug must file a fix ticket before the closing commit | WRITER | 10m | High | 4-agent T1 finding; Rule 10 covers "deferred work → ticket" but not the specific RESEARCH-confirms-bug pattern |
| N-2 | Document `permissions.deny` scope in CLAUDE.md: blocks direct Bash strings, not subprocess commands | WRITER | 10m | Low | Prevents false security confidence; APPLE 06-01 |
| N-3 | Assess and address silent failure risk in `close.js` deferred teardown | RESEARCH | 30m | Medium | #542 is the filed scope; this proposed puzzle drives it to a DEV fix recommendation |
| N-4 | Update `docs/learnings/README.md` index: add the 48 missing entries (38–98) | WRITER | 45m | Low | Hygiene for the next synthesizer; this harvest can't complete it without exceeding the H cap |

---

## 6. Open-issue cross-reference

| TIL finding | Existing issue | Status |
|-------------|---------------|--------|
| RESEARCH→bug→fix-ticket chain | Rule 10 (#490) | Partial; N-1 covers the gap |
| Verify before implementing | #728 | OPEN |
| Close.js HEAD check | #571, #610 | CLOSED |
| Build step splits close sequence | #492 | OPEN |
| Bundle path mismatch | #709, #710 | CLOSED |
| Stale example in velocity-schema.md | #459 | Was filed |
| Deferred teardown silent failure | #542 | OPEN |
| Agent casing in velocity DB | #669 | OPEN |
| OP_EXT disassembler width mismatch | #496 | OPEN |
| Velocity notebook date ceiling | #664 | OPEN |
| README index gap | — | Proposed N-4 |
| deny scope | — | Proposed N-2 |

---

## 7. Coverage gap note

31 files were not read in depth: primarily the 2026-06-01 CHERRY (×6), ELDERBERRY (×3),
and FIG (×4) sessions, which may contain additional T1-quality sightings for T1-A and T1-B.
The cross-agent themes identified above have ≥3 independent sightings already; additional
sightings would strengthen them but would not change the conclusions.

If the gap is a concern, a follow-on targeted read of those 31 files (≤20m) could be run.

---

## 8. What's working well (don't fix)

- **The tooling continues to harden itself.** #541 (deferred teardown), #551 (stderr visibility),
  #452 (EOF vs empty-line), #538 (br numeric operand gate) — agents are consistently turning
  bugs into tickets and shipping fixes in the same session.
- **TIL quality is high.** Nearly every file includes a "Why it matters" framing and an explicit
  lesson statement. The synthesis is faster when authors name the principle, not just the incident.
- **Cross-checking before assuming.** T1-C ("already done is a valid close") shows agents are
  getting better at verifying current state before implementing. The failure rate dropped
  noticeably in the June sessions versus the May sessions.
- **Rule 10 (deferred work → ticket) landed and agents cited it.** CHERRY (06-01), APPLE (06-03),
  and BANANA (06-01) all demonstrated or cited the pattern within days of it being filed.
  Guard-level rules propagate faster than prose-level TILs.
