// stateDelta.js — pure machine-state diff helpers for the debug / interactive layers.
//
// Canonical home for the register/flag diff computation shared across interpreter.js
// and iinterpreter.js. Pure functions — no machine state, no I/O, no formatting —
// so both the oracle-parity debugger and the interactive TUI share the "what changed"
// computation while each renders it itself.
//
// IMPORTANT — flags/pc are NOT fully shared by design:
//   The core oracle debugger (interpreter.js) renders flags/pc *fire-once* — it shows
//   <NZCV=…>/<pc=…> when an instruction SET them (this.flagsSet / this.hasJumped),
//   not when their value changed — because that is what the real `lcc` does and the
//   output is byte-exact-tested. So interpreter.js uses ONLY diffRegisters() here.
//   The value-based diffFlags()/pcChanged() below are for the interactive TUI, which
//   highlights on value change. Do not route interpreter.js flag/pc display through
//   diffFlags() — it would break oracle parity.

'use strict';

// diffRegisters(prevRegs, currRegs) — compare two 8-element register arrays.
// Returns the changed registers in index order: [{ i, oldVal, newVal }].
function diffRegisters(prevRegs, currRegs) {
  const changed = [];
  for (let i = 0; i < 8; i++) {
    if (prevRegs[i] !== currRegs[i]) {
      changed.push({ i, oldVal: prevRegs[i], newVal: currRegs[i] });
    }
  }
  return changed;
}

// diffFlags(prevFlags, currFlags) — value-based flag diff (interactive TUI).
// prev/curr are { n, z, c, v }. Returns { n, z, c, v } booleans: true where changed.
function diffFlags(prevFlags, currFlags) {
  return {
    n: prevFlags.n !== currFlags.n,
    z: prevFlags.z !== currFlags.z,
    c: prevFlags.c !== currFlags.c,
    v: prevFlags.v !== currFlags.v,
  };
}

// pcChanged(prevPc, currPc) — true if the program counter changed (value-based).
function pcChanged(prevPc, currPc) {
  return prevPc !== currPc;
}

module.exports = { diffRegisters, diffFlags, pcChanged };
