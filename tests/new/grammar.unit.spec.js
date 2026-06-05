'use strict';

// Grammar tokenization tests for docs/lcc.tmLanguage.json.
// Shiki (the tokenizer) is ESM-only; we run it via a CJS-compatible helper
// that shells out to a single Node subprocess so no Jest config changes are
// needed.  All lines are batched in one subprocess call to keep startup cost
// to one-time.

const { tokenizeLines } = require('../helpers/grammarTokenizer');

// ── test-line registry ────────────────────────────────────────────────────────
// Every line that any test needs must appear here so it can be pre-tokenized
// in one batch.  Keys become the lookup keys used in each test.

const TEST_LINES = {
  // comments
  fullLineComment:          '; this is a comment',
  trailingComment:          'halt ; end',

  // directives
  dotWord:                  '.word 42',
  dotZero:                  '.zero 4',
  dotString:                '.string "hi"',
  dotStart:                 '.start main',
  dotLccplus:               '.lccplus',
  dotOrg:                   '.org 0x100',
  dotOrig:                  '.orig 0x100',
  dotFill:                  '.fill 1',
  dotStringz:               '.stringz "hi"',
  dotAsciz:                 '.asciz "hi"',
  dotSpace:                 '.space 4',
  dotBlkw:                  '.blkw 4',
  dotExtern:                '.extern foo',
  dotGlobl:                 '.globl bar',
  dotGlobal:                '.global baz',

  // label definitions
  globalLabelDef:           'myLabel:',
  labelWithInstruction:     'startup:    clear',
  localLabelDef:            '@loopTop:',

  // literals
  doubleQuotedString:       '"hello world"',
  singleCharLiteral:        "'A'",
  escapedCharLiteral:       "'\\n'",
  decimalNumber:            '42',
  negativeDecimal:          '-1',
  hexNumber:                '0x1A',
  pcRef:                    '@avail: .word *+1',

  // registers
  r0: 'mov r0, 0', r1: 'mov r1, 0', r2: 'mov r2, 0', r3: 'mov r3, 0',
  r4: 'mov r4, 0', r5: 'mov r5, 0', r6: 'mov r6, 0', r7: 'mov r7, 0',
  fpSp:                     'mov sp, fp',
  lr:                       'pop lr',

  // I/O mnemonics
  dout: 'dout r0', udout: 'udout r0', hout: 'hout r0', aout: 'aout r0',
  sout: 'sout r0', nl: 'nl', din: 'din r0', hin: 'hin r0',
  ain:  'ain r0',  sin: 'sin r0',

  // branch mnemonics
  br: 'br target', bral: 'bral target', brz: 'brz target', brnz: 'brnz target',
  bre: 'bre target', brne: 'brne target', brn: 'brn target', brp: 'brp target',
  brlt: 'brlt target', brgt: 'brgt target', bl: 'bl target', blr: 'blr r0',
  ret:  'ret',    jmp:  'jmp target',
  brc: 'brc target', brb: 'brb target', jsr: 'jsr target', jsrr: 'jsrr r0', call: 'call target',

  // core mnemonics
  add: 'add r0, r1', sub: 'sub r0, r1', mul: 'mul r0, r1', div: 'div r0, r1',
  rem: 'rem r0, r1', and: 'and r0, r1', or:  'or r0, r1',  xor: 'xor r0, r1',
  not: 'not r0',     mov: 'mov r0, 0',  ld:  'ld r0, label', ldr: 'ldr r0, r1, 0',
  st:  'st r0, label', str: 'str r0, r1, 0', lea: 'lea r0, label',
  cmp: 'cmp r0, r1', push: 'push r0',   pop: 'pop r0',     halt: 'halt',
  sll: 'sll r0, r1', srl: 'srl r0, r1', sra: 'sra r0, r1',
  rol: 'rol r0, r1', ror: 'ror r0, r1',
  mvi: 'mvi r0, 1',  mvr: 'mvr r0, r1', cea: 'cea r0, label', sext: 'sext r0',

  // LCC+ extension mnemonics
  clear: 'clear r0', sleep: 'sleep r0', nbain: 'nbain r0', rand: 'rand r0',
  srand: 'srand r0', millis: 'millis r0', resetc: 'resetc r0', cursor: 'cursor r0',

  // debug mnemonics (must be on indented lines to satisfy the ^\\s+ anchor)
  debugS:  '            s',
  debugR:  '            r',
  debugM:  '            m',
  debugBp: '            bp',

  // label references
  labelRefBranch:   'bl main',
  labelRefOperand:  'ld r0, myVar',

  // bug #596 regression lines
  atLabelLong:    'br @loopGame',
  atLabelShort:   'bre @L5',
  directiveScope: '.word 0',
  coreScope:      'add r0, r1',
  ioScope:        'aout r0',
  debugAfterLabel:'startup:   s',

  // #850 — label edge-case variants
  dollarLabelDef:    '$cheese:',
  underscoreLabelDef:'_cheese:',
  numStartNotLabel:  '5cheese: halt',
  periodNotLabel:    '.cheese: mov r0, 5',
};

// ── harness ──────────────────────────────────────────────────────────────────

const KEYS  = Object.keys(TEST_LINES);
const LINES = KEYS.map(k => TEST_LINES[k]);

let tokens; // Map<key, {content,scope}[]>

beforeAll(() => {
  const results = tokenizeLines(LINES);
  tokens = Object.fromEntries(KEYS.map((k, i) => [k, results[i]]));
}, 35_000);

// Return the scope of the first token whose content exactly equals `text`.
function scopeOf(key, text) {
  return (tokens[key] ?? []).find(t => t.content === text)?.scope ?? null;
}

// ── comments ─────────────────────────────────────────────────────────────────

describe('comments', () => {
  test('full-line comment', () => {
    expect(scopeOf('fullLineComment', '; this is a comment')).toBe('comment.line.semicolon.lcc');
  });

  test('trailing comment after instruction', () => {
    expect(scopeOf('trailingComment', '; end')).toBe('comment.line.semicolon.lcc');
  });
});

// ── directives ───────────────────────────────────────────────────────────────

describe('directives', () => {
  const DIRECTIVE_SCOPE = 'storage.type.directive.lcc';

  test.each([
    ['.word',    'dotWord'],
    ['.zero',    'dotZero'],
    ['.string',  'dotString'],
    ['.start',   'dotStart'],
    ['.lccplus', 'dotLccplus'],
    ['.org',     'dotOrg'],
    ['.orig',    'dotOrig'],
    ['.fill',    'dotFill'],
    ['.stringz', 'dotStringz'],
    ['.asciz',   'dotAsciz'],
    ['.space',   'dotSpace'],
    ['.blkw',    'dotBlkw'],
    ['.extern',  'dotExtern'],
    ['.globl',   'dotGlobl'],
    ['.global',  'dotGlobal'],
  ])('%s is a directive', (mnemonic, key) => {
    expect(scopeOf(key, mnemonic)).toBe(DIRECTIVE_SCOPE);
  });

  test('directive scope is distinct from core mnemonic scope', () => {
    expect(scopeOf('directiveScope', '.word')).not.toBe(scopeOf('coreScope', 'add'));
  });

  test('directive scope is distinct from I/O mnemonic scope', () => {
    expect(scopeOf('directiveScope', '.word')).not.toBe(scopeOf('ioScope', 'aout'));
  });
});

// ── label definitions ────────────────────────────────────────────────────────

describe('label definitions', () => {
  test('global label definition', () => {
    expect(scopeOf('globalLabelDef', 'myLabel:')).toBe('entity.name.label.lcc');
  });

  test('label definition with instruction on same line', () => {
    expect(scopeOf('labelWithInstruction', 'startup:')).toBe('entity.name.label.lcc');
  });

  test('local @-prefixed label definition', () => {
    expect(scopeOf('localLabelDef', '@loopTop:')).toBe('entity.name.label.lcc');
  });

  // #850 edge cases
  test('$-prefixed label definition', () => {
    expect(scopeOf('dollarLabelDef', '$cheese:')).toBe('entity.name.label.lcc');
  });

  test('_-prefixed label definition', () => {
    expect(scopeOf('underscoreLabelDef', '_cheese:')).toBe('entity.name.label.lcc');
  });

  test('number-starting token is NOT highlighted as a label', () => {
    expect(scopeOf('numStartNotLabel', '5cheese:')).not.toBe('entity.name.label.lcc');
  });

  test('period-starting token is NOT highlighted as a label', () => {
    expect(scopeOf('periodNotLabel', '.cheese:')).not.toBe('entity.name.label.lcc');
  });
});

// ── string and char literals ─────────────────────────────────────────────────

describe('literals', () => {
  test('double-quoted string', () => {
    expect(scopeOf('doubleQuotedString', '"hello world"')).toBe('string.quoted.double.lcc');
  });

  test('single-char literal', () => {
    expect(scopeOf('singleCharLiteral', "'A'")).toBe('string.quoted.single.lcc');
  });

  test('escaped char literal', () => {
    expect(scopeOf('escapedCharLiteral', "'\\n'")).toBe('string.quoted.single.lcc');
  });

  test('decimal number', () => {
    expect(scopeOf('decimalNumber', '42')).toBe('constant.numeric.decimal.lcc');
  });

  test('negative decimal number', () => {
    expect(scopeOf('negativeDecimal', '-1')).toBe('constant.numeric.decimal.lcc');
  });

  test('hex number', () => {
    expect(scopeOf('hexNumber', '0x1A')).toBe('constant.numeric.hex.lcc');
  });

  test('pc ref *', () => {
    expect(scopeOf('pcRef', '*')).toBe('variable.language.pc.lcc');
  });
});

// ── registers ────────────────────────────────────────────────────────────────

describe('registers', () => {
  const REG_SCOPE = 'variable.language.register.lcc';

  test.each(['r0','r1','r2','r3','r4','r5','r6','r7'])('%s', (reg) => {
    expect(scopeOf(reg, reg)).toBe(REG_SCOPE);
  });

  test('fp', () => expect(scopeOf('fpSp', 'fp')).toBe(REG_SCOPE));
  test('sp', () => expect(scopeOf('fpSp', 'sp')).toBe(REG_SCOPE));
  test('lr', () => expect(scopeOf('lr',   'lr')).toBe(REG_SCOPE));
});

// ── I/O mnemonics ─────────────────────────────────────────────────────────────

describe('I/O mnemonics', () => {
  const IO_SCOPE = 'keyword.other.io.lcc';

  test.each(['dout','udout','hout','aout','sout','nl','din','hin','ain','sin'])('%s', (m) => {
    expect(scopeOf(m, m)).toBe(IO_SCOPE);
  });
});

// ── branch mnemonics ─────────────────────────────────────────────────────────

describe('branch mnemonics', () => {
  const BR_SCOPE = 'keyword.control.branch.lcc';

  test.each(['br','bral','brz','brnz','bre','brne','brn','brp','brlt','brgt','bl','blr','ret','jmp','brc','brb','jsr','jsrr','call'])('%s', (m) => {
    expect(scopeOf(m, m)).toBe(BR_SCOPE);
  });
});

// ── core mnemonics ───────────────────────────────────────────────────────────

describe('core mnemonics', () => {
  const CORE_SCOPE = 'keyword.mnemonic.lcc';

  test.each(['add','sub','mul','div','rem','and','or','xor','not','mov','ld','ldr','st','str','lea','cmp','push','pop','halt','sll','srl','sra','rol','ror','mvi','mvr','cea','sext'])('%s', (m) => {
    expect(scopeOf(m, m)).toBe(CORE_SCOPE);
  });
});

// ── LCC+ extension mnemonics ─────────────────────────────────────────────────

describe('LCC+ extension mnemonics', () => {
  const PLUS_SCOPE = 'keyword.mnemonic.extension.lcc';

  test.each(['clear','sleep','nbain','rand','srand','millis','resetc','cursor'])('%s', (m) => {
    expect(scopeOf(m, m)).toBe(PLUS_SCOPE);
  });
});

// ── debug mnemonics ──────────────────────────────────────────────────────────

describe('debug mnemonics', () => {
  const DBG_SCOPE = 'keyword.mnemonic.debug.lcc';
  // The debug mnemonic pattern requires leading whitespace (^\\s+ or after a label colon).
  const CASES = [['s','debugS'], ['r','debugR'], ['m','debugM'], ['bp','debugBp']];

  test.each(CASES)('%s on indented line', (m, key) => {
    const tok = (tokens[key] ?? []).find(t => t.content.trim() === m);
    expect(tok?.scope).toBe(DBG_SCOPE);
  });
});

// ── label references ─────────────────────────────────────────────────────────

describe('label references', () => {
  test('bare label ref as branch target', () => {
    expect(scopeOf('labelRefBranch', 'main')).toBe('entity.name.label.lcc');
  });

  test('bare label ref as operand', () => {
    expect(scopeOf('labelRefOperand', 'myVar')).toBe('entity.name.label.lcc');
  });
});

// ── bug #596 regressions ─────────────────────────────────────────────────────

describe('bug #596 regressions', () => {

  // Bug #596.1 — @-prefixed label refs now tokenize as one entity.name.label.lcc
  // token (fixed by replacing leading \\b with (?<![A-Za-z0-9_@]) in label_ref).
  test('bug #596.1 — @-prefixed label ref is a single entity.name.label.lcc token (long name)', () => {
    const toks = tokens['atLabelLong'] ?? [];
    const atTok = toks.find(t => t.content.startsWith('@'));
    expect(atTok).toBeDefined();
    expect(atTok.content).toBe('@loopGame');
    expect(atTok.scope).toBe('entity.name.label.lcc');
  });

  test('bug #596.1 — short @L5 label ref is a single entity.name.label.lcc token', () => {
    const toks = tokens['atLabelShort'] ?? [];
    const atTok = toks.find(t => t.content.startsWith('@'));
    expect(atTok).toBeDefined();
    expect(atTok.content).toBe('@L5');
    expect(atTok.scope).toBe('entity.name.label.lcc');
  });

  // Bug #596.2 — directive scope is now storage.type.directive.lcc, which does
  // not share the "keyword" prefix with any mnemonic scope.
  test('bug #596.2 — directive scope does not share "keyword" prefix with mnemonic scopes', () => {
    const directiveScope = scopeOf('directiveScope', '.word');
    expect(directiveScope).not.toMatch(/^keyword/);
  });

  // Bug #596.3 — debug mnemonic after a label on the same line is now matched
  // (fixed by adding (?<=:)\\s+ alternation to the mnemonic_debug pattern).
  test('bug #596.3 — debug mnemonic on a label line gets keyword.mnemonic.debug.lcc', () => {
    const toks = tokens['debugAfterLabel'] ?? [];
    const sTok = toks.find(t => t.content.trim() === 's' && !t.content.includes(':'));
    expect(sTok).toBeDefined();
    expect(sTok.scope).toBe('keyword.mnemonic.debug.lcc');
  });
});
