# TIL 2026-06-29 — APPLE

**Context:** Drove the "LCC+ sound mnemonics in core LCC" feature end-to-end, starting from a ticket (#1501) that an `issue-review` flagged as NEEDS-WORK. The arc: promote #1501 to a tracker → spike the architecture into an ADR (#1502) → behavior-preserving refactor extracting a shared `SoundEngine` (#1503) → implement the `--sounds-on` flag (#1504) → close the umbrella. Plus a cross-repo orchestration pass.

---

## 1. A NEEDS-WORK ticket gets promoted to a tracker and decomposed — not rewritten

**What happened:** `issue-review-skill` scored #1501 (a bundled "research the architecture AND implement `--sounds-on`") as **NEEDS WORK** — research+dev in one unit, architecture undecided. Rather than rewrite it, I promoted it to an umbrella/tracker (`issue-needs-work` label, child checklist, original framing preserved in edit history) and filed the children: #1502 (RESEARCH/spike → ADR), #1503 (refactor), #1504 (the flag, blocked-by #1503).

**What I learned:** The review verdict is the *decomposition instruction*. A bundled "research-then-build" ticket isn't fixed by editing prose — it's split, with the design ticket gating the build ticket. The tracker keeps the goal + invariants; the children carry the actionable units.

**The rule:** **An issue-review of NEEDS-WORK on a bundled ticket means promote-and-decompose: tracker + `issue-needs-work` label + one child per deliverable, with `blocked-by` edges — not a body rewrite.**

## 2. Reading the code kills the ticket's architectural fear

**What happened:** #1501's central worry was "does enabling sound in core LCC require LCC+'s cooperative async batch loop?" The #1502 spike answered it by reading three files: `playSoundFile` is `spawnSync` (`interpreterplus.js:119`) — **synchronous**. The async loop exists for non-blocking *input* (`nonBlockingInput`/stdin polling), not sound. So core LCC needs **no** async machinery; `executeSound` drops straight into the sync `while(running){step()}` loop.

**What I learned:** The scariest-sounding architecture question often dissolves on contact with the code. The ADR's most valuable sentence was a *de-risking* finding from reading, not a design invention.

**The rule:** **Before designing around a feared constraint, read the code that supposedly imposes it — the fear is often already false.** (Same lesson as the #8 exit-1 non-bug: verify against the code, not the ticket's framing.)

## 3. A behavior-preserving refactor must preserve the TEST seams, not just the behavior

**What happened:** Extracting `SoundEngine` from `interpreterplus.js` (#1503), I first mapped what the unit test *couples to*: it stubs `ip.playSoundFile` (a `jest.fn()`) and **mutates `InterpreterPlus.SOUND_SLOTS`** expecting the mutation to take effect. So the refactor had to (a) keep `executeSound` calling `this.playSoundFile` (stubbable), and (b) re-export the **same `SOUND_SLOTS` array object** the engine owns (`InterpreterPlus.SOUND_SLOTS === soundEngine.SOUND_SLOTS`). I verified that identity explicitly.

**What I learned:** "Behavior-preserving" is necessary but not sufficient — a refactor can preserve runtime behavior and still break tests by moving a seam the test reaches through (an instance method it stubs, an array it mutates). Map the test's coupling *before* moving code.

**The rule:** **Before a refactor, grep the tests for every symbol they stub, spy, or mutate on the thing you're extracting — those are seams you must preserve by reference, not just by behavior.**

## 4. A gated feature's "off" path must fall through to byte-identical prior behavior

**What happened:** `--sounds-on` (#1504) adds `case TRAP_SOUND:` to core `executeTRAP`. With the flag off, `0xF8` must stay an unknown trap → "Trap vector out of range", exactly as before. I used switch fall-through: `case TRAP_SOUND: if (this.soundsOn) { this.executeSound(); break; } /* falls through */ default: …`. Tested both flag states, and a CLI smoke confirmed `--sounds-on` on a normal program produces output **byte-identical** to the unflagged run.

**The rule:** **For a gated trap/opcode, make the flag-off branch literally fall through to the existing default, and assert byte-identical output for the off path — a new `case` must not perturb the unflagged baseline (oracle parity).**

## 5. A test that depends on real I/O isn't deterministic — remove the dependency

**What happened:** My first flag-ON test set slot 1 (doink), whose bundled `doink.wav` exists; with an audio player installed, the test *actually played the sound* (261 ms) instead of falling back to BEL, and failed. The fix (mirroring the existing LCC+ test): point the slot's `bundled` at a nonexistent path so `firstExistingSoundPath` returns undefined → BEL deterministically, no playback, no PATH dependency.

**The rule:** **If a unit test's outcome depends on whether an external resource (an audio player, a network host) happens to be present, it's flaky — neutralize the resource (nonexistent path / cleared env) so the code takes the deterministic branch.**

## What landed

| Artifact | Change |
|---|---|
| #1501 | Promoted to tracker (`issue-needs-work`); CLOSED when all children landed |
| #1502 | ADR `docs/research/1502-sounds-in-core-lcc.md` — architecture decided |
| #1503 | New `src/core/soundEngine.js`; `TRAP_SOUND` moved to neutral `core/constants.js` |
| #1504 | `--sounds-on` flag (off by default, BEL fallback, gated `case TRAP_SOUND`) |

## Open threads

- **Cross-repo orchestration:** dispatched a sub-agent to read ~28 issue bodies across lccjs + pmtools and return a dependency graph (chains, heads, file-overlap matrix). Biggest finding: the trap-registry chain (#1443→#1444/#1445) is **human-gated on #1447** (`@ItBeCharlie` sign-off) — the highest-value unblock needs a human, not an agent.
- The lccjs sound/`interpreterplus` region is a **single-writer zone** (jackfruit live on #1499) — keep parallel agents out of it.

## Related artifacts

- Issues #1501, #1502, #1503, #1504; ADR `docs/research/1502-sounds-in-core-lcc.md`
- Prior TIL on the same "verify against the code" theme: the #8/#82 non-bug investigations (pmtools)
