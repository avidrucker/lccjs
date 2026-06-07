const path = require('path');
const { spawnSync } = require('child_process');

// Regression tests for scripts/lccrun.sh — the timeout watchdog runner.
//
// #1149: the watchdog ran as a backgrounded subshell whose `sleep "$TIMEOUT"`
// was orphaned when the child finished early. The orphan inherited lccrun's
// stdout/stderr, so a spawnSync caller capturing output never saw pipe EOF
// until the orphaned sleep elapsed — blocking for the FULL timeout even on
// instant completion. The fix redirects the watchdog's stdio to /dev/null.
const LCCRUN = path.resolve(__dirname, '../../scripts/lccrun.sh');

function runLccrun(args, opts = {}) {
  const start = process.hrtime.bigint();
  const res = spawnSync('bash', [LCCRUN, ...args], { encoding: 'utf8', ...opts });
  const wallMs = Number(process.hrtime.bigint() - start) / 1e6;
  return { ...res, wallMs };
}

describe('scripts/lccrun.sh', () => {
  test('returns promptly on instant completion regardless of the timeout (#1149)', () => {
    // A huge timeout must NOT dictate wall-clock: a command that exits in
    // milliseconds should return in well under a second. Pre-fix this took
    // the full 30s; we assert a generous 5s ceiling to stay CI-stable.
    const r = runLccrun(['30', 'node', '-e', "process.stdout.write('hi')"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('hi');
    expect(r.wallMs).toBeLessThan(5000);
  });

  test('passes stdout/stderr through and exits with the child code', () => {
    const r = runLccrun(['10', 'node', '-e', "process.stderr.write('boom'); process.exit(3)"]);
    expect(r.status).toBe(3);
    expect(r.stderr).toContain('boom');
  });

  test('exits 124 with a timeout message when the child outlives the timeout', () => {
    const r = runLccrun(['1', 'sleep', '30']);
    expect(r.status).toBe(124);
    expect(r.stderr).toMatch(/lccrun: timeout after 1s/);
    // The kill happens at ~1s; allow generous slack for the SIGKILL grace.
    expect(r.wallMs).toBeLessThan(5000);
  });
});
