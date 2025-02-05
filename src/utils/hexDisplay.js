#!/usr/bin/env node

// hexDisplay.js
// Reads a .o or .e file and outputs a Hex/Ascii display of the file

import fs from "fs";

// Check command-line arguments
if (process.argv.length !== 3) {
    console.error('Usage: node hexDisplay.js <filename>');
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

// Function to determine if a byte is a printable ASCII character
function isPrintableASCII(byte) {
    return byte >= 32 && byte <= 126;
}

// We'll process the buffer, starting from the current offset
// Process 16 bytes per line
const bytesPerLine = 16;

while (offset < fileSize) {
    const lineBytes = [];
    const asciiChars = [];

    // Read up to bytesPerLine bytes
    for (let i = 0; i < bytesPerLine && offset < fileSize; i++, offset++) {
        const byte = buffer[offset];
        lineBytes.push(byte);
        asciiChars.push(isPrintableASCII(byte) ? String.fromCharCode(byte) : '.');
    }

    // Format hex output without swapping bytes
    const hexParts = [];
    for (let i = 0; i < lineBytes.length; i += 2) {
        if (i + 1 < lineBytes.length) {
            const byte1 = lineBytes[i];
            const byte2 = lineBytes[i + 1];
            // Combine bytes as they appear in the file (big-endian)
            hexParts.push(byte1.toString(16).padStart(2, '0').toUpperCase() + byte2.toString(16).padStart(2, '0').toUpperCase());
        } else {
            // If we have an odd number of bytes, output the last byte
            const byte = lineBytes[i];
            hexParts.push(byte.toString(16).padStart(2, '0').toUpperCase());
        }
    }

    // Join hex parts with spaces
    const hexString = hexParts.join(' ');

    // Join ASCII characters
    const asciiString = asciiChars.join('');

    // Calculate padding to align ASCII output
    const totalHexWidth = 39; // Maximum width of hex string (for 16 bytes)
    const padding = ' '.repeat(totalHexWidth - hexString.length);

    // Output the line
    console.log(`${hexString}${padding}    ${asciiString}`);
}
