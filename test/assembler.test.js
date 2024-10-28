// assembler.test.js
// Simple test script to invoke the assembler

const Assembler = require('../src/assembler');
const path = require('path');

function testAssembler() {
  const assembler = new Assembler();
  
  // Simulate command line arguments
  const args = [path.join(__dirname, '../demos/demoA.a')];
  
  assembler.main(args);
}

testAssembler();
