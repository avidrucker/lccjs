# interpreter-traps.feature — jest-cucumber BDD (#1288; tracker #1269, harness #1252).
#
# Living documentation of the interpreter's trap / I-O instructions, via the real
# CLI. Output traps assemble + run and assert the printed output; input traps pipe
# stdin (spawnSync `input`). Byte-for-byte parity stays with the *.oracle.e2e suites.

Feature: Interpreter trap / I-O instructions
  As a programmer doing input and output
  I want the I/O traps to read and print values correctly
  So that my program can talk to the user

  Scenario: dout prints a register as a decimal number
    Given a source file "dout.a" containing:
      """
          mov r0, 42
          dout r0
          halt
      """
    When I run lcc on "dout.a"
    Then the program prints "42"

  Scenario: aout prints a register as an ASCII character
    Given a source file "aout.a" containing:
      """
          mov r0, 65
          aout r0
          halt
      """
    When I run lcc on "aout.a"
    Then the program prints "A"

  Scenario: hout prints a register as hexadecimal
    Given a source file "hout.a" containing:
      """
          mov r0, 255
          hout r0
          halt
      """
    When I run lcc on "hout.a"
    Then the program prints "ff"

  Scenario: sout prints a null-terminated string at an address
    Given a source file "sout.a" containing:
      """
          lea r0, msg
          sout r0
          halt
msg:        .string "Hi"
      """
    When I run lcc on "sout.a"
    Then the program prints "Hi"

  Scenario: nl emits a newline between outputs
    Given a source file "nl.a" containing:
      """
          mov r0, 1
          dout r0
          nl
          mov r0, 2
          dout r0
          halt
      """
    When I run lcc on "nl.a"
    Then "1" and "2" appear on separate lines

  Scenario: halt stops the program cleanly
    Given a source file "halt.a" containing:
      """
          halt
      """
    When I run lcc on "halt.a"
    Then the program exits cleanly with no output

  Scenario: din reads a decimal number from stdin
    Given a source file "din.a" containing:
      """
          din r0
          dout r0
          halt
      """
    When I run lcc on "din.a" with input "7"
    Then the program prints "7"

  Scenario: hin reads a hexadecimal number from stdin
    Given a source file "hin.a" containing:
      """
          hin r0
          dout r0
          halt
      """
    When I run lcc on "hin.a" with input "ff"
    Then the program prints "255"

  Scenario: sin reads a string from stdin
    Given a source file "sin.a" containing:
      """
          lea r0, buf
          sin r0
          sout r0
          halt
buf:        .blkw 20
      """
    When I run lcc on "sin.a" with input "hello"
    Then the program prints "hello"
