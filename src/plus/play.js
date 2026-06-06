// src/plus/play.js
//
// Spike prototype for #896: LCC+ play-mnemonic extension module.
//
// This module demonstrates the registration contract. It is loaded only when
// lccplus.js receives --play / -p; without that flag the mnemonics defined here
// are absent from the instruction table and any attempt to assemble them yields
// a standard "unknown mnemonic" error.
//
// == Extension contract ==
//
//   mnemonics
//     An object mapping mnemonic name → { trapVec, operandShape }.
//     AssemblerPlus.registerExtension() sees a `trapVec` property and
//     auto-generates the encoder: (ops) => this.assembleTrap(ops, trapVec).
//     Complex mnemonics that need a custom encoder (e.g. rand's two-register
//     form) export getMnemonics(assembler) instead and build the entry directly.
//
//   trapHandlers
//     An object mapping trap vector → function.
//     Each function is bound to the InterpreterPlus instance on registration
//     (fn.bind(this)), so `this.r`, `this.dr`, `this.sr`, etc. are available.
//     InterpreterPlus.registerExtension() stores them in _extTrapHandlers;
//     executeTRAP() dispatches there before its switch, so no switch case is
//     needed in core for any play mnemonic.
//
// == Trap vector allocation ==
//   Play vectors occupy 0x00F0–0x00F4, below the core-plus range 0x00F5–0x00FF.
//   Add new play vectors at the top of this block (decrement from 0x00F4 down).
//
//   0x00F4  TRAP_FLASH   — clear screen (demo mnemonic for this spike)
//   0x00F3  (available)
//   0x00F2  (available)
//   0x00F1  (available)
//   0x00F0  (available)
//
// To add a new play mnemonic (example: "buzz"):
//   1. Add const TRAP_BUZZ = 0x00F3; here.
//   2. Add  buzz: { trapVec: TRAP_BUZZ, operandShape: '(none)' }  to mnemonics.
//   3. Add  [TRAP_BUZZ]() { process.stdout.write('\x07\x07'); }   to trapHandlers.
//   4. Done — no changes to assemblerplus.js, interpreterplus.js, or constants.js.

const TRAP_FLASH = 0x00F4;

module.exports = {
  mnemonics: {
    flash: { trapVec: TRAP_FLASH, operandShape: '(none)' },
  },

  trapHandlers: {
    [TRAP_FLASH]() {
      // ANSI ED2 (erase display) + cursor-home — same effect as console.clear()
      // but works inside the non-blocking loop without freezing the event queue.
      process.stdout.write('\x1b[2J\x1b[H');
    },
  },
};
