// error-ids.spec.js — the assembler error-ID registry (#1553, mechanism amended per #1480).
//
// ids live in a central registry keyed by NORMALIZED MESSAGE (src/utils/errorIds.js),
// resolved in formatAssemblerError as `id || lookupErrorId(message)` under --show-err-id.
// These guards keep the registry honest: lookup + normalization behavior, load-time
// uniqueness/format validation (with teeth), and a coverage guard that every error
// literal in assembler.js resolves to a registered id.

'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const { ASM_ERROR_IDS, INT_ERROR_IDS, LNK_ERROR_IDS, lookupErrorId, normalize, validateErrorIds } = require('../../src/utils/errorIds');
const { scanAssemblerErrorIds, scanInterpreterErrorIds, scanLinkerErrorIds } = require('../../scripts/check-error-ids');

describe('errorIds registry — lookup + normalization (#1553)', () => {
  test('a plain message resolves to its id', () => {
    expect(lookupErrorId('Missing register')).toBe('asm-005');
  });

  test('an interpolation suffix is normalized away (": ${…}")', () => {
    expect(lookupErrorId('Invalid mnemonic: zork')).toBe('asm-023');
    expect(lookupErrorId("Unspecified label error for: foo")).toBe('asm-026');
    expect(lookupErrorId("Character literal must contain exactly one character: 'ab'"))
      .toBe('asm-025');
  });

  test('a verbose suggestClosest suffix is normalized away (". Did you mean \'…\'?")', () => {
    expect(lookupErrorId("Bad register. Did you mean 'r0'?")).toBe('asm-012');
    expect(lookupErrorId("Undefined label. Did you mean 'loop'?")).toBe('asm-009');
  });

  test('evaluateImmediate ${type} messages key per distinct type', () => {
    expect(lookupErrorId('imm5 out of range')).toBe('asm-027');
    expect(lookupErrorId('offset6 out of range')).toBe('asm-028');
    expect(lookupErrorId('mvi immediate out of range')).toBe('asm-030');
  });

  test('an unknown message resolves to null (no false positive)', () => {
    expect(lookupErrorId('something nobody registered')).toBeNull();
    expect(lookupErrorId('')).toBeNull();
    expect(lookupErrorId(null)).toBeNull();
  });

  test('the three #1552 ids are preserved (append-only, no renumber)', () => {
    expect(lookupErrorId('Bad label')).toBe('asm-001');
    expect(lookupErrorId('Duplicate label')).toBe('asm-002');
    expect(lookupErrorId('Program too big')).toBe('asm-003');
  });
});

describe('errorIds registry — load-time validation guard (#1553)', () => {
  test('the real registry is well-formed (all ids match /^asm-\\d{3}$/, unique)', () => {
    expect(() => validateErrorIds(ASM_ERROR_IDS)).not.toThrow();
    const ids = Object.values(ASM_ERROR_IDS).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);          // unique
    ids.forEach((id) => expect(id).toMatch(/^asm-\d{3}$/)); // format
  });

  test('guard throws on a duplicate id', () => {
    const dup = { A: { id: 'asm-040' }, B: { id: 'asm-040' } };
    expect(() => validateErrorIds(dup)).toThrow(/duplicate id 'asm-040'/);
  });

  test('guard throws on a malformed id', () => {
    expect(() => validateErrorIds({ A: { id: 'asm-40' } })).toThrow(/malformed id/);
    expect(() => validateErrorIds({ A: { id: 'bad' } })).toThrow(/malformed id/);
  });
});

describe('errorIds registry — coverage guard against assembler.js (#1553)', () => {
  test('every error literal in assembler.js resolves to a registered id', () => {
    const { unresolved, count } = scanAssemblerErrorIds();
    expect(unresolved).toEqual([]);        // names any offender in the failure
    expect(count).toBeGreaterThan(20);     // sanity floor: the scan can't silently no-op
  });

  test('coverage scan has teeth — an unregistered literal is reported', () => {
    const tmp = path.join(os.tmpdir(), `asm-coverage-teeth-${process.pid}.js`);
    fs.writeFileSync(tmp, "this.failAssembly('a brand new unregistered condition', 1);\n");
    try {
      const { unresolved } = scanAssemblerErrorIds(tmp);
      expect(unresolved).toHaveLength(1);
      expect(unresolved[0].key).toBe('a brand new unregistered condition');
    } finally {
      fs.unlinkSync(tmp);
    }
  });
});

describe('errorIds — interpreter registry INT_ERROR_IDS (#1554)', () => {
  test('the INT registry is well-formed (int-NNN, unique, valid under validateErrorIds)', () => {
    expect(() => validateErrorIds(INT_ERROR_IDS)).not.toThrow();
    const ids = Object.values(INT_ERROR_IDS).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^int-\d{3}$/));
    expect(ids).toContain('int-001'); // div-by-zero reference (migrated from #1562)
  });

  test('coverage: source int- ids and the INT registry match exactly (bidirectional)', () => {
    const { usedIds } = scanInterpreterErrorIds();
    const tableIds = new Set(Object.values(INT_ERROR_IDS).map((e) => e.id));
    expect([...usedIds].sort()).toEqual([...tableIds].sort()); // no orphans, no dead entries
    expect(usedIds.size).toBeGreaterThan(10); // sanity floor
  });

  test('coverage: every diagnostic typed-error throw carries an id (none un-identified)', () => {
    const { unidentifiedThrows } = scanInterpreterErrorIds();
    expect(unidentifiedThrows).toEqual([]);
  });

  test('coverage scan has teeth — an id-less diagnostic throw is flagged', () => {
    const tmp = path.join(os.tmpdir(), `int-coverage-teeth-${process.pid}.js`);
    fs.writeFileSync(tmp, "this.raiseRuntimeError(new InterpreterRuntimeError('some new runtime fault'));\n");
    try {
      const { unidentifiedThrows } = scanInterpreterErrorIds(tmp);
      expect(unidentifiedThrows).toHaveLength(1);
    } finally {
      fs.unlinkSync(tmp);
    }
  });
});

describe('errorIds — linker registry LNK_ERROR_IDS (#1555)', () => {
  test('the LNK registry is well-formed (lnk-NNN, unique, valid under validateErrorIds)', () => {
    expect(() => validateErrorIds(LNK_ERROR_IDS)).not.toThrow();
    const ids = Object.values(LNK_ERROR_IDS).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^lnk-\d{3}$/));
    // BAD_OBJECT_HEADER spans 6 distinct messages → 6 distinct ids (max granularity)
    const boh = Object.values(LNK_ERROR_IDS).filter((e) => e.explainKey === 'BAD_OBJECT_HEADER');
    expect(boh.length).toBe(6);
  });

  test('coverage: source lnk- ids and the LNK registry match exactly (bidirectional)', () => {
    const { usedIds } = scanLinkerErrorIds();
    const tableIds = new Set(Object.values(LNK_ERROR_IDS).map((e) => e.id));
    expect([...usedIds].sort()).toEqual([...tableIds].sort());
    expect(usedIds.size).toBeGreaterThan(8);
  });

  test('coverage: every diagnostic LinkerError/this.error site carries an id (none un-identified)', () => {
    const { unidentified } = scanLinkerErrorIds();
    expect(unidentified).toEqual([]);
  });

  test('all-module id-prefix integrity: asm-/int-/lnk- are disjoint and each table is self-consistent', () => {
    const all = [...Object.values(ASM_ERROR_IDS), ...Object.values(INT_ERROR_IDS), ...Object.values(LNK_ERROR_IDS)]
      .map((e) => e.id);
    expect(new Set(all).size).toBe(all.length); // globally unique across modules
    expect(all.every((id) => /^(asm|int|lnk)-\d{3}$/.test(id))).toBe(true);
  });
});
