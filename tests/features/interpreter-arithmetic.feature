# interpreter-arithmetic.feature — jest-cucumber BDD (#1287; tracker #1269, harness #1252).
#
# Living documentation of the interpreter's arithmetic instructions and condition
# flags, via the real CLI. Results are observed by computing a value and printing
# it with `dout`. Condition flags (N/Z/C/V) are not printed directly — they are
# observed the way a program uses them: a `cmp` sets the flags and a conditional
# branch (`brz`) is taken or not. Byte-for-byte parity stays with *.oracle.e2e.

Feature: Interpreter arithmetic and condition flags
  As a programmer doing computation
  I want the arithmetic instructions to produce correct results and set flags
  So that my calculations and conditional branches behave as expected

  Scenario: add computes a sum (immediate form)
    Given a source file "add.a" containing:
      """
          mov r0, 3
          add r0, r0, 4
          dout r0
          halt
      """
    When I run lcc on "add.a"
    Then the program prints "7"

  Scenario: sub computes a difference (register form)
    Given a source file "sub.a" containing:
      """
          mov r0, 10
          mov r1, 3
          sub r0, r0, r1
          dout r0
          halt
      """
    When I run lcc on "sub.a"
    Then the program prints "7"

  Scenario: mul multiplies two registers
    Given a source file "mul.a" containing:
      """
          mov r0, 6
          mov r1, 7
          mul r0, r1
          dout r0
          halt
      """
    When I run lcc on "mul.a"
    Then the program prints "42"

  Scenario: div divides two registers
    Given a source file "div.a" containing:
      """
          mov r0, 20
          mov r1, 4
          div r0, r1
          dout r0
          halt
      """
    When I run lcc on "div.a"
    Then the program prints "5"

  Scenario: cmp of equal values sets the zero flag so brz is taken
    Given a source file "cmpeq.a" containing:
      """
          mov r0, 5
          mov r1, 5
          cmp r0, r1
          brz equal
          mov r2, 0
          dout r2
          halt
equal:      mov r2, 1
          dout r2
          halt
      """
    When I run lcc on "cmpeq.a"
    Then the program prints "1"

  Scenario: cmp of unequal values leaves the zero flag clear so brz falls through
    Given a source file "cmpne.a" containing:
      """
          mov r0, 5
          mov r1, 6
          cmp r0, r1
          brz equal
          mov r2, 0
          dout r2
          halt
equal:      mov r2, 1
          dout r2
          halt
      """
    When I run lcc on "cmpne.a"
    Then the program prints "0"
