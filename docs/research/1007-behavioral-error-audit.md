# Behavioral Error Audit — root-cause classification & guidance-gap list (#1007)

**Author:** APPLE · **Date:** 2026-06-06 · **Type:** SPIKE (research-only)

Cross-references the three durable-guidance surfaces (`docs/do-this-not-that.md`,
`RULES.md`, the `memory/feedback_*` files) against observed agent failures (the
`errors` table in `~/.lccjs/lccjs.db` and the 126-file `docs/learnings/` corpus)
to find recurring failures that lack adequate durable guidance.

**Sibling ticket — read first:** #998 owns the *behavioral* sub-genre — failures where
the rule is already written **and clear**, yet the agent doesn't follow it (the
"clear-but-failed" / category-D rows below). This audit deliberately does **not**
file children for those; they belong to #998's structural-intervention work. The
children filed here target the *other* categories: no guidance, or guidance that
exists only as a closed ticket / scattered error note and was never promoted.

---

## 1. Error-log classification (41 rows)

### Method

Each row tagged with a root-cause category:

- **A — no guidance:** no rule/doc covers the situation.
- **B — unclear guidance:** a rule exists but is ambiguous or easy to misread.
- **C — not-visible guidance:** a rule exists but the agent wouldn't encounter it at the point of action.
- **D — clear-but-failed:** a clear rule exists; this is a process/behavioral lapse (→ #998).
- **T — tool-design:** the tool's shape makes the error easy to hit; a structural fix could eliminate it (often co-tagged with D).

### Data caveats

- **id=1** is a self-described test-insert row (GRAPE "test row only") — excluded; effective N = **40**.
- **~20 rows are retroactive batch logs** from two heavy sessions (ELDERBERRY #924: id=11–15; BANANA #958: id=30–39, logged "per #936 criteria"). Raw frequency therefore over-weights those two sessions; read counts as *pattern evidence*, not a steady-state rate.

### Recurring patterns (the signal)

| Pattern | Rows | Count | Category | Guidance today | Status |
|---|---|---|---|---|---|
| `claim` missing `--as` / wrong args | 7, 21, 26, 31 | 4 | D + T | do-this-not-that L108; RULES (implicit) | clear-but-failed → #998; identity-persistence is a tool fix (#829 decision) |
| Push-then-close → "no unpushed commit" / already-closed | 10, 15, 23, 36 | 4 | D + T | RULES 8; do-this-not-that L120 | clear-but-failed → #998; close.js could exit 0 gracefully (#633 area) |
| Worktree teardown (remove-from-inside / 2nd-attempt-on-pruned) | 13, 14, 30, 34, 35 | 5 | **A** | none (L126 covers *inspection*, not removal) | **GAP → child filed** |
| `rm`/cleanup bundled in Bash → denied | 24, 29, 33, 40 | 4 | **A** (tactical) / T | error notes only; policy in #968 | **GAP → child filed** (tactic, distinct from #968 policy) |
| README.md + velocity.csv close-rebase conflict | 3, 5, 6, 9, 22 | 5 | T | RULES 15; CSV auto-union | known tool gap → #971 (README), already ticketed |
| Skill-file Edit blocked in auto-mode (Self-Modification) | 8, 20 | 2 | T | n/a | known → #972, already ticketed |
| Edit attempted without prior Read (EDIT_PRECOND) | 11, 32 | 2 | D | harness constraint | clear-but-failed → #998 |
| `velocity:log` from main checkout while worktrees exist | 37, 38 | 2 | D | workflow "run from worktree" | clear-but-failed → #998 |
| Error rows logged with null message/context/notes | 16, 17, 18, 19 | 4 | **A** / T | log-error SKILL requires fields by convention only | **GAP → child filed** (data quality) |
| Same-identity claim collision (two APPLE agents, shared worktree) | 41 | 1 | T | n/a | known → #1010, #630, #829, already ticketed |

### One-offs (no pattern, no child)

- **id=2** STALE_READ (trusted issue-body checklist over live `gh` state) — now covered by do-this-not-that L101 (promoted from #904). `STALE_READ` error_type itself is unadopted; tracked via #904.
- **id=12** Edit `old_string == new_string` typo — behavioral one-off.
- **id=25** `comm: file 2 not in sorted order` — bash one-off, self-corrected.
- **id=27** velocity `delta = estimate − actual` sign confusion — validator already rejects it (working as designed); guidance is correct, single occurrence.
- **id=28** close "working tree not clean" (forgot to commit CSV) — RULES 15 covers it (D, → #998).
- **id=39** `no such table: velocity` — worktree predated the #947 DB rename; resolved structurally by #947.

### error_type vocabulary — checked, NOT a gap

`scripts/error-log.js` `VALID_ERROR_TYPES` already holds 15 codes incl. `GH_INFO`.
The only outstanding items are the **stale type list in the memory doc** (#970) and
the workflow doc (#969), both already ticketed. `STALE_READ` adoption is a separate
open question (#904). No new child needed.

---

## 2. TIL pattern inventory (126 files)

**Finding:** the TIL corpus is **not topic-indexed** — filenames are
`today-i-learned-<date>-<agent>[-<n>].md`, so recurring themes are invisible without
reading all 126 files. Two partial aggregations exist
(`til-synthesis-2026-06-01.md`, `til-synthesis-2026-06-04.md`); the cadence question
is already open as **#636** (10-entry TIL harvest cadence decision).

For *behavioral* themes the **error log is the better-structured signal** and its
patterns (section 1) subsume the process-failure TILs. No separate child is filed for
TIL mining — it would duplicate #636's cadence decision and #998's behavioral audit.
Recommendation: resolve #636 so synthesis is periodic, which is the durable mechanism
that would close the "TIL → durable rule" loop.

---

## 3. Memory-feedback coverage check (7 files)

| Feedback memory | Durable rule? | Covered |
|---|---|---|
| `feedback_destructive_commands` (no `rm` on main w/o permission) | RULES 1, 2, 3 | ✅ |
| `feedback_no_db_delete` (no DB deletes w/o permission) | RULES 7 | ✅ |
| `feedback_pre_claim_check` (`git status` before claim) | do-this-not-that L114 | ✅ |
| `feedback_scope_discipline` (no out-of-scope work) | RULES 6, 14 | ✅ |
| `feedback_til_worktree` (TIL needs a worktree) | RULES 4, 16 | ✅ |
| `feedback_tracker_child_issue` (always file a child) | RULES 12 | ✅ |
| `feedback_no_pii_in_issues` (no PII in issues/comments) | **none** | ❌ **GAP** |

**The single memory-feedback gap:** PII discipline. The origin PM ticket (#537) is
**CLOSED**, the lesson lives in a feedback memory, but it was **never promoted** to
`RULES.md` or `do-this-not-that.md`. This is exactly the "logged correction → durable
rule" loop the issue says is broken. Highest severity of the gap set (privacy/security).

---

## 4. Ranked gap list (gaps lacking adequate durable guidance)

Ranked by severity, then recurrence. Each gets one child issue (one change per ticket).

| # | Gap | Evidence | Severity | Proposed mitigation (one sentence) | Child |
|---|---|---|---|---|---|
| G1 | **PII has no durable rule** | feedback memory + closed #537; 0 RULES/dtnt entries | 🔴 high | Add a RULES.md rule (and a do-this-not-that entry) forbidding emails/credentials/PII in issues & comments, with the `[your email]` placeholder convention. | **#1019** |
| G2 | **Worktree teardown not documented** | id=13,14,30,34,35 (5×) | 🟠 med | Add a do-this-not-that entry: remove worktrees from the **main** checkout (never from inside), and `git worktree prune` before any retry. | **#1020** |
| G3 | **`rm`-bundling tactic not promoted** | id=24,29,33,40 (4×); notes repeat the lesson | 🟠 med | Add a do-this-not-that entry: never bundle `rm`/heredoc cleanup into a Bash call that also does real work — keep cleanup as its own call (independent of the #968 policy decision). | **#1021** |
| G4 | **`error:log` accepts empty rows** | id=16,17,18,19 (4× null message) | 🟡 low-med | Have `scripts/error-log.js` reject (or warn on) a row with an empty `message`, so analytically-useless rows can't land. | **#1022** |

### Patterns intentionally NOT given children (already owned)

- Clear-but-failed behavioral lapses (claim `--as`, push-then-close, Edit-without-Read, velocity-from-main) → **#998**.
- README/CSV close-rebase conflict → **#971**. Skill-file Edit block → **#972**.
- `rm` permission *policy* → **#968** (decision). Same-identity claim collision → **#1010 / #630 / #829**.
- error_type vocabulary / stale docs → **#970 / #969 / #904**. TIL synthesis cadence → **#636**.

---

## 5. Headline conclusion

The guardrail corpus is **broad and mostly working** — 6 of 7 feedback memories and
all high-recurrence patterns are either covered by a clear rule or already ticketed.
The real failure mode is the **promotion loop**: lessons that get logged (error notes,
a closed PM ticket, a feedback memory) but never graduate into `RULES.md` /
`do-this-not-that.md`. Of the four filed gaps, three (G1, G2, G3) are pure promotion
failures — the knowledge exists, it just never became durable, visible guidance.
Closing those, plus resolving the periodic-synthesis cadence (#636), is what actually
closes the "logged error → durable rule" loop the issue identifies.
