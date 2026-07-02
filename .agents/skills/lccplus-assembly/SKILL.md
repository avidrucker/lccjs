---
name: lccplus-assembly
description: Write idiomatic, correct LCC+ assembly (`.ap` files) for the lccplus toolchain — extended ISA with `.lccplus` directive, `rand`/`srand`/`millis`/`nbain`/`clear`/`resetc`/`sleep`/`cursor` extras, and the `lccplus.js` entry point. Use when the user asks to write, modify, debug, or explain LCC+ `.ap` programs. The four base pitfalls (register reservation, pcoffset9, immediate widths, branch suffixes) still apply — read the base `lccjs-assembly` skill for those.
version: 0.1.0
last_reviewed: 2026-06-01
---

# LCC+ Assembly (lccplus-assembly)

A skill for writing **idiomatic, correct** LCC+ assembly — not just syntactically valid. LCC+ extends the base LCC ISA with interactive-capable traps and a pseudo-random machine instruction. All four base pitfalls from `lccjs-assembly` still apply; this skill adds the LCC+-specific ones on top.

## Triggers

- User asks to write, modify, debug, or explain an LCC+ `.ap` program
- User mentions `.lccplus` directive, or LCC+-specific mnemonics (`rand`, `srand`, `millis`, `nbain`, `clear`, `resetc`, `sleep`, `cursor`)
- User mentions `plusdemos/`, `src/plus/`, or specific demos by name (`tictactoe.ap`, `gameSnake.ap`, `gameflappyBird.ap`, `rock-paper-scissors.ap`, `charPolling.ap`, etc.)
- User asks about the `lccplus.js` entry point or `.ep` executables

## Scope boundary

**This skill covers LCC+ only.** Base LCC (`.a` files, `lcc.js` entry point, linker, multi-module programs) is covered by the `lccjs-assembly` skill. When the user is working with `.a` files or needs linking, use that skill instead.

LCC+ has **no linker** — every `.ap` program must be self-contained in a single file. Multi-module LCC+ is not implemented.

## Base pitfalls still apply

The four non-negotiable pitfalls from `lccjs-assembly` apply unchanged to `.ap` programs:

1. `r5`/`r6`/`r7` are reserved (fp/sp/lr) — scratch is `r0`–`r4` only
2. `lea`/`ld` reach ±256 words via pcoffset9 — use a pointer alias for distant labels
3. Immediate widths differ per instruction (`mov` = 9-bit, `cmp`/`add` = 5-bit, `ldr`/`str` offset = 6-bit)
4. Branch suffixes encode flags, not English — `brp` is strictly positive (not zero-or-more)

Read those pitfall entries in `lccjs-assembly` before writing any `.ap` code. They are not repeated here.

## LCC+-specific non-negotiable pitfalls

These four catch the most common LCC+-only bugs.

### P1. `.lccplus` directive is required — and must come before any instruction

- **Symptom:** Assembler error on `rand`, `sleep`, `nbain`, etc. (`Invalid operation`), or the assembler succeeds but the `.ep` output header is wrong (`'o'` instead of `'op'`), causing `InterpreterPlus` to reject or misrun the file.
- **Why:** `AssemblerPlus` sets `isLCCPlusFile = true` only when it encounters `.lccplus` during Pass 1. Without it, the extra mnemonics are still registered in the instruction table (so `rand` etc. may assemble), but the output file will have the base LCC header signature `'o'` rather than `'op'`. `InterpreterPlus` checks this signature and will behave incorrectly on a mis-signed file. The directive also prevents the file from being accidentally assembled with the base `lcc.js` entry point.
- **Correct pattern:** Put `.lccplus` as the very first non-comment line of every `.ap` file:
  ```
       .lccplus
       mov r0, 0
       ...
  ```

### P2. `rand dr, sr` clobbers `dr` — load min/max into registers first, and don't re-use `dr` as a loop counter

- **Symptom:** The minimum bound disappears after the first `rand` call; the range drifts on subsequent calls; or a counter register holding the loop bound gets overwritten.
- **Why:** `rand r0, r1` generates a number in the **inclusive range [r0_value, r1_value]** and stores the result **back into `r0`** (the `dr` register). So `r0` holds the min before the call and the result after — the original min is gone. If you use `r0` as a loop counter or re-need the min, it will be clobbered.
- **Correct pattern:** Load min and max from memory-backed `.word` constants each time, or use registers you don't re-use for anything else across the call:
  ```
  loop: mov r0, 1      ; min (must reload each iteration — rand overwrites r0)
        mov r1, 20     ; max
        rand r0, r1    ; r0 now holds random number in [1, 20]
        dout r0
        nl
        ...
  ```
  The canonical `randDeterministic.ap` and `randNondeterministic.ap` demos in `plusdemos/` show this reload pattern.

### P3. `nbain` returns 0 when no key — always poll in a loop with an explicit zero check

- **Symptom:** A game loop reads the "first key available" even when no key has been pressed; or the loop exits immediately on the first frame; or a character with ASCII value 0 is incorrectly treated as "key pressed".
- **Why:** `nbain r0` is **non-blocking**: it returns immediately with the ASCII code of the pending key, or `0` if no key is available. There is no blocking variant for LCC+ interactive programs — `sin`/`ain` block indefinitely and make the game loop unresponsive. Zero is the sentinel for "no input", not a valid character.
- **Correct pattern:** Use the three-instruction polling idiom — check for zero, loop back:
  ```
  poll: nbain r0
        cmp r0, 0
        brz poll       ; keep polling until a key arrives
        ; r0 now holds the ASCII code of the key pressed
  ```
  For a game loop where you want to act on input *if available* but continue the frame either way, check without looping:
  ```
  nbain r0             ; get key or 0
  cmp r0, 0
  brz no_input         ; skip input handling if nothing pressed
  ; handle r0 ...
  no_input:
  ```

### P4. LCC+ traps take **register operands, not immediates** — load values into registers before calling

- **Symptom:** Assembler error on `sleep 1000`, `cursor 0`, `millis 500`; or assembler accepts an operand but the runtime sees garbage because the value was not in the expected register.
- **Why:** All LCC+ traps use the standard `sr`/`dr` calling convention — the operand is a register name, not a literal. `sleep r0` pauses for `r0` milliseconds; `cursor r0` shows/hides based on `r0`; `millis r0` stores the current ms into `r0`. There is no trap form that takes an immediate.
- **Correct pattern:**
  ```
  ; WRONG:
  sleep 500          ; syntax error or assembles to junk
  cursor 0           ; syntax error

  ; RIGHT:
  mov r0, 500
  sleep r0           ; pause 500 ms
  mov r0, 0
  cursor r0          ; hide cursor (0 = hide, nonzero = show)
  millis r0          ; r0 ← current system ms (0–999)
  srand r0           ; seed RNG with current time — produces non-deterministic rand
  ```

## Closed sets — don't invent extensions

The LCC+ trap and instruction set is a **closed list**. All valid mnemonics are enumerated below. If you reach for something not on this list, stop and surface the gap — don't invent trap vectors or new directives.

### Base traps (inherited, still valid in `.ap`)

| Mnemonic | Direction | Format | Notes |
|---|---|---|---|
| `sin`  | read  | string  | NUL-terminated; reads into buffer at `sr` (blocks — avoid in game loops) |
| `sout` | write | string  | NUL-terminated; prints string at `sr` |
| `din`  | read  | decimal | signed decimal → `dr` (blocks) |
| `dout` | write | decimal | signed decimal from `sr` |
| `udout`| write | decimal | unsigned decimal from `sr` |
| `hin`  | read  | hex     | hex integer → `dr` (blocks) |
| `hout` | write | hex     | hex integer from `sr` |
| `ain`  | read  | char    | ASCII char → `dr` (blocks) |
| `aout` | write | char    | ASCII char from `sr` |
| `nl`   | write | char    | literal `\n` — use this, not `"\n"` + `sout` |
| `halt` | —     | —       | stop execution |
| `m`    | —     | —       | dump memory (debug) |
| `r`    | —     | —       | dump registers (debug) |
| `s`    | —     | —       | dump stack (debug) |
| `bp`   | —     | —       | breakpoint (LCC+ enhanced: "press any key to resume") |

**Operand defaults:** omitting `sr`/`dr` defaults to `r0`. Be explicit when the value isn't in `r0`.

### LCC+ additions

**New machine instruction:**

| Mnemonic | Operands | Description |
|---|---|---|
| `rand` | `dr, sr` | Pseudo-random number in `[dr_val, sr_val]` → `dr`; clobbers `dr` (see P2 above) |

**New traps (vectors 0x000F–0x0015):**

| Mnemonic | Vector | Operand | Description |
|---|---|---|---|
| `clear`  | 0x000F | —    | Clear terminal screen |
| `sleep`  | 0x0010 | `sr` | Pause `sr` milliseconds |
| `nbain`  | 0x0011 | `dr` | Non-blocking ASCII input → `dr`; returns 0 if no key |
| `cursor` | 0x0012 | `dr` | Show/hide cursor: 0 = hide, nonzero = show |
| `srand`  | 0x0013 | `sr` | Seed RNG with `sr` |
| `millis` | 0x0014 | `dr` | System time milliseconds (0–999) → `dr` |
| `resetc` | 0x0015 | —    | Reset cursor position to top-left |

**Directive:**

| Directive | Required | Description |
|---|---|---|
| `.lccplus` | **Yes** | Marks file as LCC+; sets `'op'` output header. Must appear before any instruction (see P1). |

## Non-deterministic RNG pattern

To seed with real entropy, use `millis` before `srand`:

```
millis r0     ; r0 ← current ms (0-999)
srand r0      ; seed RNG
```

For a deterministic sequence (same output every run), seed with a constant: `mov r0, 0` + `srand r0`.

## Game-loop frame structure

Interactive LCC+ programs almost always follow this shape:

```
     .lccplus
     mov r0, 0
     cursor r0           ; hide cursor (cosmetic)
     clear               ; clear screen before first frame
frame:
     ; 1. poll input (non-blocking)
     nbain r1
     ; 2. update state based on r1 (0 = no key)
     ; 3. redraw
     resetc              ; move cursor to top-left without clearing (flicker-free)
     ; ... render ...
     mov r0, 16
     sleep r0            ; ~60fps cap
     br frame
```

`resetc` (cursor-to-top-left without erase) is faster than `clear` for full-screen redraw — use `clear` only on init or state transitions. See `gameSnake.ap` and `gameflappyBird.ap` for production examples of this pattern.

## Canonical examples (read, don't copy)

| Demo | Teaches |
|---|---|
| `plusdemos/charCycling.ap` | `cursor`, `clear`, `sleep` basics |
| `plusdemos/charPolling.ap` | `nbain` polling loop idiom |
| `plusdemos/randDeterministic.ap` | `srand` + `rand` with constant seed |
| `plusdemos/randNondeterministic.ap` | `millis` → `srand` → `rand` (real entropy) |
| `plusdemos/tictactoe.ap` | interactive game, full `nbain`/`cursor` usage |
| `plusdemos/gameSnake.ap` | full game loop: `resetc` frame redraw, `nbain` input, `sleep` timing |
| `plusdemos/rock-paper-scissors.ap` | blocking-input menu (simpler, non-game-loop) |

## Entry point and file conventions

| Aspect | Value |
|---|---|
| Source extension | `.ap` |
| Compiled output | `.ep` |
| Entry point | `node src/plus/lccplus.js <file>.ap` |
| Run `.ep` directly | `node src/plus/lccplus.js <file>.ep` |

**Do not use `src/cli/lcc.js` for `.ap` files** — it will reject the extension.

## Verification loop

Always route through `scripts/lccrun.sh` — bare invocations can block indefinitely:

```bash
scripts/lccrun.sh node src/plus/lccplus.js <file>.ap
```

Successful assembly produces a `.ep` file and immediately runs it. If assembly fails, the assembler names the instruction and encoding constraint — re-read the relevant pitfall before guessing at a fix.

## Source materials (when you need to go deeper)

- `docs/lccplus-isa.md` — full LCC+ addendum (new instructions, traps, directives, file conventions)
- `docs/lcc-isa.md` — base ISA reference (still applies in full to `.ap`)
- `src/plus/assemblerplus.js` — trap vector constants and instruction registration
- `src/plus/interpreterplus.js` — runtime semantics of LCC+ traps
- `plusdemos/plusdemos.md` — index of all canonical LCC+ demos
