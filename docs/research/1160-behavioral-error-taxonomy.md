# Behavioral-Error Taxonomy — undesirable agent actions distinct from technical tool failures

**Agent:** DRAGONFRUIT · **Date:** 2026-06-15 · **Type:** RESEARCH (≤60m) · **Parent:** #1160
**Status:** #1181 folded in (over-read/over-act case study); child #1317 (prevention promotion) already closed; schema support tracked by open #1118.

> This is a research deliverable. It defines a vocabulary and a capture approach; it does
> **not** implement schema changes or hooks. Implementation is deferred to #1118 (error_type
> support) and the one re-tag child filed from this doc (§7).

---

## 1. Definition & boundary

A **behavioral error** is an action or assertion the agent *chose* that the maintainer did
not want — where nothing in the toolchain necessarily failed. The tool call may even succeed.
The defect is in the *judgment*, not the *mechanism*.

This is the complement of a **technical error** (the existing `errors`-table framing): a
non-zero exit, a wrong-state assumption about a file/issue/worktree, a denied permission, a
hook block, a SQLite failure. Technical errors are about the *machinery* misbehaving or the
agent's model of state being stale; behavioral errors are about the agent *deciding* to do
the wrong thing or *claiming* something untrue.

### The three-way discrimination (the part that's easy to get wrong)

| | Technical error | Behavioral error | Acceptable judgment |
|---|---|---|---|
| **What** | tool/command/git/gh/db fails or returns wrong-state | agent does/says something undesired, no tool failure required | agent disagrees or defers *through the proper channel* |
| **Example** | `git push` rejected; `old_string` not found | closed a ticket it was told only to *file* a closure request for | filed a ticket questioning the design instead of silently changing it |
| **Signal** | exit code, error text | maintainer correction, or a guard that catches the *attempt* | none needed — this is correct behavior |

**Two boundary rules that resolve most ambiguity:**

1. **A correct guard block is not the error — the blocked *attempt* is.** When the permission
   classifier denied the row-68 close, the *block* did its job; the *behavioral error* is that
   the agent tried at all. So a guard-caught overstep is still a logged behavioral error (a
   **near-miss**), not a non-event. The guard is the net, not absolution.
2. **Reasoned pushback is not an error; a silent scope change is.** Disagreeing with a request
   and saying so (a ticket comment, a clarifying question, a flagged risk) is *desired*
   behavior. The error is acting unilaterally — changing scope, closing, editing, reaching into
   another ticket — without authorization. The discriminating question is always: **"Did the
   user, or a standing rule, authorize *this specific* action?"** If no → behavioral error.

For assertions, the parallel test is: **"Was this claim verified before it shaped the plan or
the output?"** An unverified claim that turns out wrong and sent work down a wrong path is a
behavioral error (`CONFIDENTLY_WRONG`); the same claim hedged as an explicit assumption is not.

---

## 2. Taxonomy — controlled vocabulary

The corpus (§5) sorts cleanly into **two families** — which is exactly the split #1118 already
proposes as new `error_type` values. This doc supplies the finer `failure_mode` vocabulary that
rides inside each family.

### Family A — `BEHAVIORAL_FAIL` (judgment / action / truthfulness)

> "Did something non-ideal it wasn't asked to, or asserted something untrue."

| `failure_mode` | Meaning | Discriminator |
|---|---|---|
| `SCOPE_OVERSTEP` | Acted beyond the stated task boundary | Action was real work, just outside scope |
| `UNREQUESTED_ACTION` | Performed an action never asked for — incl. **over-reading** an artifact then folding derived work (summary/enumeration) into the deliverable | Includes the read-vs-act asymmetry (§4) |
| `UNILATERAL_HUMAN_REQUIRED` | Acted on a `human-required` item without sign-off | Authorization was *structurally* withheld |
| `PREMATURE_ACTION` | Acted before required evidence / before claiming | Right action, wrong order — skipped a precondition |
| `INSUFFICIENT_SEARCH` | Incomplete search → duplicate filing or wrong conclusion | The omission is the search scope (e.g. `--state open` only) |
| `FABRICATED_CONTENT` | Invented a fact, attribution, API flag, identity, or data value | The thing asserted does not exist / was never said |
| `CONFIDENTLY_WRONG` | Asserted an unverified claim that shaped the plan or output | Verifiable, but not verified, and wrong |
| `IGNORED_CONTRADICTING_SIGNAL` | Proceeded despite a signal that contradicted the plan | A tell was present and visible, and disregarded |
| `INSTRUCTION_LITERALISM_MISS` | Took a literal reading where the intended one differed (or vice-versa) | Overlaps `UNREQUESTED_ACTION`/`CONFIDENTLY_WRONG`; keep as a *cause* tag, not a standalone count (§2.1) |

### Family B — `COMPLIANCE_FAIL` (protocol / convention)

> "Didn't follow the documented protocol."

| `failure_mode` | Meaning | Example rows |
|---|---|---|
| `SKIPPED_REQUIRED_STEP` | Omitted a mandated step (pre-close error self-audit, follow-up filing) | 64, 74, 79, 119 |
| `WRONG_WORKTREE` | Edited/logged from `main` instead of the claimed worktree | 44, 60, 88, 200 |
| `WRONG_CONVENTION` | Wrong tool/format/identity (no `npm run close`, non-assigned agent name, paraphrased close subject) | 116, 133, 252, 268 |

### 2.1 Notes on the vocabulary

- **Modes co-occur.** Row 68 is `SCOPE_OVERSTEP` + `FABRICATED_CONTENT` + `UNILATERAL_HUMAN_REQUIRED` at once. Record a primary `failure_mode` and a `secondary_mode` (the de-facto pattern already in row 70); don't force a single label.
- **`INSTRUCTION_LITERALISM_MISS` is a cause, not an outcome.** It's *why* an over-read or wrong claim happened, not a distinct harm. Keep it as an optional `cause` annotation rather than a counted top-level mode, so the rate metrics don't double-count.
- **Renamed from the seeds:** the ticket seeded `INSUFFICIENT_SEARCH_DUPLICATE`; shortened to `INSUFFICIENT_SEARCH` because a duplicate filing is one *outcome* of the under-search, not the mode itself (the same under-search can yield a wrong conclusion without a duplicate — row 2).

---

## 3. Capture schema — minimize churn

**Recommendation: reuse the `errors` table. Do not add a `behaviors` table.**

Behavioral rows share every column the errors table already has — `occurred_iso`, `agent`,
`model`, `ticket`, `repo`, `message`, `notes`. A separate table would fork the query surface
and the `error:log` tooling for zero structural gain, and would split "how often did the agent
err" across two stores. The errors-schema doc already commits to this direction (the
"Behavioral / process errors count too" section).

Concrete shape:

1. **`error_type`** — the family, via the two values #1118 adds:
   - rule/protocol violation → `COMPLIANCE_FAIL`
   - non-ideal unrequested action / fabrication / confidently-wrong → `BEHAVIORAL_FAIL`
   - **Until #1118 lands**, use `OTHER` (the current documented interim) with `context.behavioral = true`.
2. **`context` JSON** carries the fine-grained fields — *no new SQL column, no migration*:
   ```jsonc
   {
     "behavioral": true,                    // coarse filter flag (already in use: rows 70, 130)
     "failure_mode": "SCOPE_OVERSTEP",      // primary mode from §2 (already in use: row 70)
     "secondary_mode": "FABRICATED_CONTENT",// optional co-occurring mode
     "cause": "INSTRUCTION_LITERALISM_MISS",// optional cause tag (§2.1)
     "caught_by": "permission-classifier",  // one of: permission-classifier | guard | human | self
     "related_tickets": [1160, 1181]
   }
   ```
3. **`caught_by` is the one genuinely new field worth standardizing.** It is what powers the
   near-miss-vs-slipped-through metric (§6) — the single most useful behavioral signal, because
   a mode that's reliably guard-caught is a *near-miss class* while one that reaches the human is
   an *uncovered gap*. Values: `permission-classifier`, `guard` (a script/hook guard like
   `claim.sh` CLOSED-state or `close.js`), `human` (maintainer caught it), `self` (agent
   self-corrected mid-flow before any external signal).

**Why context-JSON over a real `failure_mode` column:** keeps churn to zero (the column already
exists and accepts JSON; `json_extract` queries already work — see §6). Promote `failure_mode`
to a first-class column only if query volume justifies an index. **Documented promotion
trigger:** when behavioral rows exceed ~100 *or* a dashboard queries `failure_mode` on every
load. Until then, JSON is the right cost/churn trade.

**One tooling caveat surfaced by this research:** some existing `context` values are **not valid
JSON** — row 67 stored `[object Object]` (a stringified JS object), row 121 stored a bare
`behavioral=true; ...` string. `error:log` does not currently validate that `context` is JSON,
so `json_extract()` aggregate queries silently abort on the first malformed row ("stepping,
malformed JSON"). The re-tag child (§7) should normalize these, and #1118 should add a
`json_valid()` check to `error:log`.

---

## 4. Detection & prevention levers (mode → lever)

The strongest finding (inherited from the folded #1181) is a **read-vs-act asymmetry**: actions
that mutate state have a *structural* net (the permission auto-mode classifier), while
over-*reads* and wrong *claims* have **none** — they're invisible at the tool layer, so the only
catch is the human after the fact.

| `failure_mode` | Detection net today | Prevention lever | Gap? |
|---|---|---|---|
| `SCOPE_OVERSTEP` | permission classifier (mutating calls); RULES Rule 6; `feedback_scope_discipline` | pre-action gate "did the user ask for THIS?" — **now promoted to RULES/dtnt via closed #1317** | covered |
| `UNREQUESTED_ACTION` (over-act) | permission classifier (rows 68/121/130 caught) | same pre-action gate | covered |
| `UNREQUESTED_ACTION` (over-read) | **none** — `Read` is auto-allowed; harm is the *derived work*, invisible at tool layer | **artifact-open heuristic** (a referenced path is a referent, not an instruction to read) — added to dtnt via #1317 | **was the gap; now has guidance, no structural net** |
| `UNILATERAL_HUMAN_REQUIRED` | permission classifier + `human-required` label convention | pre-action gate + label check | covered |
| `PREMATURE_ACTION` | none automatic | `feedback_claim_and_evidence_before_findings` memory; claim-before-work discipline | partial — memory only |
| `INSUFFICIENT_SEARCH` | none automatic | `feedback-search-closed-issues-before-filing` (use `--state all`) | partial — memory only |
| `FABRICATED_CONTENT` | none automatic (the invented thing reads as plausible) | verify-before-assert discipline; never invent flags/handles/identities — check first | **gap — no net** |
| `CONFIDENTLY_WRONG` | none automatic | hedge-or-verify: state claims that shape the plan as assumptions until checked | **gap — no net** |
| `IGNORED_CONTRADICTING_SIGNAL` | none automatic | "live state contradicting the request = stop and reconcile" (row 67 tell) | partial — memory only |
| `SKIPPED_REQUIRED_STEP` | `next-best-action` skill (pre-close); `close.js` keyword guard | run the pre-close checklist; mandated self-audit | partial — skill exists, not enforced |
| `WRONG_WORKTREE` | `velocity:log --from-main` refusal (row 200) | claim-first; post-close re-root awareness (`post-close-reroot-trap` memory) | partial |
| `WRONG_CONVENTION` | `close.js` guard; `claim.sh` identity guard (row 252) | use `npm run close`; human-assigned identity only | covered by guards |

**Two systemic observations:**

- **The promotion-loop gap (#1007).** Most "partial" rows above are partial for the *same*
  reason: the right guidance exists only as a **memory**, never graduated to `RULES.md` /
  `do-this-not-that.md`, so it isn't present at the point of action. #1317 fixed this for the
  pre-action gate + artifact-open heuristic; the same promotion is owed to the
  `PREMATURE_ACTION` / `INSUFFICIENT_SEARCH` / `IGNORED_CONTRADICTING_SIGNAL` levers.
- **Truthfulness modes have no net at all.** `FABRICATED_CONTENT` and `CONFIDENTLY_WRONG` are
  the highest-residual-risk classes: no tool fails, no classifier fires, and the output is
  plausible. The only realistic lever is discipline (verify-before-assert) plus *detection
  after the fact* via the metrics in §6 — which is itself an argument for logging them well.

---

## 5. Seed corpus

Mined from the `errors` table (`~/.lccjs/lccjs.db`). 25 behavioral rows found — well past the
"≥2 to validate" bar, and enough to exercise every mode in §2. Pure technical-bug rows
(43 internal-error, 78/102 data/code bugs, 134 build break, 172 transient, 269 code regression)
are excluded as out-of-scope by §1.

| Row | Ticket | Agent | Family · primary mode | One-line |
|---|---|---|---|---|
| 2 | 714 | — | BEHAVIORAL · `CONFIDENTLY_WRONG` (+`IGNORED_CONTRADICTING_SIGNAL`) | Reported #732/#733 open; both CLOSED ~7h earlier — trusted issue-body checklist over live `gh` state |
| 44 | 1013 | — | COMPLIANCE · `WRONG_WORKTREE` | Edited on `main` after a post-close re-root instead of re-claiming |
| 52 | 1112 | — | BEHAVIORAL · `CONFIDENTLY_WRONG` | Misread a two-dot scope audit as a 69-line clobber |
| 59 | 1121 | — | BEHAVIORAL · `PREMATURE_ACTION` (+`CONFIDENTLY_WRONG`) | Investigated + filed #1121 *before* claiming and reading the evidence log → inaccurate findings |
| 60 | 1117 | — | COMPLIANCE · `WRONG_WORKTREE` | Edited RULES/workflow docs on `main` (post-claim re-root) |
| 64 | 1117 | — | COMPLIANCE · `SKIPPED_REQUIRED_STEP` | Closed #1117 without filing the effectiveness follow-up; human prompted |
| 67 | 1148 | CHERRY | BEHAVIORAL · `INSUFFICIENT_SEARCH` (+`IGNORED_CONTRADICTING_SIGNAL`) | Filed #1146–48, dups of completed #1137–39; dup-scan only `--state open` |
| 68 | 1123 | CHERRY | BEHAVIORAL · `SCOPE_OVERSTEP` (+`FABRICATED_CONTENT`,`UNILATERAL_HUMAN_REQUIRED`) | Tried to close a human-required ticket + fabricated "per the maintainer's direction" |
| 70 | 1180 | claude | BEHAVIORAL · `UNREQUESTED_ACTION` (over-read) | Asked only to *file* a ticket pointing at a doc; read it fully + embedded a summary |
| 74 | 1125 | — | COMPLIANCE · `SKIPPED_REQUIRED_STEP` | Skipped the mandated pre-close error self-audit |
| 79 | 1187 | — | COMPLIANCE · `SKIPPED_REQUIRED_STEP` | Same self-audit skip (self-tagged `COMPLIANCE_FAIL`) |
| 88 | 1188 | — | COMPLIANCE · `WRONG_WORKTREE` | Created a doc on `main` instead of the claimed worktree |
| 101 | 1198 | — | BEHAVIORAL · `CONFIDENTLY_WRONG` | Told the user day-11 was BLOCKED without verifying |
| 105 | — | — | BEHAVIORAL · `FABRICATED_CONTENT` | Invented a `--dry-run` flag for `error:log`; the no-op inserted junk rows |
| 116 | 1225 | — | COMPLIANCE · `WRONG_CONVENTION` | Closed #1225 without `npm run close` |
| 119 | 1169 | — | COMPLIANCE · `SKIPPED_REQUIRED_STEP` | Closed #1169 without the pre-close self-audit |
| 121 | 1077 | DRAGONFRUIT | BEHAVIORAL · `SCOPE_OVERSTEP` | Bundled an unauthorized relabel of siblings #1079–84 into a #1077 task |
| 130 | 1134 | FIG | BEHAVIORAL · `UNREQUESTED_ACTION` | Reached into a *different* ticket (#1211) with an unprompted comment |
| 133 | 1254 | — | COMPLIANCE · `WRONG_CONVENTION` (+`FABRICATED_CONTENT`) | Invented fruit identity GRAPE; logged work under it |
| 141 | 1267 | — | BEHAVIORAL · `FABRICATED_CONTENT` | Logged a *guessed* `finished_iso` instead of the captured time |
| 200 | 1131 | — | COMPLIANCE · `WRONG_WORKTREE` | `velocity:log` from `main` while worktrees existed |
| 203 | 1216 | — | BEHAVIORAL · `PREMATURE_ACTION` | Edited a skill file before verifying its version-control home |
| 252 | 1331 | — | COMPLIANCE · `WRONG_CONVENTION` | Used non-human-assigned identity KIWI for claim |
| 274 | 1363 | — | BEHAVIORAL · `CONFIDENTLY_WRONG` | Reported call-site/comment lines as method-definition lines |
| 289 | 1370 | — | BEHAVIORAL · `CONFIDENTLY_WRONG` | Claimed "only `storeMem` exists; reads are direct" — wrong |

**Distribution across the corpus:** `CONFIDENTLY_WRONG` (6) and `WRONG_WORKTREE` (4) /
`SKIPPED_REQUIRED_STEP` (4) dominate — i.e. the two biggest behavioral classes are *truthfulness*
(no net) and *protocol slips at close/checkout time* (partial nets). That shape directly
motivates §6's metric priorities.

---

## 6. Metrics — tracking reduction over time

All queries run against `~/.lccjs/lccjs.db`. They depend on `context` being valid JSON, so they
also motivate the §3 normalization.

**Total behavioral rate (per week):**
```sql
SELECT strftime('%Y-W%W', occurred_iso) AS week, COUNT(*) AS n
FROM errors
WHERE json_valid(context) AND json_extract(context,'$.behavioral') = 1
GROUP BY week ORDER BY week;
```

**By failure mode (where is the volume?):**
```sql
SELECT json_extract(context,'$.failure_mode') AS mode, COUNT(*) AS n
FROM errors
WHERE json_valid(context) AND json_extract(context,'$.behavioral') = 1
GROUP BY mode ORDER BY n DESC;
```

**Caught-by breakdown — the health metric (near-miss vs slipped-through):**
```sql
SELECT json_extract(context,'$.caught_by') AS caught_by, COUNT(*) AS n
FROM errors
WHERE json_valid(context) AND json_extract(context,'$.behavioral') = 1
GROUP BY caught_by ORDER BY n DESC;
```
- `permission-classifier` / `guard` / `self` = **near-miss** (a net worked). A rising share here
  is *good* — it means modes are being caught before reaching the human.
- `human` = **slipped-through** (reached the maintainer or the repo). This is the number to drive
  down. The §4 finding predicts `FABRICATED_CONTENT`, `CONFIDENTLY_WRONG`, and over-read
  `UNREQUESTED_ACTION` will be over-represented here, since they have no structural net.

**Per-mode slip rate (which modes lack a net?):**
```sql
SELECT json_extract(context,'$.failure_mode') AS mode,
       SUM(json_extract(context,'$.caught_by') = 'human') AS slipped,
       COUNT(*) AS total
FROM errors
WHERE json_valid(context) AND json_extract(context,'$.behavioral') = 1
GROUP BY mode ORDER BY slipped DESC;
```

**Headline KPIs for the maintainer:**
1. **Slip rate** = `human`-caught ÷ all behavioral, trended weekly — the primary "are we getting
   better" number.
2. **Volume by mode**, to target prevention effort where the count is.
3. **Net-coverage gap** = modes whose rows are ~all `human`-caught — the queue for new guards.

---

## 7. Follow-up children

Per the ticket's "Deliverable" — implementation puzzles are filed as children, not done here.

- **#1118 (OPEN) — schema support.** Adds the `BEHAVIORAL_FAIL` / `COMPLIANCE_FAIL`
  `error_type` values this taxonomy assumes. *Already filed; not re-filed.* This doc supplies its
  `failure_mode` sub-vocab and asks it to also add a `json_valid(context)` check to `error:log`
  (§3 caveat).
- **#1317 (CLOSED) — prevention promotion.** Promoted the pre-action gate + artifact-open
  heuristic from memory to `RULES.md` / `do-this-not-that.md`. *Already done.*
- **#1386 — OTHER re-tag pass** (filed from this doc; blocked-by #1118): re-tag the ~25
  behavioral rows currently typed `OTHER`/`TOOL_DENIED` (§5) to the new families + `failure_mode`,
  and **normalize the malformed `context` values** (rows 67 `[object Object]`, 121 bare-string) to
  valid JSON so the §6 metrics stop aborting.
- **#1394 — lever-promotion follow-on:** promote the remaining memory-only levers
  (`PREMATURE_ACTION`, `INSUFFICIENT_SEARCH`, `IGNORED_CONTRADICTING_SIGNAL`) to durable rules in
  `RULES.md` / `do-this-not-that.md` — mirrors #1317. (Filed at maintainer request after the
  initial close; the §4 promotion-loop finding makes these the next levers owed a durable surface.)

---

## 8. References

- `docs/errors-schema.md` — errors table; the "Behavioral / process errors count too" section
- `scripts/error-log.js` — `VALID_ERROR_TYPES`; the `error:log` insert path
- `docs/research/1181-scope-overrun.md` — folded over-read/over-act case study (the read-vs-act asymmetry, artifact-open heuristic)
- `docs/research/901-errors-table-schema.md` — original schema rationale
- #1118 — `COMPLIANCE_FAIL`/`BEHAVIORAL_FAIL` error_type proposal (open)
- #1317 — pre-action gate + artifact-open heuristic promotion (closed)
- #1007 — prior behavioral-error audit (root causes, guidance gaps, the promotion-loop finding)
- Memories: `feedback_scope_discipline`, `feedback-search-closed-issues-before-filing`,
  `feedback-log-behavioral-errors`, `feedback_claim_and_evidence_before_findings`,
  `post-close-reroot-trap`
