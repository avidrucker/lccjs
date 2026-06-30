// command-registry.spec.js — guards for the ilcc COMMAND_REGISTRY (#1342).
//
// The interactive `-i` TUI dispatch and its help text are both generated from a
// single COMMAND_REGISTRY. These guards keep that single source of truth honest:
//   (a) collision  — no two commands claim the same key/alias,
//   (b) parity     — generated help lists exactly the registered commands,
//   (c) coverage   — every command declares a resolving proving test (or a
//                    pending(#child) marker tied to the coverage tracker #1343).

'use strict';

const path = require('path');
const fs = require('fs');
const IInterpreter = require('../../src/interactive/iinterpreter');

const { COMMAND_REGISTRY, matchCommand, validateCommandRegistry } = IInterpreter;

describe('ilcc COMMAND_REGISTRY (#1342)', () => {
  test('is exported, non-empty, and every entry is well-formed', () => {
    expect(Array.isArray(COMMAND_REGISTRY)).toBe(true);
    expect(COMMAND_REGISTRY.length).toBeGreaterThan(0);
    const validMatch = new Set(['exact', 'prefix', 'numeric', 'empty']);
    for (const e of COMMAND_REGISTRY) {
      expect(typeof e.key).toBe('string');
      expect(validMatch.has(e.match)).toBe(true);
      expect(typeof e.run).toBe('function');
      expect(typeof e.provenance).toBe('string');
    }
  });

  // ── Guard (a): collision ───────────────────────────────────────────────────
  test('collision guard: no two entries claim the same key or alias', () => {
    const seen = new Set();
    for (const e of COMMAND_REGISTRY) {
      for (const k of [e.key, ...(e.aliases || [])]) {
        expect(seen.has(k)).toBe(false);
        seen.add(k);
      }
    }
  });

  test('collision guard throws at construction on a duplicate key', () => {
    const dup = [
      { key: 'x', match: 'exact', run: () => ({}) },
      { key: 'x', match: 'exact', run: () => ({}) },
    ];
    expect(() => validateCommandRegistry(dup)).toThrow(/duplicate command key 'x'/);
  });

  // ── Guard (b): parity ──────────────────────────────────────────────────────
  test('parity guard: generated help lists every registered command, and nothing else', () => {
    const help = new IInterpreter().displayHelp();
    // Every command's helpLabel appears in the help (dispatch -> help).
    for (const e of COMMAND_REGISTRY) {
      if (e.helpLabel) expect(help).toContain(e.helpLabel);
    }
    // Conversely (help -> dispatch): every help line is accounted for by the
    // registry. Strip the header + each entry's generated line + helpExtra; what
    // remains must be empty, proving there are no orphan help lines for commands
    // that don't exist in the dispatch.
    let remaining = help;
    remaining = remaining.replace('ilcc interactive commands:\n', '');
    for (const e of COMMAND_REGISTRY) {
      if (e.helpLabel) remaining = remaining.replace(`  ${e.helpLabel.padEnd(11)} ${e.help}\n`, '');
      for (const ex of (e.helpExtra || [])) remaining = remaining.replace(ex + '\n', '');
    }
    expect(remaining.trim()).toBe('');
  });

  // ── Guard (c): coverage ────────────────────────────────────────────────────
  test('coverage guard: every entry declares a resolving test or a pending(#N) marker', () => {
    for (const e of COMMAND_REGISTRY) {
      expect(typeof e.test).toBe('string');
      expect(e.test.length).toBeGreaterThan(0);
      if (/^pending\(#\d+\)$/.test(e.test)) continue; // explicitly deferred to #1343
      const specFile = e.test.split(/[\s:]/)[0]; // filename before ' > ' or ':'
      expect(fs.existsSync(path.join(__dirname, specFile))).toBe(true);
    }
  });

  // ── matchCommand precedence sanity ─────────────────────────────────────────
  test('matchCommand: exact 0 wins over numeric; prefixes beat numeric; bare s is unknown', () => {
    const find = (cmd) => COMMAND_REGISTRY.find((e) => matchCommand(cmd, e).matched);
    expect(find('0').key).toBe('0');         // exact, not the numeric step
    expect(find('m4').key).toBe('m');        // prefix, not numeric
    expect(find('-3').key).toBe('{N}');      // numeric step (backward)
    expect(find('5').key).toBe('{N}');       // numeric step (forward)
    expect(find('').key).toBe('<enter>');    // empty repeats last step
    expect(find('s')).toBeUndefined();       // bare 's' (len 1) matches nothing -> unknown
    expect(find('ssp').key).toBe('s');       // s{anchor}
    expect(find('zzz')).toBeUndefined();     // unknown command
  });

  // ── alias dispatch (#1531) ─────────────────────────────────────────────────
  // The collision guard (a) already reserves and protects entry.aliases, but
  // matchCommand historically never consulted them — so an aliased key dispatched
  // to nothing. These pin the now-honored contract: an exact alias routes to its
  // entry's run, with no over-matching and the guard still rejecting clashes.
  test('matchCommand: an exact alias token routes to its entry (arg empty)', () => {
    const entry = { key: 'q', match: 'exact', aliases: ['quit'], run: () => ({}) };
    const m = matchCommand('quit', entry);
    expect(m.matched).toBe(true);
    expect(m.arg).toBe('');
  });

  test('matchCommand: alias match is exact — a superstring of the alias does not match', () => {
    const entry = { key: 'q', match: 'exact', aliases: ['quit'], run: () => ({}) };
    expect(matchCommand('quitx', entry).matched).toBe(false);
    expect(matchCommand('qui', entry).matched).toBe(false);
  });

  test('matchCommand: an aliased entry dispatches end-to-end through registry precedence', () => {
    const reg = [
      { key: 'z', match: 'exact', aliases: ['zap'], run: () => ({ tag: 'Z' }) },
      { key: '{N}', match: 'numeric', run: () => ({ tag: 'N' }) },
    ];
    const hit = reg.find((e) => matchCommand('zap', e).matched);
    expect(hit).toBeDefined();
    expect(hit.run().tag).toBe('Z'); // routes to the aliased entry's run, not the numeric step
  });

  test('collision guard still rejects an alias that double-books another key', () => {
    const clash = [
      { key: 'a', match: 'exact', run: () => ({}) },
      { key: 'b', match: 'exact', aliases: ['a'], run: () => ({}) },
    ];
    expect(() => validateCommandRegistry(clash)).toThrow(/duplicate command key 'a'/);
  });
});
