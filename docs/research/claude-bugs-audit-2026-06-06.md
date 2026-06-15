# Codebase audit — claude-bugs-audit (2026-06-06)

> **Provenance & lineage** (added when this artifact was brought under version control via #1403):
>
> - **Origin:** an external, Claude-driven deep code-review pass on lccjs, captured 2026-06-06. Everything from the first `---` below is the raw review transcript, preserved verbatim (including the model's streaming narration).
> - **Triaged via:** tracker **#1180**, which decomposed every finding into its own verify-first child ticket.
> - **Graduated findings:**
>   - P0 — `div`/`rem` execute unsigned → **#1237** (closed)
>   - P1 — `resetAssemblyState()` omits `listingLoadPoint` → **#1238** (closed)
>   - P2.1 — `div`/`rem` by zero → **#1377** (closed) + **#1378** (guard hardening)
>   - P2.2 — `parseObjectModuleBuffer` bounds → **#1380** (closed) + **#1384** (unterminated-label, spun off)
>   - P2.3 — linker `error()` / `REPORT_MULTI_ERRORS` divergence → **#1389** (closed)
>   - P2.4 — unconditional pass-banner `console.log`s → **#1397** (closed)
>   - ARCH — interpreter god-object → **#255** (closed, over-scoped) / **#1352** (spike)
>   - ARCH — assembler god-object → **#1404** (spike)
>   - ARCH — `SEXT_PARITY_TABLE` provenance → **#1402** (blocked-by #159)
> - **Caveat:** this is a third-party review. Each finding was independently verified or refuted in its child ticket before any fix — do not treat the claims below as authoritative on their own.

---

I'll do a thorough review of the lccjs codebase. Let me clone it and dig in.Let me read the core files — the assembler, interpreter, and linker are where correctness lives.Let me read the core source files — assembler, interpreter, linker — for correctness analysis.I see one notable bug already. Let me read the interpreter and assembler key sections.I found several real bugs. Let me verify a couple of suspicions: the DIV truncation toward negative, the SRA/SLL `ct=0` carry corner, and the linker's `A`-entry doubling for virtual address refs. Let me check `setCV`, `setNZ`, `toSigned16`, and DIV semantics.Now let me confirm the DIV/REM signedness issue and MUL flag concern by checking what registers feed them, and verify the linker A-entry double-write. Let me look at how DIV operands are read (signed vs unsigned).Now I've confirmed the DIV/REM signedness bug. The registers are `Uint16Array` (always 0–65535), so `this.r[this.dr] / this.r[this.sr1]` does *unsigned* division — meaning `-6 / 2` (stored as 0xFFFA / 0x0002) computes 65530/2 = 32765, not -3. Real LCC does signed division. Let me confirm against the assembler's handling and check the docs to see if this is already known. Let me also verify the linker A-entry duplication and check a few more things, then look at the assembler.The bug log claims everything but OB-008 is fixed. Let me verify whether the DIV/REM signedness issue is actually documented anywhere, since I believe it's a live bug. Let me grep parity docs and check the oracle's DIV behavior expectation.Let me write a quick test to confirm the signed DIV/REM/SRA bugs empirically by running the interpreter directly.Confirmed: **DIV and REM are unsigned** — a real correctness bug. Whether it's a *parity* bug depends on whether the oracle LCC treats them as signed; in the LCC textbook (`mul`/`div`/`rem`), these operate on signed integers, so this diverges. Let me verify against the LCC ISA doc in-repo, then look at the assembler and a few more things efficiently.The ISA doc treats values as signed in arithmetic (`dout` displays signed; `div` is integer division). The LCC reference implementation does signed division. This is a genuine P0 correctness bug that the bug log misses. Let me now scan the assembler for issues and check the disassembler DIV/REM round-trip and a couple other suspect areas, then wrap up.I notice the assembler constructor sets state inline but there's a separate reset at line 279. Let me check whether the constructor's inline init and the reset method are kept in sync (the linker explicitly avoided this duplication; the assembler may not have). Let me check the disassembler DIV/REM and the linker A-entry double write, then I have enough for a thorough review.Confirmed a state-leak hazard: `resetAssemblyState()` omits `listingLoadPoint` and `listingLoadPoint`/`startAddress`-adjacent fields. Specifically **`listingLoadPoint` is set in the constructor but NOT reset** — so a reused `Assembler` instance carries it across runs. This is exactly the duplication-drift the linker explicitly avoided with a single `resetState()`. Let me confirm `listingLoadPoint` is actually mutated during a run.Confirmed. `listingLoadPoint` is set externally (by the CLI via `-l`) and read in `genStats`, but `resetAssemblyState()` never clears it — so a reused instance leaks the prior `-l` value into the next assembly's listing. Lower severity than the linker (CLI creates fresh instances) but a real latent bug given the project's programmatic/in-memory reuse goals. Now the disassembler DIV/REM and one final check on the linker double-`A` write.The linker `createExecutable` writes a separate `A` entry for each `virtualAddressTable` ref AND each `addressAdjustmentTable` ref. These are disjoint tables (V vs A headers), so that's correct, not a double-write — good. I have enough to write a thorough, accurate review. Let me also do one quick run of the test suite to gauge health, then write up.Tests pass and emit `console.log` noise even in non-verbose runs (a minor hygiene issue). I have a thorough picture. Here's the review.

---

# lccjs — Codebase Critique

## P0 — Correctness bugs (genuine, not in `open_bugs.md`)

**1. `div` and `rem` are unsigned, not signed.** In `interpreter.js` `executeCase10`, both operate directly on `Uint16Array` register slots:
```js
this.r[this.dr] = (this.r[this.dr] / this.r[this.sr1]) & 0xFFFF;  // DIV
this.r[this.dr] = (this.r[this.dr] % this.r[this.sr1]) & 0xFFFF;  // REM
```
Registers are always 0–65535, so these do unsigned arithmetic. I confirmed empirically:
- `-6 / 2` → `0x7ffd` (32765), should be `0xfffd` (-3)
- `-7 % 3` → `0x0000`, should be `0xffff` (-1)

`mul` happens to be safe (low 16 bits are identical for signed/unsigned), but `div`/`rem` are not. Your ISA doc treats arithmetic as signed (`dout` is signed decimal, `brlt`/`brgt` use signed semantics), and the reference LCC does signed integer division — so this is both a semantic and a parity bug. Fix: convert with `toSigned16` before dividing, then mask. `open_bugs.md` claims everything but OB-008 is fixed; this one slipped through, and it's higher severity than most that *are* logged.

## P1 — State-leak / reuse hazards

**2. `resetAssemblyState()` omits `listingLoadPoint`.** The constructor initializes it (line 134) but the reset method doesn't. It's set externally by the CLI's `-l` flag (`lcc.js:330`) and read in `genStats.js`. A reused `Assembler` instance carries a prior run's `-l` value into the next assembly's listing offset. The CLI dodges this by creating fresh instances, but the whole point of `resetAssemblyState()` (per its own comment, "so the core logic can be reused without a fresh instance") is programmatic reuse — which is a stated project goal for the browser/in-memory paths.

This is exactly the drift the *linker* explicitly designed against: `Linker` has a single `resetState()` that the constructor delegates to, with a comment explaining why ("a field can't be added in one place and forgotten in the other"). The assembler does the opposite — duplicates ~26 field initializers across constructor and reset, and has already drifted. **Apply the linker's pattern to the assembler:** constructor calls `resetAssemblyState()`, config-only fields (`verboseModeOn`, `explainModeOn`, `defaultLoadPoint`, `listingLoadPoint`) live outside it. This kills a whole bug class.

## P2 — Smaller correctness/robustness notes

- **`div`/`rem` by zero** calls `raiseRuntimeError` but execution *continues* to the divide on the next line (no `break`/`return` guaranteed by the throw path — verify `raiseRuntimeError` actually throws rather than logging). If it ever becomes non-throwing, you get a `NaN & 0xFFFF = 0` silent result.
- **`parseObjectModuleBuffer` bounds checks are off-by-one-ish.** `if (offset + 1 >= buffer.length)` for a 2-byte read rejects the case where exactly 2 bytes remain (`offset+1 === length-1` is fine, but `offset+1 === length` should be the failure). Worth a unit test with a truncated module ending mid-field; current fixtures may not cover it.
- **Linker `error()` logs *and* throws**, and callers (`processModule` "Multiple entry points", "More than one global declaration") call it mid-loop — so the first duplicate aborts. That's probably intended (oracle reports one error), but it means `REPORT_MULTI_ERRORS` semantics in the assembler and the linker's behavior diverge silently. Document the intent.
- **`console.log("Starting assembly pass 1")` etc. fire during tests** regardless of verbose mode — they're unconditional. Gate them behind `verboseModeOn` or route through a logger; right now `jest` output is buried in pass-banner noise.

## Architecture

- **`interpreter.js` (1865 lines) and `assembler.js` (2249 lines) are god-objects.** The interpreter's own TODO (`#255`) already names the fix: the ~50 flat `this.*` fields mix CPU state, run options, and diagnostics in one namespace. Grouping into `this.cpu` / `this.io` / `this.diag` would also make the reset/snapshot story (needed for your step-back execution feature) far cleaner — right now backward-stepping has to know every field by name.
- **`SEXT_PARITY_TABLE`** is a 15×32 hardcoded oracle-capture matrix with no generator or comment explaining how it was derived. If the oracle's `sext` behavior is ever re-probed, nobody can regenerate it. Either derive it programmatically (you clearly understand the field-mode mapping) or check in the script that produced it.
- The `storeMem` choke-point comment is excellent — that's the right seam for the debugger's undo log. Good design instinct; extend that "single choke point" discipline to register writes too, which would also serve step-back.

## What's solid

The linker's reset discipline, the `storeMem` observer seam, the typed-error hierarchy (`LinkerError`/`AssemblerError`/`InterpreterRuntimeError`), the oracle-parity test structure, and the explicit "we diverge from the oracle here and why" comments (e.g. unknown eopcode throwing vs. silently exiting) are all above the bar for a project this size. The CV/NZ flag logic is carefully done and correct.

---

**Top three actions:** (1) fix signed `div`/`rem` + add signed-operand oracle tests, (2) port the linker's single-`reset()` pattern to the assembler and add `listingLoadPoint`, (3) gate the pass-banner `console.log`s. Want me to write the patches and the failing tests that pin them?
