# Error-ID catalog, stability policy & prefix registry

_Audience: contributors, AI agents · Tier: reference_

Every diagnostic LCC.js can emit has (or is being given) a **unique, citable, stable
error ID** of the form `<prefix>-NNN` — e.g. `asm-014`, `int-004`, `lnk-011`. IDs let a
learner, teacher, or bug report name an exact condition (`"I hit int-004"`) instead of
pasting a wall of output, and let docs and tests reference a condition by a name that does
not drift when the human-readable message is reworded.

IDs are **off by default** — they surface inline only under the `--show-err-id` flag, so
the default output stays byte-identical to the oracle. See [`--show-err-id`
behavior](#--show-err-id-behavior) below.

> **Scope.** This catalog is for **toolchain diagnostics** — the errors the assembler,
> interpreter, and linker raise while processing a user's program. It is unrelated to the
> agent-workflow *error-logging vocabulary* in [`errors-schema.md`](./errors-schema.md) /
> [`errors-lookup.md`](./errors-lookup.md) (those `TOOL_DENIED`/`GIT_FAIL`/… codes classify
> *agent* mistakes, not user-program errors).

Source of truth for the minted tables is [`src/utils/errorIds.js`](../src/utils/errorIds.js);
a coverage-guard test (`tests/new/error-ids.spec.js`) asserts every error literal in the
source resolves to an id here, so the catalog cannot silently rot.

---

## Stability policy

IDs are a **published API**. Treat them the way you would treat a serialized wire format:

1. **Append-only.** New conditions get the next unused number for their prefix. Numbers are
   never reused and never renumbered — a retired condition's number stays retired (a "tombstone"),
   it is not recycled for something else.
2. **Message-independent.** An ID names a *condition*, not a *string*. Reword the
   human-readable message freely; the ID stays put. (In the assembler, IDs are keyed by the
   **normalized** message — the runtime `: ${x}` interpolation and the verbose `Did you mean
   '…'?` suffix are stripped first — so one ID covers a condition regardless of call site or
   which method emits it. The interpreter and linker carry the ID **inline** on the typed
   error because their messages don't normalize cleanly.)
3. **One ID per condition, across call sites.** If the same logical error is thrown from five
   places, all five resolve to the same ID.
4. **Zero-padded three digits** within a prefix (`asm-001` … `asm-030`). A prefix reaching
   `-999` is not anticipated; if it ever does, that is a spec change, not a silent rollover.
5. **Validated at load time.** `validateErrorIds()` runs at `require()` and throws on a
   malformed (`/^(?:asm|int|lnk)-\d{3}$/`) or duplicate ID, so a bad ID breaks the build
   rather than shipping.

Changing an existing ID's *number* is a **breaking change** and must not be done. Retiring a
condition is fine — drop the throw site, leave the table row (or a comment tombstone) so the
number is never reused.

---

## Prefix registry

Each toolchain component owns a prefix. Minted prefixes have a live table in
`errorIds.js`; reserved prefixes are claimed here so future work doesn't collide, but have no
IDs minted yet.

| Prefix | Component | Source | Status |
|--------|-----------|--------|--------|
| `asm`  | Assembler diagnostics | [`src/core/assembler.js`](../src/core/assembler.js) → `ASM_ERROR_IDS` | **minted** — `asm-001`…`asm-030` |
| `int`  | Interpreter / runtime diagnostics | [`src/core/interpreter.js`](../src/core/interpreter.js) → `INT_ERROR_IDS` | **minted** — `int-001`…`int-016` |
| `lnk`  | Linker diagnostics | [`src/core/linker.js`](../src/core/linker.js) → `LNK_ERROR_IDS` | **minted** — `lnk-001`…`lnk-011` |
| `ilcc` | Interactive stepping debugger | [`src/interactive/ilcc.js`](../src/interactive/ilcc.js) | **reserved** — not yet minted |
| `hex`  | `.hex` / `.bin` ASCII-loader parsing | [`src/core/interpreter.js`](../src/core/interpreter.js), [`src/cli/lcc.js`](../src/cli/lcc.js) | **reserved** — not yet minted |
| `pic`  | File-"picture" viewer | [`src/utils/picture.js`](../src/utils/picture.js) | **reserved** — not yet minted |
| `dis`  | Disassembler | [`src/extra/disassembler.js`](../src/extra/disassembler.js) | **reserved** — not yet minted |

To mint a reserved prefix: add its table to `errorIds.js`, extend the
`/^(?:asm|int|lnk)-\d{3}$/` validation pattern, and wire the coverage-guard test to the new
source module — then fill in its section below.

---

## `--show-err-id` behavior

- **Off by default.** Without the flag, output is byte-identical to the historical/oracle
  form — IDs are never printed.
- **`--show-err-id`** renders the ID inline. For the assembler the ID is folded into the
  message; for interpreter/linker errors the exit path converges on the consistent
  `Error [<id>]: <message>` form (the `<prefix> running <file>:` wrapper is dropped in favor
  of the citable ID).
- **Combinable with `--explain`.** IDs stay hidden under bare `--explain`; pass both
  (`--explain --show-err-id`) to get the student-friendly explanation block *and* the citable
  ID. The two flags are independent — `--explain` keys off the `explainKey` column below,
  `--show-err-id` off the ID column.

Wiring lives in [`src/utils/cliExit.js`](../src/utils/cliExit.js) (`withErrorId`,
`setShowErrId`) and is flipped by the CLI driver in [`src/cli/lcc.js`](../src/cli/lcc.js).

---

## Catalog

The **Explain key** column links a condition to the `--explain` student-explanation catalog
([`src/utils/explanations.js`](../src/utils/explanations.js)); `—` means no explanation entry
exists (yet) for that condition — the ID still works, only the `--explain` block is absent.

### `asm` — Assembler (`asm-001` … `asm-030`)

| ID | Message | Explain key | Condition |
|----|---------|-------------|-----------|
| `asm-001` | Bad label | `BAD_LABEL` | A label is malformed (bad characters, starts wrong, or is a reserved token). |
| `asm-002` | Duplicate label | `DUPLICATE_LABEL` | The same label is defined more than once. |
| `asm-003` | Program too big | `PROGRAM_TOO_BIG` | Assembled image exceeds the 16-bit address space. |
| `asm-004` | Missing operand | — | An instruction/directive is missing a required operand. |
| `asm-005` | Missing register | `REGISTER` | A register operand was expected but not supplied. |
| `asm-006` | Bad number | — | A numeric operand is not a valid number. |
| `asm-007` | Missing number | — | A numeric operand was expected but not supplied. |
| `asm-008` | Bad operand--not a valid label | `BAD_OPERAND_LABEL` | An operand that must be a label is not one. |
| `asm-009` | Undefined label | `UNDEFINED_LABEL` | A referenced label is never defined in the module. |
| `asm-010` | Missing terminating quote | — | A `.string`/char literal is missing its closing quote. |
| `asm-011` | Invalid operation | `INVALID_OPERATION` | The mnemonic is not a recognized operation. |
| `asm-012` | Bad register | `REGISTER` | A register token is malformed (e.g. not `r0`–`r7`). |
| `asm-013` | pcoffset9 out of range | `PCOFFSET9_RANGE` | A PC-relative target is outside the signed 9-bit range. |
| `asm-014` | pcoffset9 out of range for ld | `PCOFFSET9_RANGE` | `ld` target is outside the signed 9-bit PC-relative range. |
| `asm-015` | pcoffset9 out of range for st | `PCOFFSET9_RANGE` | `st` target is outside the signed 9-bit PC-relative range. |
| `asm-016` | pcoffset11 out of range | `PCOFFSET11_RANGE` | A `bl` target is outside the signed 11-bit PC-relative range. |
| `asm-017` | invalid header entry error | — | A malformed entry was found while emitting the object/exe header. |
| `asm-018` | Invalid number for .org directive | `ORG_DIRECTIVE` | `.org` operand is not a valid address. |
| `asm-019` | Backward address on .org | `ORG_DIRECTIVE` | `.org` tries to move the location counter backward. |
| `asm-020` | String constant missing leading quote | — | A string constant does not start with a quote. |
| `asm-021` | malformed character literal | `MALFORMED_CHAR_LITERAL` | A `'x'` character literal is malformed. |
| `asm-022` | Unknown escape sequence | — | An escape (`\?`) in a literal is not recognized. |
| `asm-023` | Invalid mnemonic | — | The token in the mnemonic position is not a known instruction. |
| `asm-024` | Invalid escape sequence | — | An escape sequence is syntactically invalid. |
| `asm-025` | Character literal must contain exactly one character | `MULTICHAR_CHAR_LITERAL` | A `'…'` literal holds zero or several characters. |
| `asm-026` | Unspecified label error for | — | A label error with no more specific category. |
| `asm-027` | imm5 out of range | `IMM5_RANGE` | An immediate is outside the signed 5-bit field. |
| `asm-028` | offset6 out of range | — | An offset is outside the signed 6-bit field. |
| `asm-029` | mov immediate value out of range | `IMM9_RANGE` | A `mov` immediate is outside its 9-bit range. |
| `asm-030` | mvi immediate out of range | `IMM9_RANGE` | An `mvi` immediate is outside its 9-bit range. |

### `int` — Interpreter / runtime (`int-001` … `int-016`)

| ID | Message | Explain key | Condition |
|----|---------|-------------|-----------|
| `int-001` | Floating point exception | `DIV_BY_ZERO` | Integer divide/remainder by zero at runtime. |
| `int-002` | Unknown opcode | `UNKNOWN_OPCODE` | The fetched instruction has an unrecognized opcode. |
| `int-003` | Unknown extended opcode | `UNKNOWN_OPCODE` | A `TRAP`/extended-opcode form is unrecognized. |
| `int-004` | sin: unexpected EOF on stdin | `EOF_ON_STDIN` | `sin` (string input) hit end-of-input before completing. |
| `int-005` | din: unexpected EOF on stdin | `EOF_ON_STDIN` | `din` (decimal input) hit end-of-input before completing. |
| `int-006` | hin: unexpected EOF on stdin | `EOF_ON_STDIN` | `hin` (hex input) hit end-of-input before completing. |
| `int-007` | ain: unexpected EOF on stdin | `EOF_ON_STDIN` | `ain` (ASCII input) hit end-of-input before completing. |
| `int-008` | Trap vector out of range | `TRAP_VECTOR_RANGE` | A `TRAP` vector is outside the valid table range. |
| `int-009` | software breakpoint | — | Execution hit a software breakpoint (`-d`/debug context). |
| `int-010` | is not in lcc format | `NOT_LCC_FORMAT` | The input file does not start with a valid LCC signature. |
| `int-011` | Invalid file signature | `NOT_LCC_FORMAT` | The file's magic/signature bytes are not recognized. |
| `int-012` | Incomplete start address in header | `BAD_EXE_HEADER` | The executable header's start-address entry is truncated. |
| `int-013` | Incomplete G entry in header | `BAD_EXE_HEADER` | A `G` (global) header entry is truncated. |
| `int-014` | Incomplete A entry in header | `BAD_EXE_HEADER` | An `A` (relocation) header entry is truncated. |
| `int-015` | Unknown header entry | `BAD_EXE_HEADER` | The header contains an entry tag the loader doesn't know. |
| `int-016` | is not a valid LCC executable file | `NOT_LCC_FORMAT` | The file is not a loadable LCC executable. |

### `lnk` — Linker (`lnk-001` … `lnk-011`)

| ID | Message | Explain key | Condition |
|----|---------|-------------|-----------|
| `lnk-001` | not a linkable file | `NOT_LINKABLE` | An input given to the linker is not an object module. |
| `lnk-002` | Invalid S entry | `BAD_OBJECT_HEADER` | A malformed `S` (start) entry in an object header. |
| `lnk-003` | Invalid `{entryType}` entry | `BAD_OBJECT_HEADER` | A malformed header entry (`{entryType}` is filled at runtime, e.g. `Invalid A entry`). |
| `lnk-004` | Unterminated label in entry | `BAD_OBJECT_HEADER` | A label in a header entry has no terminating NUL. |
| `lnk-005` | Invalid A entry | `BAD_OBJECT_HEADER` | A malformed `A` (relocation) entry in an object header. |
| `lnk-006` | Unknown header entry in file | `BAD_OBJECT_HEADER` | An object header contains an unrecognized entry tag. |
| `lnk-007` | is not a linkable module | `BAD_OBJECT_HEADER` | The file isn't a well-formed linkable module. |
| `lnk-008` | Multiple entry points | `MULTIPLE_ENTRY` | More than one module declares a program entry point. |
| `lnk-009` | More than one global declaration | `MULTIPLE_GLOBAL` | The same global symbol is declared in multiple modules. |
| `lnk-010` | Invalid header entry | — | A header entry is invalid with no more specific category. |
| `lnk-011` | undefined external reference | `UNDEFINED_EXTERN` | An `.extern` symbol is referenced but never defined by any module. |

---

## For teachers

The IDs are designed so a course can cite a specific diagnostic in an assignment rubric or
handout — e.g. *"if you see `asm-013`, your branch target is too far away"* — and have that
reference stay valid across LCC.js releases even if the wording of the message changes. Have
students run with `--explain --show-err-id` to get both the explanation and the citable ID.
See the [teacher audience notes](./who_lccjs_is_for.md#teacher--educator) for how the
diagnostics fit the classroom use case.
