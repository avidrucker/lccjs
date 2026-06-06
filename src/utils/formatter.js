'use strict';

/**
 * Format a string of LCC assembly source code.
 *
 * Pass 1 (minimal):
 *   - Labels normalised to column 0.
 *   - Instructions / directives indented by INDENT spaces.
 *   - Full-line comments normalised to column 0.
 *   - Label + body on the same line stays inline, normalised to a single space
 *     after the colon (`label: body`); a label with no body stays `label:`.
 *   - Trailing whitespace stripped from every line.
 *   - Trailing blank lines stripped; non-empty output ends with exactly one
 *     trailing newline (POSIX text-file convention).
 *   - Inline comments (part of an instruction line) are preserved verbatim.
 *
 * @param {string} src
 * @returns {string}
 */
function formatLccSource(src) {
  const INDENT = '        '; // 8 spaces — de-facto LCC convention
  const lines = src.split('\n');
  const out = [];

  for (const raw of lines) {
    const stripped = raw.trimEnd();
    const trimmed  = stripped.trim();

    // blank line
    if (!trimmed) { out.push(''); continue; }

    // full-line comment (first non-whitespace char is ;)
    if (trimmed.startsWith(';')) { out.push(trimmed); continue; }

    // label: starts with an optional @ or $ sigil, then word chars, followed by a colon
    // Aligns with vscode-lcc tmLanguage: ^[a-zA-Z_$@][a-zA-Z0-9_$@]*
    const labelM = trimmed.match(/^([@$A-Za-z_][@$\w]*)\s*:(.*)/s);
    if (labelM) {
      const body = labelM[2].trim();
      // label + body stay inline, single space after the colon (R2, #864);
      // a label with no body on its line stays bare at col 0
      out.push(body ? `${labelM[1]}: ${body}` : `${labelM[1]}:`);
      continue;
    }

    // instruction or assembler directive
    out.push(INDENT + trimmed);
  }

  // strip trailing blank lines
  while (out.length && out[out.length - 1] === '') out.pop();

  // non-empty output ends with exactly one trailing newline (R6, #863)
  return out.length ? out.join('\n') + '\n' : '';
}

module.exports = { formatLccSource };
