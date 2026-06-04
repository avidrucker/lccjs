// tests/new/textbook-demos.parity.spec.js
//
// Verifies that each C/assembly textbook demo pair produces identical stdout.
//
// Auto-skips all tests when gcc is not in PATH.
// Known incompatibilities and assembler bugs are annotated inline.

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TEXTBOOK_DIR = path.resolve(__dirname, '../../textbook_demos');
const LCC_JS = path.resolve(__dirname, '../../src/cli/lcc.js');
const OUTPUT_MARKER = '====================================================== Output\n';

function gccAvailable() {
  const r = spawnSync('gcc', ['--version'], { encoding: 'utf8' });
  return r.status === 0;
}

function runC(cFilePath, stdin) {
  const tmpBin = path.join(os.tmpdir(), `lcc-parity-${path.basename(cFilePath, '.c')}-${process.pid}`);
  try {
    const compile = spawnSync('gcc', ['-o', tmpBin, cFilePath], { encoding: 'utf8', timeout: 15000 });
    if (compile.status !== 0) return { error: compile.stderr };
    const run = spawnSync(tmpBin, [], { input: stdin, encoding: 'utf8', timeout: 10000 });
    return { output: run.stdout };
  } finally {
    try { fs.unlinkSync(tmpBin); } catch {}
  }
}

function runAssembly(aFilePath, stdin) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcc-parity-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'name.nnn'), 'TestUser\n');
    const base = path.basename(aFilePath);
    fs.copyFileSync(aFilePath, path.join(tmpDir, base));
    const r = spawnSync(process.execPath, [LCC_JS, base], {
      cwd: tmpDir, input: stdin, encoding: 'utf8', timeout: 15000,
    });
    const idx = r.stdout ? r.stdout.indexOf(OUTPUT_MARKER) : -1;
    const output = idx >= 0 ? r.stdout.slice(idx + OUTPUT_MARKER.length) : r.stdout;
    return { output, status: r.status, stderr: r.stderr };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// Each entry: { num, slug, chapter, inputs?, skip?, failing? }
//   num:     3-digit demo number
//   slug:    full demo name without the number prefix (e.g. 'load-add-display')
//   chapter: chapter directory key  (e.g. 'ch03-assembly-basics')
//   inputs:  stdin string pre-supplied to both sides (default: '')
//   skip:    string reason → test.skip
//   failing: string reason → test.failing (known bug, tracked separately)
const DEMOS = [
  { num: '001', slug: 'load-add-display',            chapter: 'ch03-assembly-basics' },
  { num: '002', slug: 'string-input-output',          chapter: 'ch03-assembly-basics', inputs: 'hello\n' },
  { num: '003', slug: 'counting-loop',                chapter: 'ch03-assembly-basics' },
  { num: '004', slug: 'subroutine-call',              chapter: 'ch03-assembly-basics' },
  { num: '005', slug: 'start-directive',              chapter: 'ch03-assembly-basics' },
  {
    num: '006', slug: 'word-label-vs-literal',        chapter: 'ch03-assembly-basics',
    skip: 'C prints 64-bit host pointer via %p; LCC addresses are 16-bit — values are inherently incomparable',
  },
  { num: '007', slug: 'signed-comparison',            chapter: 'ch03-assembly-basics', inputs: '3\n5\n' },
  { num: '008', slug: 'label-arithmetic',             chapter: 'ch03-assembly-basics' },
  { num: '009', slug: 'static-linked-list',           chapter: 'ch03-assembly-basics' },
  { num: '010', slug: 'function-call-with-args',      chapter: 'ch04-functions-and-call-stack' },
  { num: '011', slug: 'function-return-value',        chapter: 'ch04-functions-and-call-stack' },
  { num: '012', slug: 'global-variables',             chapter: 'ch05-variable-storage-classes' },
  { num: '013', slug: 'local-variables-dynamic',      chapter: 'ch05-variable-storage-classes' },
  { num: '014', slug: 'local-variables-static',       chapter: 'ch05-variable-storage-classes' },
  { num: '015', slug: 'while-loop',                   chapter: 'ch06-control-flow-and-recursion' },
  { num: '016', slug: 'tail-recursion',               chapter: 'ch06-control-flow-and-recursion' },
  { num: '017', slug: 'recursion-non-tail',           chapter: 'ch06-control-flow-and-recursion' },
  { num: '018', slug: 'pointer-to-global',            chapter: 'ch07-pointers' },
  {
    num: '019', slug: 'pointer-to-local',             chapter: 'ch07-pointers',
    failing: 'Assembly bug: fp-offset comments are inverted; *p dereferences wrong slot → 0 instead of 7',
  },
  { num: '020', slug: 'pointer-to-function',          chapter: 'ch07-pointers' },
  { num: '021', slug: 'pass-by-value',                chapter: 'ch08-parameter-passing' },
  { num: '022', slug: 'pass-by-address',              chapter: 'ch08-parameter-passing' },
  { num: '023', slug: 'pass-by-value-result',         chapter: 'ch08-parameter-passing' },
  {
    num: '024', slug: 'pass-by-name-thunks',          chapter: 'ch08-parameter-passing',
    failing: 'Assembly crashes at exit with "Trap vector out of range" (blr/ret clobbers lr across thunk calls)',
  },
  { num: '025', slug: 'variadic-arguments',           chapter: 'ch08-parameter-passing' },
  { num: '026', slug: 'struct-static',                chapter: 'ch09-structures' },
  { num: '027', slug: 'struct-dynamic-malloc',        chapter: 'ch09-structures' },
  { num: '028', slug: 'struct-passing',               chapter: 'ch09-structures' },
  {
    num: '029', slug: 'array-access',                 chapter: 'ch10-arrays-and-strings',
    failing: 'Assembler silently drops "nl" in "dout r0  nl" (multi-instruction lines not supported)',
  },
  {
    num: '030', slug: 'array-passing',                chapter: 'ch10-arrays-and-strings',
    failing: 'Assembler rejects multi-instruction lines (e.g. "mov sp, fp  pop fp  pop lr  ret")',
  },
  {
    num: '031', slug: 'strings',                      chapter: 'ch10-arrays-and-strings',
    failing: 'Assembler silently drops "nl" in "sout r0  nl" (multi-instruction lines not supported)',
  },
  {
    num: '032', slug: 'multiplication-algorithms',    chapter: 'ch11-integer-arithmetic',
    failing: 'Assembler silently drops "nl" in "dout r0  nl" (multi-instruction lines not supported)',
  },
  { num: '033', slug: 'division-algorithm',          chapter: 'ch11-integer-arithmetic' },
  {
    num: '034', slug: 'command-line-args',            chapter: 'ch12-operating-system-interface',
    skip: 'Assembly uses .global main + linker startup stub; assembles to .o, cannot run standalone',
  },
];

const GCC_AVAILABLE = gccAvailable();

describe('Textbook demo C/assembly parity', () => {
  if (!GCC_AVAILABLE) {
    test.skip('gcc not found in PATH — entire suite skipped', () => {});
    return;
  }

  for (const demo of DEMOS) {
    const label = `demo-${demo.num}-${demo.slug}`;
    const cFile  = path.join(TEXTBOOK_DIR, demo.chapter, `demo-${demo.num}-${demo.slug}.c`);
    const aFile  = path.join(TEXTBOOK_DIR, demo.chapter, `demo-${demo.num}-${demo.slug}.a`);
    const stdin  = demo.inputs || '';

    const body = () => {
      const cResult = runC(cFile, stdin);
      const aResult = runAssembly(aFile, stdin);

      expect(cResult.error).toBeUndefined();
      expect(aResult.status).toBe(0);
      expect(aResult.output.trim()).toBe(cResult.output.trim());
    };

    if (demo.skip) {
      test.skip(`${label} — ${demo.skip}`, body);
    } else if (demo.failing) {
      test.failing(`${label} — ${demo.failing}`, body);
    } else {
      test(label, body);
    }
  }
});
