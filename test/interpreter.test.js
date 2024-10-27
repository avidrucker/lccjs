// interpreter.test.js

const Interpreter = require('../src/interpreter');

function testInterpreter() {
  const interpreter = new Interpreter();

  // Simulate command line arguments
  process.argv = ['node', 'interpreter.js', 'a1test.e'];

  interpreter.main();
}

testInterpreter();
