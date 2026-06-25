# linking.feature — jest-cucumber BDD (#1258; harness #1252).
#
# Living documentation of the multi-module workflow: assemble each .a module to a
# .o object, link the objects into a single executable, and run it. Scenarios
# assert the user-visible contract (output, produced/absent artifacts, error
# message). In-memory link behavior is covered by linker.integration.spec.js;
# this adds the CLI-level layer.
#
# NOTE on the undefined-external scenario: lcc reports the linker error on stderr
# and writes NO executable, but **exits 0** — this is deliberate parity with the
# original LCC binary (see the comment at src/cli/lcc.js linkObjectFiles). So the
# scenario asserts the message + the absent artifact, not a non-zero exit.

Feature: Link multiple object modules into a runnable executable
  As a programmer splitting a program across modules
  I want to assemble each module and link them together
  So that one module can use symbols another module exports

  Scenario: Two modules linked together resolve a cross-module symbol
    Given a module "mod_a.a" containing:
      """
          .extern val
          ld r0, val
          dout r0
          nl
          halt
      """
    And a module "mod_b.a" containing:
      """
          .global val
val:        .word 42
      """
    When I assemble and link the modules
    And I run the linked executable
    Then the output contains "42"
    And the executable "link.e" is produced

  Scenario: An undefined external reference is reported and produces no executable
    Given a module "orphan.a" containing:
      """
          .extern ghost
          ld r0, ghost
          halt
      """
    When I assemble and link the modules
    Then the error output reports "undefined external reference"
    And no executable "link.e" is produced

  # #1474: the assembler used to dedupe external references by (label, type), so
  # only the FIRST reference site was relocated; later ones silently became no-ops
  # (functions) or read unrelocated addresses (data). The oracle relocates every
  # site. "BB" / "4242" are discriminating: the bug yields "B" / "42<garbage>".
  Scenario: An external function called more than once relocates every call
    Given a module "caller.a" containing:
      """
          .extern beep
          .start main
main:       bl beep
            bl beep
            halt
      """
    And a module "lib.a" containing:
      """
          .global beep
beep:       push lr
            push fp
            mov fp, sp
            mov r0, 66
            aout r0
            mov sp, fp
            pop fp
            pop lr
            ret
      """
    When I assemble and link the modules
    And I run the linked executable
    Then the output contains "BB"

  Scenario: An external data symbol read more than once relocates every reference
    Given a module "reader.a" containing:
      """
          .extern val
          .start main
main:       ld r0, val
            dout r0
            ld r0, val
            dout r0
            halt
      """
    And a module "data.a" containing:
      """
          .global val
val:        .word 42
      """
    When I assemble and link the modules
    And I run the linked executable
    Then the output contains "4242"
