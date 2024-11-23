#!/usr/bin/env node

// disassembler.js
// LCC.js Disassembler

const fs = require('fs');

// Register names
const registerNames = ['r0', 'r1', 'r2', 'r3', 'r4', 'fp', 'sp', 'lr'];

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
        } else if (entryType === 'G' || entryType === 'E' || entryType === 'V') {
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
    const branchTargets = new Set();
    const dataTargets = new Set();

    // First pass: Read instructions and identify branch and data targets
    let pc = startAddress;
    while (offset + 1 <= fileSize) {
        const word = buffer.readUInt16LE(offset);
        offset += 2;

        const instruction = {
            address: pc,
            word,
        };
        instructions.push(instruction);

        // Decode opcode
        const opcode = (word >> 12) & 0xF;

        // Identify branch and data targets
        if (opcode === 0x0) { // BR
            const pcoffset9 = signExtend(word & 0x1FF, 9);
            const targetAddress = (pc + 1 + pcoffset9) & 0xFFFF;
            branchTargets.add(targetAddress);
            instruction.targetAddress = targetAddress;
        } else if (opcode === 0x4) { // BL or BLR
            const bit11 = (word >> 11) & 0x1;
            if (bit11 === 1) { // BL
                const pcoffset11 = signExtend(word & 0x7FF, 11);
                const targetAddress = (pc + 1 + pcoffset11) & 0xFFFF;
                branchTargets.add(targetAddress);
                instruction.targetAddress = targetAddress;
            }
        } else if (opcode === 0x2 || opcode === 0x3 || opcode === 0xE) { // LD, ST, LEA
            const pcoffset9 = signExtend(word & 0x1FF, 9);
            const targetAddress = (pc + 1 + pcoffset9) & 0xFFFF;
            dataTargets.add(targetAddress);
            instruction.dataAddress = targetAddress;
        }

        pc++;
    }

    // Assign labels to branch and data targets
    const addressToLabel = {};
    const addressToDataLabel = {};
    let labelCounter = 1;
    let dataLabelCounter = 1;
    branchTargets.forEach(address => {
        addressToLabel[address] = `@L${labelCounter++}`;
    });
    dataTargets.forEach(address => {
        addressToDataLabel[address] = `@D${dataLabelCounter++}`;
    });

    // Second pass: Disassemble instructions
    const disassembledLines = [];
    instructions.forEach(instruction => {
        // Insert label if this address is a branch target
        if (addressToLabel[instruction.address]) {
            disassembledLines.push(`${addressToLabel[instruction.address]}:`);
        }

        // Insert data label if this address is a data target
        if (addressToDataLabel[instruction.address]) {
            disassembledLines.push(`${addressToDataLabel[instruction.address]}:`);
        }

        // Check if this address is in dataTargets
        if (dataTargets.has(instruction.address)) {
            // This is data
            const dataValue = signExtend(instruction.word, 16);
            disassembledLines.push(`    .word ${dataValue}`);
            return; // Skip disassembling as instruction
        }

        let mnemonic = '';
        let operands = '';

        // Decode instruction
        const { word } = instruction;
        const opcode = (word >> 12) & 0xF;

        switch (opcode) {
            case 0x0: // BR
                {
                    const cc = (word >> 9) & 0x7;
                    const pcoffset9 = signExtend(word & 0x1FF, 9);
                    const targetAddress = (instruction.address + 1 + pcoffset9) & 0xFFFF;
                    const label = addressToLabel[targetAddress] || `@Addr${targetAddress}`;
                    mnemonic = getBranchCC(cc);
                    operands = `${label}`;
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
                    const targetAddress = (instruction.address + 1 + pcoffset9) & 0xFFFF;
                    const label = addressToDataLabel[targetAddress] || `@Addr${targetAddress}`;
                    mnemonic = 'ld';
                    operands = `${registerNames[dr]}, ${label}`;
                }
                break;
            case 0x3: // ST
                {
                    const sr = (word >> 9) & 0x7;
                    const pcoffset9 = signExtend(word & 0x1FF, 9);
                    const targetAddress = (instruction.address + 1 + pcoffset9) & 0xFFFF;
                    const label = addressToDataLabel[targetAddress] || `@Addr${targetAddress}`;
                    mnemonic = 'st';
                    operands = `${registerNames[sr]}, ${label}`;
                }
                break;
            case 0x4: // BL or BLR
                {
                    const bit11 = (word >> 11) & 0x1;
                    if (bit11 === 1) { // BL
                        const pcoffset11 = signExtend(word & 0x7FF, 11);
                        const targetAddress = (instruction.address + 1 + pcoffset11) & 0xFFFF;
                        const label = addressToLabel[targetAddress] || `@Addr${targetAddress}`;
                        mnemonic = 'bl';
                        operands = `${label}`;
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

        // Output the line with indentation
        let line = `    ${mnemonic}`;
        if (operands) {
            line += ` ${operands}`;
        }
        disassembledLines.push(line);
    });

    // Output the disassembled code
    disassembledLines.forEach(line => console.log(line));
}

// Utility functions
function signExtend(value, bitCount) {
    const signBit = 1 << (bitCount - 1);
    if (value & signBit) {
        value -= 1 << bitCount;
    }
    return value;
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

// Entry point
if (require.main === module) {
    if (process.argv.length !== 3) {
        console.error('Usage: node disassembler.js <filename>');
        process.exit(1);
    }

    const fileName = process.argv[2];
    disassemble(fileName);
}
