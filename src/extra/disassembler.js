#!/usr/bin/env node

// disassembler.js
// LCC.js Disassembler - Execution Order Processing with WIP Disassembly

const fs = require('fs');

// Register names
const registerNames = ['r0', 'r1', 'r2', 'r3', 'r4', 'fp', 'sp', 'lr'];

// Label Counters
let codeLabelCounter = 1;
let dataLabelCounter = 1;

// Label Mapping
const labels = {}; // address -> label (e.g., {0: '@L1', 3: '@D1'})

// Processed Addresses
const processedAddresses = new Set();

// Disassembled Code Lines
const disassembledCode = [];

let nextAddress = -1;

// WIP Disassembly Data Structure
let WIPDisassembly = {}; // address -> {macword, label, opcode, operands, mnemonic, value}

// Link Register Stack (to handle nested BL/RET)
const linkRegisterStack = [];

// Machine Words Array
let machineWords = [];

// Queue for Addresses to Process
const queue = [];

// Start Address (if provided)
let startAddress = null;

function adjustZeroDirectives() {
    // Get all addresses in WIPDisassembly, sorted
    const addresses = Object.keys(WIPDisassembly).map(Number).sort((a, b) => a - b);

    // Collect all label addresses
    const labelAddresses = Object.keys(labels).map(Number).sort((a, b) => a - b);

    // For each address with a `.zero` directive
    for (let addr of addresses) {
        const entry = WIPDisassembly[addr];
        if (entry.mnemonic === '.zero') {
            let zeroStart = addr;
            let zeroCount = entry.count;

            // Check for labels within the zero range (excluding the starting address)
            for (let labelAddr of labelAddresses) {
                if (labelAddr > zeroStart && labelAddr < zeroStart + zeroCount) {
                    // Adjust zeroCount to stop before the label
                    let adjustedCount = labelAddr - zeroStart;
                    // console.log(`Adjusting .zero at address ${zeroStart} from count ${zeroCount} to ${adjustedCount} due to label at ${labelAddr}`);
                    entry.count = adjustedCount;
                    zeroCount = adjustedCount;
                    break; // Assuming no overlapping labels within zero range
                }
            }
        }
    }
}

// Main Disassembler Function
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

    // Parse Header
    if (buffer[offset++] !== 'o'.charCodeAt(0)) {
        console.error('Invalid file signature');
        process.exit(1);
    }

    // Read header entries until 'C' is encountered
    while (offset < fileSize) {
        const entryType = String.fromCharCode(buffer[offset++]);
        if (entryType === 'C') {
            break;
        } else if (entryType === 'S') {
            // Read next 2 bytes as start address (little endian)
            if (offset + 1 >= fileSize) {
                console.error('Unexpected end of file while reading start address');
                process.exit(1);
            }
            startAddress = buffer.readUInt16LE(offset);
            console.log("Start Address detected:", startAddress);
            offset += 2;
        } else if (['G', 'E', 'V'].includes(entryType)) {
            // Skip address (2 bytes) and null-terminated string
            offset += 2; // Skip address
            while (offset < fileSize && buffer[offset++] !== 0);
        } else if (entryType === 'A') {
            // Skip address (2 bytes)
            offset += 2;
        } else {
            console.error(`Unknown header entry type: ${entryType}`);
            process.exit(1);
        }
    }

    // Read Machine Words (16-bit, little endian)
    while (offset + 1 < fileSize) {
        const word = buffer.readUInt16LE(offset);
        machineWords.push(word);
        offset += 2;
    }

    // Initialize WIP Disassembly
    for (let i = 0; i < machineWords.length; i++) {
        WIPDisassembly[i] = {
            macword: machineWords[i].toString(16).padStart(4, '0').toUpperCase(),
        };
    }

    // Initialize Processing Queue and Labels
    if (startAddress !== null) {
        // Assign @L1 to startAddress
        assignLabel(startAddress, 'code');
        disassembledCode.push(''.padEnd(7) + `.start ${labels[startAddress]}`);
        queue.push(startAddress);
    } else {
        // No start address; begin at address 0
        queue.push(0);
    }

    // Process the code in execution order
    while (queue.length > 0) {
        const currentAddress = queue.shift();

        //////
        // if (processedAddresses.has(currentAddress)) {
        //     continue; // Skip already processed addresses
        // }

        processedAddresses.add(currentAddress);

        // Fetch Machine Word
        const word = machineWords[currentAddress];
        if (word === undefined) {
            console.warn(`Warning: No machine word found at address ${currentAddress}`);
            continue;
        }

        // Check if the address is a data label
        if (labels[currentAddress] && labels[currentAddress].startsWith('@D')) {
            // Process data
            processData(currentAddress);
            //// printWIPDisassembly();
            continue; // No need to process further
        }

        // Disassemble Instruction
        const { mnemonic, operands } = disassembleInstruction(currentAddress, word);

        // Update WIP Disassembly
        WIPDisassembly[currentAddress].opcode = mnemonic;
        WIPDisassembly[currentAddress].operands = operands;

        // Add Label if Exists
        if (labels[currentAddress]) {
            WIPDisassembly[currentAddress].label = labels[currentAddress];
        }

        // Handle Instruction Types
        const opcode = (word >> 12) & 0xF;

        switch (opcode) {
            case 0x4: // BL or BLR
                handleBL(currentAddress, word);
                break;
            case 0x2: // LD
            case 0x3: // ST
            case 0xE: // LEA
                handleDataInstruction(currentAddress, word);
                break;
            case 0xC: // JMP or RET
                handleJMPRET(currentAddress, word);
                break;
            case 0xF: // TRAP
                const trapvect8 = word & 0xFF;
                if (trapvect8 === 0x00) { // halt
                    // Update WIP Disassembly
                    WIPDisassembly[currentAddress].opcode = 'halt';
                } 
                enqueueNextAddress(currentAddress);
                break;
            default:
                // console.log("Enqueuing next address after processing:", currentAddress);
                enqueueNextAddress(currentAddress);
                break;
        }

        // Print WIP Disassembly after each instruction
        //// printWIPDisassembly();
    }

    // const sortedArray = Array.from(processedAddresses).sort((a, b) => a - b);
    // console.log("processedAddresses:", sortedArray);
    printWIPDisassembly(); //// TODO: turn off when not debugging
    // Output the Disassembled Code
    adjustZeroDirectives();
    outputDisassembledCode();
}

// Assigns a label to an address based on its type ('code' or 'data')
function assignLabel(address, type) {
    if (labels[address]) {
        return labels[address]; // Label already assigned
    }
    if (type === 'code') {
        labels[address] = `@L${codeLabelCounter++}`;
    } else if (type === 'data') {
        labels[address] = `@D${dataLabelCounter++}`;
    }
    // Update WIP Disassembly with the label
    WIPDisassembly[address].label = labels[address];
    return labels[address];
}

// Disassembles a single machine word into its mnemonic and operands
function disassembleInstruction(address, word) {
    const opcode = (word >> 12) & 0xF;
    let mnemonic = '???';
    let operands = '';

    switch (opcode) {
        case 0x0: // BR
            {
                const cc = (word >> 9) & 0x7;
                const pcoffset9 = signExtend(word & 0x1FF, 9);
                const targetAddress = (address + 1 + pcoffset9) & 0xFFFF;
                mnemonic = getBranchMnemonic(cc);
                operands = `${getOrAssignCodeLabel(targetAddress)}`;
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
                const dataLabel = getOrAssignDataLabel(dataAddress);
                operands = `${registerNames[dr]}, ${dataLabel}`;
                mnemonic = 'ld';
            }
            break;
        case 0x3: // ST
            {
                const sr = (word >> 9) & 0x7;
                const pcoffset9 = signExtend(word & 0x1FF, 9);
                const dataAddress = (address + 1 + pcoffset9) & 0xFFFF;
                const dataLabel = getOrAssignDataLabel(dataAddress);
                operands = `${registerNames[sr]}, ${dataLabel}`;
                mnemonic = 'st';
            }
            break;
        case 0x4: // BL or BLR
            {
                const bit11 = (word >> 11) & 0x1;
                if (bit11 === 1) { // BL
                    const pcoffset11 = signExtend(word & 0x7FF, 11);
                    const targetAddress = (address + 1 + pcoffset11) & 0xFFFF;
                    const targetLabel = getOrAssignCodeLabel(targetAddress);
                    mnemonic = 'bl';
                    operands = `${targetLabel}`;
                } else { // BLR or JSRR
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
                } else { // JMP
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
                operands = `${registerNames[dr]}, ${imm9}`;
                mnemonic = 'mvi';
            }
            break;
        case 0xE: // LEA
            {
                const dr = (word >> 9) & 0x7;
                const pcoffset9 = signExtend(word & 0x1FF, 9);
                const dataAddress = (address + 1 + pcoffset9) & 0xFFFF;
                const dataLabel = getOrAssignDataLabel(dataAddress);
                operands = `${registerNames[dr]}, ${dataLabel}`;
                mnemonic = 'lea';
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

    return { mnemonic, operands };
}

// Handles BL (Branch and Link) Instructions
function handleBL(currentAddress, word) {
    const pcoffset11 = signExtend(word & 0x7FF, 11);
    const targetAddress = (currentAddress + 1 + pcoffset11) & 0xFFFF;
    // Save link register (address of next instruction)
    const linkAddress = currentAddress + 1;
    linkRegisterStack.push(linkAddress);
    // console.log(`Link register saved: ${linkAddress}`);
    // Enqueue target address
    queue.unshift(targetAddress);
    // Enqueue next instruction after BL instruction at end of queue
    enqueueNextAddress(currentAddress);
}

// Handles LD, ST, LEA Instructions
function handleDataInstruction(currentAddress, word) {
    nextAddress = currentAddress + 1;
    const opcode = (word >> 12) & 0xF;
    let pcoffset9;
    if ([0x2, 0x3, 0xE].includes(opcode)) { // LD, ST, LEA
        pcoffset9 = signExtend(word & 0x1FF, 9);
    } else {
        return; // Not a data instruction
    }
    const dataAddress = (currentAddress + 1 + pcoffset9) & 0xFFFF;
    // Always enqueue dataAddress for processing
    queue.unshift(dataAddress);

    // Enqueue next instruction address if not already processed
    queue.push(nextAddress);
}

// Handles JMP and RET Instructions
function handleJMPRET(currentAddress, word) {
    const baseR = (word >> 6) & 0x7;
    const offset6 = signExtend(word & 0x3F, 6);

    if (baseR === 7 && offset6 === 0) { // RET
        if (linkRegisterStack.length === 0) {
            console.warn(`Warning: RET encountered at ${currentAddress} with empty link register stack`);
            return;
        }
        const returnAddress = linkRegisterStack.pop();
        // console.log(`Returning to address: ${returnAddress}`);
        queue.unshift(returnAddress);
    } else { // JMP
        // Handle JMP as needed
        // For simplicity, we can enqueue the next address
        enqueueNextAddress(currentAddress);
    }
}

// Assigns or Retrieves a Code Label for a Given Address
function getOrAssignCodeLabel(address) {
    if (labels[address]) {
        return labels[address];
    }
    const label = assignLabel(address, 'code');
    // Do not enqueue here; we'll handle it in the instruction processing
    return label;
}

// Assigns or Retrieves a Data Label for a Given Address
function getOrAssignDataLabel(address) {
    if (labels[address]) {
        return labels[address];
    }
    const label = assignLabel(address, 'data');
    // Do not enqueue here; we'll handle it in the instruction processing
    return label;
}

function enqueueNextAddress(currentAddr) {
    const nextAddress = currentAddr + 1;
    if (nextAddress < machineWords.length && !processedAddresses.has(nextAddress)) {
        queue.push(nextAddress);
    }
}

function toSigned16Bit(value) {
    return (value & 0x8000) ? value - 0x10000 : value;
}

// Processes Data Sections (e.g., Strings)
function processData(address) {
    let currentAddress = address;
    let word;

    let dataEntries = []; // Array to hold data entries
    let str = ''; // String accumulator
    let zeroCount = 0; // Counter for zeros
    let strStartAddress = null; // Starting address of a string
    let zeroStartAddress = null; // Starting address of zeros
    let justFinishedString = false; // Flag to skip null terminator

    while (currentAddress < machineWords.length) {
        // Check if we have reached a new label (excluding the starting address)
        if (labels[currentAddress] && currentAddress !== address) {
            // Save any pending zeros
            if (zeroCount > 0) {
                dataEntries.push({ type: '.zero', count: zeroCount, address: zeroStartAddress });
                zeroCount = 0;
                zeroStartAddress = null;
            }
            // Break the loop to process data starting from the new label separately
            break;
        }

        word = machineWords[currentAddress];

        const lowByte = word & 0xFF;

        if (lowByte === 0) {
            // Zero encountered
            if (str.length > 0) {
                // Save the string
                dataEntries.push({ type: '.string', value: str, address: strStartAddress });
                str = '';
                strStartAddress = null;
                justFinishedString = true;
                break;
            } else if (justFinishedString) {
                // Skip the null terminator
                justFinishedString = false;
                // Do not start counting zeros yet
            } else {
                // Start counting zeros
                if (zeroCount === 0) {
                    zeroStartAddress = currentAddress;
                    console.log(`>>> Starting zeros at address ${zeroStartAddress}`);
                }
                zeroCount++;
            }
        } else {
            // Non-zero encountered
            if (zeroCount > 0) {
                // Save the zero entries
                dataEntries.push({ type: '.zero', count: zeroCount, address: zeroStartAddress });
                zeroCount = 0;
                zeroStartAddress = null;
            }

            if (isPrintableASCII(lowByte)) {
                if (strStartAddress === null) {
                    strStartAddress = currentAddress;
                }
                str += String.fromCharCode(lowByte);
            } else if (lowByte === 10) {
                if (strStartAddress === null) {
                    strStartAddress = currentAddress;
                }
                str += '\\n';
            } else if (lowByte === 13) {
                if (strStartAddress === null) {
                    strStartAddress = currentAddress;
                }
                str += '\\r';
            } else if (lowByte === 9) {
                if (strStartAddress === null) {
                    strStartAddress = currentAddress;
                }
                str += '\\t';
            } else {
                // Non-printable character; save as .word
                if (str.length > 0) {
                    // Save the string
                    dataEntries.push({ type: '.string', value: str, address: strStartAddress });
                    str = '';
                    strStartAddress = null;
                }
                // Save the word, treating it as a signed 16 bit value
                dataEntries.push({ type: '.word', value: toSigned16Bit(word), address: currentAddress });
            }
        }

        //// processedAddresses.add(currentAddress);
        currentAddress++;
    }

    // After the loop, save any pending data entries
    if (str.length > 0) {
        dataEntries.push({ type: '.string', value: str, address: strStartAddress });
        str = '';
        strStartAddress = null;
    }
    if (zeroCount > 0) {
        dataEntries.push({ type: '.zero', count: zeroCount, address: zeroStartAddress });
        zeroCount = 0;
        zeroStartAddress = null;
    }

    // console.log("=====================");
    // console.log('Data Entries:');
    // dataEntries.forEach(entry => {
    //     console.log(`Type: ${entry.type}, Address: ${entry.address}, Count: ${entry.count || ''}, Value: ${entry.value || ''}`);
    // });
    // console.log("=====================");

    // Update WIPDisassembly with the data entries
    dataEntries.forEach(entry => {
        if (entry.type === '.string') {
            WIPDisassembly[entry.address].mnemonic = '.string';
            WIPDisassembly[entry.address].value = entry.value;
        } else if (entry.type === '.zero') {
            WIPDisassembly[entry.address].mnemonic = '.zero';
            WIPDisassembly[entry.address].count = entry.count;
        } else if (entry.type === '.word') {
            WIPDisassembly[entry.address].mnemonic = '.word';
            WIPDisassembly[entry.address].value = entry.value;
        }

        // Mark addresses covered by the data entry as processed
        let entryLength = 1;
        if (entry.type === '.zero') {
            entryLength = entry.count;
        } else if (entry.type === '.string') {
            entryLength = entry.value.length + 1;
        }
        for (let i = 0; i < entryLength; i++) {
            processedAddresses.add(entry.address + i);
        }
    });
}

// Outputs the Final Disassembled Code
function outputDisassembledCode() {
    // Construct the final disassembled code from WIPDisassembly
    const finalDisassembly = [];

    // Convert WIPDisassembly keys to numbers and sort them
    const addresses = Object.keys(WIPDisassembly).map(Number).sort((a, b) => a - b);

    for (let addr of addresses) {
        const entry = WIPDisassembly[addr];
        let line = '';

        if (entry.label) {
            line += `${entry.label}:`.padEnd(7);
        } else {
            line += ''.padEnd(7);
        }

        if (entry.mnemonic === '.string') {
            line += `.string ${JSON.stringify(entry.value)}`;
        } else if (entry.mnemonic === '.zero') {
            line += `.zero ${entry.count}`;
        } else if (entry.mnemonic === '.word') {
            line += `.word ${entry.value}`;
        } else if (entry.opcode) {
            line += `${entry.opcode}`;
            if (entry.operands) {
                line += ` ${entry.operands}`;
            }
        } else if (entry.label) {
            // Ensure labels with no mnemonic or opcode are output with a placeholder
            line += '; Empty label';
        }

        if (line.trim() !== '') {
            finalDisassembly.push(line);
        }
    }

    // Prepend the .start line
    if (startAddress !== null) {
        finalDisassembly.unshift(disassembledCode[0]);
    }
    console.log('\nFinal Disassembled Code:');
    finalDisassembly.forEach(line => console.log(line));
}

// Prints the current state of WIP Disassembly
function printWIPDisassembly() {
    console.log('\nCurrent WIP Disassembly:');
    const addresses = Object.keys(WIPDisassembly).map(Number).sort((a, b) => a - b);
    for (let addr of addresses) {
        const entry = WIPDisassembly[addr];
        let line = `${addr}: { macword: "${entry.macword}"`;

        if (entry.label) {
            line += `, label: "${entry.label}"`;
        }
        if (entry.opcode) {
            line += `, opcode: "${entry.opcode}"`;
        }
        if (entry.operands) {
            line += `, operands: "${entry.operands}"`;
        }
        if (entry.mnemonic) {
            line += `, mnemonic: "${entry.mnemonic}"`;
        }
        if (entry.value) {
            if(entry.mnemonic === '.string') {
                line += `, value: ${JSON.stringify(entry.value)}`;
            } else {
                line += `, value: ${entry.value}`;
            }
        }
        if (entry.count) {
            line += `, count: ${entry.count}`;
        }
        line += ' }';
        console.log(line);
    }
}

// Utility Functions

// Sign-extends a value based on the bit count
function signExtend(value, bitCount) {
    const signBit = 1 << (bitCount - 1);
    return (value & (signBit - 1)) - (value & signBit);
}

// Retrieves the mnemonic for a given branch condition code
function getBranchMnemonic(cc) {
    const ccMap = {
        0: 'brz',  // Branch if Zero
        1: 'brnz', // Branch if Not Zero
        2: 'brn',  // Branch if Negative
        3: 'brp',  // Branch if Positive
        4: 'brlt', // Branch if Less Than
        5: 'brgt', // Branch if Greater Than
        6: 'brc',  // Branch if Carry
        7: 'br',   // Unconditional Branch
    };
    return ccMap[cc] || 'br';
}

// Retrieves Trap Information Based on Trap Vector
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

// Determines if a machine word represents a printable ASCII character
function isPrintableASCII(byte) {
    return ((byte >= 32 && byte <= 126) || byte === 10); // Printable ASCII range
}

// Main Execution Entry Point
if (require.main === module) {
    if (process.argv.length !== 3) {
        console.error('Usage: node disassembler.js <filename>');
        process.exit(1);
    }

    const fileName = process.argv[2];
    disassemble(fileName);
}
