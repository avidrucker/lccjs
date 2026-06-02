# TIL 2026-06-02 — DRAGONFRUIT

## The executor and disassembler can decode the same field at different widths — silently

**What happened:** While researching #481 (trap opcode layout), I found that the OP_EXT
executor extracts the extended opcode as `ir & 0x1F` (5 bits, range 0–31), but the
disassembler in `mnemonicForMachineWord` extracts the same field as `hex & 0x000F`
(4 bits, range 0–15). The two paths have silently disagreed since `rand` was added at
eopcode 14 — they happen to agree there, but any instruction at eopcode 16+ (e.g.
`slen`, planned in #482) would execute correctly and disassemble wrong.

**What I learned:** When an interpreter has two separate code paths for the same
instruction word — one that *runs* it and one that *names* it — the widths of every
field extraction must match. A narrower mask in the disassembler doesn't crash; it
silently maps the new instruction onto a recycled name or `Unknown(...)`. That kind of
wrong-but-quiet mismatch is the hardest to spot in review because the feature appears
to work.

The fix is one character (`0x000F` → `0x001F`), but it's easy to miss when adding a
new mnemonic because you only touch the encoder and the executor — the disassembler
path is a separate function in a different part of the file.

**The rule I'm adding to my pre-ship checklist for new OP_EXT instructions:**

> After wiring up a new eopcode: grep for every place the instruction word is decoded
> (encoder, executor, disassembler, listing printer) and verify the field masks are
> consistent. Widen any that are narrower than the executor's.

**Filed as:** #496 — prerequisite for any eopcode ≥16 mnemonic.

**Why it's easy to miss:** the disassembler is only exercised by the `.lst` listing
output and the interactive debugger — paths that many test programs never hit. Unit
tests that only check `stdout` will pass even when disassembly is broken.
