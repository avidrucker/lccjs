# Puzzle Velocity Log

Tracking estimated vs actual time per puzzle / ticket so we can calibrate
estimates over time.

## Two estimates per puzzle

Going forward each puzzle carries **two** estimates:

- **H (human)** — what a human would budget for the task. This is the Yegor
  60m-capped estimate that governs decomposition. It still drives the
  discipline (puzzles ≤60m, decompose if larger).
- **C (Claude)** — my forward-looking guess for my own wall-clock on the task.
  Tracked so we can see how my self-estimates compare to actuals over time and
  improve calibration.

For tickets filed before this protocol existed, **C** is added at the time I
pick up the ticket as my own prediction, before doing the work.

## What "actual" means

Wall-clock elapsed from when I began work on a ticket (re-reading the issue
for context) to the commit closing it.

The interesting trends to track:
- **Do my Claude estimates (C) match my actuals?** This is the calibration loop.
- **How often do I overrun?** Overruns under either H or C are worth flagging.
- **Slice-by-role variance** — DEV vs WRITER vs ARC vs TEST estimates
  probably age differently, and the velocity will too.

## Protocol

At the start of a new ticket / puzzle:
1. Capture start timestamp via `date '+%Y-%m-%d %H:%M:%S'`.
2. Stash it (task metadata or a note).
3. If only H is recorded on the ticket, set **C** now (forward-looking).
4. Do the work.

At commit-close:
5. Capture finish timestamp.
6. Compute actuals and Δ vs both H and C.
7. Append a row to the log below.
8. Include this file in the same commit that closes the ticket.

## Log

| Ticket | Title | Role | H | C | Actual | ΔH | ΔC | Started | Finished | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| [#119](https://github.com/avidrucker/lccjs/issues/119) | assembler.js (a) lifecycle/output term inventory | WRITER | 60m | — | ~10m | −50m | — | — | 2026-05-28 11:58 | C not yet tracked; first spike with warm-up cost |
| [#120](https://github.com/avidrucker/lccjs/issues/120) | assembler.js (b) pass model + file parsing term inventory | WRITER | 60m | — | ~16m | −44m | — | — | 2026-05-28 12:14 | included filing 3 follow-up puzzles for #119 findings |
| [#121](https://github.com/avidrucker/lccjs/issues/121) | assembler.js (c) tokens + dispatch term inventory | WRITER | 60m | — | ~2m | −58m | — | — | 2026-05-28 12:16 | densest section by directive count but mechanical |
| [#122](https://github.com/avidrucker/lccjs/issues/122) | assembler.js (d) per-instruction encoders term inventory | WRITER | 60m | — | ~3m | −57m | — | — | 2026-05-28 12:19 | bonus: also closed #125 (E/e/V disambiguation) |
| [#123](https://github.com/avidrucker/lccjs/issues/123) | assembler.js (e) operand helpers term inventory | WRITER | 60m | — | ~2m | −58m | — | — | 2026-05-28 12:21 | smallest section; finally documented fp/sp/lr → r5/r6/r7 |
| [#124](https://github.com/avidrucker/lccjs/issues/124) | .e/.o glossary entry shape design | ARC | 30m | 4m | 1.5m | −28.5m | −2.5m | 2026-05-28 12:31:56 | 2026-05-28 12:33:28 | first dual-estimate row; first ARC puzzle; my C estimate ran ~2.5× too high |

## Running stats

| | All puzzles | WRITER only | ARC only |
|---|---|---|---|
| Count | 6 | 5 | 1 |
| Sum of H | 330m | 300m | 30m |
| Sum of C | 4m (only #124 tracked) | — | 4m |
| Sum of actuals | ~34.5m | ~33m | 1.5m |
| Average ΔH | −49m | −53m | −28.5m |
| Average ΔC | −2.5m (n=1) | — | −2.5m |
| H-to-actual ratio | ~10× | ~9× | 20× |
| C-to-actual ratio | n=1 (~2.5×) | — | ~2.5× |
| Overruns vs H | 0/6 | 0/5 | 0/1 |
| Overruns vs C | 0/1 | — | 0/1 |

## Calibration takeaways

After 5 WRITER spikes + 1 ARC design call:

- **H (human) cap is wildly over-budgeted for AI**, confirmed across two roles
  (WRITER ~9× margin, ARC ~6× margin). The 60m cap still drives decomposition
  discipline — that's its job — but isn't a predictor of actuals.
- **C (Claude) is the right input to forecast** when we want to know how long
  *I* will take. First data point: my own estimate (4m) ran ~2.5× too high on
  a 1.5m-actual ARC ticket. Either I overweight uncertainty for new task
  shapes, or I needed to budget for filing-the-decision-comment ceremony but
  it was faster than I thought. Need more samples before declaring a pattern.
- **Warm-up cost is real** — first spike of a streak runs longer than
  subsequent ones (#119 took ~10m, then #121-#123 dropped to 2-3m once the
  pattern was established).
- **Process overhead bleeds in** — #120 was longer largely because of filing
  3 follow-up puzzles. Worth distinguishing "task work" from "process work" in
  future estimates if the gap matters.

## Open questions to revisit

- Do **DEV** puzzles (actual code changes with edit/test loops) follow the
  same ratio, or does the loop dominate?
- How does the C estimate hold up across role kinds? Need DEV + TEST samples.
- Does this calibration hold for **less familiar** codebases or denser file
  types (e.g., a 2000-line file with no comments)?
- Does C systematically drift over time (overconfidence after a streak of
  underruns)?
