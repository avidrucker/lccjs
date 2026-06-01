#!/usr/bin/env node

// picture.js
// Reads a .o or .e file and outputs a "picture" of the file

const fs = require('fs');
const { InvalidExecutableFormatError } = require('./errors');

// Reads a null-terminated string starting at `offset`. Returns { str, offset }
// where the returned offset points just past the terminating NUL (or past the
// end of the buffer if no NUL was found). Pure — no I/O.
function readNullTerminatedString(buffer, offset) {
    let str = '';
    while (offset < buffer.length) {
        const byte = buffer[offset++];
        if (byte === 0) break;
        str += String.fromCharCode(byte);
    }
    return { str, offset };
}

// Pure parse of an LCC object/executable buffer into a structured "picture":
//   { header: [...entries], codeWords: [...numbers] }
// Each header entry carries a `type` char. Address-bearing entries (S/A) add a
// numeric `address`; label-bearing entries (G/E/e/V) add `address` plus a string
// `label`. The leading 'o' magic and the terminating 'C' are included as bare
// entries. Throws InvalidExecutableFormatError on malformed input — no
// console output, no process.exit, no file I/O (the CLI wrapper owns those).
function parseObjectPicture(buffer) {
    let offset = 0;
    const fileSize = buffer.length;
    const header = [];

    if (offset >= fileSize) {
        throw new InvalidExecutableFormatError('Unexpected end of file');
    }

    const initialChar = String.fromCharCode(buffer[offset++]);
    if (initialChar !== 'o') {
        throw new InvalidExecutableFormatError("File does not start with 'o'");
    }
    header.push({ type: 'o' });

    // Read header entries until the 'C' terminator (or end of buffer).
    while (offset < fileSize) {
        const entryType = String.fromCharCode(buffer[offset++]);
        if (entryType === 'C') {
            header.push({ type: 'C' });
            break;
        }
        switch (entryType) {
            case 'S':
            case 'A': {
                if (offset + 1 >= fileSize) {
                    throw new InvalidExecutableFormatError(`Unexpected end of file while reading ${entryType} entry`);
                }
                const address = buffer.readUInt16LE(offset);
                offset += 2;
                header.push({ type: entryType, address });
                break;
            }
            case 'G':
            case 'E':
            case 'e':
            case 'V': {
                if (offset + 1 >= fileSize) {
                    throw new InvalidExecutableFormatError(`Unexpected end of file while reading ${entryType} entry`);
                }
                const address = buffer.readUInt16LE(offset);
                offset += 2;
                const { str: label, offset: newOffset } = readNullTerminatedString(buffer, offset);
                offset = newOffset;
                header.push({ type: entryType, address, label });
                break;
            }
            default:
                throw new InvalidExecutableFormatError(`Unknown header entry type: ${entryType}`);
        }
    }

    // Remaining whole 16-bit words form the code section.
    const codeWords = [];
    while (offset + 1 < fileSize) {
        const word = buffer.readUInt16LE(offset);
        offset += 2;
        codeWords.push(word);
    }

    return { header, codeWords };
}

// Pure render of a parsed picture (the inverse sink of parseObjectPicture) into
// the multi-line display string. Code words wrap 8 per line. Returns a string;
// the CLI is the only thing that prints it.
function formatPicture({ header, codeWords }) {
    const lines = ['Header:'];
    for (const entry of header) {
        if (entry.type === 'o' || entry.type === 'C') {
            lines.push(`   ${entry.type}`);
        } else if (entry.label !== undefined) {
            lines.push(`   ${entry.type} ${entry.address.toString(16).padStart(4, '0')} ${entry.label}`);
        } else {
            lines.push(`   ${entry.type} ${entry.address.toString(16).padStart(4, '0')}`);
        }
    }

    lines.push('Code:');
    let codeLine = '   ';
    for (let i = 0; i < codeWords.length; i++) {
        codeLine += codeWords[i].toString(16).padStart(4, '0');
        if ((i + 1) % 8 === 0) {
            lines.push(codeLine);
            codeLine = '   ';
        } else {
            codeLine += ' ';
        }
    }
    if (codeLine.trim() !== '') {
        lines.push(codeLine);
    }
    return lines.join('\n');
}

// CLI wrapper: owns argv parsing, file I/O, console output, and exit codes.
if (require.main === module) {
    if (process.argv.length !== 3) {
        console.error('Usage: node picture.js <filename>');
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

    try {
        console.log(formatPicture(parseObjectPicture(buffer)));
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}

// Export seam (#172): the pure parse/format helpers were previously buried in
// the CLI driver at module level (0% coverage). See tests/new/picture.unit.spec.js.
module.exports = { readNullTerminatedString, parseObjectPicture, formatPicture };
