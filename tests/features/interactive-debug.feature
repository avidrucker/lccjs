# interactive-debug.feature — jest-cucumber BDD (#1259; harness #1252).
#
# Living documentation of the interactive stepping debugger (`lcc -i`), which is a
# distinct execution path from the batch interpreter. The debugger reads single-
# character commands from stdin: a number N steps N instructions; `q` quits. It
# renders a Registers/Memory/Code panel after each step.
#
# Driven via spawnSync with piped stdin (input: the command sequence) — verified
# deterministic (~50ms, exits 0). The panel uses ANSI colour, so the steps strip
# escape codes before asserting on register text. The register-panel format is a
# real, if UI-coupled, contract; assertions stay on stable substrings ("Registers",
# "r0: 0005").

Feature: Step through a program with the interactive debugger
  As a student learning how a program executes
  I want to step one instruction at a time and watch the registers change
  So that I can see exactly what each instruction does

  Scenario: Stepping one instruction updates the register it writes
    Given a source file "step.a" containing:
      """
          mov r0, 5
          dout r0
          nl
          halt
      """
    When I step once and then quit the debugger
    Then the interactive debugger starts
    And register r0 holds 5 after the step
    And the debugger exits cleanly

  Scenario: Quitting without stepping leaves the registers untouched
    Given a source file "step.a" containing:
      """
          mov r0, 5
          dout r0
          nl
          halt
      """
    When I quit the debugger without stepping
    Then the interactive debugger starts
    And no instruction has executed yet
    And the debugger exits cleanly
