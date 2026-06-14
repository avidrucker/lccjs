# assembler-directives.feature — jest-cucumber BDD (#1280; tracker #1269, harness #1252).
#
# Living documentation of the data-defining assembler directives, via the real CLI.
# Aliases with identical behavior: .word/.fill ; .string/.stringz/.asciz ;
# .blkw/.space/.zero. (.global/.extern are covered by linking.feature #1258;
# .org/.start are a follow-up child of #1269.) Scenarios assert the program's
# printed output; byte-for-byte parity stays with the *.oracle.e2e suites.

Feature: Data-defining assembler directives
  As a programmer laying out data in memory
  I want directives that store words, strings, and zeroed space
  So that my program can reference constants and buffers by label

  Scenario: .word stores a value that can be loaded and printed
    Given a source file "word.a" containing:
      """
          ld r0, num
          dout r0
          nl
          halt
num:        .word 7
      """
    When I run lcc on "word.a"
    Then the program prints "7"

  Scenario: .string stores a printable, null-terminated string
    Given a source file "str.a" containing:
      """
          lea r0, msg
          sout r0
          halt
msg:        .string "Hi"
      """
    When I run lcc on "str.a"
    Then the program prints "Hi"

  Scenario: .blkw reserves zero-initialized space
    Given a source file "buf.a" containing:
      """
          ld r0, buf
          dout r0
          nl
          halt
buf:        .blkw 2
      """
    When I run lcc on "buf.a"
    Then the program prints "0"
