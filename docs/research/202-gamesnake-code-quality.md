# gameSnake.ap Code-Quality Assessment (#202)

**Agent:** BANANA · **Date:** 2026-06-03 · **Rubric:** avi-code-quality concern catalog

---

## Verdict

`plusdemos/gameSnake.ap` (637 lines) is **working but organically overgrown**. The core
algorithms (linked list, collision, wrapping, random fruit placement) are correct and
well-commented. The main quality problems are:

1. `main` is 158 lines and should be decomposed into three extracted subroutines.
2. Several small dead-code / comment-accuracy issues accumulate into noise.
3. One correctness bug: no opposite-direction guard (pressing the reverse key kills you
   instantly).
4. Two efficiency smells worth knowing about (not blocking, but worth fixing eventually).

No structural rework is needed — targeted refactors and one bug fix bring the file to
a clearly good shape. Total estimated follow-up effort: ~200m across 5 puzzles.

---

## File statistics

| Item | Value |
|------|-------|
| Total lines | 637 |
| Subroutines | 13 |
| Global data section (lines 215–236) | 22 lines |
| Largest subroutine | `main` — 158 lines |
| Second largest | `printBoard` — 76 lines |

---

## Findings

### :simplicity — `main` is 158 lines (far above ≤60 target)

`main` (lines 374–531) does: snake initialisation, the game loop (render + input + direction
update + movement + collision + fruit + sleep), and the game-over screen. These are four
distinct responsibilities.

Recommended extraction (each ≤60m puzzle):
- `initSnake` — lines 378–388: set `snake=0`, append starting segment
- `updateDirection` — lines 403–429: wasd chain → `direction` store
- `moveSnake` — lines 431–516: compute new head, wrap, collision, append, fruit, tail trim
- `gameOverScreen` — lines 518–531: print messages, wait for key

After extraction `main` would be ~40 lines: init → loop (resetc → print → score → input →
updateDir → moveSnake → sleep) → gameOver.

### :simplicity — `printBoard` mixes iteration with collision detection

`printBoard` (lines 294–369) loops 10×10=100 cells and calls `checkCollision` for each.
`checkCollision` traverses the full snake list, so per-frame rendering is
O(board² × snake_length). For a 10×10 board with a 50-segment snake: 5 000 node traversals
per frame. Tolerable today but worth noting.

A cheap fix: walk the snake list once before the loop and build a flat row[] / col[] array,
then check membership in O(1) per cell. Deferred — low priority for a ≤10×10 game.

### :correctness — no opposite-direction guard (instant-death bug)

The direction-update chain (lines 403–429) does not prevent reversing. If the snake is
moving right (direction=2) and the player presses `a` (direction=0), the new head steps
into the cell the old head just vacated, which is still in the snake list. `checkCollision`
finds it and triggers game over immediately.

Fix: before writing to `direction`, compare the candidate with the current direction and
reject if `new_dir == (current_dir + 2) % 4`. Belongs in its own puzzle since it requires
knowing the direction encoding.

### :readability — `@noKey` is a dead fall-through

Lines 459–462:
```
@noKey:
    br @wrapped
@wrapped:
```
`@noKey` is used only as the `brne` target when direction=0 is *not* matched, but that
branch would fall through to `@wrapped` anyway. The explicit `br @wrapped` is dead.

### :readability — wrong register name in `removeSnakeTail` comment

Line 153:
```
ldr r1, r1, 2   ; r2 = oldHead->next
```
The destination is `r1`, not `r2`. The comment was not updated when the register was changed.

### :readability — historical `DONE:` block and dead dev-mode lines

Lines 24–32: five `DONE:` markers document completed work. That information is in Git
history, not needed in the source.

Lines 361–363:
```
; Uncomment these two lines for step-by-step dev mode
; r
; bp
```
Commented-out instructions are dead code. Either remove them or wire them to a `devMode`
global so they can be activated without editing the source.

### :readability — `getSnakeHeadXY` local labels are not indented

The local labels `@loopGL:`, `@doneGL:`, `@empty:` (lines 568, 577, 583) are at column 0,
unlike every other subroutine's local labels which are indented 4–12 spaces. Minor but
inconsistent.

### :maintainability — `wrapCoord` double-loads `boardSize`

Lines 605–610:
```
ld  r1, @boardSizePtr
ldr r0, r1, 0
add r2, r2, r0
rem r2, r0
ld  r1, @boardSizePtr   ; ← r0 not clobbered; this is dead
ldr r0, r1, 0           ; ← dead
add r3, r3, r0
rem r3, r0
```
`r0` holds `boardSize` after the first `ldr`. The second `ld`/`ldr` pair can be deleted.

### :maintainability — `printScore` uses indirect pointer for `snakeLen`

Lines 543–545:
```
ld  r1, @snakeLenPtr
ldr r0, r1, 0
dout r0
```
`ld r0, snakeLen` is equivalent and one instruction shorter. The rest of the file uses
direct `ld` for globals (e.g., `ld r0, fruitRow` at line 274). Inconsistent.

### :maintainability — dead frame-pointer setup in no-arg subroutines

`placeFruitRandom` (lines 241–261) and `printScore` (lines 536–552) each do
`push fp / mov fp, sp` but take no arguments and allocate no locals. Neither accesses `fp`
after setup. The `mov sp, fp` epilog is also a no-op (sp was never moved below fp).

### Memory leak (known, tracked in #144)

`removeSnakeTail` leaves freed nodes unreachable. The comment at lines 156–163 correctly
documents this. The memory-leak question is open in #144 and feeds the free-implementation
spike at `docs/research/560-free-implementation-in-lcc-assembly.md`.

---

## Feature backlog re-evaluation (#143 items)

| Feature | Verdict | Notes |
|---------|---------|-------|
| Opposite-direction guard | **Re-surface as bug fix** | Not a feature — it's a correctness defect. File now. |
| Pause | Worth doing | Adds `paused` global + toggle in game loop. Natural after `main` refactor. |
| Win condition | Worth doing | `snakeLen >= boardSize²` check on each fruit eat. ~20m. |
| Vim HJKL controls | Worth doing | Trivial once `updateDirection` is extracted (~15m extension). |
| Variable board size | Defer | Requires replacing all hardcoded `10` constants. Do after main refactor. |
| Replay | Defer | Requires `initSnake` extraction first (see main refactor). |
| High-score | Defer | In-session only (no file I/O in LCC+). Fine after refactor; not urgent. |

---

## Follow-up puzzles filed

Five new issues were filed as a result of this assessment. @todo markers are planted at
the relevant code sites in this commit.

| Issue | Title | H-estimate |
|-------|-------|-----------|
| #581 | Fix opposite-direction guard | 30m |
| #582 | Extract `updateDirection` + `gameOverScreen` from `main` | 60m |
| #583 | Extract `moveSnake` logic from `main` | 60m |
| #584 | Dead-code + comment hygiene (7 items) | 40m |
| #585 | Direct-access + frame-setup micro-cleanups (3 items) | 20m |
