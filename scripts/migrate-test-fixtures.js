#!/usr/bin/env node
/**
 * One-shot migration: move inline `const source = \`...\`` assembly strings
 * in test files to named .a fixture files under tests/fixtures/<subdir>/.
 *
 * Usage:  node scripts/migrate-test-fixtures.js [--dry-run]
 *
 * Issue #777
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = path.resolve(__dirname, '..');
const TESTS_NEW = path.join(ROOT, 'tests', 'new');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures');

// ---------- file manifest ----------

const FILES = [
  // mockFs=true → use realFs.readFileSync; mockFs=false → use fs.readFileSync
  // hasPath=true → file already has `const path = require('path')`
  { name: 'assembler.edge.integration.spec.js',          subdir: 'assembler-edge',           mockFs: true,  hasPath: false },
  { name: 'assembler.instructions.integration.spec.js',  subdir: 'assembler-instructions',   mockFs: true,  hasPath: false },
  { name: 'assembler.directives.integration.spec.js',    subdir: 'assembler-directives',     mockFs: true,  hasPath: false },
  { name: 'assembler.labels.integration.spec.js',        subdir: 'assembler-labels',         mockFs: true,  hasPath: false },
  { name: 'assembler.formats.integration.spec.js',       subdir: 'assembler-formats',        mockFs: true,  hasPath: false },
  { name: 'assembler.integration.spec.js',               subdir: 'assembler-integration',    mockFs: true,  hasPath: true  },
  { name: 'assembler.cli.integration.spec.js',           subdir: 'assembler-cli',            mockFs: true,  hasPath: false },
  { name: 'assembler.object-modules.integration.spec.js',subdir: 'assembler-object-modules', mockFs: true,  hasPath: true  },
  { name: 'assembler.unit.spec.js',                      subdir: 'assembler-unit',           mockFs: false, hasPath: false },
  { name: 'interpreter.unit.spec.js',                    subdir: 'interpreter-unit',         mockFs: false, hasPath: false },
  // research.behavior.spec.js is SKIPPED — all sources are programmatically generated
];

// ---------- helpers ----------

/**
 * Extract every `const source = \`...\`` range from content.
 * Returns an array of { start, end, templateContent, hasDynamic, precedingText, followingText }.
 */
function extractTemplateRanges(content) {
  const MARKER = 'const source = `';
  const results = [];
  let searchFrom = 0;

  while (true) {
    const pos = content.indexOf(MARKER, searchFrom);
    if (pos === -1) break;

    const litStart = pos + MARKER.length - 1; // position of opening backtick
    const contentStart = litStart + 1;

    let j = contentStart;
    let depth = 0; // nesting depth inside ${}
    while (j < content.length) {
      const ch = content[j];
      if (ch === '\\') { j += 2; continue; }
      if (ch === '`' && depth === 0) break;
      if (ch === '$' && content[j + 1] === '{') { depth++; j += 2; continue; }
      if (ch === '}' && depth > 0) { depth--; }
      j++;
    }

    const templateContent = content.slice(contentStart, j);
    results.push({
      start: pos,
      end: j + 1,            // character after the closing backtick
      templateContent,
      hasDynamic: templateContent.includes('${'),
      precedingText: content.slice(Math.max(0, pos - 600), pos),
      followingText: content.slice(j + 1, Math.min(content.length, j + 700)),
    });

    searchFrom = j + 1;
  }

  return results;
}

/**
 * Look for `const <anyName>FilePath = 'NAME.ext'` in the ~600 chars before this source.
 * Returns the filename string (e.g. 'addLabelInsteadRegister.a') or null.
 */
function getAFilePath(precedingText) {
  // Only match the NEAREST one (last match in the preceding text)
  const matches = [...precedingText.matchAll(/const \w*[Ff]ile[Pp]ath = '([^']+)';/g)];
  if (matches.length === 0) return null;
  return matches[matches.length - 1][1];
}

/**
 * Look for `inputFileName: 'NAME.a'` in the ~700 chars after this source.
 * Returns the filename or null. Only captures .a files.
 */
function getInputFileName(followingText) {
  const m = followingText.match(/inputFileName\s*:\s*'([^']+)'/);
  if (!m) return null;
  return m[1];
}

/**
 * Dedent a template literal body:
 *  1. Split on newlines
 *  2. Drop the first line if it's empty/whitespace (after the opening backtick)
 *  3. Drop the last line if it's empty/whitespace (before the closing backtick)
 *  4. Compute minimum leading-whitespace among non-empty lines
 *  5. Strip max(0, min_indent - 2) chars so instructions keep ≥2 spaces of indent
 *     (LCC assembly treats column-0 tokens as labels; instructions must be indented)
 *  6. Join and ensure a single trailing newline
 */
function dedent(raw) {
  let lines = raw.split('\n');

  // Drop leading empty/whitespace line
  if (lines.length > 0 && lines[0].trim() === '') lines = lines.slice(1);
  // Drop trailing empty/whitespace line
  if (lines.length > 0 && lines[lines.length - 1].trim() === '') lines = lines.slice(0, -1);

  if (lines.length === 0) return '\n';

  const nonEmpty = lines.filter(l => l.trim().length > 0);
  const minIndent = nonEmpty.length
    ? Math.min(...nonEmpty.map(l => l.match(/^(\s*)/)[1].length))
    : 0;

  // Keep at least 2 spaces so instructions never land at column 0
  const strip = Math.max(0, minIndent - 2);

  return lines.map(l => l.slice(strip)).join('\n') + '\n';
}

/**
 * Convert an inputFileName to a safe fixture name.
 * Files ending in recognised assembly/format extensions are kept as-is.
 * Non-standard extensions (e.g. .txt, .ap) get the extension embedded:
 *   'demoA.txt' → 'demoA-txt.a'  'demoA.ap' → 'demoA-ap.a'
 */
function toFixtureName(filename) {
  if (!filename) return null;
  const ext = path.extname(filename);
  if (['.a', '.bin', '.hex', '.o'].includes(ext)) return filename;
  const base = path.basename(filename, ext);
  return `${base}${ext.replace('.', '-')}.a`;
}

// ---------- per-file processing ----------

function processFile({ name, subdir, mockFs, hasPath }) {
  const filePath = path.join(TESTS_NEW, name);
  let content = fs.readFileSync(filePath, 'utf8');

  const subdirPath = path.join(FIXTURES, subdir);
  if (!DRY_RUN && !fs.existsSync(subdirPath)) {
    fs.mkdirSync(subdirPath, { recursive: true });
  }

  const ranges = extractTemplateRanges(content);
  let skippedDynamic = 0;
  let skippedNoName = 0;
  const replacements = []; // { start, end, replacement }

  // Registry for this file's fixture names: name → { count, contentToName }
  const nameRegistry = {};           // fixtureBaseName → number of times seen
  const contentRegistry = {};        // cleanedContent → already-assigned fixture name

  for (const range of ranges) {
    if (range.hasDynamic) {
      skippedDynamic++;
      continue;
    }

    // Determine candidate fixture name
    let candidateName = null;
    const aFilePath = getAFilePath(range.precedingText);
    if (aFilePath) {
      candidateName = aFilePath; // always ends in .a
    } else {
      const inputFileName = getInputFileName(range.followingText);
      candidateName = toFixtureName(inputFileName);
    }

    if (!candidateName) {
      skippedNoName++;
      console.warn(`  WARN: no name found in ${name} near offset ${range.start}`);
      continue;
    }

    // Evaluate JS escape sequences (\\, \", \n, etc.) then dedent
    let evaluatedContent;
    try {
      // eslint-disable-next-line no-new-func
      evaluatedContent = new Function('return `' + range.templateContent + '`')();
    } catch (e) {
      console.warn(`  WARN: could not evaluate template in ${name}: ${e.message}`);
      evaluatedContent = range.templateContent;
    }
    const cleanedContent = dedent(evaluatedContent);

    // Content-based deduplication: if we already wrote this exact content, reuse that file
    if (contentRegistry[cleanedContent]) {
      const existingName = contentRegistry[cleanedContent];
      const relPath = `../fixtures/${subdir}/${existingName}`;
      const readExpr = mockFs
        ? `const source = realFs.readFileSync(path.join(__dirname, '${relPath}'), 'utf8')`
        : `const source = fs.readFileSync(path.join(__dirname, '${relPath}'), 'utf8')`;
      replacements.push({ start: range.start, end: range.end, replacement: readExpr });
      continue;
    }

    // Name-based deduplication: if this name already appeared (with different content), add -N suffix
    let uniqueName = candidateName;
    if (nameRegistry[candidateName] !== undefined) {
      nameRegistry[candidateName]++;
      const ext = path.extname(candidateName);
      const base = path.basename(candidateName, ext);
      uniqueName = `${base}-${nameRegistry[candidateName]}${ext}`;
    } else {
      nameRegistry[candidateName] = 1;
    }

    // Write fixture file (always overwrite — supports re-running after fixes)
    const fixturePath = path.join(subdirPath, uniqueName);
    if (!DRY_RUN) {
      fs.writeFileSync(fixturePath, cleanedContent);
      console.log(`  + tests/fixtures/${subdir}/${uniqueName}`);
    } else {
      console.log(`  [dry] + tests/fixtures/${subdir}/${uniqueName}`);
    }

    contentRegistry[cleanedContent] = uniqueName;

    // Build the replacement expression
    const relPath = `../fixtures/${subdir}/${uniqueName}`;
    const readExpr = mockFs
      ? `const source = realFs.readFileSync(path.join(__dirname, '${relPath}'), 'utf8')`
      : `const source = fs.readFileSync(path.join(__dirname, '${relPath}'), 'utf8')`;
    replacements.push({ start: range.start, end: range.end, replacement: readExpr });
  }

  if (replacements.length === 0) {
    console.log(`  (no replacements in ${name})`);
    return;
  }

  // Apply replacements in reverse order to preserve offsets
  replacements.sort((a, b) => b.start - a.start);
  for (const r of replacements) {
    content = content.slice(0, r.start) + r.replacement + content.slice(r.end);
  }

  // Add imports
  content = addImports(content, { mockFs, hasPath, hasFs: !mockFs });

  if (!DRY_RUN) {
    fs.writeFileSync(filePath, content);
  }

  console.log(`  ${DRY_RUN ? '[dry] ' : ''}updated ${name}: ${replacements.length} replacements` +
    (skippedDynamic ? `, ${skippedDynamic} dynamic skipped` : '') +
    (skippedNoName ? `, ${skippedNoName} unnamed skipped` : ''));
}

/**
 * Add `const path = require('path')` and either:
 *   - (mockFs)  `const realFs = jest.requireActual('fs')` — after jest.mock('fs')
 *   - (!mockFs) `const fs = require('fs')` — at top with other requires
 */
function addImports(content, { mockFs, hasPath }) {
  if (mockFs) {
    // Add after jest.mock('fs') line
    const jestMockLine = "jest.mock('fs');";
    const idx = content.indexOf(jestMockLine);
    if (idx === -1) {
      console.warn('  WARN: jest.mock(\'fs\') not found — skipping import insertion');
      return content;
    }
    const insertAt = idx + jestMockLine.length;
    let insertion = '';
    if (!hasPath && !content.includes("require('path')")) {
      insertion += `\nconst path = require('path');`;
    }
    if (!content.includes('const realFs')) {
      insertion += `\nconst realFs = jest.requireActual('fs');`;
    }
    if (insertion) {
      content = content.slice(0, insertAt) + insertion + content.slice(insertAt);
    }
  } else {
    // Non-mocked file: add fs and path requires at the very top (before first require)
    const firstRequire = content.search(/^const \w/m);
    const insertAt = firstRequire === -1 ? 0 : firstRequire;
    let insertion = '';
    if (!content.includes('const fs ') && !content.includes("require('fs')")) {
      insertion += `const fs = require('fs');\n`;
    }
    if (!content.includes('const path ') && !content.includes("require('path')")) {
      insertion += `const path = require('path');\n`;
    }
    if (insertion) {
      content = content.slice(0, insertAt) + insertion + content.slice(insertAt);
    }
  }
  return content;
}

// ---------- main ----------

console.log(`Migration: inline assembly → fixture files${DRY_RUN ? ' (DRY RUN)' : ''}`);
console.log('');

for (const fileInfo of FILES) {
  console.log(`Processing: ${fileInfo.name}`);
  processFile(fileInfo);
  console.log('');
}

console.log('Done.');
