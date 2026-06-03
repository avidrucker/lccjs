// browser-entry.js — spike entry point for #591.
// Exports the two in-memory API surfaces needed for browser use.
// Consumer example (after bundling):
//
//   const asm = new lcc.Assembler();
//   const buf = asm.assembleSource(src);
//   const interp = new lcc.Interpreter({ write: m => (output += m) });
//   interp.executeBuffer(buf, { inputBuffer: 'hello\n' });

const Assembler = require('../src/core/assembler');
const Interpreter = require('../src/core/interpreter');

module.exports = { Assembler, Interpreter };
