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

## Test

- [x] negative numbers test (negative data in a .word, negative imm5 arg to `add`, negative inputs to `mov`)
- [x] `cmp` and `br` test

## Fix
- [ ] lcc.js assembly output .e file and assembler.js assembly output .e file should be the same, but currently are not, specifically in the headers (o, S, C, etc.)

## Extra Features

- [ ] emoji support
- [ ] RAND support
- [ ] TIME support
- [ ] new flags
  - [ ] infinite loop permission flag
  - [ ] turn off auto-symbolic debugger flag
