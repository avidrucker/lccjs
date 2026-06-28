# ADR 1502 — Sound mnemonics in core LCC (`--sounds-on`)

- **Status:** Accepted (spike output for #1502; umbrella #1501)
- **Date:** 2026-06-28
- **Deliverable of:** #1502 (SPIKE/RESEARCH). No production code in this ticket.
- **Decides:** how LCC+ sound mnemonics run in **core** LCC behind a `--sounds-on` flag.

## Context

Sound mnemonics (`ding`, `doink`, `beep`, `ping`, `popsound`, `softbeep`, `bop`) exist only in LCC+ (`src/plus/interpreterplus.js`). Core LCC (`src/core/interpreter.js`) is a synchronous fetch-decode-execute loop (`run()` at `interpreter.js:693`, `while (this.running) { this.step() }` at `:709`) with no sound support. The parent (#1501) flagged this as "architecture-sensitive" and asked five questions before any code. This ADR answers them from the code and picks one architecture.

## The key finding (answers the parent's central worry)

**Sound playback is already synchronous.** `playSoundFile()` (`interpreterplus.js:119`) is `spawnSync(player, args, { stdio: 'ignore', timeout: 5000 })` — it blocks until the external player exits. LCC+'s cooperative async batch loop exists for **non-blocking input** (`this.nonBlockingInput`, stdin polling — `interpreterplus.js:178,293`), **not** for sound. So **enabling sound in core LCC does NOT require the async loop**: an `executeSound()` call drops straight into core's existing synchronous `step()` as an ordinary blocking trap.

## Q&A

### Q1 — Trap integration
Core decodes opcode 15 → `executeTRAP()` (`interpreter.js:832-833`), which dispatches on `trapvec = ir & 0xFF` (`interpreter.js:748`). `TRAP_SOUND = 0x00F8` is defined in `src/plus/constants.js:12`; core's `executeTRAP` has **no** `0xF8` case. **Integration:** add a `case TRAP_SOUND` to core `executeTRAP`, **gated on a `this.soundsOn` flag**, delegating to the shared SoundEngine (Q4). With the flag off, `0xF8` falls through to the existing unknown-trap default — i.e. **identical to today**. Move `TRAP_SOUND` / `TRAP_SOUND_LITERAL_FLAG` to a neutral constants location so core never imports from `src/plus`.

### Q2 — Sync vs async
**Synchronous; no async loop.** See "key finding." `executeSound` is a blocking `spawnSync` and fits core's sync loop directly. Rejecting the async path removes the single biggest complexity the parent feared.

### Q3 — Determinism / oracle-parity
- Successful playback writes **zero** bytes to stdout (`spawnSync` `stdio:'ignore'`) → cannot perturb golden snapshots, `.lst`/`.bst`, or oracle output.
- The **only** stdout perturbation is the **BEL `\x07` fallback** (`interpreterplus.js:648,658`).
- **Verdict:** keep sound entirely behind the flag. With `--sounds-on` **off**, core never handles `0xF8` → byte-identical to today. With it **on** but no player, BEL adds `\x07` — intended, but it means sound-on output is **not** compared against oracle goldens (the oracle has no `--sounds-on`). Tests run flag-off for parity; flag-on is exercised separately. The 5s×N-player blocking timeout is a runtime concern → another reason tests default flag-off.

### Q4 — Module shape
**A shared `SoundEngine` module** (proposed `src/core/soundEngine.js`) holding the currently module-level primitives from `interpreterplus.js`: the slot table (`SOUND_SLOTS`), `SOUND_PLAYERS` (`:79`), `playSoundFile` (`:119`), `firstExistingSoundPath` (`:111`) + env/dotenv resolution, exposed as one `playSlot(slotIndex) -> { played: boolean }` that encapsulates the BEL-vs-play decision. **Both** `interpreter.js` (gated on `soundsOn`) and `interpreterplus.js` (always) consume it. This satisfies "no copy-paste, no monkey-patch, clean separation": `interpreterplus`'s `executeSound` becomes a thin call into `SoundEngine`, and core gets the same call.

### Q5 — Fallback
Confirmed. `executeSound` (`interpreterplus.js:644`) emits BEL `\x07` when the slot index is invalid **or** `playSoundFile` returns false. `playSoundFile` probes `paplay → canberra-gtk-play → ffplay → aplay`, treating `ENOENT` (not installed) as "try next" and returning false if all fail → "no player on PATH" yields BEL. Core reuses this exact path via `SoundEngine`.

## Decision

Shared `SoundEngine` (Q4) + a **flag-gated `case TRAP_SOUND` in core `executeTRAP`** (Q1) + **synchronous `spawnSync`, no async loop** (Q2) + **flag-off ⇒ byte-identical default** (Q3) + the **existing BEL fallback** (Q5).

### Rejected alternatives
- **Copy interpreterplus's sound code into core** — violates "no copy-paste"; two slot tables drift.
- **Import the async batch loop into core** — unnecessary (sound is sync); large complexity for zero benefit.
- **Monkey-patch core `executeTRAP` from a plus module** — violates "no monkey-patch."
- **A `--sounds-on` interpreter subclass** (à la `interpreterplus`) — over-engineered for a single trap; the gated case is minimal.

## Decomposition (DEV children of #1501 — to file next)

1. **DEV-A — extract `SoundEngine`** from `interpreterplus.js` (behavior-preserving refactor; `interpreterplus` delegates to it; LCC+ sound tests stay green; move `TRAP_SOUND` constants to a neutral location). ~45m.
2. **DEV-B (blocked-by DEV-A) — add `--sounds-on`**: arg in `src/cli/lcc.js`, a `soundsOn` flag on core `Interpreter`, and the gated `case TRAP_SOUND` in core `executeTRAP` delegating to `SoundEngine`. Off by default; BEL fallback; tests assert (a) flag-off output unchanged, (b) flag-on resolves the 7-slot table. ~45m. Split arg-plumbing from the trap-case if it exceeds 60m.

## Consequences

- Net new core dependency surface is tiny: one gated trap case + an import of `SoundEngine`. Core stays sync.
- LCC+ behavior is unchanged (it routes through the same extracted engine).
- Default core behavior (no flag) is provably byte-identical — no oracle-parity risk.
