'use strict';

const { formatLccSource } = require('../../src/utils/formatter');

describe('formatLccSource', () => {

  // ── blank / whitespace-only ──────────────────────────────────────────────────

  test('empty string returns empty string', () => {
    expect(formatLccSource('')).toBe('');
  });

  test('whitespace-only string returns empty string', () => {
    expect(formatLccSource('   \n\t\n  ')).toBe('');
  });

  // ── instructions ─────────────────────────────────────────────────────────────

  test('instruction with no indent is indented 8 spaces', () => {
    expect(formatLccSource('mov r0, 1')).toBe('        mov r0, 1\n');
  });

  test('instruction with wrong indent is normalised to 8 spaces', () => {
    expect(formatLccSource('  mov r0, 1')).toBe('        mov r0, 1\n');
  });

  test('instruction already indented 8 spaces is unchanged', () => {
    expect(formatLccSource('        mov r0, 1')).toBe('        mov r0, 1\n');
  });

  test('trailing whitespace is stripped from instruction', () => {
    expect(formatLccSource('        mov r0, 1   ')).toBe('        mov r0, 1\n');
  });

  // ── labels ───────────────────────────────────────────────────────────────────

  test('label-only line normalised to column 0', () => {
    expect(formatLccSource('        main:')).toBe('main:\n');
  });

  test('label already at column 0 is unchanged', () => {
    expect(formatLccSource('main:')).toBe('main:\n');
  });

  test('label+body kept inline, single space after colon', () => {
    expect(formatLccSource('msg:    .string "hello"')).toBe('msg: .string "hello"\n');
  });

  test('label+body with extra spaces between colon and body normalised to one space', () => {
    expect(formatLccSource('data_word:      .word 5')).toBe('data_word: .word 5\n');
  });

  test('label with space before colon normalised', () => {
    expect(formatLccSource('main :')).toBe('main:\n');
  });

  test('@-prefix label placed at column 0', () => {
    expect(formatLccSource('        @loop:')).toBe('@loop:\n');
  });

  test('$-prefix label placed at column 0', () => {
    expect(formatLccSource('        $local:')).toBe('$local:\n');
  });

  test('@-prefix label+body kept inline at column 0', () => {
    expect(formatLccSource('@loop: br @loop')).toBe('@loop: br @loop\n');
  });

  test('$-prefix label+body kept inline at column 0', () => {
    expect(formatLccSource('$local: .word 0')).toBe('$local: .word 0\n');
  });

  test('@-prefix label not misclassified as instruction', () => {
    // Without the sigil-aware regex: '@loop: br @loop' → '        @loop: br @loop'
    // (wrong, indented as an instruction). With it (R2): '@loop: br @loop' stays
    // inline at col 0.
    expect(formatLccSource('@loop: br @loop')).not.toBe('        @loop: br @loop');
  });

  // ── comments ─────────────────────────────────────────────────────────────────

  test('full-line comment normalised to column 0', () => {
    expect(formatLccSource('        ; indented comment')).toBe('; indented comment\n');
  });

  test('full-line comment already at column 0 is unchanged', () => {
    expect(formatLccSource('; a comment')).toBe('; a comment\n');
  });

  test('trailing whitespace stripped from comment', () => {
    expect(formatLccSource('; a comment   ')).toBe('; a comment\n');
  });

  test('inline comment on instruction line is preserved', () => {
    const input = '  mov r0, 1     ; load 1';
    expect(formatLccSource(input)).toBe('        mov r0, 1     ; load 1\n');
  });

  // ── blank lines ──────────────────────────────────────────────────────────────

  test('blank line between instructions is preserved', () => {
    const input = '        mov r0, 1\n\n        mov r1, 2';
    expect(formatLccSource(input)).toBe('        mov r0, 1\n\n        mov r1, 2\n');
  });

  test('trailing blank lines are stripped', () => {
    expect(formatLccSource('        halt\n\n')).toBe('        halt\n');
  });

  // ── directives ───────────────────────────────────────────────────────────────

  test('.start directive indented 8 spaces', () => {
    expect(formatLccSource('.start main')).toBe('        .start main\n');
  });

  test('.word directive indented 8 spaces', () => {
    expect(formatLccSource('.word 42')).toBe('        .word 42\n');
  });

  // ── multi-line ───────────────────────────────────────────────────────────────

  test('typical hello-world snippet is fully normalised', () => {
    const input = [
      '; Hello World',
      '  .start main',
      'main:',
      '  lea r0, msg',
      '  sout r0',
      '  nl',
      '  halt',
      'msg:  .string "Hello, World!"',
    ].join('\n');

    const expected = [
      '; Hello World',
      '        .start main',
      'main:',
      '        lea r0, msg',
      '        sout r0',
      '        nl',
      '        halt',
      'msg: .string "Hello, World!"',
    ].join('\n') + '\n';

    expect(formatLccSource(input)).toBe(expected);
  });

  test('already-formatted snippet is idempotent', () => {
    const src = [
      '; Hello World',
      '        .start main',
      'main:',
      '        lea r0, msg',
      '        sout r0',
      '        nl',
      '        halt',
      'msg: .string "Hello, World!"',
    ].join('\n') + '\n';

    expect(formatLccSource(src)).toBe(src);
  });

});
