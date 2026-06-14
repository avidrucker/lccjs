const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// LCC+ driver verbose forwarding (#1005).
//
// `AssemblerPlus` extends the core `Assembler` and inherits every typo-suggestion
// path (unknown mnemonic, directive, label, register — #883/#973). Those paths only
// fire when `verboseModeOn` is true, which in the core toolchain `lcc.js` sets from
// the -v/--verbose flag (lcc.js: `assembler.verboseModeOn = !!options.verbose`).
// The LCC+ driver (`lccplus.js`) never accepted a verbose flag, so in LCC+ every
// "did you mean?" suggestion was unreachable. This suite drives the driver itself.

const LCCPLUS = path.resolve(__dirname, '../../src/plus/lccplus.js');

// `slep` is a one-character typo of the plus mnemonic `sleep` (registered in
// AssemblerPlus._instructionTable), so the inherited suggester should offer it.
const TYPO_AP = `        .lccplus
        slep r0
        halt
`;

function runDriver(apSource, name, extraArgs) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-lccplus-verbose-'));
  try {
    const apPath = path.join(tmpDir, `${name}.ap`);
    fs.writeFileSync(apPath, apSource);
    return spawnSync(
      process.execPath,
      [LCCPLUS, ...extraArgs, `${name}.ap`],
      { cwd: tmpDir, encoding: 'utf8', input: '', timeout: 10000 }
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe('lccplus driver forwards -v/--verbose to the inherited suggester (#1005)', () => {
  test('-v surfaces the inherited "Did you mean \'sleep\'?" on a typo mnemonic in an .ap file', () => {
    const run = runDriver(TYPO_AP, 'typo', ['-v']);
    const out = `${run.stdout || ''}${run.stderr || ''}`;
    expect(out).toContain("Did you mean 'sleep'?");
  });

  test('default (no flag) path is unchanged — the same typo emits no suggestion', () => {
    const run = runDriver(TYPO_AP, 'typo', []);
    const out = `${run.stdout || ''}${run.stderr || ''}`;
    expect(out).not.toContain('Did you mean');
  });

  test('--verbose long form forwards identically to -v', () => {
    const run = runDriver(TYPO_AP, 'typo', ['--verbose']);
    const out = `${run.stdout || ''}${run.stderr || ''}`;
    expect(out).toContain("Did you mean 'sleep'?");
  });
});
