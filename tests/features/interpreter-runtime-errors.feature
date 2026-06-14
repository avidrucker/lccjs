# interpreter-runtime-errors.feature — jest-cucumber BDD (#1294; tracker #1269, harness #1252).
#
# Living documentation of the interpreter's runtime errors as a user sees them at
# the CLI: the message (on stderr) and the failing run (non-zero exit). Unlike
# linker errors (which exit 0 for OG-LCC parity), runtime errors exit non-zero.
# The last scenario confirms --explain reaches runtime errors too (complementing
# explain-errors #1257, which covered assembler + file-format). Byte-for-byte
# parity stays with the *.oracle.e2e suites.

Feature: Interpreter runtime errors
  As a programmer whose program misbehaves at run time
  I want a clear error and a failing exit
  So that I (and my scripts) know the run did not succeed

  Scenario: dividing by zero raises a floating point exception
    Given a source file "div0.a" containing:
      """
          mov r0, 5
          mov r1, 0
          div r0, r1
          halt
      """
    When I run lcc on "div0.a"
    Then the run fails
    And the error output contains "Floating point exception"

  Scenario: an out-of-range trap vector is rejected
    Given a source file "badtrap.a" containing:
      """
          .word 0xF0FF
          halt
      """
    When I run lcc on "badtrap.a"
    Then the run fails
    And the error output contains "Trap vector out of range"

  Scenario: --explain adds a teaching note to a runtime error
    Given a source file "div0.a" containing:
      """
          mov r0, 5
          mov r1, 0
          div r0, r1
          halt
      """
    When I run lcc on "div0.a" with --explain
    Then the run fails
    And the error output contains "Floating point exception"
    And the error output includes an explain block
