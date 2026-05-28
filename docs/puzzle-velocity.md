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
| `closed_commit` | git short SHA | short SHA of the closing commit |
| `notes` | string | free-text notes (anomalies, context, what was hard/easy) |

## Role codes

| Code | Meaning |
|---|---|
| `DEV` | code change — implementation work |
| `TEST` | test writing or test-only work |
| `ARC` | architect / design decision — chooses a path; does not implement |
| `WRITER` | documentation / glossary writing |
| `PM` | project management work (tracker updates, issue triage) |

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
5. **Close** — `git commit -m "... Closes #N"` (commit 1).
6. **Sync** — `git pull --rebase`. **This step is critical when other agents may have pushed in parallel** — rebase rewrites your commit's SHA, so the SHA must be captured *after* this step. If the rebase hits a CSV conflict (both agents appended a row), resolve manually and `git rebase --continue`.
7. **Record** — `git rev-parse --short HEAD` is now stable; append a CSV row with that SHA + the actuals + ΔH + ΔC.
8. **Log** — `git commit -m "docs(velocity): log #N — …"` (commit 2).
9. **Push** — `git push`.

Why `pull --rebase` at step 6 and not earlier: rebasing rewrites the commit SHA captured at step 5. If you logged the velocity row first, that SHA would point at a now-orphan commit that doesn't exist on `main`. By rebasing between commit 1 and the SHA capture, the SHA is stable through the push.

Same reason: **do not `git commit --amend`** to backfill a SHA. Amend also orphans the original.

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
- **Warm-up cost** on the first puzzle of a streak is real: #119 (10m) versus #121-#123 (2-3m) once the pattern was established.
- **Process overhead bleeds in** — e.g. #120 was longer because of filing 3 follow-up puzzles, not because the inventory work was harder. Worth distinguishing "task work" from "process work" in future estimates.

### Hypotheses on the persistent C over-pad

Logged here for later study; not actively investigating yet.

1. **"Weightier" tasks attract more padding regardless of actual difficulty.** #113 was definition-*writing* not term-*inventorying*, and felt like real prose work; I padded C accordingly. Actual wall-clock was similar to the spike rows. The padding is psychological, not predictive.
2. **I'm calibrating in the wrong direction.** With 5 underruns and 0 overruns, conservative calibration tightens nothing. To close the loop I'd need to halve C aggressively until I start *occasionally* overrunning. Right now overrun rate is 0% and that's the wrong target — somewhere around 40-50% overrun rate is where the median is well-calibrated.
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
