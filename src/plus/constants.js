'use strict';

// LCC+ extension trap vectors — occupy the HIGH end of the 8-bit space (0xFF
// down) so core traps can grow upward from 0x0F without collision.
const TRAP_CLEAR  = 0x00F9;
const TRAP_SLEEP  = 0x00FA;
const TRAP_NBAIN  = 0x00FB;
const TRAP_CURSOR = 0x00FC;
const TRAP_SRAND  = 0x00FD;
const TRAP_MILLIS = 0x00FE;
const TRAP_RESETC = 0x00FF;

// LCC+ extended sub-opcode — reuses the EOP slot above EOP_SEXT (0x0D)
const EOP_RAND = 0x0E;

module.exports = {
  TRAP_CLEAR, TRAP_SLEEP, TRAP_NBAIN, TRAP_CURSOR,
  TRAP_SRAND, TRAP_MILLIS, TRAP_RESETC,
  EOP_RAND,
};
