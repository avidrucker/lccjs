// iinterpreter.js — Interactive stepping debugger extending lccjs's core Interpreter
// Enables forward/backward step-through execution with time-travel via snapshot log.
//
// Architecture:
//   class IInterpreter extends Interpreter
//   - this.snapshot[]: per-instruction state delta (registers, flags, pc, ir, memory change)
//   - this.currentIteration: which snapshot index is current (0 = initial state)
//   - Efficient mode (-e): disables snapshots for long-running programs (forward-only)
//
// Entry point: src/interactive/ilcc.js (see @todo #88)
// Reference:   ItBeCharlie/interactive_lccjs/src/interactive/iinterpreter.js (~2405 lines)

'use strict';

const Interpreter = require('../core/interpreter');

class IInterpreter extends Interpreter {
  // @todo #90:45m/DEV Create IInterpreter constructor; init snapshot[], currentIteration, memoryChange; implement initSnapshot() (OB-037)
  constructor() {
    super();
    // snapshot system and efficient-mode flag go here
    throw new Error('OB-037 not yet implemented — see @todo #90');
  }

  // @todo #93:45m/DEV Override step(): save pre-step state, call super.step(), detect memory change, push logEntry to snapshot[] (OB-038)
  step() {
    throw new Error('OB-038 not yet implemented — see @todo #93');
  }

  // @todo #96:60m/DEV Implement handleSteps(N): forward N via step(); backward N via restoreFromTo() using snapshot deltas (OB-039)
  handleSteps(stepNumber) {
    throw new Error('OB-039 not yet implemented — see @todo #96');
  }

  // @todo #98:30m/DEV Implement displayRegisters(prevSnapshot, currSnapshot): show all 8 registers + flags; highlight changed values (OB-040)
  displayRegisters(prevSnapshot, currSnapshot) {
    throw new Error('OB-040 not yet implemented — see @todo #98');
  }

  // @todo #89:30m/DEV Implement displayMemory(baseAddr, rows): show rows×8 memory words as 'ADDR: w0 w1 ... w7'; highlight PC row (OB-041)
  displayMemory(baseAddr, rows) {
    throw new Error('OB-041 not yet implemented — see @todo #89');
  }

  // @todo #92:30m/DEV Implement displayStack(anchor): show N words around anchor (hex addr or register name); mark SP position (OB-042)
  displayStack(anchor) {
    throw new Error('OB-042 not yet implemented — see @todo #92');
  }

  // @todo #95:60m/DEV Implement displayCodeSnippet(sourceMap, contextRows): show current PC + N lines of context from sourceMap (OB-043)
  // BLOCKED by #77 (PC→source-line map must be built by assembler pass 2 and passed in)
  displayCodeSnippet(sourceMap, contextRows) {
    throw new Error('OB-043 not yet implemented (blocked by #77) — see @todo #95');
  }

  // @todo #97:45m/DEV Implement runInteractive(sourceMap): prompt loop — renderDisplay, read command, dispatch handleSteps/config/quit (OB-044)
  runInteractive(sourceMap) {
    throw new Error('OB-044 not yet implemented — see @todo #97');
  }
}

module.exports = IInterpreter;
