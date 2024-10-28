// interpreter.test.js

const Interpreter = require('../src/interpreter');
const path = require('path');

function testInterpreter() {
  const interpreter = new Interpreter();

  const args = [path.join(__dirname, '../demos/demoA.e')];

  interpreter.main(args);
}

testInterpreter();
