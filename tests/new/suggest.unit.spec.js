'use strict';

const { levenshtein, suggestClosest } = require('../../src/utils/suggest');

describe('levenshtein', () => {
  test('identical strings return 0', () => {
    expect(levenshtein('mov', 'mov')).toBe(0);
  });

  test('empty string to non-empty returns length of non-empty', () => {
    expect(levenshtein('', 'abc')).toBe(3);
  });

  test('non-empty to empty returns length', () => {
    expect(levenshtein('abc', '')).toBe(3);
  });

  test('single substitution', () => {
    expect(levenshtein('mov', 'mow')).toBe(1);
  });

  test('single insertion', () => {
    expect(levenshtein('mov', 'movr')).toBe(1);
  });

  test('single deletion', () => {
    expect(levenshtein('movr', 'mov')).toBe(1);
  });

  test('mvr0 vs mov is distance 3', () => {
    expect(levenshtein('mvr0', 'mov')).toBe(3);
  });

  test('completely different short strings', () => {
    expect(levenshtein('add', 'zzz')).toBe(3);
  });
});

describe('suggestClosest', () => {
  const mnemonics = ['mov', 'add', 'sub', 'and', 'not', 'ld', 'st', 'br'];

  test('returns null for empty candidates', () => {
    expect(suggestClosest('mov', [])).toBeNull();
  });

  test('returns null for null candidates', () => {
    expect(suggestClosest('mov', null)).toBeNull();
  });

  test('returns null for empty token', () => {
    expect(suggestClosest('', mnemonics)).toBeNull();
  });

  test('returns null for exact match (distance 0) — caller should not have errored', () => {
    expect(suggestClosest('mov', mnemonics)).toBeNull();
  });

  test('returns closest match within default distance 2', () => {
    // 'addd' → 'add' is distance 1 (one extra character)
    expect(suggestClosest('addd', mnemonics)).toBe('add');
  });

  test('returns null when no candidate within threshold', () => {
    // 'zzzzz' is far from everything
    expect(suggestClosest('zzzzz', mnemonics)).toBeNull();
  });

  test('returns lexicographically first when tied', () => {
    // 'an' is distance 1 from both 'add' (no) and 'and' — only 'and'? Actually:
    // levenshtein('an', 'and') = 1, levenshtein('an', 'add') = 2
    // So 'and' wins. Let's test explicit tie:
    const candidates = ['zzb', 'zza']; // both distance 2 from 'zzc'
    expect(suggestClosest('zzc', candidates)).toBe('zza');
  });

  test('case-insensitive comparison', () => {
    // 'MOV' should match 'mov'
    expect(suggestClosest('MVO', ['mov', 'add'])).toBe('mov');
  });

  test('respects custom maxDistance 1', () => {
    // 'mvr0' → 'mov' is distance 2, so should be null with maxDistance 1
    expect(suggestClosest('mvr0', mnemonics, 1)).toBeNull();
  });

  test('distance-1 match within maxDistance 1', () => {
    // 'addd' → 'add' is distance 1
    expect(suggestClosest('addd', mnemonics, 1)).toBe('add');
  });
});
