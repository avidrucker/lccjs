# interpreter-stack.feature — jest-cucumber BDD (#1293; tracker #1269, harness #1252).
#
# Living documentation of the interpreter's stack instructions (push/pop), via the
# real CLI. push stores a register at the stack pointer (decrementing sp); pop
# loads from it (incrementing sp). Scenarios pop values and print them to show the
# round-trip and last-in-first-out order. Byte-for-byte parity stays with *.oracle.e2e.

Feature: Interpreter stack operations
  As a programmer using a stack
  I want push and pop to save and restore values in last-in-first-out order
  So that I can spill registers and build call frames

  Scenario: push then pop round-trips a value
    Given a source file "rt.a" containing:
      """
          mov r0, 42
          push r0
          pop r1
          dout r1
          halt
      """
    When I run lcc on "rt.a"
    Then the program prints "42"

  Scenario: two pushes pop back in last-in-first-out order
    Given a source file "lifo.a" containing:
      """
          mov r0, 1
          push r0
          mov r0, 2
          push r0
          pop r1
          dout r1
          nl
          pop r2
          dout r2
          halt
      """
    When I run lcc on "lifo.a"
    Then "2" and "1" appear on separate lines
