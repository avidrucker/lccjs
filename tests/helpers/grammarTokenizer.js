'use strict';

// Tokenizes LCC assembly lines through the TextMate grammar using Shiki.
// Shiki is ESM-only; this helper runs it in a child Node process so the
// CJS Jest environment doesn't need --experimental-vm-modules.

const { execSync } = require('child_process');
const path         = require('path');
const fs           = require('fs');

const GRAMMAR_PATH = path.join(__dirname, '../../docs/lcc.tmLanguage.json');

/**
 * Tokenize an array of lines in one Shiki subprocess call.
 *
 * @param {string[]} lines
 * @returns {{ content: string, scope: string }[][]}  one token array per line
 */
function tokenizeLines(lines) {
  const script = `
import { createHighlighter } from 'shiki';
import { readFileSync } from 'fs';

const grammar = JSON.parse(readFileSync(${JSON.stringify(GRAMMAR_PATH)}, 'utf8'));
const hl = await createHighlighter({ themes: ['github-dark'], langs: [grammar] });

const lines = ${JSON.stringify(lines)};
const results = lines.map(line =>
  hl.codeToTokensBase(line, { lang: 'lcc', theme: 'github-dark', includeExplanation: true })[0]
    .map(t => ({
      content: t.content,
      scope: t.explanation?.at(-1).scopes.at(-1)?.scopeName ?? 'source.lcc',
    }))
);
process.stdout.write(JSON.stringify(results));
`;
  const out = execSync('node --input-type=module', {
    input:    script,
    encoding: 'utf8',
    timeout:  30_000,
  });
  return JSON.parse(out);
}

module.exports = { tokenizeLines };
