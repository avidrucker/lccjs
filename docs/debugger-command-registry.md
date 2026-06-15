# Debugger command & flag provenance registry

**Status:** authoritative living reference (created for #1341). Update whenever a debugger command or
CLI flag is added, renamed, or re-provenanced. The data-driven registry in code (#1342) is generated
to match these rulings; the coverage tracker (#1343) closes the "proving test?" gaps.

> **Terminology (strict, enforced in all docs + help strings):**
> **"Oracle" / "OG" = the original Dos Reis `cuh63` LCC binary ONLY.** lccjs's `-d` debugger is
> lccjs's *oracle-**parity*** imitation and is always called **"lccjs `-d` debugger"** — never "the
> oracle debugger." When this doc says the lccjs `-d` debugger "lacks the Oracle's `z`/`w`/`t`", it
> means lccjs's imitation omits commands the real Oracle has.

## lccjs has TWO debuggers (mutually exclusive)

`src/cli/lcc.js:83` short-circuits to interactive before the batch path, so these never run together:

| Surface | Entered by | Code | Command language | Lineage |
|---|---|---|---|---|
| **A. lccjs `-d` debugger** | `-d` | `src/core/interpreter.js` `debug()` (~L938) | single letters: `b`/`g`/`m`/`r`/`s`/`i`/`h`/`q` + Enter-step | **imitates OG Oracle** |
| **B. ILCC TUI** | `-i` | `src/interactive/iinterpreter.js` `runInteractive()` | `{N}`/`{-N}`/`0`/`a`/`m`/`s`/`c{N}`/`l`/`h`/`q` | **derived from Charlie's `interactive_lccjs`** |

## Provenance priority (conflict-resolution order)

> **OG oracle LCC  →  Charlie `interactive_lccjs`  →  lccjs-original**

web_ilcc is **out of scope** for this registry (it is a browser GUI with no command letters / no CLI
debug flags; it is mentioned here only so its absence is intentional, not an oversight).

**Tags:** `OG` = real Oracle binary · `CH` = Charlie's `interactive_lccjs` · `LCCJS` = lccjs-original.
Every cell below is **established** from a cited source (no remaining inferences as of 2026-06-15).

## Sources
- **OG Oracle** — `~/Documents/Study/Assembly/cuh63/lcc.txt`: "Debugger commands" (~L451-580) and
  "Command Line Arguments" (~L140-165); `experiments/debugger-results.md`.
- **Charlie** — source read of `ItBeCharlie/interactive_lccjs` `src/interactive/iinterpreter.js` +
  `ilcc.js` (2026-06-15); `docs/research/389-ilcc-charlie-gap-matrix.md`. User confirmed lccjs's ILCC
  is *derived from* Charlie's, and that reverse-step (`{-N}`) was Charlie's first.
- **lccjs** — `src/core/interpreter.js` `debug()`; `src/interactive/iinterpreter.js`;
  `src/interactive/ilcc.js`; `src/cli/lcc.js`.

---

## §1. Surface A — the `-d` oracle-style debugger (OG vs lccjs `-d`)

The Charlie TUI and the `-i` surface do **not** have these commands (N/A there). `✅`=implemented,
`❌`=missing, `⚠️BUG`=advertised in help but not implemented.

| Cmd | OG Oracle (`lcc.txt`) | lccjs `-d` (`debug()`) | Prov. | Ruling | Test? |
|-----|-----------------------|------------------------|-------|--------|-------|
| `Enter` | run step-count instrs | step one | OG | keep | ❌ |
| `integer n` | set step-count + run n | **⚠️BUG** advertised (L1016), no handler → single-steps | OG | implement to match OG **or** de-advertise (gated on W7 probe) | ❌ |
| `b <addr\|label>` / `b` / `b-` | set / cancel breakpoint | `b <addr>` set, `b` cancel (no `b-`) | OG | **reserve `b`=breakpoint**; #1088 use `b` not `bp`; add `b-` for parity | ❌ |
| `c <loc> val` | change value (reportedly crashes) | **⚠️BUG** advertised (L1018), no handler → single-steps | OG | **gated on W7**: implement if Oracle works; de-advertise + upstream report if Oracle is buggy | ❌ |
| `g` | go (run to breakpoint) | `g` continue | OG | keep | ❌ |
| `z` | run-to-end (ignore bps) | **missing** | OG | add for OG parity | ❌ |
| `w` / `w-` | watchpoint set / cancel | **missing** | OG | add for OG parity | ❌ |
| `i` | display next instruction | `i` | OG | keep | ❌ |
| `m` / `m addr [n]` | memory display | `m` / `m addr [n]` | OG | keep | ❌ |
| `r` | register display | `r` | OG | keep | ❌ |
| `s` | display stack | `s` | OG | keep | ❌ |
| `t` / `t-` | toggle trace | **missing** (only `-t` flag) | OG | add interactive `t` for parity | ❌ |
| `h` | help | `h` | OG | keep | ❌ |
| `q` | quit | `q` | OG | keep | ❌ |

**Summary:** lccjs `-d` implements `Enter/q/g/b/r/m/i/h/s`. It is **missing** the Oracle's `z`/`w`/`t`
and **falsely advertises** `c`/`integer n`. No behavioral tests cover the `-d` surface today.

## §2. Surface B — the `-i` ILCC TUI (Charlie vs lccjs `-i`)

OG and the lccjs `-d` debugger do **not** have these (N/A there).

| Cmd | Charlie | lccjs `-i` | Prov. | Ruling | Test? |
|-----|---------|------------|-------|--------|-------|
| `{N}` step fwd | ✅ | ✅ | CH | keep | ✅ |
| `{-N}` step **back** | ✅ (Charlie's first) | ✅ | **CH** | keep — reverse is Charlie's, not OG | ✅ |
| `<enter>` repeat | `0` repeats | repeat last step | CH/LCCJS | keep | ❌ |
| `0` redisplay | ✅ | ✅ | CH | keep | ✅ |
| `a{hex}` mem base | ✅ | ✅ + `a{label}` (lccjs enhancement #1041) | CH (+LCCJS) | keep | ✅ |
| `m{N}` mem rows | ✅ | ✅ | CH | keep | ✅ |
| `s{anchor}` stack anchor | ✅ | ✅ | CH | keep (deviation §5.2) | ✅ |
| `c{N}` code rows | ✅ | ✅ | CH | keep (deviation §5.1) | ❌ |
| `l{layout}` panes | ✅ | ✅ | CH | keep | ❌ |
| `h` / `q` | ✅ | ✅ | CH/OG | keep | ✅ |

**If #1088 ports breakpoints/`g` into this TUI surface**, use `b`/`g` (matching both OG and lccjs's own
`-d` surface) — not `bp`. The reverse-step alias (#1089) must be **neither `b`** (reserved) **nor
`s`-prefixed** (swallowed by `s{anchor}`).

## §3. CLI flags (real Oracle / Charlie tool / lccjs `lcc`+`ilcc`)

`Test?`: `✅` effect proven · `⚠️` parse/wire only (effect unasserted) · `❌` none.

| Flag | OG Oracle | Charlie | lccjs | Prov. | Ruling | Test? |
|------|-----------|---------|-------|-------|--------|-------|
| `-d` | debugger on + trace + step1 | debug | enters **lccjs `-d` debugger** | OG | keep | ❌ |
| `-i` (bare) | — | — (not recognized) | `lcc.js`: enter interactive | **LCCJS** | keep (Charlie is interactive-by-default + `-n`; lccjs `lcc` is batch-by-default so needs `-i`) | ⚠️ |
| `-i<N>` | — | instruction cap | `ilcc.js`: instruction cap | **CH** | keep as documented alias; see `--max-steps` | ⚠️ |
| `--max-steps` | — | — | `lcc.js`: instruction cap | **LCCJS** | **make consistent** — also accept in `ilcc.js` (and/or `-ms{N}`); W4 | ⚠️ |
| `-e` | — | efficient | efficient | CH | keep | ✅ |
| `-c` | — | colorblind | colorblind | CH | keep (no OG conflict — OG has no `-c` flag) | ⚠️ |
| `-n` | — | disable interactive | batch (`run()` not `runInteractive()`) | CH | keep (semantics differ: Charlie default-on; lccjs default-off) | ✅ |
| `-m` | memory dump at end | ✅ | `memDisplay` | OG | keep | ⚠️ |
| `-r` | register dump at end | ✅ | `regDisplay` | OG | keep | ⚠️ |
| `-f` | full list (no truncation) | ✅ | `fullLineDisplay` | OG | keep | ⚠️ |
| `-x` | `hout` 4 hex digits | ✅ | `hexOutput` | OG | keep | ⚠️ |
| `-t` | instruction trace on | ✅ | `traceMode` | OG | keep | ⚠️ |
| `-l<hex>` | load point | ✅ | load point | OG | keep | ❌ |
| `-o<file>` | output filename | ✅ | output filename | OG | keep | ⚠️ |
| `-h` | help | ✅ | help (exits) | OG | keep | ⚠️ |
| `-nostats` | — | ✅ | ✅ (`lcc.js`) | CH | keep | — |
| `-v`/`--verbose`, `--explain`, `--test` | — | — | `lcc.js` only | LCCJS | keep | mixed |

## §5. Naming rulings

### 5.1 `c` — accepted deviation, two surfaces
OG `c` (change-value) lives on the **`-d`** surface; lccjs's `c{N}` (code rows) lives on the **`-i`**
surface. They never coexist in one loop, so both keep `c`. The lccjs `-d` `c` is currently a **bug**
(advertised, unimplemented) — its fate is gated on the W7 Oracle probe.

### 5.2 `s` — accepted deviation
OG `s` (display stack) on `-d`; lccjs `s{anchor}` (stack-pane anchor) on `-i`. Both keep `s`.

### 5.3 `-i` is **not** a collision
`-i` (bare) = interactive (`lcc.js`, **lccjs-original**); `-i<N>` = cap (`ilcc.js`, **Charlie-origin**);
`--max-steps` = cap (`lcc.js`, **lccjs-original**). The defect is *inconsistent cap naming* across
entry points — fixed by W4 (accept `--max-steps`/`-ms{N}` in `ilcc.js`), not by renaming `-i`.

### 5.4 Reserved OG letters on the `-d` surface
`b`=breakpoint, `g`=go, `z`=run-to-end, `w`=watchpoint, `c`=change-value, `i`=instr-display,
`t`=trace-toggle. lccjs's `-d` already has `b`/`g`/`i`; `z`/`w`/`t` and (pending W7) `c`/`integer n`
are the OG-parity backlog.

### 5.5 In-flight reconciliations
- **#1088** (`g` + breakpoints into the TUI): use `g` and `b`/`b-` (OG letters), not `bp`.
- **#1089** (reverse-step discoverability): docs-only now; alias deferred, must not be `b`/`s`-prefixed.

## §6. Registry schema (for #1342)

One plain-object entry per command/flag, mirroring `_instructionTable` (`src/core/assembler.js`):

```js
{
  key:        'a',                 // canonical key / prefix
  match:      'prefix',            // 'exact' | 'prefix' | 'numeric' | 'empty'
  surface:    'ilcc',              // 'ilcc' (-i TUI) | 'oracle' (-d) | 'cli' (flag)
  argShape:   '{hex|label}',
  help:       'set memory base address',
  handler:    (ctx, arg) => {…},
  provenance: 'CH',                // OG | CH | LCCJS
  aliases:    [],
  test:       'interactive.unit.spec.js › a{hex}',  // or pending(#1343-childN)
}
```

Guards the #1342 meta-test enforces: **collision** (no dup key/alias), **parity** (generated help key
set == dispatch key set), **coverage** (`test` resolves or is `pending(#child)`). Note the two
surfaces have independent key namespaces — `c` means different things on `-d` vs `-i`, which is legal
because they never share a dispatch loop; the registry encodes `surface` to keep that explicit.

## §7. Coverage audit (worklist for #1343)

- **`-i` TUI:** tested — `{N}/{-N}/a{hex}/a{label}/m{N}/s{anchor}/0/h/q`. Untested — `<enter>` repeat,
  `c{N}`, `l{layout}`.
- **`-d` oracle surface:** **no behavioral tests at all** — every command is a coverage gap.
- **Flags:** parse/wire tested for `-e/-c/-n/-m/-r/-f/-x/-t/-i<N>`; **behavioral effect** untested for
  `-x/-f/-m/-r/-c/-t` (e.g. nothing proves `-x` yields 4-digit hex). No test for `-d`, `-l<hex>`.

Each ❌/⚠️ becomes a ≤60-min #1343 child, failing-first, flipping its registry `test` pointer on close.

## §8. Override of the prior "low payoff" finding

`docs/research/debugger-ilcc-dry.md` (overlap #5) judged a shared command-table "low payoff, not worth
coupling" under a **DRY** motivation. This registry is adopted under a **different mandate** —
**parity** (OG-letter fidelity, recorded per lineage), **collision prevention** (a build-time guard;
two real collisions already shipped latent), and **coverage** (machine-checked `test` pointers). It
does **not** merge the two command languages; it records both with provenance and guards the lccjs
surfaces against drift.

## Changelog
- 2026-06-15 — initial authoritative version (#1341). Corrected from the first draft: web_ilcc dropped;
  the two debuggers (`-d` oracle-style vs `-i` Charlie TUI) split into separate surfaces; provenance
  re-grounded against Charlie's actual source + user confirmation; `-i` reclassified from "collision"
  to "inconsistency"; strict Oracle/lccjs terminology adopted.
