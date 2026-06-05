'use strict';

/**
 * Returns true if the source line str begins a valid label definition —
 * i.e. the assembler would accept it and add the label to the symbol table
 * without a "Bad label" error.
 *
 * Rules (mirrors assembler.js isValidLabelDef + isValidLabel):
 *   - A line is a label-def candidate if its first token ends with ':'
 *     OR the line has no leading whitespace (col-0 label without colon).
 *   - The label name (first token minus any trailing ':') must match
 *     [A-Za-z_$@][A-Za-z0-9_$@]*.
 *
 * @param {string} str - A single source line.
 * @returns {boolean}
 */
function isValidLabelDefinition(str) {
  if (!str || !str.trim()) return false;

  const startsAtCol0 = !/^\s/.test(str);

  // Extract first token: maximal run of non-whitespace/non-comma/non-colon chars,
  // followed by an optional ':' (mirrors the assembler tokenizer which appends ':'
  // to the current token when it encounters the colon character).
  const m = str.match(/^\s*([^\s,:]+:?)/);
  if (!m) return false;

  const firstToken = m[1];
  const hasColon = firstToken.endsWith(':');
  if (!hasColon && !startsAtCol0) return false;

  const labelName = hasColon ? firstToken.slice(0, -1) : firstToken;
  return /^[A-Za-z_$@][A-Za-z0-9_$@]*$/.test(labelName);
}

module.exports = { isValidLabelDefinition };
