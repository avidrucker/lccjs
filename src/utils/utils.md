# Utilities

LCC.js has a few utility programs that help with the development of the main modules. Some of these utilities are necessary for the function of LCC.js (such as genStats.js and name.js), while others are more for helpful analysis (such as hexDisplay.js and picture.js).

- genStats.js: This program produces the .lst and .bst file outputs, which show program statistics in hex and binary formats, respectively.
- name.js: This program takes in a user's name and creates a name.nnn file to store it. The contents of the name.nnn file are used for displaying in the statistics files.
- hexDisplay.js: This program takes a machine code executable (.e) or object binary (.o) and displays it in hexadecimal format (a hex dump that is displayed "as-is" where the header entries are in big endian except for address numbers which are little endian, followed by the code in little endian format).
- picture.js: This program takes in a machine code executable (.e) or object binary (.o) and displays the binary data as a slightly more human-readable "picture" (a header followed by the code in big endian format).