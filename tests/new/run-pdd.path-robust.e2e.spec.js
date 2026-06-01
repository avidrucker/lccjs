const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// #224: the pre-push pdd gate (scripts/run-pdd.sh) false-failed from any worktree
// whose absolute path contains a regex-special char — EnterWorktree names worktree
// dirs `<fruit>+<slug>`, and `+` is a regex quantifier. pdd-0.24.2 compiles each
// .pddignore exclude into a regexp from the absolute source path WITHOUT escaping
// literal chars, so the `+` silently voided every exclude; pdd then scanned the
// markdown it was meant to skip and aborted on the first uppercase keyword.
//
// These tests shell out to the real `pdd` gem, so they self-skip when it's absent
// (same convention as the oracle suites — plain `npm test` stays green without it).
const RUN_PDD = path.resolve(__dirname, '../../scripts/run-pdd.sh');
const KW = ['T', 'O', 'D', 'O'].join(''); // built at runtime so this very spec stays scannable

function pddAvailable() {
  const r = spawnSync('pdd', ['--help'], { encoding: 'utf8' });
  return !r.error && r.status === 0;
}

// Lay down a minimal repo-shaped tree at `root`: a copy of run-pdd.sh under
// scripts/, the given .pddignore, and the given files. run-pdd.sh resolves its
// repo root as `dirname($0)/..`, so invoking the copy under root/scripts scans root.
function scaffold(root, { pddignore, files }) {
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.copyFileSync(RUN_PDD, path.join(root, 'scripts', 'run-pdd.sh'));
  fs.writeFileSync(path.join(root, '.pddignore'), pddignore);
  // run-pdd.sh passes --skip-gitignore; pdd-0.24.2 only swaps that flag's boolean
  // for an array when a .gitignore exists (bin/pdd:71-76) — without one it crashes
  // on `[] + true`. A real checkout always has one, so mirror that here.
  fs.writeFileSync(path.join(root, '.gitignore'), 'node_modules/\n');
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
}

function runScan(root) {
  return spawnSync('bash', [path.join(root, 'scripts', 'run-pdd.sh')], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30000,
  });
}

const describeMaybe = pddAvailable() ? describe : describe.skip;

describeMaybe('run-pdd.sh path-robustness (#224)', () => {
  let parent;
  beforeEach(() => {
    parent = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-pdd224-'));
  });
  afterEach(() => {
    fs.rmSync(parent, { recursive: true, force: true });
  });

  // The bug repro: a regex-special char in the path + the keyword living ONLY in
  // an excluded markdown file. Pre-fix this false-failed; the fix must pass it.
  test('a `+` in the repo path does not disable .pddignore excludes', () => {
    const root = path.join(parent, 'cherry+issue-224');
    scaffold(root, {
      pddignore: '*.md\n',
      // uppercase keyword with no leading space — trips pdd iff *.md is not excluded
      files: { 'notes.md': `intro\n${KW} talk about it\n`, 'src/clean.js': '// nothing\n' },
    });

    const r = runScan(root);
    expect(r.status).toBe(0);
    // confirm the fix actually took the safe-symlink branch (not that the char was absent)
    expect(r.stderr).toMatch(/scanning via .*repo/);
  });

  // The gate must still bite: a genuine malformed marker in a *scanned* file fails,
  // even through the symlink — the fix must not neuter detection.
  test('a real malformed marker in a scanned file still fails from a `+` path', () => {
    const root = path.join(parent, 'cherry+issue-224');
    scaffold(root, {
      pddignore: '*.md\n',
      files: { 'src/bad.js': `// ${KW} no puzzle marker here\n` },
    });

    const r = runScan(root);
    expect(r.status).not.toBe(0);
  });

  // Control: a metachar-free path needs no symlink and passes directly.
  test('a clean path passes without engaging the symlink fallback', () => {
    const root = path.join(parent, 'cherry-issue-224');
    scaffold(root, {
      pddignore: '*.md\n',
      files: { 'notes.md': `intro\n${KW} talk about it\n`, 'src/clean.js': '// nothing\n' },
    });

    const r = runScan(root);
    expect(r.status).toBe(0);
    expect(r.stderr).not.toMatch(/scanning via/);
  });
});

describeMaybe('run-pdd.sh --skip-gitignore guard (#248)', () => {
  let parent;
  beforeEach(() => {
    parent = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-pdd248-'));
  });
  afterEach(() => {
    fs.rmSync(parent, { recursive: true, force: true });
  });

  // Pre-fix: pdd-0.24.2 crashes with "TypeError: no implicit conversion of true
  // into Array" when --skip-gitignore is passed but no .gitignore exists.
  // Post-fix: the guard in run-pdd.sh drops the flag, so the scan succeeds.
  test('no .gitignore present: scan succeeds rather than crashing with TypeError', () => {
    const root = path.join(parent, 'no-gitignore');
    scaffold(root, { pddignore: '*.md\n', files: { 'src/clean.js': '// nothing\n' } });
    fs.unlinkSync(path.join(root, '.gitignore'));

    const r = runScan(root);
    expect(r.status).toBe(0);
    expect(r.stderr).not.toMatch(/TypeError/);
  });
});
