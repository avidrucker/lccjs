// interpreter.js
// LCC.js Interpreter
// Translated from i1.c by Avital Drucker

class Interpreter {
  constructor() {
    this.mem = new Array(65536).fill(0); // Memory
    this.r = new Array(8).fill(0); // Registers r0 to r7
    this.pc = 0; // Program Counter
    this.ir = 0; // Instruction Register
    this.n = 0; // Negative flag
    this.z = 0; // Zero flag
    this.c = 0; // Carry flag
    this.v = 0; // Overflow flag
    this.opcode = 0; // Opcode
    this.pcoffset9 = 0; // PC offset 9
    this.imm9 = 0;
    this.pcoffset11 = 0; // PC offset 11
    this.imm5 = 0; // Immediate 5
    this.offset6 = 0; // Offset 6
    this.eopcode = 0; // Extended opcode
    this.trapvec = 0; // Trap vector
    this.code = 0; // Condition code
    this.sr = 0; // Source register
    this.dr = 0; // Destination register
    this.sr1 = 0; // Source register 1
    this.baser = 0; // Base register
    this.sr2 = 0; // Source register 2
    this.bit5 = 0; // Bit 5
    this.bit11 = 0; // Bit 11
    this.running = true;
    this.output = ''; // Output string
  }

  loadExecutable(executable) {
    // Load code into memory
    let code = executable.code;
    for (let i = 0; i < code.length; i++) {
      this.mem[i] = code[i];
    }

    // Set PC to start address if provided
    for (let header of executable.headers) {
      if (header.type === 'S') {
        this.pc = header.address;
        break;
      }
    }
  }

  run() {
    while (this.running) {
      this.step();
    }
  }

  step() {
    // Fetch instruction
    this.ir = this.mem[this.pc++];
    // Decode instruction
    this.opcode = (this.ir >> 12) & 0xf;

    // let pcoffset9 = this.signExtend(this.ir & 0x1ff, 9);
    let pcoffset9setup = this.ir << 7;                // left justify pcoffset9 field
    this.pcoffset9 = this.imm9 = pcoffset9setup >> 7;  // sign extend and rt justify
    let pcoffset11setup = this.ir << 5;               // left justify pcoffset11 field
    this.pcoffset11 = pcoffset11setup >> 5;       // sign extend and rt justify
    // let imm5 = this.signExtend(this.ir & 0x1f, 5);
    let imm5setup = this.ir << 11;                    // left justify imm5 field
    this.imm5 = imm5setup >> 11;                  // sign extend andd rt justify
    let offset6setup = this.ir << 10;                 // left justify offset6 field
    this.offset6 = offset6setup >> 10;            // sign extend and rt justify
    this.eopcode = this.ir & 0x1f;                // get 5-bit eopcode field "extended op code" used only for push and pop  
    this.trapvec = this.ir & 0xff;                // get 8-bit trapvec field 
    this.code = this.dr = this.sr = (this.ir & 0x0e00) >> 9;   // get condition code/dr/sr and rt justify

    this.sr1 = this.baser = (this.ir & 0x01c0) >> 6;   // get sr1/baser and rt justify
    this.sr2 = this.ir & 0x0007;                  // get third reg field
    this.bit5 = this.ir & 0x0020;                 // get bit 5
    this.bit11 = this.ir & 0x0800;                // get bit 11

    switch (this.opcode) {
      case 0: // BR
        this.executeBR();
        break;
      case 1: // ADD
        this.executeADD();
        break;
      case 2: // LD
        this.executeLD();
        break;
      case 3: // ST
        this.executeST();
        break;
      case 4: // BL or BLR
        this.executeBLorBLR(); // TODO: implement this
        break;
      case 5: // AND
        this.executeAND(); // TODO: implement this
        break;
      case 6: // LDR
        this.executeLDR(); // TODO: implement this
        break;
      case 7: // STR
        this.executeSTR(); // TODO: implement this
        break;
      case 8: // CMP
        this.executeCMP(); // TODO: implement this
        break;
      case 9: // NOT
        this.executeNOT(); // TODO: implement this
        break;
      case 10: // PUSH, POP, SRL, SRA, SLL, ROL, ROR, MUL, DIV, REM, OR, XOR, MVR, SEXT
        this.execute10(); // TODO: implement this
        break;
      case 11: // SUB
        this.executeSUB(); // TODO: implement this
        break;
      case 12: // JMP
        this.executeJMP(); // TODO: implement this
        break;
      case 13: // MVI
        this.executeMVI(); // TODO: implement this
        break;
      case 14: // LEA
        this.executeLEA(); // TODO: implement this
        break;
      case 15: // TRAP
        this.executeTRAP();
        break;
      default:
        this.error(`Unknown opcode: ${opcode}`);
        this.running = false;
    }
  }

  executeBR() {
    let conditionMet = false;

    switch (this.code) {
      case 0: // brz
        conditionMet = this.z === 1;
        break;
      case 1: // brnz
        conditionMet = this.z === 0;
        break;
      case 2: // brn
        conditionMet = this.n === 1;
        break;
      case 3: // brp
        conditionMet = this.n === this.z;
        break;
      case 4: // brlt
        conditionMet = this.n !== this.v;
        break;
      case 5: // brgt
        conditionMet = this.n === this.v && this.z === 0;
        break;
      case 6: // brc
        conditionMet = this.c === 1;
        break;
      case 7: // br (always)
        conditionMet = true;
        break;
    }

    if (conditionMet) {
      this.pc = (this.pc + this.pcoffset9) & 0xffff;
    }
  }

  executeADD() {
    if (this.bit5 === 0) {
      // Register mode
      this.r[this.dr] = this.r[this.sr1] + this.r[this.sr2];
      this.setNZ(this.r[this.dr]);
      this.setCV(this.r[this.dr], this.r[this.sr1], this.r[this.sr2]);
    } else {
      // Immediate mode
      this.r[this.dr] = this.r[this.sr1] + this.imm5;
      this.setNZ(this.r[this.dr]);
      this.setCV(this.r[this.dr], this.r[this.sr1], this.imm5);
    }
  }

  executeLD() {
    this.r[this.dr] = this.mem[(this.pc + this.pcoffset9) & 0xffff];
  }

  executeST() {
    this.mem[(this.pc + this.pcoffset9) & 0xffff] = this.r[this.sr];
  }

  executeSOUT() {
    let address = this.r[this.sr];
    let outputString = '';
    let charCode;
    while ((charCode = this.mem[address++]) !== 0) {
      outputString += String.fromCharCode(charCode);
    }
    this.output += outputString;
  }
  
  executeSIN() {
    // For simplicity, we'll simulate user input
    // In a real application, you would prompt the user
    const simulatedInput = 'UserInput'; // Replace with actual user input mechanism
    let address = this.r[this.sr];
    for (let i = 0; i < simulatedInput.length; i++) {
      this.mem[address++] = simulatedInput.charCodeAt(i);
    }
    this.mem[address] = 0; // Null terminator
  }

  executeTRAP() {
    switch (this.trapvec) {
      case 0x00: // HALT
        this.running = false;
        break;
      case 0x01: // NL
        this.output += '\n';
        break;
      case 0x02: // DOUT
        this.output += this.r[this.sr].toString();
        break;
      //// TODO: implement remaining trap vectors
      case 0x06: // SOUT
        this.executeSOUT();
        break;
      //// TODO: implement remaining trap vectors
      case 0x0A: // SIN
        this.executeSIN();
        break;
      default:
        this.error(`Unknown TRAP vector: ${this.trapvec}`);
        this.running = false;
    }
  }

  setNZ(value) {
    this.n = value < 0 ? 1 : 0;
    this.z = value === 0 ? 1 : 0;
  }

  setCV(sum, x, y) {
    this.c = ((x & 0xffff) + (y & 0xffff)) > 0xffff ? 1 : 0;
    let sx = x >> 15;
    let sy = y >> 15;
    let ss = sum >> 15;
    this.v = (sx === sy && sx !== ss) ? 1 : 0;
  }

  signExtend(value, bitCount) {
    if ((value >> (bitCount - 1)) & 1) {
      value |= (0xffff << bitCount);
    }
    return value;
  }

  error(message) {
    console.error(`Interpreter Error: ${message}`);
  }
}

// Export the Interpreter class for use in other modules
module.exports = Interpreter;
