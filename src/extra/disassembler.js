#!/usr/bin/env node

// disassembler.js
// LCC.js Disassembler

const fs = require('fs');

// Register names
const registerNames = ['r0', 'r1', 'r2', 'r3', 'r4', 'fp', 'sp', 'lr'];

// Global variables for label tracking
const codeLabels = {};
const dataLabels = {};
let codeLabelCounter = 1;
let dataLabelCounter = 1;

// Main disassembler function
function disassemble(fileName) {
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

    // Parse header
    if (buffer[offset++] !== 'o'.charCodeAt(0)) {
        console.error('Invalid file signature');
        process.exit(1);
    }

    let startAddress = 0;
    // Skip header entries (S, G, etc.) until 'C' is encountered
    while (offset < fileSize) {
        const entryType = String.fromCharCode(buffer[offset++]);
        if (entryType === 'C') {
            break;
        } else if (entryType === 'S') {
            startAddress = buffer.readUInt16LE(offset);
            offset += 2;
        } else if (['G', 'E', 'V'].includes(entryType)) {
            // Skip address and null-terminated string
            offset += 2; // Skip address
            while (buffer[offset++] !== 0); // Skip null-terminated string
        } else if (entryType === 'A') {
            offset += 2; // Skip address
        } else {
            console.error(`Unknown header entry type: ${entryType}`);
            process.exit(1);
        }
    }

    // Now offset points to the code section
    const instructions = [];
    const dataAddresses = new Set();
    const branchTargets = new Set();

    // First pass: Read instructions and identify branch and data targets
    let pc = startAddress;
    let bufferOffset = offset;

    while (bufferOffset + 1 <= fileSize) {
        const word = buffer.readUInt16LE(bufferOffset);

        const opcode = (word >> 12) & 0xF;

        // If we have already identified this address as data, stop interpreting as code
        if (dataAddresses.has(pc)) {
            break;
        }

        // Mark this address as code
        instructions.push({ address: pc, word });

        // Identify branch targets and data references
        if (opcode === 0x0) { // BR
            const pcoffset9 = signExtend(word & 0x1FF, 9);
            const targetAddress = (pc + 1 + pcoffset9) & 0xFFFF;
            branchTargets.add(targetAddress);
        } else if (opcode === 0x4) { // BL, BLR
            const bit11 = (word >> 11) & 0x1;
            if (bit11 === 1) { // BL
                const pcoffset11 = signExtend(word & 0x7FF, 11);
                const targetAddress = (pc + 1 + pcoffset11) & 0xFFFF;
                branchTargets.add(targetAddress);
            }
        } else if ([0x2, 0x3, 0xE].includes(opcode)) { // LD, ST, LEA
            const pcoffset9 = signExtend(word & 0x1FF, 9);
            const dataAddress = (pc + 1 + pcoffset9) & 0xFFFF;
            dataAddresses.add(dataAddress);
        }

        bufferOffset += 2;
        pc++;
    }

    // Assign code labels
    branchTargets.forEach(address => {
        codeLabels[address] = `@L${codeLabelCounter++}`;
    });

    // Assign data labels
    dataAddresses.forEach(address => {
        dataLabels[address] = `@D${dataLabelCounter++}`;
    });

    // Second pass: Disassemble instructions
    const disassembledLines = [];
    let i = 0;
    while (i < instructions.length) {
        const instruction = instructions[i];
        const { address, word } = instruction;

        // Check if this address is a data address
        if (dataLabels[address]) {
            // We've reached data, stop disassembling instructions
            break;
        }

        const line = disassembleInstruction(address, word, codeLabels);
        disassembledLines.push(line);
        i++;
    }

    // Process data sections
    processDataSections(buffer, bufferOffset, pc, fileSize, disassembledLines);

    // Output the disassembled code
    disassembledLines.forEach(line => console.log(line));
}

// Utility functions
function signExtend(value, bitCount) {
    const signBit = 1 << (bitCount - 1);
    return (value & (signBit - 1)) - (value & signBit);
}

function isPrintableASCII(word) {
    return word >= 32 && word <= 126;
}

function getBranchCC(cc) {
    const ccMap = {
        0: 'brz',
        1: 'brnz',
        2: 'brn',
        3: 'brp',
        4: 'brlt',
        5: 'brgt',
        6: 'brc',
        7: 'br',
    };
    return ccMap[cc] || 'br';
}

function getTrapInfo(trapvect8) {
    const trapMap = {
        0x00: { mnemonic: 'halt', needsRegister: false },
        0x01: { mnemonic: 'nl', needsRegister: false },
        0x02: { mnemonic: 'dout', needsRegister: true },
        0x03: { mnemonic: 'udout', needsRegister: true },
        0x04: { mnemonic: 'hout', needsRegister: true },
        0x05: { mnemonic: 'aout', needsRegister: true },
        0x06: { mnemonic: 'sout', needsRegister: true },
        0x07: { mnemonic: 'din', needsRegister: true },
        0x08: { mnemonic: 'hin', needsRegister: true },
        0x09: { mnemonic: 'ain', needsRegister: true },
        0x0A: { mnemonic: 'sin', needsRegister: true },
        0x0B: { mnemonic: 'm', needsRegister: false },
        0x0C: { mnemonic: 'r', needsRegister: false },
        0x0D: { mnemonic: 's', needsRegister: false },
        0x0E: { mnemonic: 'bp', needsRegister: false },
    };
    return trapMap[trapvect8];
}

function disassembleInstruction(address, word, codeLabels) {
    const label = codeLabels[address] ? `${codeLabels[address]}: ` : '';
    const opcode = (word >> 12) & 0xF;
    let mnemonic = '???';
    let operands = '';

    switch (opcode) {
        case 0x0: // BR
            {
                const cc = (word >> 9) & 0x7;
                const pcoffset9 = signExtend(word & 0x1FF, 9);
                const targetAddress = (address + 1 + pcoffset9) & 0xFFFF;
                const labelTarget = codeLabels[targetAddress] || `@Addr${targetAddress}`;
                mnemonic = getBranchCC(cc);
                operands = `${labelTarget}`;
            }
            break;
        case 0x1: // ADD
            {
                const dr = (word >> 9) & 0x7;
                const sr1 = (word >> 6) & 0x7;
                const mode = (word >> 5) & 0x1;
                if (mode === 0) {
                    const sr2 = word & 0x7;
                    operands = `${registerNames[dr]}, ${registerNames[sr1]}, ${registerNames[sr2]}`;
                } else {
                    const imm5 = signExtend(word & 0x1F, 5);
                    operands = `${registerNames[dr]}, ${registerNames[sr1]}, ${imm5}`;
                }
                mnemonic = 'add';
            }
            break;
        case 0x2: // LD
            {
                const dr = (word >> 9) & 0x7;
                const pcoffset9 = signExtend(word & 0x1FF, 9);
                const dataAddress = (address + 1 + pcoffset9) & 0xFFFF;
                const labelData = dataLabels[dataAddress] || assignDataLabel(dataAddress);
                mnemonic = 'ld';
                operands = `${registerNames[dr]}, ${labelData}`;
            }
            break;
        case 0x3: // ST
            {
                const sr = (word >> 9) & 0x7;
                const pcoffset9 = signExtend(word & 0x1FF, 9);
                const dataAddress = (address + 1 + pcoffset9) & 0xFFFF;
                const labelData = dataLabels[dataAddress] || assignDataLabel(dataAddress);
                mnemonic = 'st';
                operands = `${registerNames[sr]}, ${labelData}`;
            }
            break;
        case 0x4: // BL or BLR
            {
                const bit11 = (word >> 11) & 0x1;
                if (bit11 === 1) { // BL
                    const pcoffset11 = signExtend(word & 0x7FF, 11);
                    const targetAddress = (address + 1 + pcoffset11) & 0xFFFF;
                    const labelTarget = codeLabels[targetAddress] || assignCodeLabel(targetAddress);
                    mnemonic = 'bl';
                    operands = `${labelTarget}`;
                } else {
                    // BLR or JSRR
                    const baseR = (word >> 6) & 0x7;
                    const offset6 = signExtend(word & 0x3F, 6);
                    mnemonic = 'blr';
                    operands = `${registerNames[baseR]}`;
                    if (offset6 !== 0) {
                        operands += `, ${offset6}`;
                    }
                }
            }
            break;
        case 0x5: // AND
            {
                const dr = (word >> 9) & 0x7;
                const sr1 = (word >> 6) & 0x7;
                const mode = (word >> 5) & 0x1;
                if (mode === 0) {
                    const sr2 = word & 0x7;
                    operands = `${registerNames[dr]}, ${registerNames[sr1]}, ${registerNames[sr2]}`;
                } else {
                    const imm5 = signExtend(word & 0x1F, 5);
                    operands = `${registerNames[dr]}, ${registerNames[sr1]}, ${imm5}`;
                }
                mnemonic = 'and';
            }
            break;
        case 0x8: // CMP
            {
                const sr1 = (word >> 6) & 0x7;
                const mode = (word >> 5) & 0x1;
                if (mode === 0) {
                    const sr2 = word & 0x7;
                    operands = `${registerNames[sr1]}, ${registerNames[sr2]}`;
                } else {
                    const imm5 = signExtend(word & 0x1F, 5);
                    operands = `${registerNames[sr1]}, ${imm5}`;
                }
                mnemonic = 'cmp';
            }
            break;
        case 0xB: // SUB
            {
                const dr = (word >> 9) & 0x7;
                const sr1 = (word >> 6) & 0x7;
                const mode = (word >> 5) & 0x1;
                if (mode === 0) {
                    const sr2 = word & 0x7;
                    operands = `${registerNames[dr]}, ${registerNames[sr1]}, ${registerNames[sr2]}`;
                } else {
                    const imm5 = signExtend(word & 0x1F, 5);
                    operands = `${registerNames[dr]}, ${registerNames[sr1]}, ${imm5}`;
                }
                mnemonic = 'sub';
            }
            break;
        case 0xC: // JMP or RET
            {
                const baseR = (word >> 6) & 0x7;
                const offset6 = signExtend(word & 0x3F, 6);
                if (baseR === 7 && offset6 === 0) { // RET
                    mnemonic = 'ret';
                    operands = '';
                } else {
                    mnemonic = 'jmp';
                    operands = `${registerNames[baseR]}`;
                    if (offset6 !== 0) {
                        operands += `, ${offset6}`;
                    }
                }
            }
            break;
        case 0xD: // MVI
            {
                const dr = (word >> 9) & 0x7;
                const imm9 = signExtend(word & 0x1FF, 9);
                mnemonic = 'mvi';
                operands = `${registerNames[dr]}, ${imm9}`;
            }
            break;
        case 0xE: // LEA
            {
                const dr = (word >> 9) & 0x7;
                const pcoffset9 = signExtend(word & 0x1FF, 9);
                const dataAddress = (address + 1 + pcoffset9) & 0xFFFF;
                const labelData = dataLabels[dataAddress] || assignDataLabel(dataAddress);
                mnemonic = 'lea';
                operands = `${registerNames[dr]}, ${labelData}`;
            }
            break;
        case 0xA: // MISC (PUSH, POP, MVR)
            {
                const sr_dr = (word >> 9) & 0x7;
                const eopcode = word & 0x3F; // bits 5-0
                switch (eopcode) {
                    case 0x00: // PUSH
                        mnemonic = 'push';
                        operands = `${registerNames[sr_dr]}`;
                        break;
                    case 0x01: // POP
                        mnemonic = 'pop';
                        operands = `${registerNames[sr_dr]}`;
                        break;
                    case 0x0C: // MVR
                        const sr1 = (word >> 6) & 0x7;
                        mnemonic = 'mvr';
                        operands = `${registerNames[sr_dr]}, ${registerNames[sr1]}`;
                        break;
                    default:
                        mnemonic = '???';
                        operands = '';
                }
            }
            break;
        case 0xF: // TRAP
            {
                const trapvect8 = word & 0xFF;
                const dr_sr = (word >> 9) & 0x7;
                const trapInfo = getTrapInfo(trapvect8);
                if (trapInfo) {
                    mnemonic = trapInfo.mnemonic;
                    operands = trapInfo.needsRegister ? `${registerNames[dr_sr]}` : '';
                } else {
                    mnemonic = `trap`;
                    operands = `${trapvect8}`;
                }
            }
            break;
        default:
            mnemonic = '???';
            operands = '';
    }

    return `${label.padEnd(5)} ${mnemonic}${operands ? ' ' + operands : ''}`;
}

function assignDataLabel(address) {
    if (!dataLabels[address]) {
        dataLabels[address] = `@D${dataLabelCounter++}`;
    }
    return dataLabels[address];
}

function assignCodeLabel(address) {
    if (!codeLabels[address]) {
        codeLabels[address] = `@L${codeLabelCounter++}`;
    }
    return codeLabels[address];
}

function processDataSections(buffer, offset, pc, fileSize, disassembledLines) {
    // Collect all data label addresses and sort them
    const dataLabelAddresses = Object.keys(dataLabels).map(addr => parseInt(addr)).sort((a, b) => a - b);

    let currentIndex = 0;
    while (offset + 1 <= fileSize) {
        const address = pc;

        // If current address matches a data label, use it
        let label = dataLabels[address];
        if (!label) {
            label = assignDataLabel(address);
        }

        let nextDataLabelAddress = dataLabelAddresses.find(addr => addr > address);
        let dataEndAddress = nextDataLabelAddress !== undefined ? nextDataLabelAddress : Infinity;

        // Start processing data from current address until next data label or end of data
        let tempOffset = offset;
        let tempPc = pc;

        // Check for strings
        let isString = true;
        const chars = [];
        while (tempOffset + 1 <= fileSize && tempPc < dataEndAddress) {
            const word = buffer.readUInt16LE(tempOffset);
            if (word === 0) {
                // Null terminator
                chars.push(0);
                tempOffset += 2;
                tempPc++;
                break;
            } else if (isPrintableASCII(word)) {
                chars.push(word);
                tempOffset += 2;
                tempPc++;
            } else {
                isString = false;
                break;
            }
        }

        if (isString && chars.length > 1 && chars[chars.length - 1] === 0) {
            // It's a string
            const strContent = chars.slice(0, -1).map(c => String.fromCharCode(c)).join('');
            const line = `${label}:`.padEnd(5) + ` .string "${strContent.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
            disassembledLines.push(line);
            offset = tempOffset;
            pc = tempPc;
            continue;
        }

        // Check for zeros up to next data label or end of data
        let zeroCount = 0;
        tempOffset = offset;
        tempPc = pc;
        while (tempOffset + 1 <= fileSize && tempPc < dataEndAddress) {
            const word = buffer.readUInt16LE(tempOffset);
            if (word === 0) {
                zeroCount++;
                tempOffset += 2;
                tempPc++;
            } else {
                break;
            }
        }

        if (zeroCount > 0) {
            // It's zeros
            const line = `${label}:`.padEnd(5) + ` .zero ${zeroCount}`;
            disassembledLines.push(line);
            offset = tempOffset;
            pc = tempPc;
            continue;
        }

        // Else, treat as words up to next data label or end of data
        tempOffset = offset;
        tempPc = pc;
        let firstLine = true;
        while (tempOffset + 1 <= fileSize && tempPc < dataEndAddress) {
            const word = buffer.readUInt16LE(tempOffset);
            const lineLabel = firstLine ? `${label}:` : '';
            disassembledLines.push(`${lineLabel}`.padEnd(5) + ` .word ${signExtend(word, 16)}`);
            tempOffset += 2;
            tempPc++;
            firstLine = false;
        }
        offset = tempOffset;
        pc = tempPc;
    }
}

// Entry point
if (require.main === module) {
    if (process.argv.length !== 3) {
        console.error('Usage: node disassembler.js <filename>');
        process.exit(1);
    }

    const fileName = process.argv[2];
    disassemble(fileName);
}
