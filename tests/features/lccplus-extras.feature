Feature: LCC+ extra traps
  As a programmer using the LCC+ toolchain
  I want the extra traps to behave predictably through the real CLI
  So that I can rely on rand, millis, input polling, and terminal control in .ap programs

  Scenario: srand seeds rand into a repeatable pair of numbers
    Given a source file "rand.ap" containing:
      """
          .lccplus
          mov r0, 0
          srand r0
          mov r0, 1
          mov r1, 10
          rand r0, r1
          dout r0
          nl
          mov r0, 1
          mov r1, 10
          rand r0, r1
          dout r0
          halt
      """
    When I run lccplus on "rand.ap"
    Then "2" and "7" appear on separate lines

  Scenario: millis prints a millisecond value
    Given a source file "millis.ap" containing:
      """
          .lccplus
          millis r0
          dout r0
          halt
      """
    When I run lccplus on "millis.ap"
    Then the program prints a millisecond value

  Scenario: nbain returns 0 when no key is waiting
    Given a source file "nbain.ap" containing:
      """
          .lccplus
          nbain r0
          dout r0
          halt
      """
    When I run lccplus on "nbain.ap"
    Then the program prints "0"

  Scenario: cursor and resetc emit terminal escapes under a TTY
    Given a source file "tty.ap" containing:
      """
          .lccplus
          mov r0, 0
          cursor r0
          clear
          resetc
          mov r0, 42
          dout r0
          halt
      """
    When I run lccplus on "tty.ap" in a TTY
    Then the screen is cleared once
    Then the output contains the cursor-hide escape
    And the output contains the cursor-home escape
    And the program prints "42"
