const Assembler = require('../../src/core/assembler');
const Interpreter = require('../../src/core/interpreter');

// Helper: assemble source and run via executeBuffer.
// Returns both the interpreter instance (for .n/.z/.c/.v flag access)
// and the result object (for .registers, .mem).
function run(source) {
  const asm = new Assembler();
  const assembly = asm.assembleSource(source, { inputFileName: 'flags.a' });
  const interp = new Interpreter();
  interp.executeBuffer(assembly.outputBytes, { inputFileName: 'flags.e' });
  return interp;
}

describe('Interpreter — setNZ / setCV flag-setting (#528)', () => {
  beforeAll(() => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
  });
  afterAll(() => {
    process.stdout.write.mockRestore();
  });

  // ── setNZ ────────────────────────────────────────────────────────────────

  test('positive result: N=0 Z=0', () => {
    const interp = run(`
      add r0, r0, 5
      halt
    `);
    expect(interp.n).toBe(0);
    expect(interp.z).toBe(0);
  });

  test('zero result: N=0 Z=1', () => {
    // add r0, r0, 0 forces setNZ(0) even though value doesn't change
    const interp = run(`
      add r0, r0, 0
      halt
    `);
    expect(interp.n).toBe(0);
    expect(interp.z).toBe(1);
  });

  test('negative result: N=1 Z=0', () => {
    const interp = run(`
      add r0, r0, -1
      halt
    `);
    expect(interp.n).toBe(1);
    expect(interp.z).toBe(0);
  });

  // ── setCV ────────────────────────────────────────────────────────────────

  test('pos + pos (no overflow): C=0 V=0', () => {
    // 1 + 1 = 2: both operands positive, no carry, no overflow
    const interp = run(`
      add r0, r0, 1
      add r1, r0, r0
      halt
    `);
    expect(interp.c).toBe(0);
    expect(interp.v).toBe(0);
  });

  test('neg + neg: C=1 V=0', () => {
    // (-1) + (-1) = -2: both negative → carry set, no signed overflow
    const interp = run(`
      add r0, r0, -1
      add r1, r0, r0
      halt
    `);
    expect(interp.c).toBe(1);
    expect(interp.v).toBe(0);
  });

  test('pos + pos overflow: C=0 V=1', () => {
    // 0x7FFF + 1 = 0x8000: pos+pos produces negative result → overflow
    const interp = run(`
      add r1, r1, 1
      ld r0, cv_maxval
      add r2, r0, r1
      halt
      cv_maxval: .word 0x7FFF
    `);
    expect(interp.c).toBe(0);
    expect(interp.v).toBe(1);
  });
});

describe('Interpreter — BR condition decode (#528)', () => {
  beforeAll(() => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
  });
  afterAll(() => {
    process.stdout.write.mockRestore();
  });

  // Pattern: set flags, branch to a skip label, `add r1, r1, 1` if NOT taken.
  // r1===0 after halt → branch was taken.
  // r1===1 after halt → branch was not taken (fell through).
  // Each program uses a unique label name to avoid any symbol-table collision.

  test('brz (code 0): branches if Z=1, not if Z=0', () => {
    // taken: zero result → Z=1
    const t = run(`
      add r0, r0, 0
      brz brz_t_skip
      add r1, r1, 1
      brz_t_skip: halt
    `);
    expect(t.r[1]).toBe(0);

    // not taken: positive → Z=0
    const nt = run(`
      add r0, r0, 5
      brz brz_nt_skip
      add r1, r1, 1
      brz_nt_skip: halt
    `);
    expect(nt.r[1]).toBe(1);
  });

  test('brnz (code 1): branches if Z=0, not if Z=1', () => {
    const t = run(`
      add r0, r0, 5
      brnz brnz_t_skip
      add r1, r1, 1
      brnz_t_skip: halt
    `);
    expect(t.r[1]).toBe(0);

    const nt = run(`
      add r0, r0, 0
      brnz brnz_nt_skip
      add r1, r1, 1
      brnz_nt_skip: halt
    `);
    expect(nt.r[1]).toBe(1);
  });

  test('brn (code 2): branches if N=1, not if N=0', () => {
    const t = run(`
      add r0, r0, -1
      brn brn_t_skip
      add r1, r1, 1
      brn_t_skip: halt
    `);
    expect(t.r[1]).toBe(0);

    const nt = run(`
      add r0, r0, 5
      brn brn_nt_skip
      add r1, r1, 1
      brn_nt_skip: halt
    `);
    expect(nt.r[1]).toBe(1);
  });

  test('brp (code 3): branches when N===Z (strictly positive); not for zero or negative', () => {
    // taken: N=0,Z=0 (positive) → N===Z
    const t = run(`
      add r0, r0, 5
      brp brp_t_skip
      add r1, r1, 1
      brp_t_skip: halt
    `);
    expect(t.r[1]).toBe(0);

    // not taken: zero → N=0,Z=1 → N!==Z
    const ntZ = run(`
      add r0, r0, 0
      brp brp_ntz_skip
      add r1, r1, 1
      brp_ntz_skip: halt
    `);
    expect(ntZ.r[1]).toBe(1);

    // not taken: negative → N=1,Z=0 → N!==Z
    const ntN = run(`
      add r0, r0, -1
      brp brp_ntn_skip
      add r1, r1, 1
      brp_ntn_skip: halt
    `);
    expect(ntN.r[1]).toBe(1);
  });

  test('brlt (code 4): branches if N≠V (signed less than)', () => {
    // taken: -1 result → N=1, V=0 (no overflow for small immediate) → N≠V
    const t = run(`
      add r0, r0, -1
      brlt brlt_t_skip
      add r1, r1, 1
      brlt_t_skip: halt
    `);
    expect(t.r[1]).toBe(0);

    // not taken: positive → N=0, V=0 → N===V
    const nt = run(`
      add r0, r0, 5
      brlt brlt_nt_skip
      add r1, r1, 1
      brlt_nt_skip: halt
    `);
    expect(nt.r[1]).toBe(1);
  });

  test('brgt (code 5): branches if N===V && Z===0 (signed greater than)', () => {
    // taken (positive, no overflow): N=0,V=0,Z=0 → N===V and Z===0
    const tPos = run(`
      add r0, r0, 5
      brgt brgt_tp_skip
      add r1, r1, 1
      brgt_tp_skip: halt
    `);
    expect(tPos.r[1]).toBe(0);

    // taken (overflow): 0x7FFF + 1 → N=1,V=1,Z=0 → N===V and Z===0
    const tOvf = run(`
      add r2, r2, 1
      ld r0, brgt_maxval
      add r0, r0, r2
      brgt brgt_to_skip
      add r1, r1, 1
      brgt_to_skip: halt
      brgt_maxval: .word 0x7FFF
    `);
    expect(tOvf.r[1]).toBe(0);

    // not taken (zero): Z=1 → condition false
    const ntZ = run(`
      add r0, r0, 0
      brgt brgt_ntz_skip
      add r1, r1, 1
      brgt_ntz_skip: halt
    `);
    expect(ntZ.r[1]).toBe(1);

    // not taken (negative, no overflow): N=1,V=0 → N≠V
    const ntN = run(`
      add r0, r0, -1
      brgt brgt_ntn_skip
      add r1, r1, 1
      brgt_ntn_skip: halt
    `);
    expect(ntN.r[1]).toBe(1);
  });

  test('brc (code 6): branches if C=1, not if C=0', () => {
    // taken: neg + neg → C=1: (-1) + (-1) = -2
    const t = run(`
      add r0, r0, -1
      add r0, r0, r0
      brc brc_t_skip
      add r1, r1, 1
      brc_t_skip: halt
    `);
    expect(t.r[1]).toBe(0);

    // not taken: pos + pos → C=0: 1 + 1 = 2
    const nt = run(`
      add r0, r0, 1
      add r0, r0, r0
      brc brc_nt_skip
      add r1, r1, 1
      brc_nt_skip: halt
    `);
    expect(nt.r[1]).toBe(1);
  });

  test('br (code 7): always branches regardless of flags', () => {
    const interp = run(`
      br br_skip
      add r1, r1, 1
      br_skip: halt
    `);
    expect(interp.r[1]).toBe(0);
  });
});
