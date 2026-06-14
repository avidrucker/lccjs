# assembler-label-resolution.feature — jest-cucumber BDD (#1300; tracker #1269, harness #1252).
#
# Living documentation of how the assembler resolves labels, via the real CLI:
# forward references resolve in pass 2; an undefined or duplicate label is rejected
# (message on stderr, failing run). Byte-for-byte parity stays with *.oracle.e2e.

Feature: Assembler label resolution
  As a programmer using labels
  I want forward references to resolve and bad labels to be reported
  So that I can branch to code defined later and catch typos early

  Scenario: a forward reference resolves to a label defined later
    Given a source file "fwd.a" containing:
      """
          br fwd
          mov r0, 0
          dout r0
          halt
fwd:        mov r0, 7
          dout r0
          halt
      """
    When I run lcc on "fwd.a"
    Then the program prints "7"

  Scenario: referencing an undefined label is rejected
    Given a source file "undef.a" containing:
      """
          br nowhere
          halt
      """
    When I run lcc on "undef.a"
    Then the run fails
    And the error output contains "Undefined label"

  Scenario: defining the same label twice is rejected
    Given a source file "dup.a" containing:
      """
x:          halt
x:          halt
      """
    When I run lcc on "dup.a"
    Then the run fails
    And the error output contains "Duplicate label"
