# Spike: mnemonic→descriptor table design

**Ticket:** #253 · **Role:** ARC · **Agent:** CHERRY · **Model:** sonnet-4.6
**Parent:** #246 H2 — see `docs/research/codebase-quality-hotspots.md`

---

## As-is: two switch blocks + an inheritance seam

### `Assembler.handleInstruction` (assembler.js:1220–1390, 172 lines)

Pure dispatch: every case calls an `assemble*` method and writes back a `machineWord`.
The caller (`handleInstruction`) owns write + locCtr increment.

```js
switch (mnemonic) {
  case 'add':
    machineWord = this.assembleADD(operands); break;
  case 'br': case 'bral': case 'brz': /* …10 variants */
    machineWord = this.assembleBR(mnemonic, operands); break;
  // …42 more cases…
  default:
    this.error("Invalid operation"); return;
}
if (machineWord !== null) {
  this.writeMachineWord(machineWord);
  this.locCtr += 1;
}
```

The switch is **syntax-over-data**: the mnemonic→encoder mapping is control flow,
so it can't be enumerated or diffed against an ISA table.

### `Assembler.handleDirective` (assembler.js:1008–1217, 210 lines)

Superficially similar switch but structurally different: each case contains
multi-statement logic with pass-1/pass-2 conditionals, loops, and state mutations.
It is NOT a pure dispatch table. Tabling it requires first extracting each case
body into a helper method — a separate, higher-risk refactor.

### `AssemblerPlus.handleInstruction` (assemblerplus.js:96–141, 46 lines)

Opens a second switch for 7 LCC+-specific mnemonics, then delegates:

```js
switch (mnemonic) {
  case 'clear': machineWord = this.assembleTrap(ops, 0x000F);
    this.writeAndInc(machineWord); break;   // ← plus does write+inc itself
  // …6 more LCC+ cases…
  default:
    super.handleInstruction(mnemonic, operands); // ← parent does write+inc for core
}
```

Note the **asymmetric write ownership**: plus instructions are written inside the
switch; core instructions are written inside `super.handleInstruction`. A table design
must unify this.

### `AssemblerPlus.handleDirective` (assemblerplus.js:157–168)

Adds only `.lccplus` before `default: super.handleDirective()`. Too small to
motivate a full table; string matching is fine. Exclude from this spike scope.

---

## Mnemonic inventory

### Core instructions (handleInstruction switch)

| Mnemonic(s) | Encoder | Operand shape | Notes |
|-------------|---------|---------------|-------|
| `br` `bral` `brz` `bre` `brnz` `brne` `brn` `brp` `brlt` `brgt` `brc` `brb` | `assembleBR(mnemonic, ops)` | `label` | mnemonic-parameterized |
| `add` | `assembleADD(ops)` | `dr, sr1, sr2\|imm5` | |
| `sub` | `assembleSUB(ops)` | `dr, sr1, sr2\|imm5` | |
| `cmp` | `assembleCMP(ops)` | `sr1, sr2\|imm5` | |
| `mov` `mvi` `mvr` | `assembleMOV(mnemonic, ops)` | `dr, sr\|imm9` | mnemonic-parameterized |
| `push` | `assemblePUSH(ops)` | `sr` | |
| `pop` | `assemblePOP(ops)` | `dr` | |
| `srl` `sra` `sll` `rol` `ror` | `assembleSRL/SRA/SLL/ROL/ROR(ops)` | `sr[, ct]` | |
| `mul` `div` `rem` | `assembleMUL/DIV/REM(ops)` | `dr, sr` | |
| `or` `xor` | `assembleOR/XOR(ops)` | `dr, sr` | |
| `sext` | `assembleSEXT(ops)` | `dr, sr` | |
| `ld` | `assembleLD(ops)` | `dr, label` | |
| `st` | `assembleST(ops)` | `sr, label` | |
| `lea` `cea` | `assembleLea/CEA(ops)` | `dr, label` | |
| `call` `jsr` `bl` | `assembleBL(ops)` | `label` | |
| `jsrr` `blr` | `assembleBLR(ops)` | `baser[, offset6]` | |
| `and` | `assembleAND(ops)` | `dr, sr1, sr2\|imm5` | |
| `ldr` | `assembleLDR(ops)` | `dr, baser, offset6` | |
| `str` | `assembleSTR(ops)` | `sr, baser, offset6` | |
| `jmp` | `assembleJMP(ops)` | `baser[, offset6]` | |
| `ret` | `assembleRET(ops)` | `[offset6]` | |
| `not` | `assembleNOT(ops)` | `dr, sr` | |
| `halt` | returns `OP_TRAP` constant | *(none)* | |
| `nl` | returns `0xF001` constant | *(none)* | |
| `dout` `udout` `hout` `aout` `sout` `din` `hin` `ain` `sin` `m` `r` `s` `bp` | `assembleTrap(ops, vec)` | `[sr]` | trap vector captured in closure |

Total: ~45 key strings across ~28 encoder methods.

### LCC+ additions (assemblerplus.js switch)

| Mnemonic | Encoder | Trap vector |
|----------|---------|------------|
| `clear` | `assembleTrap(ops, 0x000F)` | 15 |
| `sleep` | `assembleTrap(ops, 0x0010)` | 16 |
| `nbain` | `assembleTrap(ops, 0x0011)` | 17 |
| `cursor` | `assembleTrap(ops, 0x0012)` | 18 |
| `srand` | `assembleTrap(ops, 0x0013)` | 19 |
| `rand` | `assembleRAND(ops)` | n/a |
| `millis` | `assembleTrap(ops, 0x0014)` | 20 |
| `resetc` | `assembleTrap(ops, 0x0015)` | 21 |

---

## Proposed table design

### Descriptor shape

```js
// Each entry maps a lowercased mnemonic to a descriptor.
// encoder(operands) returns a machineWord (number) or null (error already recorded).
// operandShape is documentation only — validation stays inside the encoder.
{
  encoder: (operands) => number|null,
  operandShape: string,          // e.g. 'dr, sr1, sr2|imm5'
}
```

`operandShape` is metadata for introspection (future: error messages, a disassembler
registry). It does NOT drive validation — each `assemble*` method still validates its
own operands.

### Table initialization in Assembler

Build `_instructionTable` as an instance property in `Assembler.constructor()` (not a
static — static would prevent per-instance inheritance for the plus subclass pattern):

```js
constructor() {
  // …existing fields…
  this._instructionTable = this._buildCoreTable();
}

_buildCoreTable() {
  return {
    // BR family — mnemonic passed to encoder for condition-code lookup
    'br':    { encoder: (ops) => this.assembleBR('br',   ops), operandShape: 'label' },
    'bral':  { encoder: (ops) => this.assembleBR('bral', ops), operandShape: 'label' },
    'brz':   { encoder: (ops) => this.assembleBR('brz',  ops), operandShape: 'label' },
    'bre':   { encoder: (ops) => this.assembleBR('bre',  ops), operandShape: 'label' },
    'brnz':  { encoder: (ops) => this.assembleBR('brnz', ops), operandShape: 'label' },
    'brne':  { encoder: (ops) => this.assembleBR('brne', ops), operandShape: 'label' },
    'brn':   { encoder: (ops) => this.assembleBR('brn',  ops), operandShape: 'label' },
    'brp':   { encoder: (ops) => this.assembleBR('brp',  ops), operandShape: 'label' },
    'brlt':  { encoder: (ops) => this.assembleBR('brlt', ops), operandShape: 'label' },
    'brgt':  { encoder: (ops) => this.assembleBR('brgt', ops), operandShape: 'label' },
    'brc':   { encoder: (ops) => this.assembleBR('brc',  ops), operandShape: 'label' },
    'brb':   { encoder: (ops) => this.assembleBR('brb',  ops), operandShape: 'label' },

    // MOV family — mnemonic passed to encoder for dispatch
    'mov':   { encoder: (ops) => this.assembleMOV('mov', ops), operandShape: 'dr, sr|imm9' },
    'mvi':   { encoder: (ops) => this.assembleMOV('mvi', ops), operandShape: 'dr, imm9' },
    'mvr':   { encoder: (ops) => this.assembleMOV('mvr', ops), operandShape: 'dr, sr' },

    // Arithmetic
    'add':   { encoder: (ops) => this.assembleADD(ops),  operandShape: 'dr, sr1, sr2|imm5' },
    'sub':   { encoder: (ops) => this.assembleSUB(ops),  operandShape: 'dr, sr1, sr2|imm5' },
    'and':   { encoder: (ops) => this.assembleAND(ops),  operandShape: 'dr, sr1, sr2|imm5' },
    'cmp':   { encoder: (ops) => this.assembleCMP(ops),  operandShape: 'sr1, sr2|imm5' },
    'not':   { encoder: (ops) => this.assembleNOT(ops),  operandShape: 'dr, sr' },
    'mul':   { encoder: (ops) => this.assembleMUL(ops),  operandShape: 'dr, sr' },
    'div':   { encoder: (ops) => this.assembleDIV(ops),  operandShape: 'dr, sr' },
    'rem':   { encoder: (ops) => this.assembleREM(ops),  operandShape: 'dr, sr' },
    'or':    { encoder: (ops) => this.assembleOR(ops),   operandShape: 'dr, sr' },
    'xor':   { encoder: (ops) => this.assembleXOR(ops),  operandShape: 'dr, sr' },
    'sext':  { encoder: (ops) => this.assembleSEXT(ops), operandShape: 'dr, sr' },

    // Shifts
    'srl':   { encoder: (ops) => this.assembleSRL(ops),  operandShape: 'sr[, ct]' },
    'sra':   { encoder: (ops) => this.assembleSRA(ops),  operandShape: 'sr[, ct]' },
    'sll':   { encoder: (ops) => this.assembleSLL(ops),  operandShape: 'sr[, ct]' },
    'rol':   { encoder: (ops) => this.assembleROL(ops),  operandShape: 'sr[, ct]' },
    'ror':   { encoder: (ops) => this.assembleROR(ops),  operandShape: 'sr[, ct]' },

    // Stack
    'push':  { encoder: (ops) => this.assemblePUSH(ops), operandShape: 'sr' },
    'pop':   { encoder: (ops) => this.assemblePOP(ops),  operandShape: 'dr' },

    // Memory
    'ld':    { encoder: (ops) => this.assembleLD(ops),   operandShape: 'dr, label' },
    'st':    { encoder: (ops) => this.assembleST(ops),   operandShape: 'sr, label' },
    'ldr':   { encoder: (ops) => this.assembleLDR(ops),  operandShape: 'dr, baser, offset6' },
    'str':   { encoder: (ops) => this.assembleSTR(ops),  operandShape: 'sr, baser, offset6' },
    'lea':   { encoder: (ops) => this.assembleLea(ops),  operandShape: 'dr, label' },
    'cea':   { encoder: (ops) => this.assembleCEA(ops),  operandShape: 'dr, imm5' },

    // Control flow
    'call':  { encoder: (ops) => this.assembleBL(ops),   operandShape: 'label' },
    'jsr':   { encoder: (ops) => this.assembleBL(ops),   operandShape: 'label' },
    'bl':    { encoder: (ops) => this.assembleBL(ops),   operandShape: 'label' },
    'jsrr':  { encoder: (ops) => this.assembleBLR(ops),  operandShape: 'baser[, offset6]' },
    'blr':   { encoder: (ops) => this.assembleBLR(ops),  operandShape: 'baser[, offset6]' },
    'jmp':   { encoder: (ops) => this.assembleJMP(ops),  operandShape: 'baser[, offset6]' },
    'ret':   { encoder: (ops) => this.assembleRET(ops),  operandShape: '[offset6]' },

    // Traps (register-bearing)
    'dout':  { encoder: (ops) => this.assembleTrap(ops, 0x0002), operandShape: '[sr]' },
    'udout': { encoder: (ops) => this.assembleTrap(ops, 0x0003), operandShape: '[sr]' },
    'hout':  { encoder: (ops) => this.assembleTrap(ops, 0x0004), operandShape: '[sr]' },
    'aout':  { encoder: (ops) => this.assembleTrap(ops, 0x0005), operandShape: '[sr]' },
    'sout':  { encoder: (ops) => this.assembleTrap(ops, 0x0006), operandShape: '[sr]' },
    'din':   { encoder: (ops) => this.assembleTrap(ops, 0x0007), operandShape: '[sr]' },
    'hin':   { encoder: (ops) => this.assembleTrap(ops, 0x0008), operandShape: '[sr]' },
    'ain':   { encoder: (ops) => this.assembleTrap(ops, 0x0009), operandShape: '[sr]' },
    'sin':   { encoder: (ops) => this.assembleTrap(ops, 0x000A), operandShape: '[sr]' },
    'm':     { encoder: (ops) => this.assembleTrap(ops, 0x000B), operandShape: '[sr]' },
    'r':     { encoder: (ops) => this.assembleTrap(ops, 0x000C), operandShape: '[sr]' },
    's':     { encoder: (ops) => this.assembleTrap(ops, 0x000D), operandShape: '[sr]' },
    'bp':    { encoder: (ops) => this.assembleTrap(ops, 0x000E), operandShape: '(none)' },

    // No-operand traps (constant machine word)
    'halt':  { encoder: (_ops) => 0xF000,  operandShape: '(none)' },
    'nl':    { encoder: (_ops) => 0xF001,  operandShape: '(none)' },
  };
}
```

### New dispatch loop

```js
handleInstruction(mnemonic, operands) {
  if (this.pass === 1) { this.locCtr += 1; return; }

  const desc = this._instructionTable[mnemonic.toLowerCase()];
  if (!desc) {
    this.error("Invalid operation");
    return;
  }
  const machineWord = desc.encoder(operands);
  if (machineWord !== null) {
    this.writeMachineWord(machineWord);
    this.locCtr += 1;
  }
}
```

172 lines → 10 lines. The `_buildCoreTable` method takes those 172 lines but turns
them into pure data that can be iterated, tested, and extended without modifying
`handleInstruction`.

---

## Plus registration

### The write-ownership fix (critical)

The current plus subclass does write+inc for plus instructions, then lets the parent
do write+inc for core instructions. After the table migration the dispatch loop owns
write+inc for everyone. The plus subclass drops `writeAndInc` calls entirely —
descriptors just return the word.

### AssemblerPlus with table registration

```js
class AssemblerPlus extends Assembler {
  constructor() {
    super();
    this.isLCCPlusFile = false;
    // Register LCC+ entries into the inherited table:
    const t = this._instructionTable;
    t['clear']  = { encoder: (ops) => this.assembleTrap(ops, 0x000F), operandShape: '[sr]' };
    t['sleep']  = { encoder: (ops) => this.assembleTrap(ops, 0x0010), operandShape: '[sr]' };
    t['nbain']  = { encoder: (ops) => this.assembleTrap(ops, 0x0011), operandShape: '[sr]' };
    t['cursor'] = { encoder: (ops) => this.assembleTrap(ops, 0x0012), operandShape: '[sr]' };
    t['srand']  = { encoder: (ops) => this.assembleTrap(ops, 0x0013), operandShape: '[sr]' };
    t['rand']   = { encoder: (ops) => this.assembleRAND(ops),         operandShape: 'dr, sr' };
    t['millis'] = { encoder: (ops) => this.assembleTrap(ops, 0x0014), operandShape: '[sr]' };
    t['resetc'] = { encoder: (ops) => this.assembleTrap(ops, 0x0015), operandShape: '[sr]' };
  }
  // handleInstruction override deleted entirely — parent's table lookup works for both
}
```

No more `default: super.handleInstruction()`. The parent's dispatch loop looks up the
table, finds the plus entry, runs it. No shadowing hazard: the table is flat and
visible. Adding a trap means adding one line in the constructor, not editing two switch
blocks.

### Plus handleDirective: no change needed

`AssemblerPlus.handleDirective` only adds `.lccplus` before `default: super.handleDirective()`.
It's 12 lines and perfectly readable. Leave it alone.

---

## handleDirective: defer to a follow-on ticket

`handleDirective` is **not** a pure dispatch table:

- `.org` / `.orig`: two-pass loop with `locCtr` mutation and validation
- `.blkw` / `.space` / `.zero`: pass-conditional write loops
- `.fill` / `.word`: label+offset parsing, `parseLabelWithOffset`, `A`-entry side effects
- `.stringz` / `.asciz` / `.string`: character-by-character write in pass 2

These cases have 10–25 lines of logic each. Tabling them requires first extracting
each body into a `_handleXxx(operands)` method — a non-trivial refactor that deserves
its own ticket, its own oracle regression run, and its own estimate.

**Verdict for this spike:** exclude `handleDirective` from the initial migration.
The gains of tabling it are real (same data-vs-control argument) but the risk is
higher and the benefit is lower (directives are rarely extended; instructions are).
File a scope ticket for it separately if desired.

---

## Migration risks and mitigations

| Risk | Details | Mitigation |
|------|---------|-----------|
| **Alias divergence** | `call`/`jsr`/`bl` all map to `assembleBL`; `brz`/`bre` to `assembleBR('brz')` — an alias could be forgotten or mapped to the wrong encoder | Table is declarative: list all aliases explicitly; a unit test that enumerates table keys and spot-checks a few encoders catches omissions |
| **write-ownership double-increment** | If a plus descriptor both calls `writeAndInc` AND returns a word, the parent loop writes a second time | Descriptor contract: return the word, never call `writeMachineWord` internally. One test: assemble a plus instruction, verify `outputBuffer.length === 1` |
| **Pass-1 invariant** | Both current `handleInstruction` overrides guard `if (this.pass === 1) { locCtr += 1; return; }` at the top — the new dispatch loop must preserve this before the table lookup | Already in the proposed dispatch loop; no regression risk |
| **`halt`/`nl` constant words** | Currently `halt → OP_TRAP` (0xF000) and `nl → 0xF001` as bare constants. The descriptor encoder ignores `operands` — that's fine, but the encoder must still return `null`-safely | Use `(_ops) => 0xF000` ignoring operands; `assembleTrap([], 0)` would also work if a register check isn't triggered |
| **Plus test coverage gap** | `tests/new/assemblerplus.unit.spec.js` tests LCC+ instructions; if it misses any of the 8 added mnemonics, a registration bug is invisible | Run the full test suite; add a smoke test that assembles each of the 8 plus mnemonics |
| **Oracle parity** | Any behavior change in the instruction encoding path breaks oracle parity | Run `npm run test:oracle` with `GOLDEN_AUTO_UPDATE=0` after each puzzle — zero diffs expected |

---

## Puzzle decomposition

**Puzzle A — Core instruction table** (~45m DEV)
- Add `_buildCoreTable()` to `Assembler`, call it in `constructor`
- Replace `handleInstruction` switch with table lookup
- Delete the old switch body
- Run `npm test` and `npm run test:oracle` — all pass, no diffs
- Files: `src/core/assembler.js` only

**Puzzle B — Plus registration cutover** (~25m DEV)
- In `AssemblerPlus.constructor()`, register the 8 LCC+ entries into `this._instructionTable`
- Delete `AssemblerPlus.handleInstruction` override and `writeAndInc` helper
- Run `npm test` — LCC+ suite passes
- Files: `src/plus/assemblerplus.js` only

**Puzzle C (optional) — Directive table** (~60m DEV, separate ticket)
- Extract each `handleDirective` case into `_handleXxxDirective(operands)` helper
- Build `_directiveTable`, replace switch
- Higher complexity / higher oracle-parity risk; estimate separately
- Scope: `src/core/assembler.js`, `src/plus/assemblerplus.js`

---

## Summary

The `handleInstruction` refactor is a clean data-over-control migration with low
behavioral risk: the encoder methods are unchanged, the table is transparent, and
oracle regression confirms parity. The main non-obvious concern is the plus subclass's
write-ownership asymmetry — unifying it under the parent dispatch loop is the right
fix and simplifies the subclass from 46 lines to ~10.

`handleDirective` is excluded from this scope; it requires a distinct approach and
carries higher risk for lower extension benefit.

After Puzzles A+B: `handleInstruction` is ~10 lines, `AssemblerPlus.handleInstruction`
is deleted entirely, and adding a new instruction or LCC+ trap is a single table entry.
The CLAUDE.md "silently shadowed" warning can be retired.
