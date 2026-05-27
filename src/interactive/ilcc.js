// ilcc.js — Interactive LCC CLI driver
// Mirrors src/core/lcc.js but uses IInterpreter instead of Interpreter.
// Calls interpreter.runInteractive(sourceMap) instead of interpreter.run().
//
// Usage:  node ilcc.js <input.a>  [flags]
// Flags:  same as lcc.js, plus:
//   -e   efficient mode — disables snapshot log (forward-only, lower memory)
//   -c   colorblind mode — alternate ANSI color palette
//
// See also: src/interactive/iinterpreter.js

'use strict';

// @todo #88:30m/DEV Create ilcc.js driver: require IInterpreter; build sourceMap from assembler listing; call runInteractive(sourceMap) (OB-045)
throw new Error('OB-045 not yet implemented — see @todo #88');
