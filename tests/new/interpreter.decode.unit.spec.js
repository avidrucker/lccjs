const Interpreter = require('../../src/core/interpreter');

// Unit coverage for the pure decode(ir) seam extracted from step() (#251 / #246 H1a).
// Before the extraction, decode was inline in step() and only observable by running
// a full fetch-execute cycle with all its side effects; now decode(ir) returns a
// plain field object and writes nothing to `this`, so it can be asserted directly.
describe('Interpreter.decode(ir) — pure instruction decode', () => {
  /** @type {Interpreter} */
  let d;
  beforeEach(() => { d = new Interpreter(); });

  test('decodes ADD register mode (add r1, r2, r3)', () => {
    // opcode=1, dr=1, sr1=2, bit5=0, sr2=3
    const f = d.decode(0x1283);
    expect(f.opcode).toBe(1);
    expect(f.dr).toBe(1);
    expect(f.sr1).toBe(2);
    expect(f.bit5).toBe(0);
    expect(f.sr2).toBe(3);
  });

  test('decodes ADD immediate mode with a sign-extended imm5 (add r1, r2, #-1)', () => {
    // opcode=1, dr=1, sr1=2, bit5=1, imm5=-1
    const f = d.decode(0x12BF);
    expect(f.opcode).toBe(1);
    expect(f.bit5).toBe(1);
    expect(f.imm5).toBe(-1);
  });

  test('decodes LDR with base register and sign-extended offset6 (ldr r3, fp, -1)', () => {
    // opcode=6, dr=3, baser=5(fp), offset6=-1
    const f = d.decode(0x677F);
    expect(f.opcode).toBe(6);
    expect(f.dr).toBe(3);
    expect(f.baser).toBe(5);
    expect(f.offset6).toBe(-1);
  });

  test('decodes BR with a sign-extended pcoffset9 (cc=7, offset=-1)', () => {
    const f = d.decode(0x0FFF);
    expect(f.opcode).toBe(0);
    expect(f.code).toBe(7); // condition code lives in the bits 11-9 field
    expect(f.pcoffset9).toBe(-1);
  });

  test('decodes BL with bit11 set and a sign-extended pcoffset11', () => {
    const f = d.decode(0x4FFF);
    expect(f.opcode).toBe(4);
    expect(f.bit11).toBe(1);
    expect(f.pcoffset11).toBe(-1);
  });

  test('decodes TRAP vector (sout = 0x06)', () => {
    const f = d.decode(0xF006);
    expect(f.opcode).toBe(15);
    expect(f.trapvec).toBe(0x06);
  });

  test('decodes the case-10 extended opcode (mul = eopcode 0x07)', () => {
    // opcode=0xA, dr=1, sr1=2, eopcode=0x07
    const f = d.decode(0xA287);
    expect(f.opcode).toBe(10);
    expect(f.eopcode).toBe(0x07);
  });

  test('exposes the historical field aliases consistently', () => {
    const f = d.decode(0x1283);
    expect(f.code).toBe(f.dr);   // code === dr === sr (bits 11-9)
    expect(f.sr).toBe(f.dr);
    expect(f.baser).toBe(f.sr1); // baser === sr1 (bits 8-6)
    expect(f.imm9).toBe(f.pcoffset9); // imm9 is an alias of pcoffset9
  });

  test('is pure — writes nothing to the instance', () => {
    // None of the decode fields are set on a fresh instance; decode() must not
    // create or mutate them (that is step()\'s job, via Object.assign).
    const before = { opcode: d.opcode, dr: d.dr, imm5: d.imm5, trapvec: d.trapvec };
    d.decode(0x12BF);
    expect(d.opcode).toBe(before.opcode);
    expect(d.dr).toBe(before.dr);
    expect(d.imm5).toBe(before.imm5);
    expect(d.trapvec).toBe(before.trapvec);
  });

  test('is deterministic — same ir yields equal field sets', () => {
    expect(d.decode(0x677F)).toEqual(d.decode(0x677F));
  });
});
