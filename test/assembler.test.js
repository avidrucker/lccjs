// assembler.test.js
// Simple test script to invoke the assembler

const Assembler = require('../src/assembler');

function testAssembler() {
  const assembler = new Assembler();
  assembler.main();
}

testAssembler();
