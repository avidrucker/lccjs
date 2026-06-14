# assembler-number-formats.feature — jest-cucumber BDD (#1298; tracker #1269, harness #1252).
#
# Living documentation of how the assembler parses numeric literals, via the real
# CLI: a literal is moved into a register and printed with `dout` (which prints a
# signed decimal). Covered forms: plain decimal, hex (0x...), negative, and a
# character literal ('X' -> its ASCII code). The same forms also work as `.word`
# operands. Byte-for-byte parity stays with the *.oracle.e2e suites.

Feature: Assembler numeric literal formats
  As a programmer writing constants
  I want to express numbers as decimal, hex, negatives, or character literals
  So that I can use whichever notation is clearest for each value

  Scenario: a decimal literal
    Given a source file "dec.a" containing:
      """
          mov r0, 42
          dout r0
          halt
      """
    When I run lcc on "dec.a"
    Then the program prints "42"

  Scenario: a hexadecimal literal (0x)
    Given a source file "hex.a" containing:
      """
          mov r0, 0x2A
          dout r0
          halt
      """
    When I run lcc on "hex.a"
    Then the program prints "42"

  Scenario: a negative literal prints as a signed value
    Given a source file "neg.a" containing:
      """
          mov r0, -5
          dout r0
          halt
      """
    When I run lcc on "neg.a"
    Then the program prints "-5"

  Scenario: a character literal yields its ASCII code
    Given a source file "chr.a" containing:
      """
          mov r0, 'A'
          dout r0
          halt
      """
    When I run lcc on "chr.a"
    Then the program prints "65"
