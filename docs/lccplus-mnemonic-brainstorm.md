# LCC+ Mnemonic Brainstorm — New Fun & Educational Pseudo-Instructions

_Design document produced for issue #482. Feeds future DEV puzzles. No code changes._

---

## Encoding context (from #481 research)

Before the shortlist, two encoding spaces are available for new LCC+ mnemonics:

**TRAP vectors** (opcode 0xF, low 8 bits = vector):

| Range | Status |
|-------|--------|
| 0x00–0x0E | Core (assigned) |
| 0x0F–0x15 | LCC+ (assigned: clear→resetc) |
| 0x16 | Earmarked for `etc` (#477) |
| **0x17–0xFF** | **Free** |

**OP_EXT eopcodes** (opcode 0xA, bits 4–0 = eopcode, 5-bit field → 0–31):

| Range | Status |
|-------|--------|
| 0–13 | Core (PUSH…SEXT) |
| 14 | `rand` (LCC+) |
| **15–31** | **Free** |

> **Disassembler gap:** `mnemonicForMachineWord` extracts the eopcode with `& 0x000F`
> (4-bit mask), not `& 0x001F`. Eopcodes ≥16 will disassemble incorrectly. Any DEV
> ticket that adds an eopcode ≥16 should also widen the disassembler mask.

---

## Shortlist — 5 recommended mnemonics

### 1. `color sr` — ANSI terminal foreground color

**Trap vector:** 0x17  
**Operand shape:** `color sr` — sr holds a color code 0–15 (0 = reset/default)  
**Educational angle:** terminal I/O protocols, ANSI escape sequence format, the concept
of a stateful output device (color persists across writes until reset).  
**Demo program:** print a rainbow banner — loop over colors 1–7, print a word in each.  
**Implementation:** `process.stdout.write(`\x1B[${30 + (r[sr] & 7)}m`)` for standard
colors; bright variants at 90+. Color 0 → `\x1B[0m` (reset). The interpreter should
reset to default on HALT (trap 0) to avoid leaking color into the shell prompt.  
**Node.js concern:** ANSI codes work on all Unix terminals. VS Code's integrated
terminal and Windows Terminal support them. `cmd.exe` does not, but lccjs targets
Linux/Mac students — acceptable.

---

### 2. `gotoxy sr` — absolute cursor positioning

**Trap vector:** 0x18  
**Operand shape:** `gotoxy sr` — sr[15:8] = row (1-indexed), sr[7:0] = col (1-indexed)  
**Educational angle:** bit packing (encoding two values into one 16-bit word), ANSI
cursor addressing, 2D screen-buffer mental model. Directly analogous to how hardware
video memory is addressed by row×width + col.  
**Demo program:** draw a centered title in the middle of the terminal; or a
bouncing-character animation when combined with `sleep`, `clear`, and `millis`.  
**Implementation:** `process.stdout.write(`\x1B[${(r[sr]>>8)&0xFF};${r[sr]&0xFF}H`)`.
Row and col are 1-indexed per ANSI spec — document this clearly so students know why
row=0 behaves oddly.  
**Node.js concern:** requires no raw-mode or TTY setup. Works cleanly alongside
existing `clear` (0x0F) and `resetc` (0x15).

---

### 3. `beep` — terminal bell

**Trap vector:** 0x19  
**Operand shape:** none (like `halt`, `nl`)  
**Educational angle:** interrupt-driven I/O, hardware signal output, the historical
Bell character (ASCII 0x07) and why it exists. A one-character demo of "output does
not have to be visual".  
**Demo program:** countdown timer — print the count with `dout`, `sleep` 1000 ms, repeat;
`beep` when it hits zero.  
**Implementation:** `process.stdout.write('\x07')` — simplest possible trap handler.  
**Node.js concern:** terminal BEL is suppressed by some emulators (GNOME Terminal
has "Visual Bell" option; VS Code integrated terminal ignores it by default). Students
should be warned. Not a correctness issue — the output is still produced; it may just
be silent.

---

### 4. `popcnt dr, sr` — population count (count set bits)

**Encoding:** OP_EXT eopcode 15, machine word `0xA000 | (dr<<9) | (sr<<6) | 0x000F`  
**Operand shape:** `popcnt dr, sr` — dr = number of 1-bits in 16-bit value of sr  
**Educational angle:** bit manipulation, Hamming weight, the real `POPCNT` instruction
in x86/ARM ISAs (teaches that "one instruction" can encode non-trivial computation).
Pairs with `XOR`, `AND`, `SRL` exercises.  
**Demo program:** given a bitmask of feature flags, print how many features are on.
Or: implement a crude parity check using `popcnt` + `AND r0, r0, #1`.  
**Implementation:**
```js
// r[dr] = popcount of r[sr] (16-bit)
let v = this.r[this.sr] & 0xFFFF;
let count = 0;
while (v) { count += v & 1; v >>>= 1; }
this.r[this.dr] = count;
```
**Note:** encoded identically to `rand` (two-register OP_EXT), so `assembleRAND`'s
shape is the template — see `assemblerplus.js:105`.

---

### 5. `slen dr, sr` — string length

**Encoding:** OP_EXT eopcode 16, machine word `0xA000 | (dr<<9) | (sr<<6) | 0x0010`  
**Operand shape:** `slen dr, sr` — sr holds start address; dr receives byte count up
to (but not including) the null terminator  
**Educational angle:** null-terminated string convention, pointer/address arithmetic,
the O(n) cost of strlen (compare to Pascal-length-prefixed strings), buffer overrun
risk.  
**Demo program:** read a string with `sin`, compute its length with `slen`, print
with `dout` — shows the full null-terminated string lifecycle in one short program.  
**Implementation:** walk `this.memory` from `r[sr]` until `mem[addr] === 0`; cap at
0xFFFF to prevent infinite loop on unterminated strings (raise a runtime error or
return 0xFFFF as a sentinel — document which).  
**Disassembler note:** eopcode 16 = 0x10, which exceeds the current 4-bit mask in
`mnemonicForMachineWord` (`& 0x000F`). This must be widened to `& 0x001F` before
`slen` disassembles correctly — file as a linked sub-task.

---

## Rejected candidates

| Candidate | Reason for rejection |
|-----------|---------------------|
| `mcopy dst, src, len` | Needs 3 operands — no encoding path in current trap or EXT format without a new convention |
| `isqrt dr, sr` | `Math.sqrt()` is one line in a helper; concept already covered by multiply-and-compare exercises; lower educational ROI vs `popcnt` |
| `seconds dr`, `minutes dr`, `hour dr` | `millis` already teaches real-time I/O; three separate mnemonics for one concept is ISA bloat; a `timeunit dr, selector` variant is possible if real demand emerges |
| `assert sr` | Overlaps with `bp` (breakpoint); useful but better as a user-space macro or future DEV puzzle once `bp` documentation is solid |
| `bold` / `reset` as standalone traps | Subsumed by `color 0` (ANSI reset = code 0); adding a `style` trap that encodes bold/dim/underline in sr is possible but non-obvious operand semantics; defer until `color` is shipped and demand is measured |
| `gotow sr` / `setpos` (two-mnemonic variant) | Redundant with `gotoxy`; naming debate is a distraction |

---

## Priority order and suggested trap/eopcode assignments

| Priority | Mnemonic | Encoding | Vector / Eopcode |
|----------|----------|----------|-----------------|
| 1 | `color sr` | TRAP | 0x17 |
| 2 | `gotoxy sr` | TRAP | 0x18 |
| 3 | `beep` | TRAP | 0x19 (no operand) |
| 4 | `popcnt dr, sr` | OP_EXT | eopcode 15 |
| 5 | `slen dr, sr` | OP_EXT | eopcode 16 |

`color` and `gotoxy` together unlock the full "text-mode game" demo class and are the
highest-leverage pair. `beep` is the cheapest to implement. `popcnt` and `slen` are the
strongest _systems concepts_ mnemonics.

---

## Cross-references

- `src/plus/assemblerplus.js` — instruction registration pattern (see `TRAP_CLEAR` through `TRAP_RESETC`; `assembleRAND` for OP_EXT shape)
- `src/plus/interpreterplus.js` — trap handler pattern (`executeTRAP` switch; `executeCase10` for OP_EXT)
- `docs/lccplus-isa.md` — ISA reference to update when DEV tickets ship
- Issue #477 — `etc` implementation (claims trap 0x16)
- Issue #481 — opcode layout map (prerequisite research)
