# ICE re-score — pair-work session 2026-06-29 (#1516)

Human-judged ICE re-score of the 33 open tickets that the `--auto` sweep (commit 43fc89b) had
scored provisionally (C=0.8 default; I/E from labels). Each ticket got a full `issue-review-skill`
pass; APPLE recommended I/C/E from the review, Avi picked. The `provisional` flag is now cleared —
these scores are authoritative.

**Result:** 25/33 tickets changed · mean |ΔICE| = 1.57 · ICE = I×C×E.

## Biggest movers

- **#1487**  2.4 → 10.0 (+7.6) — research(workflow): document lccjs' end-to-end ticket l
- **#1360**  2.0 → 8.0 (+6.0) — PROPOSAL: codify "verify the common interaction path, n
- **#1456**  4.0 → 8.0 (+4.0) — tracker: migrate lccjs PM commands onto the central pmt
- **#1406**  5.6 → 2.4 (-3.2) — Tracker: report outstanding OG Oracle (cuh63 6.3) bugs/
- **#1443**  2.0 → 5.0 (+3.0) — DEV: base-owned interpreter trap/eopcode registry + con
- **#1486**  4.0 → 7.0 (+3.0) — process: promote 'verify live state, not memory' to RUL

## Per-ticket before → after (sorted by new ICE)

| # | I | C | E | ICE before | ICE after | Δ | title |
|---|---|---|---|--:|--:|--:|---|
| 1487 | 1.0→1 | 0.8→1.0 | 3.0→10 | 2.4 | 10.0 | +7.6 | research(workflow): document lccjs' end-to-end |
| 1360 | 0.5→1 | 0.8→0.8 | 5.0→10 | 2.0 | 8.0 | +6.0 | PROPOSAL: codify "verify the common interactio |
| 1456 | 1.0→2 | 0.8→0.8 | 5.0→5 | 4.0 | 8.0 | +4.0 | tracker: migrate lccjs PM commands onto the ce |
| 1486 | 1.0→1 | 0.8→1.0 | 5.0→7 | 4.0 | 7.0 | +3.0 | process: promote 'verify live state, not memor |
| 1426 | 1.0→1 | 0.8→0.8 | 7.0→7 | 5.6 | 5.6 | +0.0 | SPIKE: confirm Hermes skill model (dirs/invoca |
| 1484 | 1.0→1 | 0.8→0.8 | 5.0→7 | 4.0 | 5.6 | +1.6 | build(velocity): untrack docs/puzzle-velocity. |
| 1443 | 0.5→1 | 0.8→1.0 | 5.0→5 | 2.0 | 5.0 | +3.0 | DEV: base-owned interpreter trap/eopcode regis |
| 1440 | 1.0→2 | 0.8→0.8 | 5.0→3 | 4.0 | 4.8 | +0.8 | TRACKER: generalize lccjs-coupled skills to be |
| 1411 | 1.0→1 | 0.8→0.8 | 5.0→5 | 4.0 | 4.0 | +0.0 | data(process): normalize the 50 pre-existing n |
| 1420 | 0.5→1 | 0.8→0.8 | 5.0→5 | 2.0 | 4.0 | +2.0 | feat(skills): fruit-agent-orchestrate should r |
| 1444 | 0.5→1 | 0.8→0.8 | 5.0→5 | 2.0 | 4.0 | +2.0 | DEV: port LCC+ trap/eopcode handlers onto the  |
| 1461 | 1.0→1 | 0.8→0.8 | 5.0→5 | 4.0 | 4.0 | +0.0 | TRACKER: adopt br-/wt- self-describing worktre |
| 1465 | 1.0→1 | 0.8→0.8 | 5.0→5 | 4.0 | 4.0 | +0.0 | feat(claim): flip claim/close construction to  |
| 1479 | 1.0→1 | 0.8→0.8 | 5.0→5 | 4.0 | 4.0 | +0.0 | Char-literal error messages: '''→"Bad label" i |
| 1500 | 1.0→1 | 0.8→0.8 | 5.0→5 | 4.0 | 4.0 | +0.0 | Make themes dropdown available on all GitHub P |
| 1506 | 1.0→1 | 0.8→0.8 | 5.0→5 | 4.0 | 4.0 | +0.0 | DEV: validate and revise LCC+ sound mnemonic m |
| 1507 | 0.5→0.5 | 0.8→0.8 | 5.0→10 | 2.0 | 4.0 | +2.0 | WRITER: add Buy Me a Coffee support badge to R |
| 1512 | 1.0→1 | 0.8→0.8 | 3.0→5 | 2.4 | 4.0 | +1.6 | .env usage is unaudited — no private-vs-public |
| 1405 | 1.0→0.5 | 0.8→0.8 | 5.0→7 | 4.0 | 2.8 | -1.2 | DEV/decision: optional friendly alias for reve |
| 1445 | 0.5→0.5 | 0.8→0.8 | 5.0→7 | 2.0 | 2.8 | +0.8 | DEV: unit tests for trap/eopcode registry guar |
| 1493 | 1.0→0.5 | 0.8→0.8 | 5.0→7 | 4.0 | 2.8 | -1.2 | RESEARCH: decide whether LCC+ sound should use |
| 1510 | 0.5→0.5 | 0.8→0.8 | 7.0→7 | 2.8 | 2.8 | +0.0 | LCC+ docs and tickets misrepresent `boop`: con |
| 1406 | 1.0→1 | 0.8→0.8 | 7.0→3 | 5.6 | 2.4 | -3.2 | Tracker: report outstanding OG Oracle (cuh63 6 |
| 1447 | 0.5→1 | 0.8→0.8 | 5.0→3 | 2.0 | 2.4 | +0.4 | ARC/HUMAN: @ItBeCharlie sign-off on 4 design q |
| 1466 | 1.0→1 | 0.8→0.8 | 5.0→3 | 4.0 | 2.4 | -1.6 | tracker: PM-transition no-regression gate — cr |
| 1480 | 1.0→1 | 0.8→0.8 | 5.0→3 | 4.0 | 2.4 | -1.6 | Unique, stable error IDs for every diagnostic, |
| 1481 | 1.0→1 | 0.8→0.8 | 5.0→3 | 4.0 | 2.4 | -1.6 | Add --oracle-compat: opt-in 100% OG-LCC featur |
| 1427 | 0.5→0.5 | 0.8→0.8 | 3.0→5 | 1.2 | 2.0 | +0.8 | research(process): backtest inferArea() label  |
| 1448 | 0.5→0.5 | 0.8→0.8 | 3.0→5 | 1.2 | 2.0 | +0.8 | process: auto-mode classifier doesn't treat a  |
| 1449 | 1.0→0.5 | 0.8→0.8 | 5.0→5 | 4.0 | 2.0 | -2.0 | RESEARCH: does extracting a pure planClaim() s |
| 1492 | 1.0→0.5 | 0.8→0.8 | 5.0→5 | 4.0 | 2.0 | -2.0 | DEV: make LCC+ sound-like mnemonics register-f |
| 1378 | 0.5→0.5 | 0.8→0.5 | 5.0→7 | 2.0 | 1.75 | -0.25 | fix(interpreter): add defensive break/return a |
| 1402 | 0.5→0.5 | 0.8→0.5 | 5.0→5 | 2.0 | 1.25 | -0.75 | chore(interpreter): add a committed oracle-pro |

## Notes

- **Method:** ICE = Impact(3/2/1/0.5/0.25) × Confidence(1.0/0.8/0.5) × Ease(10/7/5/3/1), per `scripts/ice-score.js`.
- **Two tickets surfaced as likely DONE/closeable** during review (verify-live-state): **#1487** (lifecycle spec — both in-scope boxes checked; parity moved to #1518) sorted to the top (ICE 10) *to be closed, not worked*; **#1456** (pmtools PM-migration tracker — recent commits flipped close + logging) looks near-done.
- **Trackers dropped** (#1406, #1466, #1480, #1481): the auto-sweep gave them E=7, making umbrellas/epics look snackable; human judgment set Ease low (3) for long-tail/coordination work so they don't outrank grabbable tickets.
- **Risers** (#1360, #1443, #1486, #1420, #1444, #1456): under-rated by the heuristic — fully-designed or clear-value work the sweep had pinned at the default I=0.5-1 / E=5.
- **8 unchanged** (#1411/#1426/#1461/#1465/#1479/#1500/#1506/#1510) — the heuristic happened to match human judgment.
