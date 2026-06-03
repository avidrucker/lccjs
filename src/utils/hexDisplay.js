#!/usr/bin/env node

// hexDisplay.js
// Reads a .o or .e file and outputs a Hex/Ascii display of the file

const fs = require('fs');

// True for bytes that render as themselves in the ASCII gutter (space..~).
// Pure — no I/O.
function isPrintableASCII(byte) {
    return byte >= 32 && byte <= 126;
}

// Pure render of up to 16 bytes into one display line: space-separated
// big-endian hex pairs (a lone trailing byte stays a single pair), padded to a
// fixed width, then four spaces and the ASCII gutter (non-printables shown as
// '.'). Accepts an array or a Buffer slice. Returns a string — the CLI prints it.
function formatHexLine(bytes) {
    const arr = Array.from(bytes);

    const hexParts = [];
    for (let i = 0; i < arr.length; i += 2) {
        if (i + 1 < arr.length) {
            // Combine the two bytes as they appear in the file (big-endian).
            hexParts.push(
                arr[i].toString(16).padStart(2, '0').toUpperCase() +
                arr[i + 1].toString(16).padStart(2, '0').toUpperCase()
            );
        } else {
            // Odd trailing byte: emit it on its own.
            hexParts.push(arr[i].toString(16).padStart(2, '0').toUpperCase());
        }
    }

    const hexString = hexParts.join(' ');
    const asciiString = arr
        .map((byte) => (isPrintableASCII(byte) ? String.fromCharCode(byte) : '.'))
        .join('');

    // Pad the hex column to its maximum width (8 pairs * 4 chars + 7 spaces = 39)
    // so the ASCII gutter aligns across full and short lines.
    const totalHexWidth = 39;
    const padding = ' '.repeat(Math.max(0, totalHexWidth - hexString.length));

    return `${hexString}${padding}    ${asciiString}`;
}

// CLI wrapper: owns argv parsing, file I/O, console output, and exit codes.
if (require.main === module) {
    if (process.argv.length !== 3) {
        console.error('Usage: node hexDisplay.js <filename>');
        process.exit(1);
    }

    const fileName = process.argv[2];
    let buffer;
    try {
        buffer = fs.readFileSync(fileName);
    } catch (err) {
        console.error(`Cannot open file ${fileName}`);
        process.exit(1);
    }

    const bytesPerLine = 16;
    for (let offset = 0; offset < buffer.length; offset += bytesPerLine) {
        const lineBytes = Array.from(buffer.subarray(offset, offset + bytesPerLine));
        console.log(formatHexLine(lineBytes));
    }
}

// Export seam: isPrintableASCII + formatHexLine are pure functions — unit-testable
// without file I/O. See tests/new/hexDisplay.unit.spec.js.
module.exports = { isPrintableASCII, formatHexLine };
