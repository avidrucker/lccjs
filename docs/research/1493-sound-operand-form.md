# ADR 1493 — LCC+ `sound` operand form: immediate vs register

- **Status:** Accepted (research output for #1493; umbrella #1491). Ratified by maintainer @avidrucker (2026-06-29).
- **Date:** 2026-06-29
- **Deliverable of:** #1493 (RESEARCH). No production code in this ticket.
- **Decides:** whether LCC+ `sound` keeps both its immediate (`sound NUM`) and register (`sound rN`) operand forms, or collapses to one.

## Context

`sound` (added in #1491) currently accepts two operand forms, distinguished at runtime by one encoding bit:

| Surface | Encoding (`assemblerplus.js`) | Runtime (`interpreterplus.js: executeSound`) | Meaning |
|---|---|---|---|
| `sound NUM` | `assembleSoundLiteral(NUM)` — packs `NUM` into the 3-bit register field **+** `TRAP_SOUND_LITERAL_FLAG` | `slotIndex = this.sr` (the field bits) | **immediate** — fixed slot, known at assemble time |
| `sound rN` | `assembleTrap(['rN'], TRAP_SOUND)` (no flag) | `slotIndex = this.r[this.sr]` | **register** — dynamic slot = runtime value of `rN` |

The 7 friendly aliases (`ding`=0, `doink`=1, `beep`=2, `ping`=3, `popsound`=4, `softbeep`=5, `bop`=6) each compile via `assembleSoundAlias` → `assembleSoundLiteral`, i.e. **the literal form**. The slot table (`src/core/soundEngine.js: SOUND_SLOTS`) currently has **7 slots (0–6)** — the ticket's "0–4" text predates the alias expansion. The literal form is range-checked at assemble time (0–7, the 3-bit field ceiling); the register form is "checked" at runtime via the engine's graceful BEL (`\x07`) fallback for an unknown slot.

The maintainer's post-#1491 lean was to **likely pick one** primary form. This ADR weighs that against the code.

## Findings

1. **They are the immediate/register operand pair, not redundant syntax.** This mirrors the base LCC ISA, where ALU ops already take both forms (`add rd, rs, imm5` vs `add rd, rs, rt`). Keeping both is the choice **consistent** with LCC's own operand conventions — the ticket's first comparison criterion.
2. **The aliases depend on the literal encoding.** All 7 aliases compile to `assembleSoundLiteral`. Removing the literal form orphans them unless re-engineered (either keep the literal encoding internally, or expand aliases to `mov rX,k; sound rX`, which clobbers a caller register — a worse trade).
3. **The literal form is the clean resolution of the #1491 "correction", not a leftover.** The rejected idea was `sound r0` *meaning* "slot 0" (a register name used as a literal label). The correction split it honestly: `sound NUM` = fixed slot (immediate), `sound rN` = dynamic slot (register read). The literal form is the right way to say "fixed slot" without abusing register names.
4. **#1492's register-flexibility is already satisfied** by `sound rN` (any register, caller-chosen — the `nbain` model #1492 cites). The literal form is an **immediate**, not a fixed-register constraint, so it is **not** something the #1492 audit should remove.
5. **Each form serves a non-substitutable need:** fixed/static sound (the common demo and lesson case) wants the immediate/alias for readability; dynamic/computed sound (terminal games — LCC+'s reason for existing) requires the register form.

## Options weighed

1. **Keep only `sound REGISTER`** — most #1492-consistent and removes the `sound 0` vs `sound r0` look-alike, but loses the concise fixed-slot immediate and forces a re-engineering of the aliases.
2. **Keep only `sound NUM`** — most readable for fixed demos, but loses runtime/dynamic sound selection — a poor fit for LCC+ games. Rejected outright.
3. **Keep both** — extra surface area, but each form is the right tool for a distinct job, the duality is ISA-consistent, the aliases need the literal form, and the cost is already paid (one branch + one flag bit).

### The one genuine cost of "both"
`sound 0` (slot 0) and `sound r0` (slot = value of r0) look one character apart but differ semantically. This is real — but it is the *same* distinction the base ISA already accepts everywhere (`3` vs `r3`), so it adds no new teaching burden, and the alias forms (`ding`/`beep`/…) sidestep it for the fixed case.

## Decision

**Keep both forms (Option 3).** Document them explicitly as the immediate/register operand pair:

- `sound NUM` — fixed slot known at assemble time (immediate).
- `sound rN` — dynamic slot from a register's runtime value.
- **Primary teaching form for fixed sounds = the aliases** (`ding`/`beep`/…): most readable and discoverable (per the project decision tie-breaker's *discoverability over terseness* + Learner-first ranking, `docs/who_lccjs_is_for.md`). Reserve `sound rN` for dynamic/game audio, and de-emphasize bare `sound NUM` in docs/demos (every slot has an alias) — which keeps the literal *encoding* the aliases need while removing most of the `sound 0`/`sound r0` ambiguity in practice.

This **unblocks #1492**: its audit should treat `sound` as **already register-flexible** and **not** remove the literal/alias forms.

## Follow-up (no behavior change required)

The recommendation keeps current assembler/runtime behavior. A small **docs/teaching** follow-up is filed to: frame the two forms as the immediate/register pair in the LCC+ ISA doc, point fixed-sound demos/lessons at the aliases, reconcile the stale "0–4"→"0–6" slot count, and (optionally) sharpen the `sound operand must be a register or slot number` error. Tracked as the DEV/WRITER follow-up linked from #1493.

## Consequences

- No assembler/runtime change; the ratified design is the current code, now documented and justified.
- #1492 proceeds with a settled ruling for the `sound` family.
- Future demos/lessons have a canonical convention (aliases for fixed, `sound rN` for dynamic) before more material depends on the ambiguous bare-`NUM` form.
