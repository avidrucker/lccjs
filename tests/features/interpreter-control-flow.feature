# interpreter-control-flow.feature — jest-cucumber BDD (#1290; tracker #1269, harness #1252).
#
# Living documentation of the interpreter's control-flow instructions, via the real
# CLI. Each scenario branches to a path that prints a distinguishing value, so the
# output tells which path ran. The zero-flag branch (cmp + brz) is covered in
# interpreter-arithmetic (#1287). Byte-for-byte parity stays with *.oracle.e2e.

Feature: Interpreter control flow
  As a programmer directing execution
  I want branches, subroutine calls, and jumps to transfer control correctly
  So that loops, conditionals, and functions behave as written

  Scenario: br unconditionally jumps over code
    Given a source file "br.a" containing:
      """
          br skip
          mov r0, 0
          dout r0
          halt
skip:       mov r0, 1
          dout r0
          halt
      """
    When I run lcc on "br.a"
    Then the program prints "1"

  Scenario: brn is taken when the last result was negative
    Given a source file "brn.a" containing:
      """
          mov r0, 1
          sub r0, r0, 5
          brn neg
          mov r1, 0
          dout r1
          halt
neg:        mov r1, 9
          dout r1
          halt
      """
    When I run lcc on "brn.a"
    Then the program prints "9"

  Scenario: brp is taken when the last result was positive
    Given a source file "brp.a" containing:
      """
          mov r0, 0
          add r0, r0, 3
          brp pos
          mov r1, 0
          dout r1
          halt
pos:        mov r1, 8
          dout r1
          halt
      """
    When I run lcc on "brp.a"
    Then the program prints "8"

  Scenario: bl calls a subroutine and ret returns to the caller
    Given a source file "blret.a" containing:
      """
          bl setval
          dout r0
          halt
setval:     mov r0, 7
          ret
      """
    When I run lcc on "blret.a"
    Then the program prints "7"

  Scenario: jmp transfers control to an address in a register
    Given a source file "jmp.a" containing:
      """
          lea r0, dest
          jmp r0
          mov r1, 0
          dout r1
          halt
dest:       mov r1, 5
          dout r1
          halt
      """
    When I run lcc on "jmp.a"
    Then the program prints "5"
