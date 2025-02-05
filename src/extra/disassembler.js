#!/usr/bin/env node

// disassembler.js
// LCC.js Disassembler - Execution Order Processing with WIP Disassembly

import fs from "fs";

// Main Disassembler Class
class Disassembler {
    constructor() {
        // Register names
        this.registerNames = ['r0', 'r1', 'r2', 'r3', 'r4', 'fp', 'sp', 'lr'];

        // Label Counters
        this.codeLabelCounter = 1;
        this.dataLabelCounter = 1;

        // Label Mapping: address -> label (e.g., {0: '@L1', 3: '@D1'})
        this.labels = {};

        // Processed Addresses
        this.processedAddresses = new Set();

        // Disassembled Code Lines
        this.disassembledCode = [];

        // WIP Disassembly Data Structure: address -> {macword, label, opcode, operands, mnemonic, value}
        this.WIPDisassembly = {};

        // Link Register Stack (to handle nested BL/RET)
        this.linkRegisterStack = [];

        // Machine Words Array
        this.machineWords = [];

        // Queue for Addresses to Process
        this.queue = [];

        // Start Address (if provided)
        this.startAddress = null;
    }

    // Main Disassembler Function
    disassemble(fileName) {
        this.readBinaryFile(fileName);
        this.initializeDisassembly();
        this.processInstructions();
        this.adjustZeroDirectives();
        this.outputDisassembledCode();
    }

    // Reads the binary file and populates machine words
    readBinaryFile(fileName) {
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
                this.startAddress = buffer.readUInt16LE(offset);
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
            this.machineWords.push(word);
            offset += 2;
        }
    }

    // Initializes WIP Disassembly and the processing queue
    initializeDisassembly() {
        // Initialize WIP Disassembly
        for (let i = 0; i < this.machineWords.length; i++) {
            this.WIPDisassembly[i] = {
                macword: this.machineWords[i].toString(16).padStart(4, '0').toUpperCase(),
            };
        }

        // Initialize Processing Queue and Labels
        if (this.startAddress !== null) {
            // Assign @L1 to startAddress
            this.assignLabel(this.startAddress, 'code');
            this.disassembledCode.push(''.padEnd(7) + `.start ${this.labels[this.startAddress]}`);
            this.queue.push(this.startAddress);
        } else {
            // No start address; begin at address 0
            this.queue.push(0);
        }
    }

    // Processes instructions in execution order
    processInstructions() {
        while (this.queue.length > 0) {
            const currentAddress = this.queue.shift();

            // Skip already processed addresses
            if (this.processedAddresses.has(currentAddress)) {
                continue;
            }

            this.processedAddresses.add(currentAddress);

            // Fetch Machine Word
            const word = this.machineWords[currentAddress];
            if (word === undefined) {
                console.warn(`Warning: No machine word found at address ${currentAddress}`);
                continue;
            }

            // Check if the address is a data label
            if (this.labels[currentAddress] && this.labels[currentAddress].startsWith('@D')) {
                // Process data
                this.processData(currentAddress);
                continue; // No need to process further
            }

            // Disassemble Instruction
            const { mnemonic, operands } = this.disassembleInstruction(currentAddress, word);

            // Update WIP Disassembly
            this.WIPDisassembly[currentAddress].opcode = mnemonic;
            this.WIPDisassembly[currentAddress].operands = operands;

            // Add Label if Exists
            if (this.labels[currentAddress]) {
                this.WIPDisassembly[currentAddress].label = this.labels[currentAddress];
            }

            // Handle Instruction Types
            const opcode = (word >> 12) & 0xF;

            switch (opcode) {
                case 0x4: // BL or BLR
                    this.handleBL(currentAddress, word);
                    break;
                case 0x2: // LD
                case 0x3: // ST
                case 0xE: // LEA
                    this.handleDataInstruction(currentAddress, word);
                    break;
                case 0xC: // JMP or RET
                    this.handleJMPRET(currentAddress, word);
                    break;
                case 0xF: // TRAP
                    this.handleTrap(currentAddress, word);
                    break;
                default:
                    this.enqueueNextAddress(currentAddress);
            }
        }
    }

    // Adjusts .zero directives to account for labels within the zero range
    adjustZeroDirectives() {
        const addresses = Object.keys(this.WIPDisassembly).map(Number).sort((a, b) => a - b);
        const labelAddresses = Object.keys(this.labels).map(Number).sort((a, b) => a - b);

        for (let addr of addresses) {
            const entry = this.WIPDisassembly[addr];
            if (entry.mnemonic === '.zero') {
                let zeroStart = addr;
                let zeroCount = entry.count;

                // Check for labels within the zero range (excluding the starting address)
                for (let labelAddr of labelAddresses) {
                    if (labelAddr > zeroStart && labelAddr < zeroStart + zeroCount) {
                        // Adjust zeroCount to stop before the label
                        let adjustedCount = labelAddr - zeroStart;
                        entry.count = adjustedCount;
                        zeroCount = adjustedCount;
                        break; // Assuming no overlapping labels within zero range
                    }
                }
            }
        }
    }

    // Outputs the final disassembled code
    outputDisassembledCode() {
        const finalDisassembly = [];

        const addresses = Object.keys(this.WIPDisassembly).map(Number).sort((a, b) => a - b);

        for (let addr of addresses) {
            const entry = this.WIPDisassembly[addr];
            let line = '';

            if (entry.label) {
                line += `${entry.label}:`.padEnd(7);
            } else {
                line += ''.padEnd(7);
            }

            if (entry.mnemonic) {
                switch (entry.mnemonic) {
                    case '.string':
                        line += `.string ${JSON.stringify(entry.value)}`;
                        break;
                    case '.zero':
                        line += `.zero ${entry.count}`;
                        break;
                    case '.word':
                        line += `.word ${entry.value}`;
                        break;
                    default:
                        line += entry.mnemonic;
                }
            } else if (entry.opcode) {
                line += `${entry.opcode}`;
                if (entry.operands) {
                    line += ` ${entry.operands}`;
                }
            } else if (entry.label) {
                line += '; Empty label';
            }

            if (line.trim() !== '') {
                finalDisassembly.push(line);
            }
        }

        // Prepend the .start line
        if (this.startAddress !== null) {
            finalDisassembly.unshift(this.disassembledCode[0]);
        }
        console.log('\nFinal Disassembled Code:');
        finalDisassembly.forEach(line => console.log(line));
    }

    // Assigns a label to an address based on its type ('code' or 'data')
    assignLabel(address, type) {
        // console.log("assigning label of type: ", type, " at address: ", address);
        if (this.labels[address]) {
            return this.labels[address]; // Label already assigned
        }
        let label;
        if (type === 'code') {
            label = `@L${this.codeLabelCounter++}`;
        } else if (type === 'data') {
            label = `@D${this.dataLabelCounter++}`;
        }
        this.labels[address] = label;
        // Update WIP Disassembly with the label
        this.WIPDisassembly[address].label = label;
        return label;
    }

    // Disassembles a single machine word into its mnemonic and operands
    disassembleInstruction(address, word) {
        const opcode = (word >> 12) & 0xF;
        let mnemonic = '???';
        let operands = '';

        switch (opcode) {
            case 0x0: // BR
                ({ mnemonic, operands } = this.disassembleBR(address, word));
                break;
            case 0x1: // ADD
                ({ mnemonic, operands } = this.disassembleADD(word));
                break;
            case 0x2: // LD
                ({ mnemonic, operands } = this.disassembleLD(address, word));
                break;
            case 0x3: // ST
                ({ mnemonic, operands } = this.disassembleST(address, word));
                break;
            case 0x4: // BL/BLR
                ({ mnemonic, operands } = this.disassembleBL(address, word));
                break;
            case 0x5: // AND
                ({ mnemonic, operands } = this.disassembleAND(word));
                break;
            case 0x6: // LDR
                ({ mnemonic, operands } = this.disassembleLDR(word));
                break;
            case 0x7: // STR
                ({ mnemonic, operands } = this.disassembleSTR(word));
                break;
            case 0x8: // CMP
                ({ mnemonic, operands } = this.disassembleCMP(word));
                break;
            case 0x9: // NOT
                ({ mnemonic, operands } = this.disassembleNOT(word));
                break;
            case 0xA: // PUSH/POP/SRL/SRA/SLL/ROL/ROR/MUL/DIV/REM/OR/XOR/MVR/SEXT
                ({ mnemonic, operands } = this.disassembleCase10(word));
                break;
            case 0xB: // SUB
                ({ mnemonic, operands } = this.disassembleSUB(word));
                break;
            case 0xC: // JMP/RET
                ({ mnemonic, operands } = this.disassembleJMPRET(word));
                break;
            case 0xD: // MVI
                ({ mnemonic, operands } = this.disassembleMVI(word));
                break;
            case 0xE: // LEA    
                ({ mnemonic, operands } = this.disassembleLEA(address, word));
                break;
            case 0xF: // TRAP
                ({ mnemonic, operands } = this.disassembleTRAP(word));
                break;
            default:
                mnemonic = '???';
                operands = '';
        }

        return { mnemonic, operands };
    }

    // Disassembles BL and BLR instructions
    disassembleBL(address, word) {
        const bit11 = (word >> 11) & 0x1;
        let mnemonic;
        let operands;
        if (bit11 === 1) { // BL
            const pcoffset11 = this.signExtend(word & 0x7FF, 11);
            const targetAddress = (address + 1 + pcoffset11) & 0xFFFF;
            const targetLabel = this.getOrAssignCodeLabel(targetAddress);
            mnemonic = 'bl';
            operands = `${targetLabel}`;
        } else { // BLR or JSRR
            const baseR = (word >> 6) & 0x7;
            const offset6 = this.signExtend(word & 0x3F, 6);
            mnemonic = 'blr';
            operands = `${this.registerNames[baseR]}`;
            if (offset6 !== 0) {
                operands += `, ${offset6}`;
            }
        }
        return { mnemonic, operands };
    }

    // Disassembles BR instruction
    disassembleBR(address, word) {
        const cc = (word >> 9) & 0x7;
        const pcoffset9 = this.signExtend(word & 0x1FF, 9);
        const targetAddress = (address + 1 + pcoffset9) & 0xFFFF;
        const mnemonic = this.getBranchMnemonic(cc);
        const operands = `${this.getOrAssignCodeLabel(targetAddress)}`;
        return { mnemonic, operands };
    }

    // Disassembles JMP and RET instructions
    // | jmp | 1100  000  baser offset6 | | pc = baser + offset6 |
    // | ret | 1100  000  111   offset6 | | pc = lr + offset6 |
    disassembleJMPRET(word) {
        const baseR = (word >> 6) & 0x7;
        const offset6 = this.signExtend(word & 0x3F, 6);
        let mnemonic;
        let operands;
        if (baseR === 7 && offset6 === 0) {
            mnemonic = 'ret';
            operands = '';
        } else {
            mnemonic = 'jmp';
            operands = `${this.registerNames[baseR]}`;
            if (offset6 !== 0) {
                operands += `, ${offset6}`;
            }
        }
        return { mnemonic, operands };
    }

    // Disassembles ADD instruction
    disassembleADD(word) {
        const dr = (word >> 9) & 0x7;
        const sr1 = (word >> 6) & 0x7;
        const mode = (word >> 5) & 0x1;
        let operands;
        if (mode === 0) {
            const sr2 = word & 0x7;
            operands = `${this.registerNames[dr]}, ${this.registerNames[sr1]}, ${this.registerNames[sr2]}`;
        } else {
            const imm5 = this.signExtend(word & 0x1F, 5);
            operands = `${this.registerNames[dr]}, ${this.registerNames[sr1]}, ${imm5}`;
        }
        const mnemonic = 'add';
        return { mnemonic, operands };
    }

    disassembleMVI(word) {
        const dr = (word >> 9) & 0x7;
        const imm9 = this.signExtend(word & 0xFF, 9);
        const operands = `${this.registerNames[dr]}, ${imm9}`;
        const mnemonic = 'mvi';
        return { mnemonic, operands };
    }

    // | ldr | 0110  dr   baser offset6 | | dr = mem[baser + offset6] |
    // | str | 0111  sr   baser offset6 | | mem[baser + offset6] = sr |
    disassembleLDR(word) {
        const dr = (word >> 9) & 0x7;
        const baseR = (word >> 6) & 0x7;
        const offset6 = this.signExtend(word & 0x3F, 6);
        const operands = `${this.registerNames[dr]}, ${this.registerNames[baseR]}, ${offset6}`;
        const mnemonic = 'ldr';
        return { mnemonic, operands };
    }

    disassembleSTR(word) {
        const sr = (word >> 9) & 0x7;
        const baseR = (word >> 6) & 0x7;
        const offset6 = this.signExtend(word & 0x3F, 6);
        const operands = `${this.registerNames[sr]}, ${this.registerNames[baseR]}, ${offset6}`;
        const mnemonic = 'str';
        return { mnemonic, operands };
    }

    // Disassembles case 10 instructions
    // case 0xA: // PUSH/POP/SRL/SRA/SLL/ROL/ROR/MUL/DIV/REM/OR/XOR/MVR/SEXT
    /*
    | push | 1010  sr   0000 00000 | | mem[--sp] = sr |
    | pop | 1010  dr   0000 00001 | | dr = mem[sp++] |
    | srl | 1010  sr   ct   00010 | nzc | sr >> ct (0 inserted on left, c=last out) |
    | sra | 1010  sr   ct   00011 | nzc | sr >> ct (sign bit replicated, c=last out) |
    | sll | 1010  sr   ct   00100 | nzc | sr << ct (0 inserted on right, c=last out) |
    | rol | 1010  sr   ct   00101 | nzc | sr << ct (rotate: bit 15 → bit 0, c=last out) |
    | ror | 1010  sr   ct   00110 | nzc | sr << ct (rotate: bit 0 → bit 15, c=last out) |
    | mul | 1010  dr   sr 0 00111 | nz | dr = dr * sr |
    | div | 1010  dr   sr 0 01000 | nz | dr = dr / sr |
    | rem | 1010  dr   sr 0 01001 | nz | dr = dr % sr |
    | or | 1010  dr   sr 0 01010 | nz | dr = dr \| sr (bitwise OR) |
    | xor | 1010  dr   sr 0 01011 | nz | dr = dr ^ sr (bitwise exclusive OR) |
    | mvr | 1010  dr   sr 0 01100 | | dr = sr |
    | sext | 1010  dr   sr 0 01101 | nz | dr sign extended  (sr specifies field to extend) |
    */
    // ct is a 4-bit shift count field (if omitted at the assembly level, it defaults to 1).  
    disassembleCase10(word) {
        const eopCode = word & 0x1F;
        const sr_dr = (word >> 9) & 0x7;
        const sr1 = (word >> 6) & 0x7;
        let mnemonic;
        let operands;
        switch(eopCode) {
            case 0x00: // PUSH
                mnemonic = 'push';
                operands = `${this.registerNames[sr_dr]}`;
                break;
            case 0x01: // POP
                mnemonic = 'pop';
                operands = `${this.registerNames[sr_dr]}`;
                break;
            case 0x02: // SRL
                mnemonic = 'srl';
                operands = `${this.registerNames[sr_dr]}`;
                break;
            case 0x03: // SRA
                mnemonic = 'sra';
                operands = `${this.registerNames[sr_dr]}`;
                break;
            case 0x04: // SLL
                mnemonic = 'sll';
                operands = `${this.registerNames[sr_dr]}`;
                break;
            case 0x05: // ROL
                mnemonic = 'rol';
                operands = `${this.registerNames[sr_dr]}`;
                break;
            case 0x06: // ROR
                mnemonic = 'ror';
                operands = `${this.registerNames[sr_dr]}`;
                break;
            case 0x07: // MUL
                mnemonic = 'mul';
                operands = `${this.registerNames[sr_dr]}, ${this.registerNames[sr1]}`;
                break;
            case 0x08: // DIV
                mnemonic = 'div';
                operands = `${this.registerNames[sr_dr]}, ${this.registerNames[sr1]}`;
                break;
            case 0x09: // REM
                mnemonic = 'rem';
                operands = `${this.registerNames[sr_dr]}, ${this.registerNames[sr1]}`;
                break;
            case 0x0A: // OR
                mnemonic = 'or';
                operands = `${this.registerNames[sr_dr]}, ${this.registerNames[sr1]}`;
                break;
            case 0x0B: // XOR
                mnemonic = 'xor';
                operands = `${this.registerNames[sr_dr]}, ${this.registerNames[sr1]}`;
                break;
            case 0x0C: // MVR
                mnemonic = 'mvr';
                operands = `${this.registerNames[sr_dr]}, ${this.registerNames[sr1]}`;
                break;
            case 0x0D: // SEXT
                mnemonic = 'sext';
                operands = `${this.registerNames[sr_dr]}, ${this.registerNames[sr1]}`;
                break;
            default:
                mnemonic = '???';
                operands = '';
        }
        return { mnemonic, operands };
    }

    // Disassembles NOT instruction
    disassembleNOT(word) {
        const dr = (word >> 9) & 0x7;
        const sr1 = (word >> 6) & 0x7;
        const operands = `${this.registerNames[dr]}, ${this.registerNames[sr1]}`;
        const mnemonic = 'not';
        return { mnemonic, operands };
    }

     // Disassembles SUB instruction
     disassembleSUB(word) {
        const dr = (word >> 9) & 0x7;
        const sr1 = (word >> 6) & 0x7;
        const mode = (word >> 5) & 0x1;
        let operands;
        if (mode === 0) {
            const sr2 = word & 0x7;
            operands = `${this.registerNames[dr]}, ${this.registerNames[sr1]}, ${this.registerNames[sr2]}`;
        } else {
            const imm5 = this.signExtend(word & 0x1F, 5);
            operands = `${this.registerNames[dr]}, ${this.registerNames[sr1]}, ${imm5}`;
        }
        const mnemonic = 'sub';
        return { mnemonic, operands };
    }

     // Disassembles ADD instruction
     disassembleAND(word) {
        const dr = (word >> 9) & 0x7;
        const sr1 = (word >> 6) & 0x7;
        const mode = (word >> 5) & 0x1;
        let operands;
        if (mode === 0) {
            const sr2 = word & 0x7;
            operands = `${this.registerNames[dr]}, ${this.registerNames[sr1]}, ${this.registerNames[sr2]}`;
        } else {
            const imm5 = this.signExtend(word & 0x1F, 5);
            operands = `${this.registerNames[dr]}, ${this.registerNames[sr1]}, ${imm5}`;
        }
        const mnemonic = 'and';
        return { mnemonic, operands };
    }

    disassembleCMP(word) {
        const sr1 = (word >> 6) & 0x7;
        const mode = (word >> 5) & 0x1;
        let operands;
        if (mode === 0) {
            const sr2 = word & 0x7;
            operands = `${this.registerNames[sr1]}, ${this.registerNames[sr2]}`;
        } else {
            const imm5 = this.signExtend(word & 0x1F, 5);
            operands = `${this.registerNames[sr1]}, ${imm5}`;
        }
        const mnemonic = 'cmp';
        return { mnemonic, operands };
    }

    // Disassembles LD instruction
    disassembleLD(address, word) {
        const dr = (word >> 9) & 0x7;
        const pcoffset9 = this.signExtend(word & 0x1FF, 9);
        const dataAddress = (address + 1 + pcoffset9) & 0xFFFF;
        const dataLabel = this.getOrAssignDataLabel(dataAddress);
        const operands = `${this.registerNames[dr]}, ${dataLabel}`;
        const mnemonic = 'ld';
        return { mnemonic, operands };
    }

    disassembleST(address, word) { 
        const sr = (word >> 9) & 0x7;
        const pcoffset9 = this.signExtend(word & 0x1FF, 9);
        const dataAddress = (address + 1 + pcoffset9) & 0xFFFF;
        const dataLabel = this.getOrAssignDataLabel(dataAddress);
        const operands = `${this.registerNames[sr]}, ${dataLabel}`;
        const mnemonic = 'st';
        return { mnemonic, operands };
    }

    disassembleLEA(address, word) {
        const dr = (word >> 9) & 0x7;
        const pcoffset9 = this.signExtend(word & 0x1FF, 9);
        const targetAddress = (address + 1 + pcoffset9) & 0xFFFF;
        const targetLabel = this.getOrAssignDataLabel(targetAddress);
        const mnemonic = 'lea';
        const operands = `${this.registerNames[dr]}, ${targetLabel}`;
        return { mnemonic, operands };
    }

    // Disassembles TRAP instruction
    disassembleTRAP(word) {
        const trapvect8 = word & 0xFF;
        const dr_sr = (word >> 9) & 0x7;
        const trapInfo = this.getTrapInfo(trapvect8);
        let mnemonic;
        let operands;
        if (trapInfo) {
            mnemonic = trapInfo.mnemonic;
            operands = trapInfo.needsRegister ? `${this.registerNames[dr_sr]}` : '';
        } else {
            mnemonic = `trap`;
            operands = `${trapvect8}`;
        }
        return { mnemonic, operands };
    }

    // Handles BL (Branch and Link) Instructions
    handleBL(currentAddress, word) {
        const pcoffset11 = this.signExtend(word & 0x7FF, 11);
        const targetAddress = (currentAddress + 1 + pcoffset11) & 0xFFFF;
        // Save link register (address of next instruction)
        const linkAddress = currentAddress + 1;
        this.linkRegisterStack.push(linkAddress);
        // Enqueue target address
        this.queue.unshift(targetAddress);
        // Enqueue next instruction after BL instruction at end of queue
        this.enqueueNextAddress(currentAddress);
    }

    // Handles Data Instructions (LD, ST, LEA)
    handleDataInstruction(currentAddress, word) {
        const nextAddress = currentAddress + 1;
        const opcode = (word >> 12) & 0xF;
        let pcoffset9;
        if ([0x2, 0x3, 0xE].includes(opcode)) {
            pcoffset9 = this.signExtend(word & 0x1FF, 9);
        } else {
            return;
        }
        const dataAddress = (currentAddress + 1 + pcoffset9) & 0xFFFF;
        // Always enqueue dataAddress for processing
        this.queue.unshift(dataAddress);
        // Enqueue next instruction address
        this.queue.push(nextAddress);
    }

    // Handles JMP and RET Instructions
    handleJMPRET(currentAddress, word) {
        const baseR = (word >> 6) & 0x7;
        const offset6 = this.signExtend(word & 0x3F, 6);

        if (baseR === 7 && offset6 === 0) { // RET
            if (this.linkRegisterStack.length === 0) {
                console.warn(`Warning: RET encountered at ${currentAddress} with empty link register stack`);
                return;
            }
            const returnAddress = this.linkRegisterStack.pop();
            this.queue.unshift(returnAddress);
        } else { // JMP
            // Enqueue next address
            this.enqueueNextAddress(currentAddress);
        }
    }

    // Handles TRAP Instructions
    handleTrap(currentAddress, word) {
        const trapvect8 = word & 0xFF;
        if (trapvect8 === 0x00) { // halt
            this.WIPDisassembly[currentAddress].opcode = 'halt';
        }
        this.enqueueNextAddress(currentAddress);
    }

    // Enqueues the next sequential address for processing
    enqueueNextAddress(currentAddress) {
        const nextAddress = currentAddress + 1;
        if (nextAddress < this.machineWords.length && !this.processedAddresses.has(nextAddress)) {
            this.queue.push(nextAddress);
        }
    }

    // Assigns or retrieves a code label for a given address
    getOrAssignCodeLabel(address) {
        if (this.labels[address]) {
            return this.labels[address];
        }
        return this.assignLabel(address, 'code');
    }

    // Assigns or retrieves a data label for a given address
    getOrAssignDataLabel(address) {
        if (this.labels[address]) {
            return this.labels[address];
        }
        return this.assignLabel(address, 'data');
    }

    // Processes Data Sections (e.g., Strings)
    processData(address) {
        let currentAddress = address;
        const dataEntries = []; // Array to hold data entries
        let str = ''; // String accumulator
        let zeroCount = 0; // Counter for zeros
        let strStartAddress = null; // Starting address of a string
        let zeroStartAddress = null; // Starting address of zeros
        let justFinishedString = false; // Flag to skip null terminator

        while (currentAddress < this.machineWords.length) {
            // Check if we have reached a new label (excluding the starting address)
            if (this.labels[currentAddress] && currentAddress !== address) {
                // Save any pending zeros
                if (zeroCount > 0) {
                    dataEntries.push({ type: '.zero', count: zeroCount, address: zeroStartAddress });
                    zeroCount = 0;
                    zeroStartAddress = null;
                }
                // Break the loop to process data starting from the new label separately
                break;
            }

            const word = this.machineWords[currentAddress];
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
                } else {
                    // Start counting zeros
                    if (zeroCount === 0) {
                        zeroStartAddress = currentAddress;
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

                if (this.isPrintableASCII(lowByte)) {
                    if (strStartAddress === null) {
                        strStartAddress = currentAddress;
                    }
                    str += String.fromCharCode(lowByte);
                } else {
                    // Non-printable character; save as .word
                    if (str.length > 0) {
                        dataEntries.push({ type: '.string', value: str, address: strStartAddress });
                        str = '';
                        strStartAddress = null;
                    }
                    // Save the word, treating it as a signed 16-bit value
                    dataEntries.push({ type: '.word', value: this.toSigned16Bit(word), address: currentAddress });
                }
            }

            currentAddress++;
        }

        // After the loop, save any pending data entries
        if (str.length > 0) {
            dataEntries.push({ type: '.string', value: str, address: strStartAddress });
        }
        if (zeroCount > 0) {
            dataEntries.push({ type: '.zero', count: zeroCount, address: zeroStartAddress });
        }

        // Update WIPDisassembly with the data entries
        this.updateDisassemblyWithData(dataEntries);
    }

    // Updates WIPDisassembly with data entries
    updateDisassemblyWithData(dataEntries) {
        dataEntries.forEach(entry => {
            if (entry.type === '.string') {
                this.WIPDisassembly[entry.address].mnemonic = '.string';
                this.WIPDisassembly[entry.address].value = entry.value;
            } else if (entry.type === '.zero') {
                this.WIPDisassembly[entry.address].mnemonic = '.zero';
                this.WIPDisassembly[entry.address].count = entry.count;
            } else if (entry.type === '.word') {
                this.WIPDisassembly[entry.address].mnemonic = '.word';
                this.WIPDisassembly[entry.address].value = entry.value;
            }

            // Mark addresses covered by the data entry as processed
            let entryLength = 1;
            if (entry.type === '.zero') {
                entryLength = entry.count;
            } else if (entry.type === '.string') {
                entryLength = entry.value.length + 1; // Include null terminator
            }
            for (let i = 0; i < entryLength; i++) {
                this.processedAddresses.add(entry.address + i);
            }
        });
    }

    // Utility Functions

    // Sign-extends a value based on the bit count
    signExtend(value, bitCount) {
        const signBit = 1 << (bitCount - 1);
        return (value & (signBit - 1)) - (value & signBit);
    }

    // Converts a 16-bit unsigned value to a signed integer
    toSigned16Bit(value) {
        return (value & 0x8000) ? value - 0x10000 : value;
    }

    // Retrieves the mnemonic for a given branch condition code
    getBranchMnemonic(cc) {
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
    getTrapInfo(trapvect8) {
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

    // Determines if a byte represents a printable ASCII character
    isPrintableASCII(byte) {
        return ((byte >= 32 && byte <= 126) || byte === 10); // Printable ASCII range
    }
}

// Main Execution Entry Point
if (require.main === module) {
    if (process.argv.length !== 3) {
        console.error('Usage: node disassembler.js <filename>');
        process.exit(1);
    }

    const fileName = process.argv[2];
    const disassembler = new Disassembler();
    disassembler.disassemble(fileName);
}
