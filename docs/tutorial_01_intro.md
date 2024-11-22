# **Introduction to LCC Assembly Programming**

Welcome to this tutorial on LCC assembly programming! This guide is designed to help you learn how to write assembly programs for the Low-Cost Computer (LCC) architecture step by step. We'll start with basic concepts like moving data into registers and printing values, and gradually progress to more advanced topics such as labels, directives, input/output operations, control structures, and working with the stack.

By the end of this tutorial, you'll have a solid understanding of how to write and execute simple assembly programs using LCC assembly language.

---

## **Table of Contents**

1. [Getting Started](#getting-started)
2. [Basic Concepts](#basic-concepts)
   - [Registers](#registers)
   - [Moving Data into Registers](#moving-data-into-registers)
   - [Printing Data from Registers](#printing-data-from-registers)
   - [Halting a Program](#halting-a-program)
3. [Labels and Directives](#labels-and-directives)
   - [Labels](#labels)
   - [Directives](#directives)
4. [Input/Output Operations](#inputoutput-operations)
   - [Output Instructions](#output-instructions)
   - [Input Instructions](#input-instructions)
   - [Working with Strings](#working-with-strings)
5. [Control Structures](#control-structures)
   - [Comparisons](#comparisons)
   - [Branching](#branching)
   - [Loops](#loops)
6. [Working with the Stack](#working-with-the-stack)
   - [Push and Pop Instructions](#push-and-pop-instructions)
   - [Functions and Subroutines](#functions-and-subroutines)
7. [Putting It All Together](#putting-it-all-together)
8. [Additional Resources](#additional-resources)
9. [Conclusion](#conclusion)

---

## **Getting Started**

Before we dive into writing assembly programs, make sure you have the LCC.js environment set up on your computer. You'll need Node.js installed to run LCC.js scripts.

**Installation Steps:**

1. **Install Node.js**: Download and install from [nodejs.org](https://nodejs.org/).

2. **Clone the LCC.js Repository**:
   ```bash
   git clone https://github.com/yourusername/lcc.js.git
   cd lcc.js
   ```

3. **Verify Installation**: Run a simple command to ensure everything is set up correctly.
   ```bash
   node lcc.js -h
   ```

---

## **Basic Concepts**

### **Registers**

In the LCC architecture, there are **eight general-purpose registers**:

- **r0 to r7**: Used for various operations.
  - **r5**: Often used as the **frame pointer (fp)**.
  - **r6**: Used as the **stack pointer (sp)**.
  - **r7**: Used as the **link register (lr)** for storing return addresses.

Registers are like small storage areas within the CPU where you can hold data temporarily during program execution.

### **Moving Data into Registers**

To perform any operation, you often need to load data into registers. The `mov` instruction is used to move data into registers.

**Syntax:**

- **Immediate Value to Register**:
  ```arm
    mov dr, imm9  ; dr = destination register, imm9 = 9-bit immediate value
  ```
- **Register to Register**:
  ```arm
    mov dr, sr  ; dr = destination register, sr = source register
  ```

**Example:**

```arm
    mov r0, 5  ; Move the value 5 into register r0
```

### **Printing Data from Registers**

To display data, you can use the `dout`, `udout`, `hout`, and `aout` instructions.

- **dout**: Display signed decimal number.
- **udout**: Display unsigned decimal number.
- **hout**: Display number in hexadecimal.
- **aout**: Display ASCII character.

**Example:**

```arm
    dout r0  ; Display the signed decimal value in r0
    nl       ; Print a newline character
```

### **Halting a Program**

Every assembly program should end with a `halt` instruction to stop execution.

```arm
    halt  ; Stop program execution
```

**Putting It All Together:**

```arm
    ; Example: Moving data into a register and printing it
    mov r0, 5  ; Move 5 into r0
    dout r0    ; Print the value in r0
    nl         ; Newline
    halt       ; Stop execution
```

---

## **Labels and Directives**

### **Labels**

Labels are identifiers that mark a location in your program. They are used as targets for jumps and branches or to mark data locations.

**Syntax:**

```arm
label_name:
```

**Example:**

```arm
start:
    mov r0, 10
```

### **Directives**

Directives provide instructions to the assembler but do not generate machine code. They are used to define data, reserve space, or specify the starting point of your program.

**Common Directives:**

- **`.word`**: Define a word (16 bits) with an initial value.
- **`.zero`**, **`.blkw`**, **`.space`**: Reserve a block of words initialized to zero.
- **`.string`**, **`.stringz`**, **`.asciz`**: Define a null-terminated string.

**Example:**

```arm
x: .word 5         ; Define a word 'x' with value 5
buffer: .zero 10   ; Reserve 10 words initialized to zero
message: .string "Hello, World!"
```

---

## **Input/Output Operations**

### **Output Instructions**

#### **Displaying Numbers and Characters**

- **Display Signed Decimal Number**:
  ```arm
    dout r0  ; Display signed decimal value in r0
  ```
- **Display Unsigned Decimal Number**:
  ```arm
    udout r0  ; Display unsigned decimal value in r0
  ```
- **Display Hexadecimal Number**:
  ```arm
    hout r0  ; Display hexadecimal value in r0
  ```
- **Display ASCII Character**:
  ```arm
    aout r0  ; Display ASCII character in r0
  ```

#### **Displaying Strings**

- **sout**: Display a null-terminated string pointed to by a register.

  **Example:**

  ```arm
    lea r0, message  ; Load effective address of 'message' into r0
    sout r0          ; Display the string starting at address in r0
  ```

  ```arm
  message: .string "Hello, World!"
  ```

### **Input Instructions**

- **Read Signed Decimal Number**:
  ```arm
    din r0  ; Read signed decimal input into r0
  ```
- **Read Hexadecimal Number**:
  ```arm
    hin r0  ; Read hexadecimal input into r0
  ```
- **Read ASCII Character**:
  ```arm
    ain r0  ; Read a single character into r0
  ```
- **Read String**:
  ```arm
    lea r0, buffer  ; Load address of buffer into r0
    sin r0          ; Read string from keyboard into buffer
  ```

### **Working with Strings**

To work with strings, you need to reserve space in memory and manage null-termination.

**Example: Reading and Displaying a String**

```arm
    ; Prompt the user and read a string
    lea r0, prompt
    sout r0           ; Display prompt
    lea r0, buffer
    sin r0            ; Read input into buffer

    ; Display the inputted string
    lea r0, reply
    sout r0           ; Display reply message
    lea r0, buffer
    sout r0           ; Display the inputted string
    nl
    halt

prompt: .string "Enter your name: "
reply:  .string "Hello, "
buffer: .zero 20  ; Reserve 20 words for the input
```

---

## **Control Structures**

### **Comparisons**

The `cmp` instruction is used to compare two values.

**Syntax:**

- **Compare Register with Register**:
  ```arm
    cmp sr1, sr2  ; Compare sr1 - sr2, sets flags
  ```
- **Compare Register with Immediate**:
  ```arm
    cmp sr1, imm5  ; Compare sr1 - imm5, sets flags
  ```

### **Branching**

Based on the comparison, you can branch to different parts of your code using branch instructions.

**Branch Instructions:**

- **brz / bre**: Branch if zero (equal).
- **brnz / brne**: Branch if not zero (not equal).
- **brn**: Branch if negative.
- **brp**: Branch if positive.
- **brlt**: Branch if less than (signed).
- **brgt**: Branch if greater than (signed).
- **br**: Unconditional branch.

**Syntax:**

```arm
    br\* label  ; \*cc = condition code, label = target label
```

**Example: If-Else Structure**

```arm
    cmp r0, 0
    brz zero_case   ; If r0 == 0, branch to zero_case
    ; Code for r0 != 0
    br end
zero_case:
    ; Code for r0 == 0
end:
```

### **Loops**

You can create loops by combining comparisons and branches.

**Example: Counting Down from 10 to 1**

```arm
mov r0, 10    ; Initialize counter
loop_start:
    cmp r0, 0
    bre loop_end    ; Exit loop if r0 == 0
    dout r0
    nl
    sub r0, r0, 1   ; Decrement counter
    br loop_start   ; Repeat loop
loop_end:
    halt
```

---

## **Working with the Stack**

The stack is a region of memory used for storing temporary data, return addresses, and for managing function calls.

### **Push and Pop Instructions**

- **push**: Decrease the stack pointer and store a register's value on the stack.
  ```arm
    push r0  ; Push r0 onto the stack
  ```
- **pop**: Retrieve a value from the stack into a register and increase the stack pointer.
  ```arm
    pop r0   ; Pop value from the stack into r0
  ```

### **Functions and Subroutines**

Functions allow you to structure your code into reusable blocks.

**Setting Up a Function:**

1. **Function Entry:**
   - Save the caller's context.
   - Set up a new stack frame.

2. **Function Exit:**
   - Restore the caller's context.
   - Return to the caller.

**Example: A Simple Function**

```arm
; Main program
startup:
    bl main    ; Branch to 'main', saving return address in 'lr'
    halt       ; End of program

; Function 'main'
main:
    push lr    ; Save link register
    push fp    ; Save frame pointer
    mov fp, sp ; Set new frame pointer

    ; Function body
    ; ... (your code here)

    ; Function exit
    mov sp, fp ; Restore stack pointer
    pop fp     ; Restore frame pointer
    pop lr     ; Restore link register
    ret        ; Return to caller
```

**Explanation:**

- **bl main**: Branch to `main`, saving the next instruction's address in `lr`.
- **push lr**, **push fp**: Save `lr` and `fp` on the stack.
- **mov fp, sp**: Set the frame pointer to the current stack pointer.
- **mov sp, fp**: Restore the stack pointer from the frame pointer.
- **pop fp**, **pop lr**: Restore `fp` and `lr` from the stack.
- **ret**: Return to the address in `lr`.

---

## **Putting It All Together**

Let's create a complete program that incorporates many of the concepts we've discussed.

**Program: A Simple Calculator**

This program prompts the user for two numbers and an operation, performs the calculation, and displays the result. See file `simpleCalc.a` in the docs folder of this repository.

**Explanation:**

- **Input Gathering**: The program prompts the user for two numbers and an operation.
- **Operation Selection**: Uses `cmp` and `brne` to determine which operation to perform.
- **Calculations**: Performs addition, subtraction, multiplication, or division based on user input.
- **Result Display**: Shows the result using `dout`.
- **Error Handling**: Displays an error message if an invalid operation is entered.

---

## **Additional Resources**

- **LCC Instruction Set Summary**: Refer to the instruction set summary provided earlier for details on each instruction and directive.
- **LCC.js Documentation**: Explore the documentation of LCC.js for more information on assembling and running programs.

---

## **Conclusion**

Congratulations! You've learned the basics of writing assembly programs for the LCC architecture. We've covered how to:

- Move data into registers and perform arithmetic operations.
- Use labels and directives to structure your code and define data.
- Handle input/output operations to interact with the user.
- Implement control structures like loops and conditional branches.
- Work with the stack to create functions and manage data.

Assembly programming provides a deep understanding of how computers execute instructions and manage data at the lowest level. Keep practicing by writing your own programs, experimenting with different instructions, and exploring more advanced topics.

Happy coding!

---

**Notes**:

- Always ensure that your programs end with a `halt` instruction to prevent unexpected behavior (infinite loops, crashes, etc..)
- Make sure to always indent your code - if you don't indent your code, you may get some errors when assembling your program. Labels and comments however do not need to be indented. Labels should be followed by a colon.
- Data should always go at the bottom of your program, after the halt instruction. This is because the assembler reads the program from top to bottom, and data can be accidentally interpretted as an instruction.