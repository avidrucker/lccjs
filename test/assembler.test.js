// assembler.test.js
// Simple test script to invoke the assembler

const Assembler = require('../src/assembler');

function testAssembler() {
  const assembler = new Assembler();
  
  // Simulate command line arguments
  process.argv = ['node', 'assembler.js', 'a1test.a'];
  
  assembler.main();
}

testAssembler();
