const InterpreterPlus = require('../../src/plus/interpreterplus');

// First coverage for src/plus/interpreterplus.js (413 LOC, was 0% — child of #166).
// main() puts the terminal in raw mode and runs an async batch loop, so it can't
// be driven off-TTY (it throws "process.stdin.setRawMode is not a function" when
// stdin is piped — surfaced as a follow-up finding on #198). The rand/srand LCG,
// though, is *the* reason src/plus exists and the highest-signal seam: pure
// methods over instance state (this.seed / this.r), exercised here directly.

// Build an interpreter seeded like randDeterministic.ap (srand r0), returning a
// roll(min,max) that mimics `rand r0, r1` with r0=min, r1=max.
function seededRoller(seedValue) {
  const ip = new InterpreterPlus();
  ip.r = new Array(8).fill(0);
  ip.sr = 0;
  ip.r[0] = seedValue;
  ip.executeSrand();
  return function roll(min, max) {
    ip.dr = 0;
    ip.sr1 = 1;
    ip.r[0] = min;
    ip.r[1] = max;
    ip.executeRand();
    return ip.r[0];
  };
}

describe('interpreterplus — rand/srand deterministic LCG (#198)', () => {
  test('executeSrand seeds the generator from the source register', () => {
    const ip = new InterpreterPlus();
    ip.r = new Array(8).fill(0);
    ip.sr = 2;
    ip.r[2] = 12345;
    ip.executeSrand();
    expect(ip.seed).toBe(12345);
  });

  // Golden: the exact sequence randDeterministic.ap produces (srand 0; 20x rand
  // 1..20). Pins the LCG constants (a=48271, c=10139, m=2^16) and the three
  // xorshift mixing steps — any change to that math breaks this.
  test('srand 0 then 20x rand[1,20] yields the fixed golden sequence', () => {
    const roll = seededRoller(0);
    const seq = Array.from({ length: 20 }, () => roll(1, 20));
    expect(seq).toEqual([12, 17, 4, 1, 8, 9, 4, 1, 8, 5, 20, 1, 8, 17, 12, 13, 16, 5, 12, 5]);
  });

  test('the same seed is reproducible across two fresh interpreters', () => {
    const rollA = seededRoller(0);
    const rollB = seededRoller(0);
    const a = [];
    const b = [];
    for (let i = 0; i < 20; i++) {
      a.push(rollA(1, 20));
      b.push(rollB(1, 20));
    }
    expect(a).toEqual(b);
  });

  test('rand stays within [min,max] when min <= max', () => {
    const roll = seededRoller(7);
    for (let i = 0; i < 50; i++) {
      const n = roll(1, 20);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(20);
    }
  });

  test('rand handles min/max given high-then-low (exercises the other LCG branch)', () => {
    const roll = seededRoller(0);
    for (let i = 0; i < 20; i++) {
      const n = roll(20, 1); // r[dr] > r[sr1] -> the else branch
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(20);
    }
  });

  test('a degenerate range (min === max) always returns that value', () => {
    const roll = seededRoller(3);
    for (let i = 0; i < 10; i++) {
      expect(roll(5, 5)).toBe(5);
    }
  });
});
