const fs = require('fs');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text, 'utf8');
}

function readBytes(filePath) {
  return fs.readFileSync(filePath);
}

function writeBytes(filePath, bytes) {
  fs.writeFileSync(filePath, bytes);
}

module.exports = {
  ensureDir,
  readBytes,
  readText,
  writeBytes,
  writeText,
};
