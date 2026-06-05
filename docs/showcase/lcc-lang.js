// CDN-importable LCC Lezer LanguageSupport for the playground.
// Inlines src/lang-lcc/lcc.js (generated — do not hand-edit the parser data)
// and src/lang-lcc/index.js, replacing bare module specifiers with esm.sh URLs
// pinned to @codemirror/state@6 so instanceof checks work across packages. (#882)
// @lezer/lr and @lezer/highlight have no @codemirror/state dep — omit ?deps= so
// esm.sh emits the unhashed module path that @codemirror/language@6 also imports.
// @codemirror/language@6 must include @lezer/highlight@1 in ?deps= to externalize
// it, ensuring the same @lezer/highlight@1.2.3/es2022/highlight.mjs module is
// shared across this file and the explicit syntaxHighlighting() call in index.html.
import { LRParser }                    from 'https://esm.sh/@lezer/lr@1';
import { LRLanguage, LanguageSupport } from 'https://esm.sh/@codemirror/language@6?deps=@codemirror/state@6,@lezer/highlight@1';
import { styleTags, tags }             from 'https://esm.sh/@lezer/highlight@1.2.3';

// ── Inlined from src/lang-lcc/lcc.js (lezer-generator output) ──────────────
const spec_DotWord = {__proto__:null,".start":10, ".org":10, ".orig":10, ".word":10, ".fill":10, ".stringz":10, ".string":10, ".asciz":10, ".zero":10, ".space":10, ".blkw":10, ".lccplus":10, ".extern":10, ".globl":10, ".global":10, ".end":10}
const spec_Identifier = {__proto__:null,r0:16, r1:16, r2:16, r3:16, r4:16, r5:16, r6:16, r7:16, fp:16, sp:16, lr:16, dout:26, udout:26, hout:26, aout:26, sout:26, nl:26, din:26, hin:26, ain:26, sin:26, br:28, bral:28, brz:28, brnz:28, bre:28, brne:28, brn:28, brp:28, brlt:28, brgt:28, brc:28, brb:28, jmp:28, jsr:28, jsrr:28, bl:28, blr:28, call:28, ret:28, add:30, sub:30, mul:30, div:30, rem:30, and:30, or:30, xor:30, not:30, sll:30, srl:30, sra:30, rol:30, ror:30, mov:30, mvi:30, mvr:30, ld:30, ldr:30, st:30, str:30, lea:30, cea:30, cmp:30, sext:30, push:30, pop:30, halt:30, clear:32, sleep:32, nbain:32, rand:32, srand:32, millis:32, resetc:32, cursor:32}
const parser = LRParser.deserialize({
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

// ── From src/lang-lcc/index.js ──────────────────────────────────────────────
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
