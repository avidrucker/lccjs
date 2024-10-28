// lcc.test.js

const LCC = require('../src/lcc');
const path = require('path');

function testLCC() {
  const lcc = new LCC();

  // Provide arguments directly to main()
  const args = [path.join(__dirname, '../demos/demoA.a')];

  lcc.main(args);
}

testLCC();