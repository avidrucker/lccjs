'use strict';

// Unit tests for the pre-push hook's conflict-marker grep (#577).
//
// The hook uses: git grep -nE '^(<<<<<<<|>>>>>>>)' -- ':!*.md'
//
// Before #577 the glob was absent, so fenced code-block examples in TIL docs
// (which contain column-0 <<<<<<< / >>>>>>> text) would trip the gate.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function gitIn(repoDir, args, input) {
  return spawnSync('git', args, {
    cwd: repoDir,
    encoding: 'utf8',
    input,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  });
}

function makeRepo(dir) {
  gitIn(dir, ['init', '-b', 'main']);
  gitIn(dir, ['config', 'user.email', 'test@example.com']);
  gitIn(dir, ['config', 'user.name', 'Test']);
}

function commitFile(repoDir, relPath, content) {
  const full = path.join(repoDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  gitIn(repoDir, ['add', relPath]);
  gitIn(repoDir, ['commit', '-m', 'add file']);
}

// Run the exact grep the hook uses and return the matched lines (empty = no matches).
function hookGrep(repoDir) {
  const result = spawnSync(
    'git', ['grep', '-nE', '^(<<<<<<<|>>>>>>>)', '--', ':!*.md'],
    { cwd: repoDir, encoding: 'utf8' }
  );
  return result.stdout.trim();
}

describe('pre-push hook conflict-marker grep (#577)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-prepush-'));
    makeRepo(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('does NOT fire on a .md file with column-0 conflict-marker examples', () => {
    commitFile(tmpDir, 'docs/learnings/til.md',
      'Example of what a conflict looks like:\n\n```\n<<<<<<< HEAD\nmy change\n=======\ntheir change\n>>>>>>> abc1234\n```\n'
    );
    expect(hookGrep(tmpDir)).toBe('');
  });

  test('DOES fire on a .js source file with a real conflict marker', () => {
    commitFile(tmpDir, 'src/foo.js',
      '<<<<<<< HEAD\nconst x = 1;\n=======\nconst x = 2;\n>>>>>>> abc1234\n'
    );
    const matches = hookGrep(tmpDir);
    expect(matches).toContain('src/foo.js');
    expect(matches).toContain('<<<<<<<');
  });

  test('fires on non-md conflict but ignores a .md file in the same repo', () => {
    commitFile(tmpDir, 'docs/learnings/til.md',
      '```\n<<<<<<< HEAD\nexample\n>>>>>>> abc\n```\n'
    );
    commitFile(tmpDir, 'src/bar.js',
      '<<<<<<< HEAD\nconst y = 1;\n=======\nconst y = 2;\n>>>>>>> def5678\n'
    );
    const matches = hookGrep(tmpDir);
    expect(matches).not.toContain('til.md');
    expect(matches).toContain('src/bar.js');
  });
});
