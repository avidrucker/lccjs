# TO-DO's

## Core Features

- [x] implement .string, sout, & sin
- [x] implement blocking input for sin when executing
- [x] implement sin/sout execution output in bst
- [x] implement BST creation
- [ ] implement linker
- [ ] implement symbolic debugger
    - [ ] implement debugger commands
- [x] implement LST creation
- [x] implement name.js module
- [x] infinite loop detection
- [ ] implement 300 char limit per line & corresponding error in assembler
- [x] implement more directives like `.start`, `.org/.orig`, `.fill` (alt to `.word`), `.blkw` (alt to `.zero`), etc.
- [x] implement dout/udout/hout/aout in interpreter.js
- [x] implement din/ain/hin in interpreter.js
- [ ] implement debugging commands s (stack), m (memory), r (registers), bp (break point)
  - [ ] stack draw function
  - [x] memory draw function
  - [ ] registers draw function
- [ ] implement flag setting for lcc.js such as `-d` for debug mode, `-L` for load point, `-r` switch to display registers at program end, `-m` switch to display memory to be displayed at program end, etc. 
- [ ] piping of an Assembly file's output into a text file
- [ ] implement `cea` mnemonic
- [x] implement `cmp` mnemonic
- [ ] include comments in BST/LST files
- [ ] include all headers (S, etc.) in BST/LST files

## Test

- [x] negative numbers test (negative data in a .word, negative imm5 arg to `add`, negative inputs to `mov`)
- [x] `cmp` and `br` test
- [x] implement .e file testing that compares the hex dump of assembler.js's output and lcc's output
- [ ] use lcc locally to test if the lcc exists on local machine
- [ ] write script to install ubuntu docker image with lcc to run tests on when lcc does not exist on local machine
  - [ ] create docker image with lcc 63 installed, host it on dockerhub so that it can be pulled down for testing purposes
- [ ] write docker checks for (1) to see if docker is installed on the current machine and (2) to see if docker is currently running, so the tests fail gracefully and give helpful outputs such as "error: docker is not installed" or "error: docker is not running"
- [ ] test the stdout output of executing a program given a .a/.e file and specific inputs by comparing the .lst/.bst outputs of interpreter.js and the lcc
- [x] implement test battery to run all tests one after the other, regardless of whether one or more tests fail, and to log the results of each test at the very end (currently the battery of tests stop when a single test fails)
- [x] move the docker startup and shutdown out of the test files and into a separate file that is called by the test files
- [ ] move the name.nnn file existence check and creation out of the test files and into a separate file that is called by the test files, such that, for the test suite code, the name.nnn file is created only once, rather than once for each test, to cut down on unnecessary repeated file creations and deletions
- [ ] implement an initial smokescreen test that simply attempts to run the lcc via the `lcc -h` command, and, if it fails, will skip attempting to run any other tests and will log an error message to the console. This test should notify the user explicitly what the issue is: for example, whether the lcc is not available/installed, or, that the lcc has not been given executable permissions, or that the current architecture is not supported by the lcc, etc.
- [ ] fix issue where interpreter.test.js runs expecting a .lst file to be created when, in fact, the .lst file is not created by the interpreter.js file, but by the lcc.js file
  - [ ] change the interpreter.test.js to simply run the files and check for the expected output in the stdout, and to simulate the expected inputs, rather than checking for the existence of a .lst file
  - [ ] migrate the majority of what is currently interpreter.test.js to lcc.test.js, which will test running lcc.js on a given file (supplied as an argument), and will check for the existence of the generated .lst file as well comparing the contents to make sure that they match
- [ ] create an lccBattery.test.js which will call lcc.js on a list of specified .a files, and will compare the contents of each .lst file to the expected output (created by running the files with the number 1 appended to the end of their file names remotely in a dockerized container), and will log the results of each test at the very end 

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

## Extra Features

- [ ] emoji support
- [ ] RAND support
- [ ] TIME support
- [ ] new flags
  - [ ] infinite loop permission flag
  - [ ] turn off auto-symbolic debugger flag
