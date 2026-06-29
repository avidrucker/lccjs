'use strict';

// Opcode bases — bits 15–12 of a machine word (top nibble shifted into position)
const OPCODE_BR   = 0x0000; // opcode  0 — BR (branch)
const OPCODE_ADD  = 0x1000; // opcode  1 — ADD
const OPCODE_LD   = 0x2000; // opcode  2 — LD
const OPCODE_ST   = 0x3000; // opcode  3 — ST
const OPCODE_BL   = 0x4000; // opcode  4 — BL / BLR (branch-and-link)
const OPCODE_AND  = 0x5000; // opcode  5 — AND
const OPCODE_LDR  = 0x6000; // opcode  6 — LDR
const OPCODE_STR  = 0x7000; // opcode  7 — STR
const OPCODE_CMP  = 0x8000; // opcode  8 — CMP
const OPCODE_NOT  = 0x9000; // opcode  9 — NOT
const OPCODE_EXT  = 0xA000; // opcode 10 — extended group (SRL/SRA/SLL/ROL/ROR/PUSH/POP/MUL/DIV/REM/OR/XOR/MVR/SEXT)
const OPCODE_SUB  = 0xB000; // opcode 11 — SUB
const OPCODE_JMP  = 0xC000; // opcode 12 — JMP / RET
const OPCODE_MVI  = 0xD000; // opcode 13 — MVI
const OPCODE_LEA  = 0xE000; // opcode 14 — LEA
const OPCODE_TRAP = 0xF000; // opcode 15 — TRAP (HALT, NL, DOUT, …)

// Core trap vectors — bits 7–0 of a TRAP word
const TRAP_HALT  = 0x00;
const TRAP_NL    = 0x01;
const TRAP_DOUT  = 0x02;
const TRAP_UDOUT = 0x03;
const TRAP_HOUT  = 0x04;
const TRAP_AOUT  = 0x05;
const TRAP_SOUT  = 0x06;
const TRAP_DIN   = 0x07;
const TRAP_HIN   = 0x08;
const TRAP_AIN   = 0x09;
const TRAP_SIN   = 0x0A;
const TRAP_M     = 0x0B;
const TRAP_R     = 0x0C;
const TRAP_S     = 0x0D;
const TRAP_BP    = 0x0E;

// Sound trap — a high-vector (0xF8) trap that is LCC+'s by origin but becomes a
// gated CORE feature under `--sounds-on` (#1503, ADR docs/research/1502-sounds-in-core-lcc.md).
// Defined here (the neutral constants module) so core can import it without
// depending on src/plus; src/plus/constants.js re-exports it for back-compat.
const TRAP_SOUND = 0x00F8;
const TRAP_SOUND_LITERAL_FLAG = 0x0100;

// Extended sub-opcodes — bits 4–0 of an EXT word (eopcode field)
const EOP_PUSH = 0x00;
const EOP_POP  = 0x01;
const EOP_SRL  = 0x02;
const EOP_SRA  = 0x03;
const EOP_SLL  = 0x04;
const EOP_ROL  = 0x05;
const EOP_ROR  = 0x06;
const EOP_MUL  = 0x07;
const EOP_DIV  = 0x08;
const EOP_REM  = 0x09;
const EOP_OR   = 0x0A;
const EOP_XOR  = 0x0B;
const EOP_MVR  = 0x0C;
const EOP_SEXT = 0x0D;

module.exports = {
  OPCODE_BR, OPCODE_ADD, OPCODE_LD, OPCODE_ST, OPCODE_BL, OPCODE_AND,
  OPCODE_LDR, OPCODE_STR, OPCODE_CMP, OPCODE_NOT, OPCODE_EXT, OPCODE_SUB,
  OPCODE_JMP, OPCODE_MVI, OPCODE_LEA, OPCODE_TRAP,
  TRAP_HALT, TRAP_NL, TRAP_DOUT, TRAP_UDOUT, TRAP_HOUT, TRAP_AOUT, TRAP_SOUT,
  TRAP_DIN, TRAP_HIN, TRAP_AIN, TRAP_SIN, TRAP_M, TRAP_R, TRAP_S, TRAP_BP,
  TRAP_SOUND, TRAP_SOUND_LITERAL_FLAG,
  EOP_PUSH, EOP_POP, EOP_SRL, EOP_SRA, EOP_SLL, EOP_ROL, EOP_ROR,
  EOP_MUL, EOP_DIV, EOP_REM, EOP_OR, EOP_XOR, EOP_MVR, EOP_SEXT,
};
