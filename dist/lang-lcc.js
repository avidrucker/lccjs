// LCC assembly language support for CodeMirror 6.
// Generated parser tables from src/lang-lcc/lcc.grammar via @lezer/generator.
// CDN-friendly: uses full esm.sh URLs so no import map or build step is needed.
// Deduplication: @codemirror/language and @lezer/* must resolve to the same
// instances as the host page's CodeMirror bundle.  If the host uses an import
// map, add entries for "@codemirror/language", "@lezer/lr", "@lezer/highlight"
// and load this file with ?external=@codemirror/language,@lezer/lr,@lezer/highlight.

// Pin @lezer/highlight@1 in @codemirror/language@6's ?deps= (and import the same
// @lezer/highlight@1.2.3 / @lezer/lr@1 / @codemirror/language@6?deps= URLs the
// playground's syntaxHighlighting() call uses) so esm.sh externalizes a single
// shared @lezer/highlight module and a single @codemirror/language instance. Without
// this, defaultHighlightStyle's tags differ by identity from the styleTags below and
// no highlight spans are produced. (#986; mirrors docs/showcase/lcc-lang.js #882.)
import { LRParser } from 'https://esm.sh/@lezer/lr@1';
import { LRLanguage, LanguageSupport } from 'https://esm.sh/@codemirror/language@6?deps=@codemirror/state@6,@lezer/highlight@1';
import { styleTags, tags } from 'https://esm.sh/@lezer/highlight@1.2.3';

// ── Compiled parser tables (lezer-generator 1.8.0) ───────────────────────────

const spec_DotWord = {__proto__:null,".start":10, ".org":10, ".orig":10, ".word":10, ".fill":10, ".stringz":10, ".string":10, ".asciz":10, ".zero":10, ".space":10, ".blkw":10, ".lccplus":10, ".extern":10, ".globl":10, ".global":10, ".end":10}
const spec_Identifier = {__proto__:null,r0:16, r1:16, r2:16, r3:16, r4:16, r5:16, r6:16, r7:16, fp:16, sp:16, lr:16, dout:26, udout:26, hout:26, aout:26, sout:26, nl:26, din:26, hin:26, ain:26, sin:26, br:28, bral:28, brz:28, brnz:28, bre:28, brne:28, brn:28, brp:28, brlt:28, brgt:28, brc:28, brb:28, jmp:28, jsr:28, jsrr:28, bl:28, blr:28, call:28, ret:28, add:30, sub:30, mul:30, div:30, rem:30, and:30, or:30, xor:30, not:30, sll:30, srl:30, sra:30, rol:30, ror:30, mov:30, mvi:30, mvr:30, ld:30, ldr:30, st:30, str:30, lea:30, cea:30, cmp:30, sext:30, push:30, pop:30, halt:30, clear:32, sleep:32, nbain:32, rand:32, srand:32, millis:32, resetc:32, cursor:32}

const _parser = LRParser.deserialize({
  version: 14,
  states: "#fQVQPOOO!`QPO'#CtO!jQPO'#CrO#WQPO'#CrO#bQPO'#CrOOQO'#Cr'#CrOOQO'#Cm'#CmQVQPOOOOQO'#Cu'#CuOOQO'#Cn'#CnO#jQPO,59`OOQO,59^,59^O#tQPO,59^O#yQPO,59^OOQO-E6k-E6kOOQO-E6l-E6lOOQO1G.x1G.xO$RQPO1G.xOOQO7+$d7+$d",
  stateData: "$b~OeOS~OQQORROSPOTPOVPO]PO^PO_PO`POgTO~OUWOVWOWWOXWOYWOZWO[WO~OQhXghX~PwOgZO~OSPOTPOVPO]PO^PO_PO`PO~OQ[OgZO~P!oOQ[OgZO~OQhagha~PwOg`O~OQaOg`O~OgbO~OQYZSXR[VX~",
  goto: "!WjPPPPPPPPPPPPPPPPPkqPPPwP{!SQVOR^VQYPR_YTUOVSSOVR]RTXPY",
  nodeNames: "⚠ Program Comment LabelDef DotWord Directive , Identifier Register Number StringLiteral CharLiteral PcRef MnemonicIO MnemonicBranch MnemonicCore MnemonicPlus",
  maxTerm: 25,
  skippedNodes: [0],
  repeatNodeCount: 2,
  tokenData: ")v~RaXY!WYZ!c]^!hpq!Wrs!nwx$bz{&U|}&Z}!O&`!O!P&n!Q!R'c!R![&f!]!^(q!b!c)Y!c!})Y#R#S)Y#T#o)Y~!]Qe~XY!Wpq!W~!hOg~~!kPYZ!c~!qWOY!nZr!nrs#Zs#O!n#O#P#`#P;'S!n;'S;=`$[<%lO!n~#`OY~~#cRO;'S!n;'S;=`#l;=`O!n~#oXOY!nZr!nrs#Zs#O!n#O#P#`#P;'S!n;'S;=`$[;=`<%l!n<%lO!n~$_P;=`<%l!n~$eWOY$bZw$bwx$}x#O$b#O#P%S#P;'S$b;'S;=`&O<%lO$b~%SOZ~~%VRO;'S$b;'S;=`%`;=`O$b~%cXOY$bZw$bwx$}x#O$b#O#P%S#P;'S$b;'S;=`&O;=`<%l$b<%lO$b~&RP;=`<%l$b~&ZO[~~&`OU~~&cP!Q![&f~&kPX~!Q![&f~&qS!b!c&}!c!}&}#R#S&}#T#o&}~'STS~!Q![&}!b!c&}!c!}&}#R#S&}#T#o&}~'hRX~!Q![&f#U#V'q#l#m(V~'tQ!Q!R'z!R!S'z~(PQX~!Q!R'z!R!S'z~(YR!Q![(c!c!i(c#T#Z(c~(hRX~!Q![(c!c!i(c#T#Z(c~(vSQ~OY(qZ;'S(q;'S;=`)S<%lO(q~)VP;=`<%l(q~)_UV~!Q![)Y![!])q!b!c)Y!c!})Y#R#S)Y#T#o)Y~)vOR~",
  tokenizers: [0],
  topRules: {"Program":[0,1]},
  specialized: [{term: 4, get: (value) => spec_DotWord[value] || -1},{term: 7, get: (value) => spec_Identifier[value] || -1}],
  tokenPrec: 146
});

// ── LanguageSupport ───────────────────────────────────────────────────────────

const lccParser = _parser.configure({
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

/** Returns a CodeMirror 6 LanguageSupport for LCC assembly. */
export function lcc() {
  return new LanguageSupport(lccLanguage);
}
