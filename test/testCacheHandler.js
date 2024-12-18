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

  if (!fs.existsSync(cachedInputFile) || !fs.existsSync(cachedOutputFile) || !fs.existsSync(inputFilePath)) {
    return false;
  }

  const currentInputContent = fs.readFileSync(inputFilePath, 'utf8');
  const cachedInputContent = fs.readFileSync(cachedInputFile, 'utf8');

  if (currentInputContent !== cachedInputContent) {
    console.log(`Contents differ for input file '${inputFilePath}' and cached input file '${cachedInputFile}'`);
    return false;
  }

  return true;
}

function updateCache(inputFilePath, outputFilePath, options = {}) {
  const { cachedInputFile, cachedOutputFile } = getCachedFilePaths(inputFilePath, options);

  fs.copyFileSync(inputFilePath, cachedInputFile);
  fs.copyFileSync(outputFilePath, cachedOutputFile);
}

function updateCacheSingular(filePath, cacheDir) {
  console.log(`Updating cache for file '${filePath}' into cache directory '${cacheDir}'`);
  const cachedFilePath = getCachedFilePath(filePath, cacheDir);
  fs.copyFileSync(filePath, cachedFilePath);
}

function compareHexDumps(file1, file2) {
  const hexDump1 = fs.readFileSync(file1);
  const hexDump2 = fs.readFileSync(file2);
  return hexDump1.equals(hexDump2);
}

function getCachedFilePath(filePath, cacheDir) {
  const fileName = path.basename(filePath);
  return path.join(cacheDir, fileName);
}

module.exports = {
  ensureDirectoryExists,
  isCacheValid,
  updateCache,
  getCachedFilePaths,
  compareHexDumps,
  getCachedFilePath,
  updateCacheSingular
};
