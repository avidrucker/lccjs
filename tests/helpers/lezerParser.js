'use strict';

// Parses LCC assembly source through the Lezer grammar (src/lang-lcc/lcc.js)
// and returns the flat list of named syntax nodes.
//
// lcc.js is ESM; this helper runs it in a child Node process (--input-type=module)
// so the CJS Jest environment doesn't need --experimental-vm-modules.

const { execSync } = require('child_process');
const path         = require('path');

const LCC_JS_PATH = path.resolve(__dirname, '../../src/lang-lcc/lcc.js');
const WORKTREE    = path.resolve(__dirname, '../..');

/**
 * Parse one or more lines through the Lezer LCC grammar.
 *
 * @param {string[]} lines
 * @returns {{ name: string, from: number, to: number, text: string }[][]}
 *   one node array per input line (unnamed/anonymous nodes excluded)
 */
function parseLines(lines) {
  const script = `
import { parser } from ${JSON.stringify(LCC_JS_PATH)};

const lines = ${JSON.stringify(lines)};
const results = lines.map(source => {
  const tree = parser.parse(source);
  const nodes = [];
  tree.iterate({
    enter(node) {
      if (node.name && node.name !== '⚠' && node.name !== 'Program') {
        nodes.push({
          name: node.name,
          from: node.from,
          to:   node.to,
          text: source.slice(node.from, node.to),
        });
      }
    },
  });
  return nodes;
});
process.stdout.write(JSON.stringify(results));
`;

  const out = execSync('node --input-type=module', {
    input:    script,
    encoding: 'utf8',
    cwd:      WORKTREE,
    timeout:  15_000,
  });
  return JSON.parse(out);
}

module.exports = { parseLines };
