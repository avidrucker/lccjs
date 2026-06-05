import { LRLanguage, LanguageSupport } from '@codemirror/language';
import { styleTags, tags } from '@lezer/highlight';
import { parser } from './lcc.js';

const lccParser = parser.configure({
  props: [
    styleTags({
      Comment:        tags.comment,
      Directive:      tags.keyword,
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
