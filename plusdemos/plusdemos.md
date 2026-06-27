**LCC+js Demo Programs Overview**

The LCC+js demos showcase the capabilities of the LCC+js toolchain as a real-time assembly game engine. These programs demonstrate various functionalities, ranging from simple character display loops to interactive game mechanics, highlighting real-time input handling, rendering optimizations, and game logic implementation in assembly language.

---

### **Demo Programs**

1. **Character Cycling Program**
   
   - **Description:** Cycles through characters `'a'` to `'f'`, printing each character to the terminal with a one-second interval.
   - **Highlights:** Demonstrates basic looping, character manipulation, timed pauses, and terminal I/O operations.

2. **Typewriter-Style Printing Program**
   
   - **Description:** Prints the letters `'a'` through `'f'` sequentially in a typewriter-like fashion, adding a one-second delay between each character.
   - **Highlights:** Showcases controlled output sequencing and timed delays to create a smooth, readable display effect.

3. **Key Press Capture Program**
   
   - **Description:** Prompts the user to press any key and continuously displays the pressed key until the Enter key is pressed, upon which the program terminates.
   - **Highlights:** Illustrates user input handling, non-blocking input polling, conditional branching based on input, and string manipulation.

4. **Deterministic Random Number Generator**
   
   - **Description:** Generates and prints 20 deterministic random numbers between 1 and 20 using a fixed seed, ensuring the same sequence of numbers on each run.
   - **Highlights:** Demonstrates random number generation with a fixed seed for reproducibility, loop control, and numerical output formatting.

5. **Non-Deterministic Random Number Generator**
   
   - **Description:** Generates and prints 20 non-deterministic random numbers between 1 and 20 by seeding the random number generator with the current time, resulting in different sequences on each execution.
   - **Highlights:** Showcases dynamic random number generation, use of system time for seeding, and real-time variability in program output.

6. **1D Player Movement Program**
   
   - **Description:** Allows a player to move left and right along a one-dimensional board row. Optimizes rendering by only updating the display when the player moves and resetting the cursor position instead of clearing the entire screen.
   - **Highlights:** Demonstrates efficient rendering techniques, real-time player movement, cursor manipulation, and minimal screen refresh to enhance performance.

7. **Non-Blocking Input Character Movement Program**
   
   - **Description:** Enables a character to move around a board using the `W`, `A`, `S`, `D` keys for movement and `Q` to quit. Utilizes non-blocking input to allow real-time interaction without halting program execution.
   - **Highlights:** Illustrates non-blocking input handling, real-time user interaction, conditional movement based on key presses, and continuous screen updating for an interactive experience.

8. **"Find the Fruit" Game (Precursor to Snake)**
   
   - **Description:** A simple game where the player moves around a board to eat randomly placed fruit. Each time the player collides with the fruit, it is repositioned randomly on the board.
   - **Highlights:** Demonstrates basic game mechanics including player movement, collision detection, random placement of objects, and real-time rendering updates.

9. **Work-in-Progress Snake Game**
   
   - **Description:** An assembly-based implementation of the classic Snake game. Features include player movement, fruit placement, snake growth, and initial groundwork for snake body rendering and collision detection.
   - **Highlights:** Showcases advanced game logic, dynamic data structures for the snake's body, real-time input handling, collision mechanics, and iterative development with planned feature enhancements.

10. **Tic-Tac-Toe (Two-Player Hot-Seat)**

    - **Description:** A complete two-player Tic-Tac-Toe game. Players take turns pressing a digit `1`-`9` to place their mark; the program detects win lines and draws, then offers a `y`/`n` play-again prompt.
    - **Highlights:** A turn-based counterpart to the real-time game demos. Showcases `.lccplus` + `clear` redraw, single-keypress input via `nbain` polling (with `sleep` throttle), table-driven win detection over an 8-triplet `winLines` array, and a clean function decomposition (`printBoard`, `promptMove`, `applyMove`, `checkWin`, `checkDraw`, `togglePlayer`, `playOne`, `main`). A worked example of working around LCC's 9-bit pc-offset range using pointer aliases (`@xxxP: .word xxx`) when shared state sits far from its consumer.

11. **Rock-Paper-Scissors (Human vs Computer)**

    - **Description:** A one-shot single-round Rock-Paper-Scissors game. The player presses `1`/`2`/`3` to choose Rock/Paper/Scissors; the computer's choice is sampled uniformly via `rand 1, 3` (seeded with `millis` at startup); the program prints both choices and the winner, then offers a `y`/`n` play-again prompt.
    - **Highlights:** The simplest "vs computer" demo — exercises the LCC+ RNG (`millis` + `srand` + `rand`) for the AI move, `nbain` polling for blocking single-key input, and `clear` for the per-round redraw. Win detection uses the `(player - computer) mod 3` trick: tie if 0, player wins if 1, computer wins if 2.

12. **`sound` Trap Showcase** (`sound.ap`)

    - **Description:** Plays the five configured LCC+ sound slots with literal `sound 0` through `sound 4`, then shows register-driven playback with `sound r1` after loading `r1` with `4`.
    - **Highlights:** Demonstrates the single sound-producing trap and its slot mapping: `0` ding, `1` deep, `2` bop, `3` doink, `4` beep. Each slot checks `.env` first, then built-in desktop-sound defaults, then ASCII BEL.

13. **`beep` Alias Showcase** (`beep.ap`)

    - **Description:** Prints a one-line banner, then invokes `beep`, the no-operand alias for `sound 4`.
    - **Highlights:** Shows the source-compatible alias for the fifth sound slot.

14. **`ding` Alias Showcase** (`ding.ap`)

    - **Description:** Prints a one-line banner, then invokes `ding`, the no-operand alias for `sound 0`.
    - **Highlights:** Confirms the named alias path for the first sound slot.

15. **`bop` Alias Showcase** (`boop.ap`)

    - **Description:** Prints a banner, then invokes `bop`, the no-operand alias for `sound 2`.
    - **Highlights:** Keeps the historical `boop.ap` demo file while demonstrating the new `bop` alias.

---

### **Overarching Goal of the Demos**

The primary goal of the LCC+js demo programs is to **demonstrate LCC+js's capabilities as a real-time assembly game engine**. By presenting a range of interactive and progressively complex programs—from simple character displays to engaging game mechanics—these demos highlight how LCC+js can efficiently handle real-time input, rendering optimizations, and game logic within an assembly language framework. This showcases the toolchain's potential for developing responsive and interactive applications, emphasizing performance, flexibility, and the ability to manage real-time operations effectively.

---

These demos collectively illustrate the versatility and power of LCC+js in creating real-time interactive applications and games using assembly language, providing a solid foundation for developers to build more complex and feature-rich projects.
