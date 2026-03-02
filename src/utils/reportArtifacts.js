/**
 * Shared in-memory report artifact builder for `.lst` and `.bst` content.
 *
 * This module is the pure data-pipeline layer between assembled/interpreted
 * program state and the final text content written by wrapper scripts. It
 * delegates formatting details to `genStats.js`, but keeps the higher-level
 * contract stable for callers that need deterministic report content without
 * touching the filesystem.
 */
const { generateBSTLSTContent } = require('./genStats.js');

function buildReportArtifacts(options) {
  const {
    assembler = null,
    interpreter = null,
    userName,
    inputFileName,
    includeComments = false,
    now,
  } = options;

  return {
    lstContent: generateBSTLSTContent({
      isBST: false,
      assembler,
      interpreter,
      userName,
      inputFileName,
      includeComments,
      now,
    }),
    bstContent: generateBSTLSTContent({
      isBST: true,
      assembler,
      interpreter,
      userName,
      inputFileName,
      includeComments,
      now,
    }),
  };
}

module.exports = {
  buildReportArtifacts,
};
