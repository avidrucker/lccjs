// Pins the public Pages doc-section curation enforced by `.pages-ignore` (#1182).
//
// build-site.js publishes every .md in a folder section's srcDir EXCEPT paths
// matched by the root `.pages-ignore` (gitignore syntax, via the `ignore` pkg).
// This test reproduces that filter and asserts the exact published set for the
// two curated sections — so any change to the deployed doc set is a deliberate
// edit to `.pages-ignore`, never an accident of a doc being added/removed.
//
// Curation ruling: docs/github-pages-docs-audit.md (#1123). Implemented #1153,
// made maintainable via `.pages-ignore` in #1182.

const fs = require('fs');
const path = require('path');
const ignore = require('ignore');

const ROOT = path.join(__dirname, '..', '..');
const ig = ignore().add(fs.readFileSync(path.join(ROOT, '.pages-ignore'), 'utf8'));

// Mirror build-site.js: list a section folder's .md and drop .pages-ignore matches.
function published(section) {
  const dir = path.join(ROOT, 'docs', section);
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .filter(f => !ig.ignores(`docs/${section}/${f}`))
    .sort();
}

describe('.pages-ignore curation of the public Pages doc sections (#1182)', () => {
  test('research publishes exactly the 12 curated user-facing docs', () => {
    expect(published('research')).toEqual([
      '560-free-implementation-in-lcc-assembly.md',
      'codemirror-feature-inventory.md',
      'jmp-condition-suffix-mnemonics.md',
      'lezer-grammar-lcc-assembly.md',
      'line-length-limit.md',
      'mnemonic-descriptor-table.md',
      'playground-e2e-test-strategy.md',
      'sext-semantics-report.md',
      'sra-shift-by-zero-513.md',
      'string-escape-parity.md',
      'tokenizer-comma-parity.md',
      'web-ilcc-terminal-simulation.md',
    ]);
  });

  test('learnings publishes exactly the 5 curated synthesis/overview docs', () => {
    expect(published('learnings')).toEqual([
      '2026-05-25-lcc-oracle-e2e-bst-redundancy.md',
      '2026-05-26-pdd-adoption.md',
      'README.md',
      'til-synthesis-2026-06-01.md',
      'til-synthesis-2026-06-04.md',
    ]);
  });

  test('the filter is actually active — a representative internal doc is excluded', () => {
    // Sanity guard against a no-op .pages-ignore: these exist on disk but must
    // NOT publish. If .pages-ignore stopped matching, published() would balloon
    // past 12/5 and the exact-set tests above would already fail; this asserts
    // the negative directly for clarity.
    expect(ig.ignores('docs/research/1007-behavioral-error-audit.md')).toBe(true);
    expect(ig.ignores('docs/learnings/README.md')).toBe(false); // a keep stays published
  });
});
