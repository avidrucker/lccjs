# Domain Glossary — LCC / assembly acronyms

_Audience: students/learners, assembly enthusiasts, educators/teachers, contributors · Tier: reference, public_

Quick expansions of the **domain** acronyms & short terms used across the project.
For full LCC-specific *concept* definitions (load point, externs vs globals,
`.e`/`.o` format, opcode layout, …) see the per-module glossaries:
[`assembler.md`](./assembler.md) · [`interpreter.md`](./interpreter.md) ·
[`linker.md`](./linker.md).

| Acronym / term | Expansion | In this project |
|---|---|---|
| **LCC** | Low-Cost Computer | the educational 16-bit architecture + toolchain this project implements (after Prof. Dos Reis's original) |
| **LCC.js** / **lccjs** | — | the JavaScript implementation in this repo |
| **LCC+** | — | the extended toolchain (`.ap`/`.ep`, extra pseudo-instructions); see [`lccplus-isa.md`](../lccplus-isa.md) |
| **ISA** | instruction set architecture | the 16-bit LCC instruction set; see [`lcc-isa.md`](../lcc-isa.md) |
| **OG** | original | "OG LCC" = the original `cuh63` binary — the reference implementation, aka **the oracle** |
| **oracle** | — | the OG `cuh63` LCC binary used for differential parity testing |
| **PC** | program counter | the register holding the address of the next instruction |
| **sr / dr** | source register / destination register | the register operand fields in an instruction encoding |
| **imm** | immediate | a literal value baked into an instruction (e.g. `imm5`, `pcoffset9`) |
| **BEL** | bell | ASCII `0x07`; the audible/no-op fallback (e.g. LCC+ `sound`) |

**See also:** [`process.md`](./process.md) (workflow acronyms) · [`tech.md`](./tech.md) (tooling acronyms)
