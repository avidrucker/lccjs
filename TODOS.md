# TO-DO's

## Core Features

- [x] implement .string, sout, & sin
- [x] implement blocking input for sin when executing
- [x] implement sin/sout execution output in bst
- [x] implement BST creation
- [ ] implement symbolic debugger
    - [ ] implement debugger commands
- [ ] implement LST creation
- [x] implement name.js module
- [ ] implement 300 char limit per line & corresponding error in assembler
- [ ] implement more directives like `.start`, `.org/.orig`, `.fill` (alt to `.word`), `.blkw` (alt to `.zero`), etc.
- [x] implement dout/udout/hout/aout in interpreter.js
- [x] implement din/ain/hin in interpreter.js
- [ ] implement debugging commands s (stack), m (memory), r (registers), bp (break point)
  - [ ] stack draw function
  - [ ] memory draw function
  - [ ] registers draw function
- [ ] implement flag setting for lcc.js such as `-d` for debug mode, `-L` for load point, `-r` switch ti display registers at program end, `-m` switch to display memory to be displayed at program end, etc. 
- [ ] piping of an Assembly file's output into a text file
- [ ] implement `cea` mnemonic

## Test

- [ ] negative numbers test (negative data in a .word, negative imm5 arg to `add`, negative inputs to `mov`)

## Extra Features

- [ ] emoji support
- [ ] RAND support
- [ ] TIME support
- [ ] new flags
  - [ ] infinite loop permission flag
  - [ ] turn off auto-symbolic debugger flag
