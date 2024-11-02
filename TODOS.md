# TO-DO's

## Core Features

- [x] implement .string, sout, & sin
- [x] implement blocking input for sin when executing
- [x] implement sin/sout execution output in bst
- [x] implement BST creation
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
  - [ ] memory draw function
  - [ ] registers draw function
- [ ] implement flag setting for lcc.js such as `-d` for debug mode, `-L` for load point, `-r` switch to display registers at program end, `-m` switch to display memory to be displayed at program end, etc. 
- [ ] piping of an Assembly file's output into a text file
- [ ] implement `cea` mnemonic
- [x] implement `cmp` mnemonic
- [ ] include comments in BST/LST files
- [ ] include all headers (S, etc.) in BST/LST files
- [ ] implement .e file testing that compares the hex dump of assembler.js's output and lcc's output
- [ ] use lcc locally to test if the lcc exists on local machine
- [ ] write script to install ubuntu docker image with lcc to run tests on when lcc does not exist on local machine

## Test

- [x] negative numbers test (negative data in a .word, negative imm5 arg to `add`, negative inputs to `mov`)
- [x] `cmp` and `br` test

## Fix
- [x] lcc.js assembly output .e file and assembler.js assembly output .e file should be the same, but currently are not, specifically in the headers (o, S, C, etc.)
- [ ] interpreter.js output does not yet add an extra newline like lcc.js does. interpreter.js should however print an extra newline to the stdout after the program has finished executing
- [x] assembler.test.js should delete all extra files created during testing, but currently does not delete all extra files generated locally
- [x] there appears to be an infinite write loop glitch when running assembler.test.js on demoB.a, ideally there will be a way to cap infinite writes and max memory usage with a graceful failure and notification to the user that the test failed due to (near/potentially)infinite writes - the issue was that demoB.a was being interpretted by lcc, and the terminal process was waiting for intput infinitely

## Extra Features

- [ ] emoji support
- [ ] RAND support
- [ ] TIME support
- [ ] new flags
  - [ ] infinite loop permission flag
  - [ ] turn off auto-symbolic debugger flag
