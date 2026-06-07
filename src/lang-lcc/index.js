import { LRLanguage, LanguageSupport } from '@codemirror/language';
import { styleTags, tags } from '@lezer/highlight';
import { parser } from './lcc.js';

const lccParser = parser.configure({
  props: [
    styleTags({
      Comment:        tags.comment,
      // Distinct from MnemonicCore (tags.keyword) so directives can take their
      // own theme color in the CM editor — mirrors the grammar's separate
      // storage.type.directive TextMate scope used by the Shiki preview (#1124).
      Directive:      tags.definitionKeyword,
      LabelDef:       tags.definition(tags.labelName),
      StringLiteral:  tags.string,
      CharLiteral:    tags.character,
      Register:       tags.variableName,
      MnemonicIO:     tags.operatorKeyword,
      MnemonicBranch: tags.controlKeyword,
      MnemonicCore:   tags.keyword,
      MnemonicPlus:   tags.atom,
      Number:         tags.number,
      PcRef:          tags.special(tags.variableName),
      Identifier:     tags.name,
    }),
  ],
});

export const lccLanguage = LRLanguage.define({
  name: 'lcc',
  parser: lccParser,
  languageData: {
    commentTokens: { line: ';' },
  },
});

export function lcc() {
  return new LanguageSupport(lccLanguage);
}
