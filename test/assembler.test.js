// testAssembler.js

const fs = require('fs');
const Assembler = require('../src/assembler');

function testAssembler() {
  const assembler = new Assembler();

  // Read the source code from a1test.a
  const sourceCode = fs.readFileSync('a1test.a', 'utf-8');

  // Assemble the code
  const machineCode = assembler.assemble(sourceCode);

  if (machineCode !== null) {
    // Write the machine code to a1test.e
    const buffer = Buffer.alloc(2 + 2 * machineCode.length);
    let offset = 0;
    // Write file signature 'oC'
    buffer.write('oC', offset);
    offset += 2;
    // Write machine code
    for (let word of machineCode) {
      buffer.writeUInt16LE(word, offset);
      offset += 2;
    }
    fs.writeFileSync('a1test.e', buffer);
    console.log('Assembling completed successfully.');
  } else {
    console.error('Assembling failed due to errors.');
  }
}

testAssembler();
