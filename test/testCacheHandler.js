// testCacheHandler.js

const fs = require('fs');
const path = require('path');

function ensureDirectoryExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function getCachedFilePaths(inputFilePath, options = {}) {
  const {
    cacheDir = path.join(__dirname, '../test_cache'),
    inputExt = path.extname(inputFilePath),
    outputExt = '.e', // Default output extension
  } = options;

  ensureDirectoryExists(cacheDir);

  const inputFileName = path.basename(inputFilePath, inputExt);
  const cachedInputFile = path.join(cacheDir, `${inputFileName}${inputExt}`);
  const cachedOutputFile = path.join(cacheDir, `${inputFileName}${outputExt}`);

  return {
    cachedInputFile,
    cachedOutputFile,
  };
}

function isCacheValid(inputFilePath, options = {}) {
  const { cachedInputFile, cachedOutputFile } = getCachedFilePaths(inputFilePath, options);

  if (!fs.existsSync(cachedInputFile) || !fs.existsSync(cachedOutputFile)) {
    return false;
  }

  const currentInputContent = fs.readFileSync(inputFilePath);
  const cachedInputContent = fs.readFileSync(cachedInputFile);

  return currentInputContent.equals(cachedInputContent);
}

function updateCache(inputFilePath, outputFilePath, options = {}) {
  const { cachedInputFile, cachedOutputFile } = getCachedFilePaths(inputFilePath, options);

  fs.copyFileSync(inputFilePath, cachedInputFile);
  fs.copyFileSync(outputFilePath, cachedOutputFile);
}

module.exports = {
  isCacheValid,
  updateCache,
  getCachedFilePaths,
};
