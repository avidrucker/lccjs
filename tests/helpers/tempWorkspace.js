const fs = require('fs');
const os = require('os');
const path = require('path');

function createTempWorkspace(prefix, { nameFileContents = 'TestUser\n' } = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.writeFileSync(path.join(tmpDir, 'name.nnn'), nameFileContents);
  return tmpDir;
}

function stageFileInWorkspace(sourcePath, tmpDir, fileName = path.basename(sourcePath)) {
  const stagedPath = path.join(tmpDir, fileName);
  fs.copyFileSync(sourcePath, stagedPath);
  return stagedPath;
}

function runInWorkspaceCwd(tmpDir, callback) {
  const originalCwd = process.cwd();
  try {
    process.chdir(tmpDir);
    return callback();
  } finally {
    process.chdir(originalCwd);
  }
}

module.exports = {
  createTempWorkspace,
  runInWorkspaceCwd,
  stageFileInWorkspace,
};
