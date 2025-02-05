#!/usr/bin/env node

// picture.js
// Reads a .o or .e file and outputs a "picture" of the file

import fs from "fs";
import path from 'path';

// Check command-line arguments
if (process.argv.length !== 3) {
    console.error('Usage: node picture.js <filename>');
    process.exit(1);
}

const fileName = process.argv[2];

// Read the file into a buffer
let buffer;
try {
    buffer = fs.readFileSync(fileName);
} catch (err) {
    console.error(`Cannot open file ${fileName}`);
    process.exit(1);
}

let offset = 0;
const fileSize = buffer.length;

// Function to read null-terminated string
function readNullTerminatedString(buffer, offset) {
    let str = '';
    while (offset < buffer.length) {
        const byte = buffer[offset++];
        if (byte === 0) break;
        str += String.fromCharCode(byte);
    }
    return { str, offset };
}

// Output header
console.log('Header:');
if (offset >= fileSize) {
    console.error('Unexpected end of file');
    process.exit(1);
}

// Read and print the initial 'o'
const initialChar = String.fromCharCode(buffer[offset++]);
if (initialChar !== 'o') {
    console.error('File does not start with \'o\'');
    process.exit(1);
}
console.log(`   ${initialChar}`);

// Read header entries until 'C'
while (offset < fileSize) {
    const entryType = String.fromCharCode(buffer[offset++]);
    if (entryType === 'C') {
        console.log(`   ${entryType}`);
        break;
    }
    switch (entryType) {
        case 'S': {
            if (offset + 1 >= fileSize) {
                console.error('Unexpected end of file while reading S entry');
                process.exit(1);
            }
            const address = buffer.readUInt16LE(offset);
            offset += 2;
            console.log(`   ${entryType} ${address.toString(16).padStart(4, '0')}`);
            break;
        }
        case 'G':
        case 'E':
        case 'e':
        case 'V': {
            if (offset + 1 >= fileSize) {
                console.error(`Unexpected end of file while reading ${entryType} entry`);
                process.exit(1);
            }
            const address = buffer.readUInt16LE(offset);
            offset += 2;
            const { str: label, offset: newOffset } = readNullTerminatedString(buffer, offset);
            offset = newOffset;
            console.log(`   ${entryType} ${address.toString(16).padStart(4, '0')} ${label}`);
            break;
        }
        case 'A': {
            if (offset + 1 >= fileSize) {
                console.error('Unexpected end of file while reading A entry');
                process.exit(1);
            }
            const address = buffer.readUInt16LE(offset);
            offset += 2;
            console.log(`   ${entryType} ${address.toString(16).padStart(4, '0')}`);
            break;
        }
        default:
            console.error(`Unknown header entry type: ${entryType}`);
            process.exit(1);
    }
}

// Now read code section
console.log('Code:');
const codeWords = [];
while (offset + 1 < fileSize) {
    const word = buffer.readUInt16LE(offset);
    offset += 2;
    codeWords.push(word.toString(16).padStart(4, '0'));
}

// Output code words
let codeLine = '   ';
for (let i = 0; i < codeWords.length; i++) {
    codeLine += codeWords[i];
    if ((i + 1) % 8 === 0) {
        console.log(codeLine);
        codeLine = '   ';
    } else {
        codeLine += ' ';
    }
}
if (codeLine.trim() !== '') {
    console.log(codeLine);
}
