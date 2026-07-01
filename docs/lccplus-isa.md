# LCC+ Instruction Set Addendum

_Audience: students/learners, assembly enthusiasts, educators/teachers · Tier: reference, public_

This document summarizes the **additions and differences** between the original
LCC instruction set and the **LCC+** extension (see `src/plus/` and `plusdemos/`).

> **Base LCC instruction set** (standard instructions, traps, directives, branch codes)
> is documented in [lcc-isa.md](./lcc-isa.md).

---

## New Machine Instructions

| Mnemonic | Binary Format | Flags Set | Description |
| --- | --- | --- | --- |
| rand | 1010 dr sr1 0 01110 | none | Generate pseudo-random number in range [`dr`, `sr1`] and store in `dr` |

**Notes on `rand`:**

- Generates a number in an inclusive range between the values in `dr` and `sr1`.
- Uses a pseudo-random number generator based on a seeded Linear Congruential Generator (LCG) + XOR shift.
- Seed the RNG with `srand` (see trap instructions below).

> **`rand` is the only new machine instruction added by LCC+.** No other new opcodes exist. All other mnemonics are inherited unchanged from base LCC.

---

## New Trap Instructions

LCC+ extension trap vectors occupy the **high end** of the 8-bit trap space (`0xF7`–`0xFF`) so
core traps can grow upward from `0x0E` without collision.

| Mnemonic | Trap Vector | Flags Set | Description |
| --- | --- | --- | --- |
| clear  | 0x00F9 | none | Clears the terminal screen |
| sleep  | 0x00FA | none | Pauses execution for `r[dr]` milliseconds |
| nbain  | 0x00FB | none | Non-blocking ASCII input (returns ASCII code in `dr`, or 0 if no input available) |
| cursor | 0x00FC | none | Shows or hides cursor based on value in `dr` (0 = hide, else = show) |
| srand  | 0x00FD | none | Seeds RNG using value in `sr` |
| millis | 0x00FE | none | Puts current system time milliseconds (0–999) into `dr` |
| resetc | 0x00FF | none | Resets cursor position to top-left of screen |
| sound  | 0x00F8 | none | Plays a sound slot (0–6). Takes one operand in either the immediate form `sound NUM` (fixed slot, baked in at assemble time) or the register form `sound rN` (slot = runtime value of `rN`) — see [§ Sounds](#sounds). Falls back to ASCII BEL (`\x07`) when no audio file/player is available. The no-operand sound-slot aliases (`ding`, `doink`, `beep`, `ping`, `popsound`, `softbeep`, `bop`) encode to this trap |
| boop   | 0x00F6 | none | Writes a fixed message (default `"Boop!\n"`) to stdout — a logging/testing trap, distinct from the `bop` sound alias. Override the text with the `LCCPLUS_BOOP_MESSAGE` env var (a trailing newline is appended; empty/unset → default) |
| who    | 0x00F5 | none | Reads `name.nnn` from cwd and writes contents to stdout (no trailing newline); silent empty string if absent |
| whodis | 0x00F5 | none | Alias for `who`; identical encoding and behavior |

**Note on `bp`:** Trap vector `0x000E` is supported as in LCC, but enhanced in LCC+ to
allow "press any key to resume" functionality.

> **These are the complete set of LCC+ trap additions (11 mnemonics across 10 distinct vectors; `whodis` aliases `who`).** The no-operand sound-slot mnemonics (`ding`, `doink`, `beep`, `ping`, `popsound`, `softbeep`, `bop`) are aliases that encode to the `sound` trap and are documented in [§ Sounds](#sounds). The occupied range is `0xF5`–`0xFF` (`0xF7` is currently unused). There is no `fprintf`, `printf`, `sprintf`, `scanf`, `puts`, or any other C-library-style trap. Any trap mnemonic not listed above or in [lcc-isa.md](./lcc-isa.md) does not exist.

### Register operands are caller-chosen

LCC+ mnemonics follow the base-ISA convention — `nbain` is the canonical model:
**every mnemonic that takes a register operand accepts whichever register the
caller names; none hard-codes a fixed register.** Choose a register your program
already has free. Omitting the operand defaults to `r0`.

```asm
sleep r1        ; sleep the millisecond count held in r1
sleep r5        ; the same instruction with r5 instead — equally valid
sleep           ; operand omitted → defaults to r0
```

The named register lands in the trap's operand field at assemble time, and the
interpreter reads/writes that same field at run time — so the choice is entirely
the caller's. Concretely:

| Mnemonic(s) | Register operand |
|-------------|------------------|
| `sleep`, `cursor`, `srand`, `nbain`, `millis` | one caller-chosen register (default `r0` if omitted) |
| `rand` | two caller-chosen registers (`rand dr, sr`) |
| `sound` | one caller-chosen register (`sound rN`) **or** an immediate slot (`sound NUM` / an alias) — see [§ Sounds](#sounds) |
| `clear`, `resetc` | none — screen/cursor operations that use no register |
| `ding`…`bop`, `who`, `whodis`, `boop` | none — fixed slot or fixed action, no operand |

The register form is dynamic (the value is read at run time); reserve fixed
immediates and aliases for values known when you write the code.

---

## Sounds

The LCC+ `sound` trap plays one of 7 sound effects (slots **0–6**). It resolves
the selected slot to an audio file and plays it through the first available
player (`paplay`, `canberra-gtk-play`, `ffplay`, `aplay`). If no file can be
found or played, it falls back to ASCII BEL (`\x07`).

### Operand forms: `sound NUM` (immediate) vs `sound rN` (register)

`sound` takes exactly one operand, and — just like the base ISA's
immediate/register operand pair (`add dr, sr1, imm5` vs `add dr, sr1, sr2`) —
that operand is either an **immediate** literal or a **register**:

| Form | Written as | Slot played | Use when |
|------|------------|-------------|----------|
| **Immediate** | `sound NUM` | the literal `NUM`, baked into the instruction at assemble time (range-checked 0–6) | the sound is fixed and known when you write the code |
| **Register** | `sound rN`  | the **runtime value** currently held in register `rN` | the sound is chosen dynamically while the program runs |

The two look alike but are *not* the same instruction. `sound 0` **always**
plays slot 0; `sound r0` plays whatever slot number `r0` happens to hold when
the trap executes. Under the hood the immediate form sets a literal-flag bit, so
the interpreter reads the slot straight from the instruction's `sr` field rather
than dereferencing the register — `slotIndex = literalFlag ? sr : reg[sr]`.

> **Prefer the aliases for fixed sounds.** For a sound you know at write time,
> the no-operand aliases (`ding`, `doink`, `beep`, `ping`, `popsound`,
> `softbeep`, `bop`) are the most readable, ambiguity-free form — `ding` says
> what it does where `sound 0` makes you consult the slot table. Reserve the
> register form `sound rN` for dynamic/game audio where the slot is computed at
> runtime, and reach for the bare literal `sound NUM` only when neither an alias
> nor a register fits.

### Default sound table

| Code | Mnemonic    | Default system path | Description |
|------|-------------|---------------------|-------------|
| 0    | ding        | `/usr/share/sounds/freedesktop/stereo/complete.oga` | Completion chime — bright two-note "done" |
| 1    | doink       | `/usr/share/sounds/freedesktop/stereo/bell.oga` | Bell hit — classic "boink/doink" |
| 2    | beep        | `/usr/share/sounds/freedesktop/stereo/phone-outgoing-calling.oga` | Phone outgoing call tone — electronic beep |
| 3    | ping        | `/usr/share/sounds/LinuxMint/stereo/system-ready.ogg` | System ready — short ascending "ping" |
| 4    | popsound    | `/usr/share/sounds/freedesktop/stereo/dialog-information.oga` | Notification pop — gentle chime |
| 5    | softbeep    | `/usr/share/sounds/freedesktop/stereo/dialog-warning.oga` | Soft alert — lower two-note warning |
| 6    | bop         | `/usr/share/sounds/freedesktop/stereo/message.oga` | Message arrival — playful "bop" |

### Order matters

Sound codes are positional — code N maps to SOUND_SLOTS[N] in the interpreter.
Do not reorder entries without updating every `.ap`/`.ep` that references sounds
by literal code (e.g. `sound 0` for ding, `sound 6` for bop).

### Bundled fallbacks

Each slot ships a bundled WAV in `assets/sounds/lccplus/` as a last-resort
fallback, so sounds work even with no system sound theme installed.

### Overriding sounds

#### Per-slot environment variables

Set any `LCCPLUS_SOUND_<NAME>` to an absolute path to override that slot's
audio file. The env var takes priority over both system defaults and bundled
WAVs.

```bash
# Play a custom .wav for the "ding" slot (code 0)
LCCPLUS_SOUND_DING=/home/avi/my-ding.wav node src/plus/lccplus.js mygame.ap
```

Available overrides:

| Slot       | Env var                   |
|------------|---------------------------|
| ding       | `LCCPLUS_SOUND_DING`      |
| doink      | `LCCPLUS_SOUND_DOINK`     |
| beep       | `LCCPLUS_SOUND_BEEP`      |
| ping       | `LCCPLUS_SOUND_PING`      |
| popsound   | `LCCPLUS_SOUND_POPSOUND`  |
| softbeep   | `LCCPLUS_SOUND_SOFTBEEP`  |
| bop        | `LCCPLUS_SOUND_BOP`       |

#### Use system sounds

By default the interpreter only plays bundled WAVs (no system dependency).
Set `SOUND_FILES_FROM_SYSTEM=1` to also try the `osDefaults` system paths
before falling back to the bundled WAV:

```bash
SOUND_FILES_FROM_SYSTEM=1 node src/plus/lccplus.js mygame.ap
```

Resolution order with `SOUND_FILES_FROM_SYSTEM=1`:
1. `LCCPLUS_SOUND_<NAME>` env var (if set)
2. Each path in the slot's `osDefaults` array (first existing wins)
3. Bundled WAV (`assets/sounds/lccplus/<name>.wav`)
4. ASCII BEL fallback (`\x07`)

Without `SOUND_FILES_FROM_SYSTEM=1`, only steps 1 → 3 → 4 apply.

---

## New Assembler Directives

| Directive | Description |
| --- | --- |
| `.lccplus` | Marks the file as an LCC+ file. Required for LCC+ assembly. Triggers special output header format (`'p'`). |

> **`.lccplus` is the only new assembler directive added by LCC+.** All base LCC directives (`.word`, `.string`, `.start`, `.global`, `.extern`, `.org`, etc.) remain valid in `.ap` files. There are no other LCC+-specific directives.

---

## File Conventions

| Aspect | Value |
| --- | --- |
| Source extension | `.ap` |
| Compiled output extension | `.ep` |
| `.ep` header signature | `'op'` (vs. `'o'` for standard LCC `.e` files) |
