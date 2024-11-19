# TO-DO's

## Project QoL, Documentation, and Maintenance
- [x] put assembleAll.js into utils folder
- [x] add creation of name.nnn to assembleAll.js before calling assembler.js
- [ ] update README.md to include a more detailed description of the project (including linker.js), its various goals, and its current status (progress, test suite coverage, etc.)
- [ ] add comments inside of the code to indicate what hasn't been tested yet
- [ ] make a list of known assembler errors and how to trigger them to make into assembler tests
- [ ] make a list of known interpreter errors and how to trigger them to make into interpreter tests
  - division by zero "Floating point exception" (demoN.a)
  - infinite loop detection (no demo yet)
- [ ] make a list of known linker errors and how to trigger them to make into linker tests
- [ ] make a list of known namer errors and how to trigger them
  - no name input given (no demo yet)
- [x] relocate name.js, genStats.js, picture.js, and other non-core files to a separate directory called "utils"
- [ ] refactor macwords into constants at the top of the file
- [ ] refactor mnemonics into constants at the top of the file
- [x] refactor names of lst file outputs to be more descriptive in lcc and interpreter tests

## Core Features

- [x] implement .string, sout, & sin
- [x] implement blocking input for sin when executing
- [x] implement sin/sout execution output in bst
- [x] implement BST creation
- [ ] implement all case 10 mnemonic commands (MUL/DIV/ROL/etc.)
  - [ ] implement `srl` mnemonic
  - [ ] implement `sra` mnemonic
  - [ ] implement `sll` mnemonic
  - [ ] implement `rol` mnemonic
  - [ ] implement `ror` mnemonic
  - [ ] implement `mul` mnemonic
  - [ ] implement `div` mnemonic
  - [ ] implement `rem` mnemonic
  - [ ] implement `or` mnenmonic
  - [ ] implement `xor` mnemonic
  - [ ] implement `sext` mnemonic
- [ ] implement assembly of .bin files
- [ ] implement assembly of .hex files
- [ ] implement command line arguments for lcc.js (-d (symbolic debugger mode), -m (memory dump at end), -r (register dump at end), -t (instruction trace on), -f, -x, -o, -h, -l<loadpt>) "As a programmer, I can use command-line options to control the assembler and interpreter's behavior."
- [x] implement linker: "As a programmer, I can link multiple object files (.o files) into a single executable, so that I can build larger programs from separate modules."
  - [x] implement linker directives: "As a programmer, I can use .global and .extern directives to define and reference global and external symbols, so that I can share symbols between modules."
    - [x] .extern
    - [x] .global
- [ ] implement offsets
  - [ ] label offsets
    - [ ] implement decimal (base 10) offsets
    - [ ] implement hexadecimal (base 16) offsets
- [ ] implement usage of * instead of a label to indicate the current memory address
- [ ] implement catching of division by zero where, when division by zero is detected, attempting to interpret the program will result in an error message being printed to the console ("Floating point exception"), the program will not be executed, and the .lst/.bst files will not be created. note: assembly will still create the .e file. 2nd note: it appears that the lcc makes blank .lst/.bst files when errors such as division by zero are detected
- [ ] implement symbolic debugger "As a programmer, I can use the debugger to step through my program, set breakpoints, watchpoints, and inspect memory and registers, so that I can debug my code."
    - [ ] implement debugger commands
    - [ ] implement bp (breakpoint) instruction
- [x] implement LST creation
- [x] implement name.js module
- [x] infinite loop detection
- [ ] implement 300 char limit per line & corresponding error in assembler
- [x] implement more directives like `.fill` (alt to `.word`), `.blkw` (alt to `.zero`), etc.
  - [ ] implement `.start` directive: "As a programmer, I can specify the entry point of my program via the .start directive, so that I can control where my program begins execution."
  - [ ] implement `.org/.orig` directive: "The .org directive sets the location counter during the assembly process to a greater value. For example, if at the address 5 in an assembly language program, we have the directive .org 15, the location is reset to 15. The locations 5 to 14 are padded with zeros. Thus, in this example, it has the same effect as .zero 10"
- [x] implement dout/udout/hout/aout in interpreter.js
- [x] implement din/ain/hin in interpreter.js
- [x] implement debugging commands s (stack), m (memory), r (registers)
  - [x] stack draw function
  - [x] memory draw function
  - [x] registers draw function
- [ ] implement flag setting for lcc.js such as `-d` for debug mode, `-L` for load point, `-r` switch to display registers at program end, `-m` switch to display memory to be displayed at program end, etc. 
  - [ ] implement -L flag
    - [ ] implement loadPoint in interpreter.js to allow for loading of a program at a specific memory address via the S header in the .e file
- [ ] piping of an Assembly file's output into a text file
- [ ] implement `cea` mnemonic
- [x] implement `cmp` mnemonic
- [x] include comments in BST/LST files (when assembling and interpretting all at once via lcc.js)
- [x] include all headers (S, etc.) in BST/LST files


## Test

- [ ] improve tests for lcc.js and interpreter.js to include a meaningful comment that describes the test
  - [ ] lcc.test.js
  - [ ] interpreter.test.js
- [ ] improve test outputs that more accurately describe what the failure was and where it occurred
  - [ ] assembler.test.js
- [ ] test .start directive usage
- [ ] test assembly of .bin files
- [ ] test detection of division by zero
- [ ] test creation of .o files from multiple passed .a files
- [ ] test creation of .e file from multiple passed .o files
- [ ] add linker testing
  - [ ] test .org/.orig, .extern, and .global
- [x] negative numbers test (negative data in a .word, negative imm5 arg to `add`, negative inputs to `mov`)
- [x] `cmp` and `br` test
- [x] implement .e file testing that compares the hex dump of assembler.js's output and lcc's output
- [ ] use lcc locally to test if the lcc exists on local machine
- [ ] write script to install ubuntu docker image with lcc to run tests on when lcc does not exist on local machine
  - [ ] create docker image with lcc 63 installed, host it on dockerhub so that it can be pulled down for testing purposes
- [ ] write docker checks for (1) to see if docker is installed on the current machine and (2) to see if docker is currently running, so the tests fail gracefully and give helpful outputs such as "error: docker is not installed" or "error: docker is not running"
- [ ] test the stdout output of executing a program given a .e/.a file and specific inputs by comparing the .lst/.bst outputs of interpreter.js and the lcc, respectively
  - [ ] test .lst output of interpreter.js against .lst output of LCC when running on a .e file
  - [ ] test .lst output of lcc.js against .lst output of LCC when running on a .a file
- [x] implement test battery to run all tests one after the other, regardless of whether one or more tests fail, and to log the results of each test at the very end (currently the battery of tests stop when a single test fails)
- [x] move the docker startup and shutdown out of the test files and into a separate file that is called by the test files
- [x] move the name.nnn file existence check and creation out of the test files and into a separate file that is called by the test files, such that, for the test suite code, the name.nnn file is created only once, rather than once for each test, to cut down on unnecessary repeated file creations and deletions
- [ ] **implement an initial smoke test that simply attempts to run the lcc via the `lcc -h` command, and, if it fails, will skip attempting to run any other tests and will log an error message to the console. This test should notify the user explicitly what the issue is: for example, whether the lcc is not available/installed, or, that the lcc has not been given executable permissions, or that the current architecture is not supported by the lcc, etc.**
- ~~fix issue where interpreter.test.js runs expecting a .lst file to be created when, in fact, the .lst file is not created by the interpreter.js file, but by the lcc.js file~~ (interpreter.js should create a .lst file after all)
  - ~~change the interpreter.test.js to simply run the files and check for the expected output in the stdout, and to simulate the expected inputs, rather than checking for the existence of a .lst file~~
  - [x] migrate the majority of what is currently interpreter.test.js to lcc.test.js, which will test running lcc.js on a given file (supplied as an argument), and will check for the existence of the generated .lst file as well comparing the contents to make sure that they match
- [x] create an lccBattery.test.js which will call lcc.js on a list of specified .a files, and will compare the contents of each .lst file to the expected output (created by running the files with the number 1 appended to the end of their file names remotely in a dockerized container), and will log the results of each test at the very end
- [ ] test for duplicate labels
- [ ] test for correct usage of division
- [ ] test for line that is too long (300+ chars)
- [ ] test for a1test.a
- [ ] test for escaped strings, escaped chars
- [ ] test for colon terminated labels that have spaces preceding them on a line
- [ ] test for invalid mnemonic detection
- [ ] test for bad register detection
- [ ] test for bad immediate detection

## Fix
- [x] lcc.js assembly output .e file and assembler.js assembly output .e file should be the same, but currently are not, specifically in the headers (o, S, C, etc.)
- [x] interpreter.js output does not yet add an extra newline like lcc.js does. interpreter.js should however print an extra newline to the stdout after the program has finished executing
- [x] assembler.test.js should delete all extra files created during testing, but currently does not delete all extra files generated locally
- [x] there appears to be an infinite write loop glitch when running assembler.test.js on demoB.a, ideally there will be a way to cap infinite writes and max memory usage with a graceful failure and notification to the user that the test failed due to (near/potentially)infinite writes - the issue was that demoB.a was being interpretted by lcc, and the terminal process was waiting for intput infinitely
- [x] fix issue where interpreter.js needs there to be a name.nnn file but is currently running without one - move the logic to check for a name.nnn file from lcc.js to name.js and let interpreter.js call it so that, both interpreter.js when called directly can check for the name.nnn file, and lcc.js, by running interpreter.js as it already does, will automatically also make the same check via interpreter.js
- [ ] once symbolic debugger is implemented, detection of infinite loops should lead to symbolic debugger being called and the user being notified that an infinite loop was detected without terminating program execution
- [ ] refactor assembleMOV to simplify and DRY up logic
- [x] abort lcc.js assembly and execution if name input is not supplied when asked for
- [x] abort interpreter.js execution if name input is not supplied when asked for
- [x] fix issue where lcc appeared to be generated inconsistent newlines in .lst files (the issue was how the name.nnn file was being generated, it did indeed need to be terminated with a \n newline character)

## Extended Features
- [ ] hex viewer to inspect .e files

## Extra Features

- [ ] emoji support
- [ ] RAND support
- [ ] TIME support (seconds & milliseconds)
- [ ] new flags
  - [ ] infinite loop permission flag
  - [ ] turn off auto-symbolic debugger flag
- [ ] ability to detect single character press inputs ("KEYDOWN", "KEYUP", etc.) rather than requiring the user to press enter after each input
- [ ] deassembler (takes a .e file and outputs a .a file)
- [ ] website that allows users to upload .a files, run & see the output of the program, and download the .e file
- [ ] ability to include lcc.js extension modules via a comment in the .a file, which makes clear that a given program is an lcc.js+ extension program rather than a standard lcc.js program
- [ ] ability to get terminal dimensions and adjust the output of the program to fit the terminal window
- [ ] ability to make file system operations
- [ ] ability to parse text files
- [ ] ability to make fetch/http requests
- [ ] ability to make socket connections
- [ ] ability to make database connections
- [ ] ability to make system calls
- [ ] `gptin` and `gptout` instructions (sends/recieves program, program state, user input, gpt output via the api for some sort of response)
- [ ] custom user defined instructions/directives that override the default instructions/directives (`charout` instead of `aout`, numout instead of dout, etc.)