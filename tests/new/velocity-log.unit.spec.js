'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'velocity-log.js');

function run(input, extraArgs = []) {
  return spawnSync(process.execPath, [SCRIPT, JSON.stringify(input), ...extraArgs], {
    encoding: 'utf8',
    env: process.env,
  });
}

describe('velocity-log — negative delta validation (#440)', () => {
  test('rejects negative delta_h_min with exit 1 and error message', () => {
    const result = run({ role: 'DEV', agent: 'TEST', delta_h_min: -5 });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/delta_h_min must be >= 0/);
    expect(result.stderr).toMatch(/estimate - actual/);
  });

  test('rejects negative delta_c_min with exit 1 and error message', () => {
    const result = run({ role: 'DEV', agent: 'TEST', delta_c_min: -3 });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/delta_c_min must be >= 0/);
    expect(result.stderr).toMatch(/estimate - actual/);
  });

  test('zero delta_h_min passes validation (fails later on invalid ticket)', () => {
    // Probe: a bad `ticket` value causes a known later validation error,
    // confirming the delta check did not block.
    const result = run({ role: 'DEV', agent: 'TEST', delta_h_min: 0, ticket: 'bad' });
    expect(result.stderr).not.toMatch(/delta_h_min must be/);
    expect(result.stderr).toMatch(/ticket/);
  });

  test('zero delta_c_min passes validation (fails later on invalid ticket)', () => {
    const result = run({ role: 'DEV', agent: 'TEST', delta_c_min: 0, ticket: 'bad' });
    expect(result.stderr).not.toMatch(/delta_c_min must be/);
    expect(result.stderr).toMatch(/ticket/);
  });

  test('positive delta values pass validation (fails later on invalid ticket)', () => {
    const result = run({ role: 'DEV', agent: 'TEST', delta_h_min: 10, delta_c_min: 5, ticket: 'bad' });
    expect(result.stderr).not.toMatch(/delta_h_min must be/);
    expect(result.stderr).not.toMatch(/delta_c_min must be/);
    expect(result.stderr).toMatch(/ticket/);
  });

  test('null/omitted delta fields are allowed (pass validation)', () => {
    // null deltas are valid (row logged without actuals yet)
    const result = run({ role: 'DEV', agent: 'TEST', ticket: 'bad' });
    expect(result.stderr).not.toMatch(/delta_h_min must be/);
    expect(result.stderr).not.toMatch(/delta_c_min must be/);
  });
});

describe('velocity-log — model canonical format validation (#453)', () => {
  test('rejects full model ID (claude-sonnet-4-6) with exit 1 and error message', () => {
    const result = run({ role: 'DEV', agent: 'TEST', model: 'claude-sonnet-4-6' });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/canonical format/);
    expect(result.stderr).toMatch(/claude-sonnet-4-6/);
  });

  test('rejects full model ID (claude-opus-4-8) with exit 1', () => {
    const result = run({ role: 'DEV', agent: 'TEST', model: 'claude-opus-4-8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/canonical format/);
  });

  test('accepts canonical short-form sonnet-4.6 (fails later on bad ticket)', () => {
    const result = run({ role: 'DEV', agent: 'TEST', model: 'sonnet-4.6', ticket: 'bad' });
    expect(result.stderr).not.toMatch(/canonical format/);
    expect(result.stderr).toMatch(/ticket/);
  });

  test('accepts canonical short-form opus-4.8 (fails later on bad ticket)', () => {
    const result = run({ role: 'DEV', agent: 'TEST', model: 'opus-4.8', ticket: 'bad' });
    expect(result.stderr).not.toMatch(/canonical format/);
    expect(result.stderr).toMatch(/ticket/);
  });

  test('allows omitted model field (fails later on bad ticket)', () => {
    const result = run({ role: 'DEV', agent: 'TEST', ticket: 'bad' });
    expect(result.stderr).not.toMatch(/canonical format/);
    expect(result.stderr).toMatch(/ticket/);
  });

  test('allows empty string model field (fails later on bad ticket)', () => {
    const result = run({ role: 'DEV', agent: 'TEST', model: '', ticket: 'bad' });
    expect(result.stderr).not.toMatch(/canonical format/);
    expect(result.stderr).toMatch(/ticket/);
  });
});
