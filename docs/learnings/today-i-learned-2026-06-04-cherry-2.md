# TIL 2026-06-04 — CHERRY s2

**Context:** Testing sprint: wrote the textbook-demo C/assembly parity suite (#712),
removed a stale debug trap (#742), added `-nostats` regression coverage (#747), and
added a filename input to the playground (#734). Along the way, hit three sharp
non-obvious edges in the lccjs codebase.

---

## 1. `.e` file bytes ≠ `.hex`/`.bin` word values — the `oC` preamble

**What happened:** While writing integration tests for `-nostats` on the `.hex` input
path (#747), I assumed the bytes of a `.e` file could be used directly as hex word
values. The first two bytes of `simple.e` are `6F 43` — which I initially read as
machine-code word `0x6F43` (an LDR instruction). The test ran silently with wrong
output.

**What I learned:** The `.e` file starts with an `oC` preamble: `0x6F` = ASCII `'o'`
(the format marker), `0x43` = ASCII `'C'` (the code-start byte). Machine-code words
follow in little-endian order *after* any header entries. A `.hex` file, by contrast,
contains raw 16-bit word values — `D005` for `mvi r0, 5`, not `6F43`.

```
.e file for "mvi r0,5; dout r0; nl; halt":
  bytes: 6F 43 | 05 D0 | 02 F0 | 01 F0 | 00 F0
         'o' 'C'  D005 LE  F002 LE  ...

.hex file for the same program:
  D005
  F002
  F001
  F000
```

**The rule:** When building test fixtures for `.hex`/`.bin` paths, start from the raw
word values (assembler's `outputBuffer`), not from the `.e` file's bytes. (#758 tracks
codifying this in `RULES.md`; #756 tracks adding an explicit format-verification test.)

---

## 2. The assembler silently drops instructions after the first on a line

**What happened:** Running the C/assembly parity suite (#712), several demos failed
with missing newlines. `demo-032-multiplication-algorithms.a` has:

```
dout r0  nl       ; prints 1785
```

The C equivalent outputs `1785\n` (with newline), but the assembly outputs `1785`
(no newline). Inspection: the assembler tokenises the whole line and puts `['r0', 'nl']`
as operands to `dout`. `assembleTrap` only reads `operands[0]` (the register) and
ignores the rest — so `nl` is silently discarded.

**What I learned:** LCC's original assembler supports multiple instructions on one
line (e.g. `dout r0  nl`, `mov sp, fp  pop fp  pop lr  ret`). lccjs's assembler
does not — it processes exactly one mnemonic per line and ignores everything after
the operands. Six textbook demos are affected (029, 030, 031, 032, and two others).

**The rule:** In lccjs assembly source, each instruction must be on its own line.
Multi-instruction lines compile without error but silently lose all instructions
after the first. The parity suite exposes these as `test.failing` entries. (#759
tracks codifying this in `RULES.md`.)

---

## 3. Use `spawnSync` (not `inputBuffer`) for C/assembly output-parity tests

**What happened:** The issue spec said to use `lcc.interpreter.inputBuffer` for
supplying stdin. For demo-002 (string I/O), the assembly output came back as
`"Enter string\nhello\nhello"` — the input was echoed twice. The C side produced
`"Enter string\nhello"`. They didn't match.

**What I learned:** When `inputBuffer` is set, `readLineFromStdin()` is in
"simulated" mode and echoes each input line back through `writeOutput`. That echo
is intentional (mirrors a real terminal), but it diverges from C's `fgets` which
silently consumes stdin. Running lccjs via `spawnSync` with piped stdin takes the
non-simulated path — input is consumed but not echoed — so both sides behave the
same way.

**The rule:** For input-bearing parity tests comparing C and lccjs stdout, use
`spawnSync` with `{ input: stdinString }` on both sides. `inputBuffer` is correct
for unit tests that inspect `interpreter.output`, not for side-by-side stdout
comparison. (#760 tracks codifying this in `RULES.md`.)

---

## 4. `test.failing` documents bugs better than `test.skip`

**What happened:** Six parity tests and one demo-016 test had known failures.
Initial instinct was `test.skip`. But the issue had filed them as bugs to fix.

**What I learned:** Jest's `test.failing(name, fn)` is the right tool: the test
*runs*, is expected to fail, and is reported as passing (confirming the bug is
present). When the underlying bug is fixed, `test.failing` *itself* fails — alerting
the developer to remove the annotation. `test.skip` hides the failure permanently
and gives no signal when things improve.

**The rule:** Use `test.failing` for confirmed bugs with open fix tickets.
Use `test.skip` only for tests that are fundamentally incompatible (e.g.
demo-006's platform-specific `%p` pointer address, demo-034's linker dependency).
(#761 tracks codifying this in `RULES.md`.)

---

## What landed

| Ticket | Artifact | Change |
|---|---|---|
| #712 | `tests/new/textbook-demos.parity.spec.js` | 34-demo C/assembly parity suite; 25 pass, 6 `test.failing`, 3 `test.skip` |
| #742 | `textbook_demos/…/demo-016-tail-recursion.a` | Removed stale `s` debug trap; parity suite gains one clean pass |
| #747 | `tests/new/lcc.integration.spec.js` | 4 new `-nostats` tests covering `.a`/`.hex`/`.bin` paths + output-parity probe |
| #734 | `docs/playground/index.html` | Filename input field (`program.a` default, `.a` validation, `getFilename()` helper) |
| #756 | GitHub issue | `.e` format verification ticket filed |

## Open threads

- #743 demo-006 pointer-address skip needs a redesigned C comparison
- #744 demo-034 needs a linker startup stub for argc/argv
- #745 `npm run test:parity` convenience script
- #756 `.e` format verification test (the `oC` preamble lesson)
- #758–#761 authority-path tickets for the four rules above
