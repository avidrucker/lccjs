# Debugging LCC programs: the two debuggers

lccjs ships **two separate interactive debuggers**. You pick one per run — they
**cannot run at the same time**:

| | Enter with | What it is | Best for |
|---|---|---|---|
| **OG-style debugger** | `-d` | A faithful imitation of the original LCC textbook debugger (single-letter commands, breakpoints, watchpoints). | Following the textbook; setting breakpoints/watchpoints; changing a value mid-run. |
| **ILCC TUI** | `-i` | A rich full-screen terminal UI with register/memory/stack/code panes and **reverse stepping** (time-travel). | Visually exploring machine state and stepping **backward** through execution. |

> **Why two?** The `-d` debugger mirrors the original LCC (the "oracle") so course
> material lines up. The `-i` TUI is a richer, lccjs/Charlie-derived experience.
> They are different command languages by design. For the per-command provenance
> and design rationale, see **[`docs/debugger-command-registry.md`](../debugger-command-registry.md)**.

---

## The OG-style debugger (`-d`)

Run any program with `-d` to pause before the first instruction and step through it:

```bash
node ./src/cli/lcc.js -d myprogram.e
```

At each pause the prompt is the **mnemonic of the next instruction**, e.g. `mvi>>> `.
Type a command and press Enter.

**Numbers are hex** in this debugger — except the bare step-count `n`, which is decimal.

| Command | Does |
|---|---|
| *(Enter)* | Run *step-count* instructions (default 1). |
| `n` (a number) | Set the step count to `n` (decimal) and run `n` instructions. |
| `b <addr>` | Set a breakpoint at a hex address; `b` cancels it. |
| `c <loc> <val>` | Change a value: a register (`r0`–`r7`, `fp`, `sp`, `lr`) or a memory location (hex address or label) to `<val>` (hex). |
| `g` | Go — run to the next breakpoint or to the end. |
| `r` | Display all registers and flags. |
| `m`, `m <addr>`, `m <addr> <n>` | Display all memory / one word / `n` words. |
| `i` | Display the next instruction without executing it. |
| `s` | Display the stack. |
| `h` | Help. |
| `q` | Quit. |

**Parity status vs the original LCC (oracle):** the command set above matches the
oracle. Three oracle commands are **not yet implemented** in lccjs and are tracked
as the OG-parity backlog (see the registry doc): `z` (run-to-end ignoring
breakpoints), `w` (watchpoint), and `t` (interactive trace toggle).

> **Safety note:** the real oracle **segfaults** if you type a bare `c` with no
> operands. lccjs deliberately does **not** — it prints `Missing operand` instead.

---

## The ILCC TUI (`-i`)

Run with `-i` to drop into the full-screen stepping UI:

```bash
node ./src/cli/lcc.js -i myprogram.a      # .a is assembled first; .e runs directly
```

The screen shows configurable panes (registers, code, memory, output) and a prompt
`Input: `. Its standout feature is **reverse stepping** — you can step *backward*
to re-examine earlier state.

| Command | Does |
|---|---|
| `{N}` | Step **forward** N instructions (e.g. `3`). |
| `{-N}` | Step **backward** N instructions — time-travel (e.g. `-2`). |
| *(Enter)* | Repeat the last step count. |
| `0` | Re-display the current state without stepping. |
| `a{hex\|label}` | Set the memory pane's base address (e.g. `a0010`, `amyData`). |
| `m{N}` | Set the number of memory rows shown (e.g. `m4`). |
| `c{N}` | Set the number of code-context rows (e.g. `c5`; `c0` hides the pane). |
| `s{anchor}` | Anchor the stack pane to a register or hex address (e.g. `ssp`, `sfff2`). |
| `l{layout}` | Set the pane layout, up to 3 columns (e.g. `lro/mc`). Panes: `r`=registers, `c`=code, `m`=memory, `o`=output. |
| `h` | Help. |
| `q` | Quit. |

> Reverse stepping re-simulates the machine and restores **memory** plus the
> Output pane; note that the stdin cursor is not yet rewound on a backward step,
> and a real terminal in batch mode cannot be un-printed.

---

## Which should I use?

- **Use `-d`** if you want the textbook LCC experience: breakpoints, watchpoints,
  changing values, and a command set that matches the course's reference tool.
- **Use `-i`** if you want to *see* the machine — multi-pane state, configurable
  views, and the ability to step **backward** when you overshoot a bug.

They are mutually exclusive: `lcc … -d -i` runs the `-i` TUI (the interactive path
short-circuits first). Run one, quit with `q`, then try the other.

## See also
- **[`docs/debugger-command-registry.md`](../debugger-command-registry.md)** — the authoritative per-command/flag registry with provenance (OG / Charlie / lccjs) and the strict-OG naming rulings. The in-tool `h` help is generated from it.
- **[`docs/research/debugger-provenance-findings-2026-06-15.md`](../research/debugger-provenance-findings-2026-06-15.md)** — how the two debuggers and their lineage were established.
