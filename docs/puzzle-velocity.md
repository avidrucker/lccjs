# Puzzle Velocity — Data & Explainer

Tracks estimated vs actual time per puzzle / ticket so we can calibrate
forward-looking estimates over time. Raw data lives in
[`puzzle-velocity.csv`](./puzzle-velocity.csv); this doc explains the columns,
the protocol, and the jargon.

## Where the data is

[`puzzle-velocity.csv`](./puzzle-velocity.csv) — one row per closed
ticket / puzzle. Empty fields mean "not tracked" (most commonly for rows
logged retroactively before the protocol existed).

## Column reference

| Column | Type | Meaning |
|---|---|---|
| `ticket` | int | GitHub issue number (e.g. `124` = `#124`) |
| `title` | string | short ticket title |
| `role` | string | role tag (see below) |
| `h_min` | number | **H**uman time estimate in minutes — drives Yegor 60m cap |
| `c_min` | number / empty | **C**laude time estimate in minutes — my forward-looking prediction |
| `actual_min` | number | wall-clock minutes from start to closing commit |
| `delta_h_min` | number | `actual_min − h_min` (negative = under estimate) |
| `delta_c_min` | number | `actual_min − c_min` (negative = under estimate) |
| `started_iso` | ISO 8601 / empty | timestamp when I began work (re-reading the issue counts as start); empty for retroactive rows |
| `finished_iso` | ISO 8601 | timestamp of the commit that closed the ticket |
| `closed_commit` | git short SHA / empty | short SHA of the closing commit. Left **empty** at close time since the rebase rewrites it (#186); derive on demand: `git log --grep "Closes #N" -1 --format=%h`. **Cross-repo:** when a puzzle ships in a paired repo (e.g. [`claude-config`](https://github.com/avidrucker/claude-config) skill work), the closing commit lives *there*, so that `git log` run in lccjs finds nothing — the SHA belongs to the sibling repo and the `notes` column names which one. |
| `notes` | string | free-text notes (anomalies, context, what was hard/easy) |
| `agent` | string / empty | which agent did the work — the worktree fruit identity, uppercased (e.g. `APPLE`); see [`design-agent-worktree-identity.md`](./design-agent-worktree-identity.md). Empty for rows logged before #180 / for work whose agent is unknown. Trailing column so the positional `awk` examples below keep their `$1..$12`. |

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

- **PDD (Puzzle-Driven Development)** — Yegor Bugayenko's discipline where
  unfinished work lives as a `@todo` comment ("puzzle") in code, tied to a
  GitHub issue. Each puzzle is ≤60m and has format
  `@todo #N:Est/ROLE description`.
- **Yegor discipline** — broader conventions around PDD: ≤60m cap, research
  tickets labeled `research` (not `pdd-tracked`), parent/child trackers,
  decompose only what's about to be implemented.
- **Spike** — a bounded ≤60m **research** session that produces findings
  (term inventory, scope notes) rather than working code. Labeled `research`
  on the GH issue, *not* `pdd-tracked`.
- **Tracker** — a GH issue that doesn't represent a single piece of work but
  tracks N child puzzles. Example: #108 tracked the 5 assembler.js inventory
  spikes #119–#123. Closing a tracker means all children closed.
- **Term inventory** — first phase of glossary writing: list term names only,
  no definitions. Definitions land in a separate, later ticket (typically
  blocked by all the inventory spikes).
- **Section (a)-(e)** — the assembler.js glossary was decomposed into 5
  sections by file structure: (a) lifecycle, (b) pass model, (c) tokenization,
  (d) per-instruction encoders, (e) operand helpers. The interpreter and
  linker glossaries may use similar but not identical letterings.
- **Oracle / cuh63** — the reference LCC implementation
  (`~/Documents/Study/Assembly/cuh63/lcc`) used to verify LCC.js parity. See
  the `lcc_oracle_install` memory.

## Protocol

When I pick up a ticket:

1. **Start** — capture `date '+%Y-%m-%dT%H:%M:%S%z'` *before* reading the issue.
2. **Predict** — if the ticket has no C estimate yet, set one now.
3. **Work** — do the puzzle.
4. **Finish** — capture finish timestamp before the closing commit.
5. **Close + log in ONE commit** — delete the puzzle's source marker, append the
   CSV row (with `closed_commit` left **empty** — see below), and
   `git commit -m "… Closes #N"`.
6. **Sync + push** — `git pull --rebase`, then `git push`.

### What gets logged (and what's skipped)

A row tracks **work/time, not file changes.** Tasks that ship **no code** —
`PM` (tracker updates, issue triage), `RESEARCH`, `SPIKE` — still get a row; the
CSV already has many (PM #143/#204, RESEARCH #203, SPIKE #193/#166). The only
skips are: (a) no `puzzle-velocity.*` files exist *and* you haven't been asked to
set them up, or (b) a **sub-minute** fast-clarification turn. "No repo files
changed" means only that no worktree was needed for the *work itself* — it never
means "no CSV row." If such a task lacks a ticket to key the row to, file one (the
#204 retroactive-ticket precedent). See #216.

`docs/puzzle-velocity.csv` carries `merge=union` (see `.gitattributes`), so when
other agents have appended rows in parallel, the rebase **auto-unions** both
sides' rows with **no manual conflict** — the old hand-resolve + marker-guard
dance is gone. (`union` fires under `rebase`, not just `merge` — verified;
[`research/velocity-log-storage.md`](./research/velocity-log-storage.md).)

If a *non-union* file conflicts during the rebase (e.g. two agents edited the
same region of `TODOS.md`), resolve it manually and still run the guard before
`git add`: `grep -c '^<<<<<<<\|^=======\|^>>>>>>>' <file>` must print `0` (a
botched resolution once shipped raw markers — #139, fixed by `a19d115`).

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

## Calibration takeaways so far

After 5 WRITER spikes + 1 ARC + 1 WRITER write-phase + 1 DEV parity char.:

- **H is structurally over-budgeted for AI work** (~9-20× across both roles).
  Expected — reinforces that H is for discipline, not forecasting.
- **C runs systematically high too**, even after deliberate calibration. 6 C-tracked rows: 2.67× / 3.0× / 3.0× / 2.4× / 3.6× / **2.4×** (mean ≈ 2.8×). On #113 I explicitly halved my gut C from ~20m to 10m and *still* came in at 2.78m actual (3.6× over) — calibration didn't track.
- **First DEV row holds the WRITER pattern**: #106 (parity characterization — run the repro, then write the deviation entry) came in at **2.4× over C** (C=12m, actual 4.95m), squarely in the WRITER band. Caveat: this was a research-flavored DEV task, *not* a heavy edit→test→rerun loop — so the open question below (does the test loop pull DEV actuals toward H?) is still open.
- **FIRST OVERRUN — the DEV edit/test loop answers the open question.** #135 (refactor 6 demos: edit each, assemble, run, diff vs baseline — plus debugging a bug in my own transform script) ran **12.85m vs C=10m → 1.28× OVER**. First row where actual exceeded C, and it's exactly the heavy edit→test→rerun DEV loop that #106 wasn't. So **DEV-with-a-real-loop is a different forecasting class than research-flavored DEV** — the loop (and especially mid-task debugging) pulls actuals up, past even a calibrated-low C. The under-pad pattern was a property of *read/write/research* work, not of "DEV" as a role.
- **Warm-up cost** on the first puzzle of a streak is real: #119 (10m) versus #121-#123 (2-3m) once the pattern was established.
- **Process overhead bleeds in** — e.g. #120 was longer because of filing 3 follow-up puzzles, not because the inventory work was harder. Worth distinguishing "task work" from "process work" in future estimates.

### Hypotheses on the persistent C over-pad

Logged here for later study; not actively investigating yet.

1. **"Weightier" tasks attract more padding regardless of actual difficulty.** #113 was definition-*writing* not term-*inventorying*, and felt like real prose work; I padded C accordingly. Actual wall-clock was similar to the spike rows. The padding is psychological, not predictive.
2. **I'm calibrating in the wrong direction (mostly).** The read/write/research rows are all underruns, so conservative calibration there tightens nothing. **Update:** #135 broke the streak with the first overrun — but it was a *DEV edit/test-loop* task, a different class. So the real lesson is per-class calibration: keep tightening C on research/write work (still ~2-3× over), but budget DEV-with-loops higher (loops + debugging are unpredictable and can blow past C).
3. **Sample size still small (n=5).** 3.6× could be inside the noise band; need more data before declaring a real pattern shift.
4. **Cross-role contamination.** I might be conflating "write some prose" with "diagnose a bug" or "design a refactor" — all of which I'd see as "weighty" but which actually have very different wall-clock profiles for an AI.

User has explicitly said calibration isn't the priority right now — keep predicting as-is, study the data later when there's more of it.

## Open questions to revisit

- Do DEV puzzles (actual code changes with edit/test loops) follow the same
  ratios, or does the loop dominate and pull actuals closer to H?
- How does C calibrate across role kinds? Still need DEV + TEST samples.
- Does this hold for less familiar code or sparsely-commented files?
- Does C drift over time (over-confidence after a streak of underruns)?
- Is "amount of prose to type" a better predictor than "amount of code to read"?
