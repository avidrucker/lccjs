// testInterpreter.js

const Interpreter = require('../src/interpreter');

function testA1Test() {
  const interpreter = new Interpreter();

  try {
    interpreter.loadExecutableFile('a1test.e'); // Adjust the path as needed
    interpreter.run();
  } catch (error) {
    console.error('Error running a1test.e:', error);
  }
}

testA1Test();