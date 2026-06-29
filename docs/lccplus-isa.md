# LCC+ Instruction Set Addendum

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
| beep   | 0x00F8 | none | Emits ASCII BEL (`\x07`) to stdout |
| ding   | 0x00F7 | none | Emits ASCII BEL (`\x07`) to stdout (alias of `beep`; may diverge in a future release) |
| boop   | 0x00F6 | none | Writes a fixed message (default `"Boop!\n"`) to stdout — a logging/testing trap, distinct from the `bop` sound alias. Override the text with the `LCCPLUS_BOOP_MESSAGE` env var (a trailing newline is appended; empty/unset → default) |
| who    | 0x00F5 | none | Reads `name.nnn` from cwd and writes contents to stdout (no trailing newline); silent empty string if absent |
| whodis | 0x00F5 | none | Alias for `who`; identical encoding and behavior |

**Note on `bp`:** Trap vector `0x000E` is supported as in LCC, but enhanced in LCC+ to
allow "press any key to resume" functionality.

> **These are the complete set of LCC+ trap additions (12 mnemonics across 11 distinct vectors; `ding`/`whodis` are aliases).** The occupied range is `0xF5`–`0xFF`. There is no `fprintf`, `printf`, `sprintf`, `scanf`, `puts`, or any other C-library-style trap. Any trap mnemonic not listed above or in [lcc-isa.md](./lcc-isa.md) does not exist.

---

## Sounds

The LCC+ `sound` trap plays one of 7 sound effects. The trap's source
register selects a **sound code** (0–6); the interpreter resolves each code
to an audio file and plays it through the first available player
(`paplay`, `canberra-gtk-play`, `ffplay`, `aplay`). If no file can be found
or played, it falls back to ASCII BEL (`\x07`).

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
