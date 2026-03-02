const fs = require('fs');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readBytes(filePath) {
  return fs.readFileSync(filePath);
}

function fileBytesEqual(file1, file2) {
  const bytes1 = readBytes(file1);
  const bytes2 = readBytes(file2);

  if (bytes1.length !== bytes2.length) {
    return false;
  }

  for (let i = 0; i < bytes1.length; i++) {
    if (bytes1[i] !== bytes2[i]) {
      return false;
    }
  }

  return true;
}

function normalizeContent(content, options = {}) {
  const {
    skipLeadingLines = 0,
    skipFirstNonEmptyLine = false,
    stripComments = false,
    trimLines = true,
    collapseWhitespace = false,
    omitEmptyLines = false,
    caseInsensitive = false,
    truncateTo = null,
    skipPatterns = [],
  } = options;

  let lines = Array.isArray(content) ? [...content] : String(content).split('\n');

  if (skipLeadingLines > 0) {
    lines = lines.slice(skipLeadingLines);
  }

  if (stripComments) {
    lines = lines.map(line => line.replace(/;.*/, ''));
  }

  if (trimLines) {
    lines = lines.map(line => line.trim());
  }

  if (collapseWhitespace) {
    lines = lines.map(line => line.replace(/\s+/g, ' '));
  }

  if (skipPatterns.length > 0) {
    lines = lines.filter(line => !skipPatterns.some(pattern => pattern.test(line)));
  }

  if (omitEmptyLines) {
    lines = lines.filter(line => line !== '');
  }

  if (skipFirstNonEmptyLine && lines.length > 0) {
    lines = lines.slice(1);
  }

  if (caseInsensitive) {
    lines = lines.map(line => line.toLowerCase());
  }

  if (truncateTo !== null) {
    lines = lines.map(line => line.substring(0, truncateTo));
  }

  return lines;
}

function compareXstFiles(file1, file2, options = {}) {
  const content1 = readText(file1);
  const content2 = readText(file2);

  const normalized1 = normalizeContent(content1, options);
  const normalized2 = normalizeContent(content2, options);

  if (normalized1.length !== normalized2.length) {
    return false;
  }

  for (let i = 0; i < normalized1.length; i++) {
    if (normalized1[i] !== normalized2[i]) {
      return false;
    }
  }

  return true;
}

function diffXstFiles(file1, file2, options = {}) {
  const content1 = readText(file1);
  const content2 = readText(file2);

  const normalized1 = normalizeContent(content1, options);
  const normalized2 = normalizeContent(content2, options);

  const diffLines = [];
  const maxLength = Math.max(normalized1.length, normalized2.length);

  for (let i = 0; i < maxLength; i++) {
    const line1 = normalized1[i] || '<missing>';
    const line2 = normalized2[i] || '<missing>';
    const marker = line1 === line2 ? ' ' : '!';
    diffLines.push(`${marker} ${i.toString().padStart(4, '0')}: ${line1} | ${line2}`);
  }

  return diffLines.join('\n');
}

function compareLstFiles(file1, file2, options = {}) {
  return compareXstFiles(file1, file2, options);
}

function compareBstFiles(file1, file2, options = {}) {
  return compareXstFiles(file1, file2, options);
}

function lstDiff(file1, file2, options = {}) {
  return diffXstFiles(file1, file2, options);
}

function bstDiff(file1, file2, options = {}) {
  return diffXstFiles(file1, file2, options);
}

module.exports = {
  bstDiff,
  compareBstFiles,
  compareLstFiles,
  compareXstFiles,
  diffXstFiles,
  fileBytesEqual,
  lstDiff,
  normalizeContent,
};
