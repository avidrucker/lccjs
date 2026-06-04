'use strict';

const fs = require('fs');
const path = require('path');

// Shiki v1 registers custom grammars under grammar.name (e.g. "lcc"), NOT
// grammar.scopeName (e.g. "source.lcc"). Any codeToHtml({ lang: ... }) call
// must use the name value — scopeName silently fails on cold (uncached) loads.
test('showcase page uses lang: lcc not lang: source.lcc in codeToHtml calls', () => {
  const html = fs.readFileSync(
    path.join(__dirname, '../../docs/showcase/index.html'), 'utf8'
  );
  expect(html).not.toMatch(/lang:\s*['"]source\.lcc['"]/);
  expect(html).toMatch(/lang:\s*['"]lcc['"]/);
});
