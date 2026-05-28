# Puzzle Velocity Log

Tracking estimated vs actual time per puzzle / ticket so we can calibrate
estimates over time.

## What "actual" means

Wall-clock elapsed from when I began work on a ticket to the commit closing
it. For me (an AI agent), this often runs far faster than the human-time
estimate baked into the puzzle. The 60m hard cap from Yegor's discipline is
a **human-effort** ceiling; AI wall-clock will typically be a small fraction.

The interesting trend isn't "did I beat the estimate" (I usually will) but:
- **How often I _overrun_** — calibration miss on the hard side
- **Whether my forward-looking estimates get more accurate over time**
- **Slice-by-role variance** — DEV vs WRITER vs ARC vs TEST estimates probably
  age differently, and the velocity will too

## Protocol

At the start of a new ticket / puzzle:
1. Run `date '+%Y-%m-%d %H:%M'` and stash the value (task metadata or a note).
2. Do the work.

At commit-close:
3. Run `date '+%Y-%m-%d %H:%M'`, compute Δ from estimate.
4. Append a row to the log below.
5. Include this file in the same commit that closes the ticket.

## Log

| Ticket | Title | Role | Est | Actual | Δ | Finished (UTC offset −10) | Notes |
|---|---|---|---|---|---|---|---|
| [#119](https://github.com/avidrucker/lccjs/issues/119) | assembler.js (a) lifecycle/output term inventory | WRITER | 60m | ~10m | −50m | 2026-05-28 11:58 | first spike; included reading 600L + populating section (a) |
| [#120](https://github.com/avidrucker/lccjs/issues/120) | assembler.js (b) pass model + file parsing term inventory | WRITER | 60m | ~16m | −44m | 2026-05-28 12:14 | included filing 3 follow-up puzzles for #119 findings |
| [#121](https://github.com/avidrucker/lccjs/issues/121) | assembler.js (c) tokens + dispatch term inventory | WRITER | 60m | ~2m | −58m | 2026-05-28 12:16 | densest section by directive count but mechanical |
| [#122](https://github.com/avidrucker/lccjs/issues/122) | assembler.js (d) per-instruction encoders term inventory | WRITER | 60m | ~3m | −57m | 2026-05-28 12:19 | bonus: also closed #125 (E/e/V disambiguation) |
| [#123](https://github.com/avidrucker/lccjs/issues/123) | assembler.js (e) operand helpers term inventory | WRITER | 60m | ~2m | −58m | 2026-05-28 12:21 | smallest section; finally documented fp/sp/lr → r5/r6/r7 |

## Running stats

|  | All puzzles |
|---|---|
| Count | 5 |
| Sum of estimates | 300m (5 × 60m) |
| Sum of actuals | ~33m |
| Average Δ | −53m |
| Estimate-to-actual ratio | ~9× over-budgeted |
| Overruns | 0/5 |

## Calibration takeaways

After 5 WRITER-role term-inventory spikes on a familiar, well-commented JS file:

- **60m was wildly over-budgeted** for this kind of work. A more honest baseline
  for WRITER term-inventory on JS source is closer to **1-3 min per 100 lines**
  (so ~10m for a 600-line section, ~3m for a 300-line section).
- The first spike of a streak runs longer than subsequent ones (warm-up cost:
  loading conventions + figuring out grouping). Once the pattern is established,
  subsequent same-shape puzzles are much faster.
- Estimates that bake in "and follow Yegor's discipline" don't add wall-clock,
  but estimates that bake in "and decide whether to file follow-up puzzles for
  findings" do (spike #120 was longer largely because of #119's findings).

## Open questions to revisit

- Are DEV puzzles (actual code changes) similarly over-budgeted, or does the
  edit/test loop dominate and make 60m more realistic?
- Do ARC puzzles (design decisions) take significantly more wall-clock?
- Does this calibration hold for less familiar codebases or denser file types
  (e.g., a 2000-line file with no comments)?
