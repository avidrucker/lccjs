# assembler-org-start.feature — jest-cucumber BDD (#1303; tracker #1269, harness #1252).
#
# Living documentation of the location-counter and entry-point directives, via the
# real CLI. `.org` sets where the next item is assembled (observed by printing a
# label's address with lea + dout). `.start` sets the program's entry point
# (observed by branching past earlier code). Byte-for-byte parity stays with
# the *.oracle.e2e suites.

Feature: Assembler .org and .start directives
  As a programmer placing code and data
  I want to set absolute addresses and choose the entry point
  So that I control where things live and where execution begins

  Scenario: .org places the next label at an absolute address
    Given a source file "org.a" containing:
      """
          lea r0, val
          dout r0
          halt
          .org 0x80
val:        .word 0
      """
    When I run lcc on "org.a"
    Then the program prints "128"

  Scenario: .start sets the program entry point
    Given a source file "start.a" containing:
      """
          .start begin
          mov r0, 1
          dout r0
          halt
begin:      mov r0, 2
          dout r0
          halt
      """
    When I run lcc on "start.a"
    Then the program prints "2"
