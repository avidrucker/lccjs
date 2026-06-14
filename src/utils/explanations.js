// explanations.js — the --explain catalog (#1096).
//
// A keyed table of student-friendly explanations for the toolchain's error
// classes. Each entry teaches the underlying concept and shows a correct form.
// Errors map to an entry via a stable `explainKey` set at the throw site (NOT by
// matching the rendered message text, which interpolates values and may carry a
// suggestClosest "Did you mean?" suffix — see #1042 §2).
//
// Pure data + lookup: no console, no I/O. The render wrappers (assembler's
// formatAssemblerError, cliExit's exit helpers) own where the block is printed.
//
// pcoffset9 was wired end-to-end by the infra slice (#1096). The encoding/range
// batch (#1097) adds imm5/imm9/pcoffset11. The register + label/symbol batch
// (#1098) adds REGISTER, BAD_LABEL, UNDEFINED_LABEL, DUPLICATE_LABEL (assembler)
// and UNDEFINED_EXTERN, MULTIPLE_GLOBAL (linker). The directive + structural batch
// (#1099) adds ORG_DIRECTIVE, BAD_OPERAND_LABEL, INVALID_OPERATION, PROGRAM_TOO_BIG
// (assembler). The runtime/interpreter batch (#1100) adds DIV_BY_ZERO,
// TRAP_VECTOR_RANGE, UNKNOWN_OPCODE, EOF_ON_STDIN (interpreter; rendered via the
// cliExit seam). The linker + file-format batch (#1101) adds NOT_LINKABLE,
// BAD_OBJECT_HEADER, MULTIPLE_ENTRY (linker) and NOT_LCC_FORMAT, BAD_EXE_HEADER
// (interpreter file-format), completing the epic (#1042). Each entry is attached
// at its throw site; the render seams are formatAssemblerError (assembler) and
// cliExit's exit helpers plus the linker's own error() (linker/runtime/format).

'use strict';

const EXPLANATIONS = {
  PCOFFSET9_RANGE: {
    concept:
      'A branch/load/store target is encoded as a PC-relative offset in a signed ' +
      '9-bit field, so it must lie within -256..+255 words of the instruction that ' +
      'follows it. A label farther away than that cannot be reached by this form.',
    correctForm:
      'Move the label nearer, or load its address into a register first ' +
      '(e.g. `lea r0, far_label`) and use the register-indirect form.',
  },
  PCOFFSET11_RANGE: {
    concept:
      'A bl/jsr target is encoded as a PC-relative offset in a signed 11-bit field, ' +
      'so it must lie within -1024..+1023 words of the following instruction.',
    correctForm:
      'Place the callee within range, or compute its address in a register and ' +
      'call through the register form.',
  },
  IMM5_RANGE: {
    concept:
      'An immediate operand on a register/immediate instruction (e.g. add, sub) is ' +
      'encoded in a signed 5-bit field, so it must lie within -16..15. A literal ' +
      'outside that window cannot be encoded inline.',
    correctForm:
      'Use a value in -16..15, or load the constant into a register first ' +
      '(e.g. `mvi r2, 1000`) and use the register-register form (e.g. `add r0, r1, r2`).',
  },
  IMM9_RANGE: {
    concept:
      'A mov/mvi immediate is encoded in a signed 9-bit field, so it must lie ' +
      'within -256..255. A larger constant cannot be moved in a single immediate.',
    correctForm:
      'Use a value in -256..255, or store the constant in memory with `.word` and ' +
      'load it (e.g. `lea r0, k` then `ldr r0, r0, 0`, with `k: .word 30000`).',
  },

  // Register + label/symbol error classes (#1098).
  REGISTER: {
    concept:
      'The LCC has exactly eight general-purpose registers, r0 through r7, and a ' +
      'register operand is encoded in a 3-bit field — so there is no r8 or higher. ' +
      'Three registers also have conventional aliases by calling convention: ' +
      'r5=fp (frame pointer), r6=sp (stack pointer), r7=lr (link register).',
    correctForm:
      'Name one of r0–r7 (or the aliases fp, sp, lr) wherever a register operand ' +
      'is required, e.g. `add r0, r1, r2`.',
  },
  BAD_LABEL: {
    concept:
      'A label definition is written at the start of a line and terminated by a ' +
      'colon, and a label name may contain only letters, digits, and underscores ' +
      'and may not begin with a digit. Text that does not fit that shape cannot be ' +
      'read as a label.',
    correctForm:
      'Define a label at line start with a trailing colon (e.g. `loop:`), then ' +
      'reference it by name without the colon (e.g. `br loop`).',
  },
  UNDEFINED_LABEL: {
    concept:
      'Every label you reference must be defined somewhere in the program. A ' +
      'forward reference to a label defined later is fine — the assembler resolves ' +
      'it in pass 2 — but a label that is used and never defined (often a typo) ' +
      'cannot be resolved to an address.',
    correctForm:
      'Define the label (e.g. `done: halt`), correct the spelling to match an ' +
      'existing definition, or declare it `.extern` if it lives in another module.',
  },
  DUPLICATE_LABEL: {
    concept:
      'Each label may be defined only once: the assembler builds a single symbol ' +
      'table mapping each name to one address, so defining the same label twice is ' +
      'ambiguous.',
    correctForm:
      'Rename one definition so every label is unique, or remove the redundant one.',
  },
  UNDEFINED_EXTERN: {
    concept:
      'A symbol marked `.extern` in one module must be provided as a `.global` ' +
      'definition by exactly one of the modules being linked. An undefined external ' +
      'reference means none of the linked modules exports that symbol.',
    correctForm:
      'Add a `.global <name>` definition in the module that owns the symbol, include ' +
      'that module in the link command, or fix the name to match an existing global.',
  },
  MULTIPLE_GLOBAL: {
    concept:
      'Across all modules being linked, a symbol may be declared `.global` ' +
      '(exported) by only one module — the linker needs a single, unambiguous ' +
      'address for each global name.',
    correctForm:
      'Keep exactly one `.global` definition of the symbol (mark the others ' +
      '`.extern`), or rename the duplicates so each global is unique.',
  },

  // Directive + structural error classes (#1099).
  ORG_DIRECTIVE: {
    concept:
      'The `.org` directive sets the location counter — the address the next word ' +
      'is assembled at — to an absolute value, so its operand must be a number in ' +
      '0..65535. The counter only advances as code is laid down, so `.org` cannot ' +
      'rewind it to an address at or below the current position.',
    correctForm:
      'Give `.org` a numeric address (decimal or `0x` hex) within 0..0xFFFF that is ' +
      'ahead of the current location, e.g. `.org 0x3000`.',
  },
  BAD_OPERAND_LABEL: {
    concept:
      'Directives that name a symbol — `.start`, `.global`/`.globl`, `.extern` — ' +
      'take a single label name as their operand. The name must follow label ' +
      'syntax (letters, digits, and underscores, not beginning with a digit); a ' +
      'number or a malformed token cannot be read as a label here.',
    correctForm:
      'Pass one valid label name that matches a definition in the program, e.g. ' +
      '`.global main` or `.start main`.',
  },
  INVALID_OPERATION: {
    concept:
      'Every statement begins with either a known instruction mnemonic (e.g. add, ' +
      'ld, br, halt) or a directive (a token starting with `.`, e.g. `.word`). A ' +
      'leading token that matches neither cannot be assembled — usually a typo or a ' +
      'misplaced operand.',
    correctForm:
      'Use a valid instruction or directive name; under `-v`/`--verbose` the ' +
      'assembler suggests the closest match (e.g. `add` for `addd`).',
  },
  PROGRAM_TOO_BIG: {
    concept:
      'The LCC addresses memory with 16-bit addresses, so the entire program plus ' +
      'its data must fit within a 65536-word address space. Assembling past the ' +
      'final word would overflow that range.',
    correctForm:
      'Reduce the code or data so the total stays within 65536 words, e.g. by ' +
      'shrinking large `.blkw`/`.space` reservations.',
  },

  // Runtime / interpreter error classes (#1100).
  DIV_BY_ZERO: {
    concept:
      'The div and rem instructions divide the destination register by the ' +
      'source register; when that divisor register holds 0 the result is ' +
      'undefined, and the machine raises a "Floating point exception" (the ' +
      'conventional name for an integer divide-by-zero fault).',
    correctForm:
      'Ensure the divisor register is non-zero before div/rem — e.g. compare it ' +
      'against 0 and branch past the division when it is zero.',
  },
  TRAP_VECTOR_RANGE: {
    concept:
      'A trap instruction selects an OS service by an 8-bit trap vector, but only ' +
      'a small fixed set is defined (halt, the output/input traps such as nl, ' +
      'dout, sout, din, sin, and the breakpoint trap). A vector outside that set ' +
      'has no handler — often a sign that the program counter ran off the end of ' +
      'the code and is interpreting data as an instruction.',
    correctForm:
      'Use one of the defined trap mnemonics (e.g. halt, nl, dout, din, sin) and ' +
      'make sure the program halts before control falls through code into data.',
  },
  UNKNOWN_OPCODE: {
    concept:
      "An instruction word's top four bits select the operation, and case-10 " +
      'words further select an extended operation from a 5-bit sub-field. A word ' +
      'whose (extended) operation code is not one the machine defines cannot be ' +
      'executed — almost always corrupt or mis-assembled code, or the program ' +
      'counter running off into data and decoding it as an instruction.',
    correctForm:
      'Re-assemble from source so only valid instructions are emitted, and ensure ' +
      'the program halts (or branches away) before control reaches data.',
  },
  EOF_ON_STDIN: {
    concept:
      'The input traps (sin, din, hin, ain) read from standard input. This error ' +
      'means the trap tried to read but standard input was already at end-of-' +
      'stream — there was no more input to consume. In the batch toolchain stdin ' +
      'is whatever you pipe or redirect in, and once it is exhausted further input ' +
      'traps cannot succeed.',
    correctForm:
      'Supply enough input on stdin for every input trap the program runs — pipe ' +
      'or redirect it (e.g. `echo 5 | lcc prog.e` or `lcc prog.e < input.txt`) — ' +
      'or guard the read so the program never requests more input than is given.',
  },

  // Linker + file-format error classes (#1101). (Undefined-external references
  // are taught by UNDEFINED_EXTERN, added in #1098 — referenced, not re-authored.)
  NOT_LINKABLE: {
    concept:
      'The linker combines object modules, and every object file (`.o`) begins ' +
      'with an `o` signature byte followed by a header of S/G/E/e/V/A entries. A ' +
      'file that does not start that way is not a linkable object — commonly an ' +
      'executable (`.e`), an assembly source (`.a`), or some unrelated file passed ' +
      'to the linker by mistake.',
    correctForm:
      'Pass the `.o` object files produced by assembling each module (e.g. ' +
      '`lcc -c mod.a` then link the resulting `mod.o`), not `.e`/`.a` files.',
  },
  BAD_OBJECT_HEADER: {
    concept:
      "An object module's header is a sequence of typed entries (S for the start " +
      'address, G/E/e/V for symbols, A for an adjustment), each followed by its ' +
      'fixed-size payload. An entry whose payload runs past the end of the file, ' +
      'or an unrecognized entry type, means the object file is truncated or ' +
      'corrupt — not something the assembler would emit.',
    correctForm:
      'Re-assemble the module to regenerate a clean `.o`, and make sure the file ' +
      'was not truncated in transit or hand-edited.',
  },
  MULTIPLE_ENTRY: {
    concept:
      'Exactly one module in a link may set the program start address (the `S` ' +
      'entry produced by `.start`). When two or more modules each declare a start ' +
      'point, the linker cannot choose which one the program begins at.',
    correctForm:
      'Keep `.start` in a single module (typically the one with `main`) and remove ' +
      'it from the others.',
  },
  NOT_LCC_FORMAT: {
    concept:
      'An LCC executable (`.e`) must begin with the `o` signature byte; the ' +
      'interpreter checks it before loading. A file lacking that signature is not ' +
      'an LCC executable — often an assembly source or object file, or a file that ' +
      'was never assembled/linked.',
    correctForm:
      'Run a `.e` produced by the assembler/linker (e.g. assemble `prog.a` to ' +
      '`prog.e`, then `lcc prog.e`), not a `.a` source or `.o` object.',
  },
  BAD_EXE_HEADER: {
    concept:
      "An executable's header lists typed entries (S start address, G globals, A " +
      'adjustment) terminated by `C` before the code. A header that ends mid-entry ' +
      'or contains an unrecognized entry type means the file is truncated or ' +
      'corrupt rather than a complete LCC executable.',
    correctForm:
      'Re-assemble/re-link to regenerate the `.e`, and check the file was not ' +
      'truncated or modified after it was produced.',
  },
};

// Returns the { concept, correctForm } entry for a key, or null if the key is
// absent / falsy. Callers treat null as "no explanation available".
function getExplanation(key) {
  if (!key) return null;
  return Object.prototype.hasOwnProperty.call(EXPLANATIONS, key)
    ? EXPLANATIONS[key]
    : null;
}

// Renders the indented `explain:` block for a key, or null if there is no entry.
// Format: a distinct `explain:` prefix, with the correct-form line aligned under
// the concept text so it reads as one block, separate from the error line above.
function formatExplanation(key) {
  const entry = getExplanation(key);
  if (!entry) return null;
  return `explain: ${entry.concept}\n         ${entry.correctForm}`;
}

module.exports = { EXPLANATIONS, getExplanation, formatExplanation };
