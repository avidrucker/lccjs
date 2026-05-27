// interactive.unit.spec.js — Unit tests for IInterpreter (interactive stepping debugger)
//
// @todo #91:45m/DEV Write tests for IInterpreter backward stepping correctness (OB-046):
//   - After 3 forward steps: currentIteration === 3, snapshot.length === 4
//   - After 3 forward + 2 backward: currentIteration === 1, registers match snapshot[1]
//   - After 3 forward + 5 backward: clamps at 0
//   - ST instruction + backward step: memory correctly restored
//   - Efficient mode: backward step throws or is ignored
//
// @todo #94:45m/DEV Write tests for IInterpreter display pane format correctness (OB-047):
//   - displayRegisters(): output contains 'r0:', 'fp:', 'sp:', 'lr:', 'NZCV:'
//   - displayRegisters(): changed register is visually marked differently
//   - displayMemory(0, 1): output contains '0000:' and 8 hex words
//   - displayMemory(0x10, 1): output starts with '0010:'
//   - displayStack(): output contains the word at the SP address

describe('IInterpreter Unit Tests', () => {
  // Tests will be added here as OB-037 through OB-044 are resolved.
  // OB-046 (#91): backward stepping correctness
  // OB-047 (#94): display pane format correctness
  test.todo('OB-046: backward stepping — resolve #90/#93/#96 first');
  test.todo('OB-047: display format — resolve #90/#98/#89/#92 first');
});
