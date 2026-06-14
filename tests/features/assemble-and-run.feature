# assemble-and-run.feature — jest-cucumber pilot (#1252, decision #1250).
#
# Living documentation of the core `lcc <file>.a` happy path: assemble a source
# program and run it in one step. Scenarios assert the user-visible CLI contract
# (exit code, key output, generated artifacts). Byte-for-byte output parity with
# the reference LCC binary remains the job of the *.oracle.e2e suites — these
# scenarios complement that, they do not duplicate it. See tests/features/README.md.

Feature: Assemble and run an LCC program
  As a student using the lcc toolchain
  I want to assemble and run a .a source file with one command
  So that I see my program's output without separate build and run steps

  Scenario: Running a .a source assembles it and executes the result
    Given a source file "hello.a" containing:
      """
          mov r0, 42
          dout r0
          nl
          halt
      """
    When I run lcc on "hello.a"
    Then the command exits successfully
    And the output contains "42"
    And the executable "hello.e" is produced

  Scenario: A program with no output still assembles and runs cleanly
    Given a source file "noop.a" containing:
      """
          halt
      """
    When I run lcc on "noop.a"
    Then the command exits successfully
    And the executable "noop.e" is produced
