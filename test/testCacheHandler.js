// testCacheHandler.js

const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '../test_cache');

// Ensure the cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR);
}

function isCacheValid(inputFilePath) {
  const inputFileName = path.basename(inputFilePath, '.a');
  const cachedInputFile = path.join(CACHE_DIR, `${inputFileName}.a`);
  const cachedOutputFile = path.join(CACHE_DIR, `${inputFileName}.e`);

  if (!fs.existsSync(cachedInputFile) || !fs.existsSync(cachedOutputFile)) {
    return false;
  }

  const currentInputContent = fs.readFileSync(inputFilePath);
  const cachedInputContent = fs.readFileSync(cachedInputFile);

  return currentInputContent.equals(cachedInputContent);
}

function updateCache(inputFilePath, outputFilePath) {
  const inputFileName = path.basename(inputFilePath, '.a');
  const cachedInputFile = path.join(CACHE_DIR, `${inputFileName}.a`);
  const cachedOutputFile = path.join(CACHE_DIR, `${inputFileName}.e`);

  fs.copyFileSync(inputFilePath, cachedInputFile);
  fs.copyFileSync(outputFilePath, cachedOutputFile);
}

module.exports = {
  isCacheValid,
  updateCache,
  CACHE_DIR,
};
