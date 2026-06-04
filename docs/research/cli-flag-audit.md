# CLI Flag Audit — OG LCC parity, LCCjs-only flags, ilcc co-existence

**Issue:** #713  
**Role:** RESEARCH  
**Date:** 2026-06-04  
**Agent:** APPLE

---

## 1. OG LCC flag inventory

Source: `lcc -h` (cuh63 6.3).

| Flag | OG LCC description | LCCjs equivalent | Status |
|------|--------------------|------------------|--------|
| `-d` | debug | `-d` (`options.debug`) | ✓ parity |
| `-m` | mem display at end | `-m` (`options.memDisplay`) | ✓ parity |
| `-r` | reg display at end | `-r` (`options.regDisplay`) | ✓ parity |
| `-t` | (not described in help; accepts the flag) | `-t` (`options.trace`) | ✓ parity |
| `-f` | full line display | `-f` (`options.fullLineDisplay`) | ✓ parity |
| `-x` | 4 digit hout | `-x` (`options.hexOutput`) | ✓ parity |
| `-l<hex>` | load point | `-l<hex>` (`options.loadPoint`) | ✓ parity |
| `-o <outfile>` | output file name | `-o <outfile>` (`this.outputFileName`) | ✓ parity |
| `-h` | help | `-h` (prints help, exits 0) | ✓ parity |

**Verdict: OG LCC → LCCjs flag parity is complete.** Every OG LCC flag exists in LCCjs with equivalent behavior. No OG LCC flag is absent.

**Note on `-x` help text:** both OG LCC and LCCjs print "4 digit hout" (appears to be a shortening of "hex output"). This is parity-correct — a shared typo, not a LCCjs-specific issue.

---

## 2. LCCjs-only flag inventory

Flags in `lcc.js` that have no OG LCC counterpart.

| Flag | In help text? | Code site | Wired to | Status |
|------|---------------|-----------|----------|--------|
| `-i` | ✓ (`-i: interactive stepping debugger mode`) | `lcc.js:246–248` | `options.interactive` → `runInteractiveMode()` | OK |
| `-e` | ✓ (`-e: efficient mode`) | `lcc.js:249–251` | `options.efficientMode` → forwarded to ilcc | OK |
| `-c` | ✓ (`-c: colorblind mode`) | `lcc.js:252–254` | `options.colorblindMode` → forwarded to ilcc | OK |
| `-nostats` | ✗ **missing from help** | `lcc.js:255–257` | `options.noStats = true` — **never read** | **GAP 1: dead flag** |
| `-v` / `--verbose` | ✗ **missing from help** | `lcc.js:261–264` | `options.verbose` → `assembler.verboseModeOn`, `interpreter.verboseModeOn`, `linker.verboseModeOn` | **GAP 2: undocumented** |

**GAP 1 — `-nostats` is a dead flag:**  
`parseArguments` sets `options.noStats = true` (line 256) but `options.noStats` is never read anywhere in `lcc.js`. The `generateStats` field (which controls whether `.lst`/`.bst` files are written, lines 359–390) is initialized to `true` and never updated from `options.noStats`. Effectively, `-nostats` accepts the flag silently but does nothing. Child ticket filed: see §4.

**GAP 2 — `-v`/`--verbose` undocumented:**  
`-v` and `--verbose` are accepted and functional (they wire `verboseModeOn` into assembler, interpreter, and linker), but neither appears in `printHelp()`. A user running `lcc -h` has no way to discover them. Child ticket filed: see §4.

---

## 3. `ilcc` flag inventory

Source: `ilcc.js` help text and `parseArguments` (lines 119–178).

| Flag | ilcc help text | Code site | Notes |
|------|---------------|-----------|-------|
| `-n` | batch mode (non-interactive; skip prompt, run to completion) | `ilcc.js:125–127` | ilcc-specific; no lcc.js counterpart |
| `-m` | print memory display after run | `ilcc.js:128–130` | accepted and documented |
| `-r` | print register display after run | `ilcc.js:131–133` | accepted and documented |
| `-f` | full line display | `ilcc.js:134–136` | accepted and documented |
| `-x` | 4-digit hex output | `ilcc.js:137–139` | accepted and documented |
| `-t` | trace mode | `ilcc.js:140–142` | accepted and documented |
| `-e` | efficient mode | `ilcc.js:143–145` | accepted and documented |
| `-c` | colorblind mode | `ilcc.js:146–148` | accepted and documented |
| `-d` | debug mode | `ilcc.js:149–151` | accepted and documented |
| `-h` | show this help | `ilcc.js:152–155` | accepted and documented |
| `-i<N>` | instruction cap before automatic halt (default 500000) | `ilcc.js:157–158` | `parseInt(arg.substr(2), 10)` — ilcc-specific |
| `-l<hex>` | load point | `ilcc.js:159–160` | accepted and documented |
| `-o <file>` | output executable name | `ilcc.js:161–167` | accepted and documented |

**ilcc.js help text is accurate and complete** for its own flag set.

**`-i<N>` vs `-i` naming conflict:**  
In `lcc.js`, bare `-i` means "interactive mode." In `ilcc.js`, `-i<N>` (with a number immediately attached, e.g. `-i5000`) means "instruction cap." These two tools give `-i` different meanings, but there is no actual collision — `lcc.js -i` enters ilcc and never forwards `-i<N>` to it; `ilcc.js` is invoked directly if you need `-i<N>`. The meanings are disjoint in practice but could confuse users who read both help texts. No child ticket needed — worth a cross-reference note in the help texts.

---

## 4. Flags forwarded from `lcc -i` to ilcc

When `lcc.js` runs with `-i`, it delegates to `ILCC` via `runInteractiveMode()` (`lcc.js:109–133`). The docstring at line 104–107 states what is forwarded:

> "Forwards -e (efficient), -c (colorblind), -d (debug), -l<hex>, -o flags."

Confirmed by code inspection:

| Flag | Forwarded from `lcc -i` to ilcc? |
|------|----------------------------------|
| `-e` | ✓ `ilcc.options.efficientMode` |
| `-c` | ✓ `ilcc.options.colorblindMode` |
| `-d` | ✓ `ilcc.options.debug` |
| `-l<hex>` | ✓ `ilcc.options.loadPoint` |
| `-o` | ✓ `ilcc.outputFileName` |
| `-m` | ✗ not forwarded |
| `-r` | ✗ not forwarded |
| `-f` | ✗ not forwarded |
| `-x` | ✗ not forwarded |
| `-t` | ✗ not forwarded |

**GAP 3 — `-m`, `-r`, `-f`, `-x`, `-t` silently dropped in `lcc -i`:**  
When a user passes `lcc -i -x file.a`, the `-x` flag is parsed by `lcc.js` → `options.hexOutput = true`, but `runInteractiveMode()` does not copy `hexOutput` (or `memDisplay`, `regDisplay`, `fullLineDisplay`, `trace`) to the ilcc instance. The flags are silently ignored.

Whether these omissions are intentional is unclear:
- `-m`/`-r` (post-run displays): ilcc runs interactively and shows its own live register/memory display, so post-run dumps may be intentionally excluded.
- `-f`/`-x`/`-t`: ilcc does accept and use these, so the omission is likely unintentional or undocumented.

In any case, users have no way to know which flags apply in `-i` mode from `lcc -h`. Child ticket filed: see §4.

---

## 5. Confirmed gaps — child tickets

Three confirmed gaps warrant child tickets:

| # | Gap | Proposed type | Priority |
|---|-----|---------------|----------|
| G1 | `-nostats` is a dead flag: sets `options.noStats` but `generateStats` is never updated | `fix` | low |
| G2 | `-v`/`--verbose` undocumented in `lcc.js` help text | `docs` | low |
| G3 | `lcc -i` silently drops `-m`/`-r`/`-f`/`-x`/`-t` — no user-visible explanation | `docs` or `fix` | low |

---

## 6. Non-gaps

- All OG LCC flags (`-d`, `-m`, `-r`, `-t`, `-f`, `-x`, `-l<hex>`, `-o`, `-h`) are present in LCCjs with equivalent behavior.
- LCCjs-only flags `-i`, `-e`, `-c` appear correctly in `lcc.js` help text.
- `ilcc.js` help text is accurate and complete for its own flag set.
- No OG LCC flag is absent from LCCjs.
- No existing entry in `docs/parity_deviations.md` relates to CLI flags.

---

## Key code sites

- `src/cli/lcc.js:195–219` — `printHelp()` (flags in help text)
- `src/cli/lcc.js:221–290` — `parseArguments()` (all accepted flags)
- `src/cli/lcc.js:103–133` — `runInteractiveMode()` and its forwarding docstring
- `src/interactive/ilcc.js:119–178` — `parseArguments()` (ilcc accepted flags)
- `src/interactive/ilcc.js:180–197` — `printHelp()` (ilcc help text)
