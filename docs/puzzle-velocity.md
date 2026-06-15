# Puzzle Velocity — Data & Explainer

Tracks estimated vs actual time per puzzle / ticket so we can calibrate
forward-looking estimates over time.

> **Do not edit `puzzle-velocity.csv` directly.** It is auto-generated.
> To log a new row, use:
> ```bash
> npm run velocity:log -- '{"ticket":N,"role":"DEV","agent":"BANANA",...}'
> ```
> See the close sequence in `docs/claude_workflow.md` for the full protocol.

## Where the data is

**Canonical store:** `~/.lccjs/lccjs.db` (SQLite, local-only, not git-tracked).
See [`docs/velocity-schema.md`](./velocity-schema.md) for the full schema reference.

**Read-only export:** [`puzzle-velocity.csv`](./puzzle-velocity.csv) — auto-generated
by `scripts/velocity-export.js` from the SQLite DB. One row per closed ticket /
puzzle, plus a comment header line. Empty fields mean "not tracked".

## Column reference

| Column | Type | Meaning |
|---|---|---|
| `id` | int | SQLite surrogate key (auto-increment); first column in the CSV export |
| `ticket` | int | GitHub issue number (e.g. `124` = `#124`) |
| `title` | string | short ticket title |
| `role` | string | role tag (see below) |
| `h_min` | number | **H**uman time estimate in minutes — drives Yegor 60m cap |
| `c_min` | number / empty | **C**laude time estimate in minutes — my forward-looking prediction |
| `actual_min` | number | wall-clock minutes from start to closing commit. **Valid only when the work performed matches the ticket scope** — if out-of-scope work was absorbed, annotate `notes` as invalid rather than leaving a silent corrupted value (see validity note in `docs/velocity-schema.md`). |
| `delta_h_min` | number | `actual_min − h_min` (negative = under estimate) |
| `delta_c_min` | number | `actual_min − c_min` (negative = under estimate) |
| `started_iso` | ISO 8601 / empty | timestamp when I began work (re-reading the issue counts as start); empty for retroactive rows |
| `finished_iso` | ISO 8601 | timestamp of the commit that closed the ticket |
| `closed_commit` | git short SHA / empty | short SHA of the closing commit. Left **empty** at close time since the rebase rewrites it (#186); derive on demand: `git log --grep "Closes #N" -1 --format=%h`. **Cross-repo:** when a puzzle ships in a paired repo (e.g. [`claude-config`](https://github.com/avidrucker/claude-config) skill work), the closing commit lives *there*, so that `git log` run in lccjs finds nothing — the SHA belongs to the sibling repo and the `notes` column names which one. |
| `notes` | string | free-text notes (anomalies, context, what was hard/easy) |
| `agent` | string / empty | the human/terminal name the agent ran under (e.g. `APPLE`). Once `CLAUDE_AGENT_NAME`/`--as` is set, this equals the worktree fruit — divergence only arises under bare `auto`. See [`design-agent-worktree-identity.md`](./design-agent-worktree-identity.md). Empty for rows logged before #180 / for work whose agent is unknown. Trailing column so the positional `awk` examples below keep their `$1..$12`. |
| `model` | string / empty | the Claude model that did the work, in short form `<family>-<major>.<minor>` — e.g. `sonnet-4.6`, `opus-4.8`, `haiku-4.5`. Empty for rows logged before the column was added (#275). Do not fabricate; leave blank when genuinely unknown. Added as a side-effect of #275; documented in #314. |

## Role codes

| Code | Meaning |
|---|---|
| `DEV` | code change — implementation work |
| `TEST` | test writing or test-only work |
| `ARC` | architect / design decision — chooses a path; does not implement |
| `WRITER` | documentation / glossary writing |
| `PM` | project management work (tracker updates, issue triage) |
| `DATA` | data analysis — stats, notebooks, calibration of this very log |
| `RESEARCH` | empirical investigation answering a question by experiment; no production code ships |
| `SPIKE` | bounded ≤60m investigation to scope/refresh an epic before writing puzzles (per `yegor-spikes`) |
| `REVIEW` | ratification / sign-off on an artifact someone else produced — distinct from RESEARCH (probing) and ARC (deciding) |
| `COMBO` | a task that genuinely spanned 2+ roles; the notes name which (used over a forced single tag) |

## The two estimates

Each puzzle going forward carries:

- **H (human)** — a human's time budget. Governs the Yegor ≤60m hard cap;
  if a puzzle would exceed 60m, it must be decomposed. **H is for discipline,
  not forecasting.**
- **C (Claude)** — my own forward-looking estimate for *my* wall-clock on the
  task. **C is for forecasting.** Tracked so we can see whether my self-
  predictions get more accurate over time.

For tickets filed before this protocol existed, **C** is captured at the time
I pick up the ticket as my prediction *before* doing the work.

## Concept reference (LCCjs-specific or PDD jargon)

See the canonical glossary in [`claude_workflow.md` § "Concept glossary (one-liners)"](./claude_workflow.md#concept-glossary-one-liners) — PDD, Puzzle, Spike, Tracker, Worktree, fruit identity, velocity row, and more are defined there.

## Protocol

When I pick up a ticket:

1. **Start** — capture `date '+%Y-%m-%dT%H:%M:%S%:z'` *before* reading the issue.
2. **Predict** — if the ticket has no C estimate yet, set one now.
3. **Work** — do the puzzle.
4. **Finish** — capture finish timestamp before the closing commit.
5. **Log the row** — run `npm run velocity:log -- '{"ticket":N,"role":"...","agent":"...",...}'`
   (validates, INSERTs into `~/.lccjs/lccjs.db`, auto-exports `docs/puzzle-velocity.csv`).
6. **Close in ONE commit** — delete the puzzle's source marker and commit:
   `git commit -m "… Closes #N"`. The exported CSV rides along automatically.
7. **Land + clean up** — `npm run close N` (from inside the worktree). Loops
   fetch/rebase/push until the commit lands on `origin/main`, then tears down
   the worktree and branch — gated on push success so cleanup can never race
   ahead of a failed push. Fallback when the tool is unavailable:
   `git pull --rebase && git push && git worktree remove .claude/worktrees/<fruit>-issue-N && git worktree prune && git branch -D <fruit>/issue-N-<slug>`.

### What gets logged (and what's skipped)

A row tracks **work/time, not file changes.** Tasks that ship **no code** —
`PM` (tracker updates, issue triage), `RESEARCH`, `SPIKE` — still get a row; the
DB already has many (PM #143/#204, RESEARCH #203, SPIKE #193/#166). The only
skips are: (a) `~/.lccjs/lccjs.db` doesn't exist *and* you haven't been asked to
set it up, or (b) a **pure tracker/epic** — see the umbrella test below. "No
repo files changed" means only that no worktree was needed for the *work
itself* — it never means "no velocity
row." If such a task lacks a ticket to key the row to, file one (the #204
retroactive-ticket precedent). See #216.

**Tracker/epic vs scope-spike — the umbrella test (#225)**

The deciding question: *does this issue represent distinct work, or is it just an
umbrella over rows that already exist?*

| Issue type | Row? | Rule |
|---|---|---|
| **Tracker / epic** (umbrella only — collects child issues, does no work itself) | **No** | Children log all the work; a row here double-counts. Precedent: #108, #144. |
| **Scope-decomposition spike** (bounded deliverable: site inventory + child breakdown + ROI) | **One row** | The scoping act is distinct from the children's implementation. `actual_min` must reflect the decomposition only, never a sum of child work. Precedent: #166, #171. |
| **Spike / RESEARCH** (findings, no children) | **One row** | Its own deliverable. |
| **Child puzzle** | **One row each** | The implementation work. |

A scope-spike row is not double-logging — it records the scoping; the children
record their implementation separately.

### FM-2 discovery bleed — `notes` field convention

When a ticket requires a short triage pass before implementation (FM-2: checking
whether a prior fix already landed, identifying the right caller, confirming the
issue is still present), and that pass is under ~5 minutes, do **not** file a
separate research ticket. Instead, capture it in the velocity row's `notes` field:

> `"~5 min triage confirming #N already landed before starting; not counted in implementation actual"`

This keeps the discovery visible in the data without inflating `actual_min` for
the implementation and without creating a ticket for trivial triage. Triage that
takes more than ~5 minutes warrants its own ticket and velocity row. See
`docs/research/601-scope-discipline.md` for the full FM-2 analysis.

`docs/puzzle-velocity.csv` is now a **generated read-only export** — `velocity-log.js`
writes to SQLite and auto-exports the full CSV after every INSERT. Format details
(LF endings, quote-doubling) are handled by the export script; manual editing is
not needed and not safe.

If a file conflicts during the rebase (e.g. two agents edited the same region
of `TODOS.md`), resolve it manually and still run the guard before `git add`:
`grep -c '^<<<<<<<\|^=======\|^>>>>>>>' <file>` must print `0` (a botched
resolution once shipped raw markers — #139, fixed by `a19d115`).
`docs/puzzle-velocity.csv` conflicts are auto-resolved by `npm run close`
(re-exports from SQLite); `docs/puzzle-clusters.csv` auto-resolves via
`merge=union`. Manual resolution is only needed for everything else.

### `closed_commit`: derive, don't capture

Leave `closed_commit` **empty** at close time. The rebase rewrites the closing
commit's SHA, so any value captured before the push is fragile and orphans on
every rebase round (the #160 close cycled `5c811f8 → 45f2654 → ab80bbc` for
exactly this reason). The closing commit is always recoverable from its message:

```bash
git log --grep "Closes #<N>" -1 --format=%h
```

An empty `closed_commit` is the honest value at close. Bulk-backfilling empty
SHAs from the git log (a reconciler run alongside `puzzle:status`) is a follow-up.
**Do not `git commit --amend`** to backfill a SHA — amend orphans the original.

**Cross-repo closes.** When the deliverable ships in a paired repository — e.g.
skill work landing in [`claude-config`](https://github.com/avidrucker/claude-config)
rather than lccjs — the `Closes #<N>` commit lives in *that* repo, so the
`git log --grep` above (run inside lccjs) returns nothing. For those rows the
closing SHA belongs to the sibling repo, and the `notes` column states which
repo to look in. Several rows already follow this convention (e.g. #137–#140,
#148); reconcilers and readers should resolve such SHAs against the named repo,
not lccjs.

## Reading the data

Quick stats with `awk` (zero-dependencies):

```bash
# average ΔH across all rows
awk -F, 'NR>1 && $7!="" {sum += $7; n++} END {print sum/n}' docs/puzzle-velocity.csv

# rows where I overran my C estimate
awk -F, 'NR>1 && $8>0 {print $1, $2, $8}' docs/puzzle-velocity.csv

# group by role
awk -F, 'NR>1 {n[$3]++; sa[$3]+=$6} END {for (r in n) print r, n[r], sa[r]/n[r]}' docs/puzzle-velocity.csv
```

Or just open the CSV in any spreadsheet.

## Estimate vocabulary (plain language)

These terms appear throughout the velocity data. Use the plain-language forms
in conversation; avoid shorthand like "under C."

| Term / column | Plain English |
|---|---|
| **H** | The 60-minute discipline budget set by a human. Governs when a puzzle must be decomposed. **Not a time forecast.** |
| **C** | My time prediction — how long I think the work will take me, set before starting. |
| `actual_min` | How long the work actually took (start timestamp to finishing commit). |
| `delta_c_min` | Minutes saved vs my prediction. Positive = finished faster than predicted; negative = ran longer than predicted. |
| "finished faster than predicted" | `actual_min < c_min` (previously "under C" — avoid this shorthand). |
| "ran longer than predicted" | `actual_min > c_min` (previously "over C" — avoid this shorthand). |
| "used X% of predicted time" | `actual_min / c_min × 100`. E.g. 39% means the work took less than half the predicted time. |
| "speedup factor" | `c_min / actual_min`. A factor of 2.5 means the work finished 2.5× faster than predicted. |

Analysis commentary in responses should use the plain-language forms only. No
inline calibration analysis during normal work sessions — that belongs in a
focused DATA/RESEARCH session (see #234).

## Calibration takeaways — updated 2026-06-03 (n=379)

*Early observations (n≈8) are preserved inline as historical context.*

### Overall pattern

Across 379 rows with both a C prediction and a measured actual:

- **93% of tasks finished faster than predicted** (351/379). 5% ran longer; 2% matched exactly.
- **Average: used 41% of predicted time** (actual = 5.7m, C = 15.7m; 2.44× faster than predicted on average).
- **H is structurally over-budgeted for AI work**, by 9-20× or more. Expected — H governs discipline, not forecasting.
- **C is also systematically over-padded**, and the over-pad has not converged despite ~18 months of data. Deliberate calibration attempts (e.g. #113: halved gut C, still finished in 27% of predicted time) did not move the needle.

### Per-role breakdown

| Role | n | Used % of predicted | Speedup factor | Faster / Slower |
|---|---|---|---|---|
| TEST | 16 | 24% | 4.1× | 16 / 0 |
| ARC | 14 | 29% | 3.4× | 14 / 0 |
| COMBO | 8 | 34% | 2.9× | 8 / 0 |
| DEV | 115 | 39% | 2.5× | 107 / 6 |
| SPIKE | 6 | 41% | 2.4× | 6 / 0 |
| RESEARCH | 70 | 42% | 2.4× | 64 / 5 |
| WRITER | 102 | 43% | 2.3× | 93 / 6 |
| PM | 17 | 45% | 2.2× | 15 / 1 |
| DATA | 24 | 49% | 2.1× | 23 / 1 |
| REVIEW | 2 | 58% | 1.7× | 2 / 0 |
| CHORE | 5 | 70% | 1.4× | 3 / 0 |

TEST is the most over-predicted role (used only 24% of C on average; never ran
longer). CHORE is the most accurate (used 70%; closest to C). DEV is the only
role with meaningful "ran longer" cases (6/115).

### Answers to early open questions

**Do DEV edit/test loops dominate and pull actuals toward H?**
At n=115 DEV rows: 107 finished faster, 6 ran longer. The first overrun (#135)
still holds as a real pattern — heavy edit/test/debug loops can overshoot C
— but it's the exception (6/115), not the rule. Average DEV speedup is still 2.5×.

**How does C calibrate across roles?**
Clear gradient: TEST/ARC/COMBO most over-predicted; CHORE/REVIEW most accurate.
The ranking is stable — read/write/research work is consistently over-padded
by 2-3×, while more variable loop-heavy or chore work is over-padded by 1-2×.

**Does C drift over time?**
No visible convergence. The over-pad pattern is stable across the full dataset.
Attempts to deliberately calibrate lower have not produced lasting improvement.

### Why the over-pad persists

Working hypotheses (not yet investigated empirically):

1. **Psychological weight ≠ wall-clock difficulty.** Tasks that feel heavy
   (writing prose, making design decisions) attract more padding regardless of
   their actual duration.
2. **Calibrating in the wrong direction.** Read/write/research rows are almost
   always underruns, so "padding conservatively" applies pressure in the wrong
   direction — the actual is already far below.
3. **Cross-role contamination.** "DEV" covers both research-flavored
   investigation (closer to 4×) and genuine edit/test loops (closer to 1-1.5×).
   Aggregating them masks within-role variance.

### Notable overruns

Rows where actual exceeded C by more than 5 minutes:

| Ticket | Title | Role | C | Actual | Overran by |
|---|---|---|---|---|---|
| #303 | TIL BANANA s2 — worktree cleanup, audit | WRITER | 10m | 34m | 24m |
| #530 | Unit tests for InterpreterPlus traps | DEV | 25m | 44m | 19m |
| #364 | docs: OB-001 §4 stale — mov silently wraps | WRITER | 15m | 32m | 17m |
| #141 | adopt .pddignore + lowercase scan | DEV | 12m | 25m | 13m |
| #406 | disassembler.js flatten with guard clauses | RESEARCH | 2m | 15m | 13m |
| #314 | model-column data quality | DATA | 20m | 30m | 10m |

Most overruns are in WRITER or DEV. #406 (RESEARCH) is a clear mis-labeling —
the task involved code refactoring, not pure investigation.

### Scope bundling silently corrupts actuals

When a session absorbs out-of-scope work — an unplanned bug fix (FM-1: bug tax), a
triage pass longer than ~5 minutes (FM-2: discovery bleed), or a scope-creep addition
(FM-3) — the resulting `actual_min` includes time that belongs to a different
deliverable. Against the ticket's `c_min` estimate this makes the prediction look
over-padded when the C estimate may have been accurate for the in-scope work alone.
The corruption is invisible unless the commit diff is audited against the ticket body.
Over many tickets it makes calibration appear broken when the underlying estimates are
sound.

**What to do:** do not delete or blank out `actual_min` (that loses the data point
entirely). Instead annotate `notes` with a brief description:
`"actual_min invalid — absorbed FM-1 fix for #N, ~10 min untracked"`.
This keeps the corruption visible in the data rather than silent, and lets a future
DATA pass identify and exclude invalid rows from calibration analysis. See
`docs/research/601-scope-discipline.md` for the full FM taxonomy and
`docs/velocity-schema.md` for the field-level validity rule.

### ELDERBERRY: confirmed drift, corrected priors (n=78, 2026-06-04)

**Finding (Q28r, #706):** ELDERBERRY's |delta_c_min| has a significant upward trend
over its history independent of puzzle difficulty. Partial correlation of |delta_c|
vs row order, controlling for h_min: r=+0.270, p=0.014. Mean h_min actually fell
(34m early → 27m late), ruling out the "harder puzzles" explanation. The drift is
genuine calibration degradation, not a task-mix artifact.

**Root cause:** c_min was anchored as a fraction of h_min (roughly h/3) rather than
to AI wall-clock actuals. As h_min varied, c_min drifted with it, inflating |delta_c|
even when actual_min remained stable.

**Corrected per-role priors** (derived from 78 ELDERBERRY rows with actual_min):

| Role | n | Median actual | Mean actual | Old c_min range | New c_min prior |
|------|---|--------------|-------------|-----------------|-----------------|
| WRITER | 29 | 1m | 3.0m | 5–15m | 3m |
| PM | 6 | 1m | 1.7m | 3–25m | 2m |
| DATA | 9 | 3m | 6.2m | 8–25m | 5m |
| DEV | 14 | 3m | 4.0m | 5–40m | 5m |
| ARC | 4 | 4m | 3.8m | 10–40m | 5m |
| RESEARCH | 16 | 5m | 8.8m | 5–30m | 7m |
| SPIKE | 3 | 6m | 7.3m | 20–30m | 8m |
| CHORE | 1 | 3m | 3.0m | 8m | 4m |

**New calibration rule for ELDERBERRY:** anchor c_min to the role's median actual,
not to H. Add a small buffer (1–3m) for variance; do not scale with H. The first
post-recalibration row is #718 (PM, c_min=3m — slightly above the new 2m prior to
reflect the data-analysis component of this particular ticket).

### Full-corpus C-overshoot study: retired (Q29r, #706, 2026-06-04)

**Decision:** The full-corpus powered study of C-overshoot rate is **not feasible**
at the current data growth rate and has been formally retired.

**Finding (Q29r, #706):** Detecting a halving of the full-corpus C-overshoot rate
(4.6% → 2.3%) at 80% power requires n=1,969 rows with both `c_min` and `actual_min`
present. The corpus had 477 such rows at the time of analysis — 4.1× short of the
required sample. At the observed logging rate of ~32 rows/month, reaching n=1,969
would take ~47 months.

**Conclusion:** Do not re-propose a full-corpus C-overshoot powered study until the
corpus reaches n≥1,000 with both fields. For near-term overshoot analysis, use
per-agent subsets (e.g., DRAGONFRUIT, CHERRY) where per-role sample sizes are more
tractable. See sibling tickets under #706 for the per-agent analysis track.
