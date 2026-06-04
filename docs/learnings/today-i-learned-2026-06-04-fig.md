# TIL 2026-06-04 (FIG) — Restart loops in LCC+ assembly, de-confounding drift with partial correlation, and ROADMAP accuracy review

## Context

Three tickets closed today: #691 (restart loop in `gameflappyBird.ap`), #706 (velocity
analytics follow-up — C-overshoot predictors and ELDERBERRY calibration drift), and #681
(ROADMAP.md accuracy review).

---

## 1. Restart loops in LCC+ assembly

**Problem:** `gameflappyBird.ap` exited permanently on game over. Pressing `q` or dying
returned through the call stack to `startup → halt` with no way to replay.

**Pattern:** A restart loop in LCC+ assembly is just a conditional branch back to a label
inside the same function. The key insight is that branching back to `@loopStart` inside
`main` is safe — you're still in the same stack frame, so the existing `push lr` / `pop lr`
from the original `bl main` is still valid. Re-initializing game state before branching
back gives a clean slate.

```asm
@endGame:
    bl    drawFrame         ; show final board
    sout  gameOverMsg       ; "GAME OVER - r=restart, q=quit"
    nl
    ain   r0                ; block for one keypress

    mov   r1, 'r'
    cmp   r0, r1
    brne  @quitGame         ; any key other than r falls through
    bl    initializeGame    ; reset score, bird, pipe
    br    @loopStart        ; jump back into the game loop

@quitGame:
    mov   sp, fp
    pop   fp
    pop   lr
    ret
```

Three things to keep consistent when adding a restart:

- **Reset all mutable state** in `initializeGame` — including fields that seem
  constant (like `birdCol`). An overlooked reset becomes a latent bug if the field
  is ever made mutable.
- **Don't re-seed the RNG.** `srand` is called once at the top of `main` before the
  loop; restarting skips it. That's correct — re-seeding on every restart would give
  identical gap sequences across games.
- **Don't re-`clear` or re-`cursor` on restart** — those belong in startup only;
  `drawFrame` uses `resetc` to repaint in place.

---

## 2. Partial correlation to de-confound a trend

**Problem:** ELDERBERRY's |delta_c_min| (C-estimate error) showed a significant upward
trend over time (Spearman r=+0.245, p=0.04 in the original Q28 analysis). One plausible
explanation: ELDERBERRY was assigned progressively harder puzzles, and larger puzzles
naturally produce larger absolute errors — no true calibration drift required.

**Tool:** Partial correlation. Regress both variables (row order and |delta_c|) on the
confounder (h_min), take the residuals, then correlate the residuals.

```python
def resid(y, x):
    x = np.column_stack([np.ones(len(x)), x])
    coef, *_ = np.linalg.lstsq(x, y, rcond=None)
    return np.array(y) - x @ coef

ro_r = resid(row_orders, h_mins)   # row order unexplained by h_min
dc_r = resid(abs_deltas, h_mins)   # |delta_c| unexplained by h_min
r_partial, p_partial = scipy.stats.spearmanr(ro_r, dc_r)
# → r=+0.270, p=0.014
```

**Result:** Controlling for h_min *strengthened* the correlation (r=+0.245 → r=+0.270),
and ELDERBERRY's mean h_min actually fell from 34m (early half) to 27m (late half).
Easier puzzles over time, yet growing errors — the drift is genuine.

**Rule of thumb:** If a partial correlation is stronger than the raw correlation, the
confounder was suppressing the relationship, not causing it. If it disappears, the
confounder was the cause.

---

## 3. Verifying a range claim against actual files

**Problem:** `ROADMAP.md` described the cuh63 exercise index as covering "ch3–ch19".
The dash notation implies continuous coverage.

**Check:** `ls docs/cuh63/` showed ch03–ch12, ch14–ch16, ch19 — ch13, ch17, and ch18
were absent.

**General principle:** Any doc that uses a range shorthand (`ch3–ch19`, `v1–v5`,
`step 1–10`) is making an implicit claim about completeness. Verify it by listing the
actual files; the range notation is almost always wrong when files were added
opportunistically rather than in sequence.

A related check: "in progress" items that cite issue numbers. If the cited issues are
closed, the description may be stale even if the larger arc is still open. In the same
ROADMAP, "platform selection between reveal-md, Marp, and Quarto in progress" was still
written after reveal-md had been selected and validated (issues #673 and #682 both
closed). The fix is to re-read the item as "what is still open" not "what was once open."

---

## What landed

| Artifact | Change |
|---|---|
| [#691](https://github.com/avidrucker/lccjs/issues/691) | Restart-after-game-over loop added to `plusdemos/gameflappyBird.ap` |
| [#706](https://github.com/avidrucker/lccjs/issues/706) | C-overshoot predictors + ELDERBERRY drift analysis appended to `docs/research/velocity-analytics-batch.md` |
| [#681](https://github.com/avidrucker/lccjs/issues/681) | ROADMAP accuracy review comment posted; two corrections flagged |
| [#723](https://github.com/avidrucker/lccjs/issues/723) | This TIL |
