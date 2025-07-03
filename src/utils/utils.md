# Utilities

LCC.js has a few utility programs that help with the development of the main modules. Some of these utilities are necessary for the function of LCC.js (such as genStats.js and name.js), while others are more for helpful analysis (such as hexDisplay.js and picture.js).

- genStats.js: This program produces the .lst and .bst file outputs, which show program statistics in hex and binary formats, respectively.
- name.js: This program takes in a user's name and creates a name.nnn file to store it. The contents of the name.nnn file are used for displaying in the statistics files.
- hexDisplay.js: This program takes a machine code executable (.e) or object binary (.o) and displays it in hexadecimal format (a hex dump that is displayed "as-is" where the header entries are in big endian except for address numbers which are little endian, followed by the code in little endian format).
- picture.js: This program takes in a machine code executable (.e) or object binary (.o) and displays the binary data as a slightly more human-readable "picture" (a header followed by the code in big endian format).

Longer Summaries:

genStats.js

Generates .lst (listing) and .bst (binary listing) reports combining assembler or interpreter metadata, memory dumps, and runtime statistics. Produces formatted text output showing addresses, opcodes (hex or binary), source lines, and program metrics like instruction counts and stack usage. Used for debugging and performance analysis.

name.js

Checks for a name.nnn file in the working directory and reads the stored user name. If missing, prompts interactively for a "LastName, FirstName MiddleInitial" string, saves it to name.nnn, and returns the value. Used to embed author metadata in generated files.

hexDisplay.js

Reads a .o or .e binary and prints a formatted hex+ASCII display of its contents, similar to xxd. Each line shows hexadecimal word pairs alongside printable ASCII characters, helping developers inspect raw binaries for debugging or reverse engineering.

picture.js

Reads a .o or .e binary and outputs a textual representation of header entries and code words. Unlike hexDisplay.js, this tool emphasizes decoding the header metadata (symbols, labels, addresses) and shows the raw machine code words in structured lines, useful for quickly understanding file structure rather than raw byte values.
