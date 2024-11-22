#!/usr/bin/env node

// disassembler.js
// LCC.js Disassembler

const fs = require('fs');
const path = require('path');

// Instruction mapping
const instructionSet = {
    0x0: 'br',
    0x1: 'add',
    0x2: 'ld',
    0x3: 'st',
    0x4: 'bl',
    0x5: 'and',
    0x6: 'ldr',
    0x7: 'str',
    0x8: 'cmp',
    0x9: 'not',
    0xA: 'misc',
    0xB: 'sub',
    0xC: 'jmp',
    0xD: 'mvi',
    0xE: 'lea',
    0xF: 'trap',
};

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
        } else {
            // Skip other entries (G, A, etc.)
            while (buffer[offset++] !== 0); // Skip null-terminated strings
        }
    }

    // Now offset points to the code section
    const codeStart = offset;
    const instructions = [];
    const branchTargets = new Set();

    // First pass: Read instructions and identify branch targets
    let pc = startAddress;
    while (offset + 1 < fileSize) {
        const word = buffer.readUInt16LE(offset);
        offset += 2;

        const instruction = {
            address: pc,
            word,
        };
        instructions.push(instruction);

        // Decode opcode
        const opcode = (word >> 12) & 0xF;

        // If the instruction is a branch, calculate the target address
        if (opcode === 0x0 || opcode === 0x4 || opcode === 0xC) {
            let pcoffset = 0;
            if (opcode === 0x0) { // BR
                pcoffset = signExtend(word & 0x1FF, 9);
            } else if (opcode === 0x4) { // BL
                if (((word >> 11) & 0x1) === 1) { // BL
                    pcoffset = signExtend(word & 0x7FF, 11);
                }
            } else if (opcode === 0xC) { // JMP
                // For JMP, we need to handle differently
            }

            const targetAddress = (pc + 1 + pcoffset) & 0xFFFF;
            branchTargets.add(targetAddress);
            instruction.targetAddress = targetAddress;
        }

        pc++;
    }

    // Assign labels to branch targets
    const addressToLabel = {};
    let labelCounter = 1;
    branchTargets.forEach(address => {
        addressToLabel[address] = `@L${labelCounter++}`;
    });

    // Second pass: Disassemble instructions
    const disassembledLines = [];
    instructions.forEach(instruction => {
        let line = '';

        // Insert label if this address is a branch target
        if (addressToLabel[instruction.address]) {
            line += `${addressToLabel[instruction.address]}:\n`;
        }

        // Decode instruction
        const { word } = instruction;
        const opcode = (word >> 12) & 0xF;
        const mnemonic = instructionSet[opcode] || 'unknown';

        // Decode operands based on instruction type
        let operands = '';

        switch (opcode) {
            case 0x0: // BR
                {
                    const cc = (word >> 9) & 0x7;
                    const pcoffset9 = signExtend(word & 0x1FF, 9);
                    const targetAddress = instruction.targetAddress;
                    const label = addressToLabel[targetAddress];
                    const ccMnemonic = getBranchCC(cc);
                    operands = `${ccMnemonic} ${label}`;
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
                }
                break;
            // Handle other opcodes similarly...
            case 0xF: // TRAP
                {
                    const trapvect8 = word & 0xFF;
                    const sr = (word >> 9) & 0x7;
                    const trapMnemonic = getTrapMnemonic(trapvect8);
                    operands = `${trapMnemonic} ${registerNames[sr]}`;
                    line += operands;
                    disassembledLines.push(line);
                    return;
                }
            default:
                // console.log(`Unknown opcode: ${opcode}`);
                operands = '...'; // For unimplemented opcodes
        }

        line += `    ${mnemonic} ${operands}`;
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

function getTrapMnemonic(trapvect8) {
    const trapMap = {
        0x00: 'halt',
        0x01: 'nl',
        0x02: 'dout',
        0x03: 'udout',
        0x04: 'hout',
        0x05: 'aout',
        0x06: 'sout',
        0x07: 'din',
        0x08: 'hin',
        0x09: 'ain',
        0x0A: 'sin',
        0x0B: 'm',
        0x0C: 'r',
        0x0D: 's',
        0x0E: 'bp',
    };
    return trapMap[trapvect8] || `trap ${trapvect8}`;
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
