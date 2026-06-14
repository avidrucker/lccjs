# explain-errors.feature — jest-cucumber BDD (#1257; harness #1252, epic #1042, fix #1247).
#
# Living documentation of the opt-in `--explain` flag: when on, the toolchain
# appends a student-friendly teaching block (prefixed `explain:`) after an error;
# when off, output is unchanged. Errors and their explain blocks go to STDERR.
# Scenarios assert the user-visible contract (the message, the presence/absence of
# the explain block, a failing exit); exact wording stays with the *.oracle.e2e
# suites. See tests/features/README.md.

Feature: --explain expands errors into teaching notes
  As a student hitting a toolchain error
  I want an opt-in explanation of what went wrong
  So that I learn the underlying rule, not just the terse message

  Scenario: An assembler error with --explain shows the error and an explanation
    Given a source file "bad.a" containing:
      """
          add r0, r1, 99
          halt
      """
    When I run lcc on "bad.a" with "--explain"
    Then the command fails
    And the error output contains "imm5 out of range"
    And the error output includes an explain block

  Scenario: The same assembler error without --explain stays terse
    Given a source file "bad.a" containing:
      """
          add r0, r1, 99
          halt
      """
    When I run lcc on "bad.a" with ""
    Then the command fails
    And the error output contains "imm5 out of range"
    And the error output has no explain block

  Scenario: A non-runnable executable with --explain explains why it will not run
    Given a non-runnable executable "broken.e"
    When I run lcc on "broken.e" with "--explain"
    Then the command fails
    And the error output contains "is not a valid LCC executable file"
    And the error output includes an explain block
