// Editor bundle entry for the playground (#1284).
//
// Replaces the ~58 per-subpackage esm.sh requests the sandbox used to make for
// CodeMirror 6 + Lezer + the lcc() language with ONE local asset (dist/editor.bundle.js,
// UMD → window.LccEditor). Bundling also collapses the deprecated
// @codemirror/basic-setup@0.20 dependency tree (basicSetup now comes from the
// codemirror@6 meta-package) and guarantees a SINGLE @codemirror/state instance —
// which is what makes CM6's instanceof checks pass without the ?deps= version
// pinning the esm.sh imports needed (#772/#986).
//
// Build: npm run build:browser (webpack.browser.config.js).

import {
  EditorView, keymap, lineNumbers, drawSelection, dropCursor,
  highlightActiveLine, highlightActiveLineGutter, rectangularSelection,
  crosshairCursor, highlightSpecialChars,
} from '@codemirror/view';
import { Compartment } from '@codemirror/state';
import {
  history, defaultKeymap, historyKeymap, indentWithTab,
  toggleLineComment, insertNewlineAndIndent,
} from '@codemirror/commands';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import {
  syntaxHighlighting, HighlightStyle, indentOnInput, bracketMatching,
  foldGutter, foldKeymap,
} from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { lcc } from '../lang-lcc/index.js';

export {
  EditorView, keymap, lineNumbers,
  drawSelection, dropCursor,
  highlightActiveLine, highlightActiveLineGutter, rectangularSelection,
  crosshairCursor, highlightSpecialChars,
  Compartment,
  history, defaultKeymap, historyKeymap, indentWithTab,
  toggleLineComment, insertNewlineAndIndent,
  autocompletion, completionKeymap,
  syntaxHighlighting, HighlightStyle, indentOnInput, bracketMatching,
  foldGutter, foldKeymap,
  tags,
  lcc,
};
