// Probe #157: .string escape-set parity — lccjs vs oracle.
// The headline bug ("\n rejected") does NOT reproduce; this maps the full set and
// shows lccjs is STRICTER than the oracle on unknown escapes (rejects vs
// silently drops the backslash). See docs/research/string-escape-parity.md.
const fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');
// repo root = two levels up from public_experiments/<thisdir>/
const REPO = path.resolve(__dirname, '..', '..');
const ORACLE = process.env.LCC_ORACLE
  || (fs.existsSync(path.join(REPO, '.env'))
      ? ((fs.readFileSync(path.join(REPO, '.env'), 'utf8').match(/^LCC_ORACLE=(.*)$/m) || [])[1] || '').trim()
      : '');
if (!ORACLE) { console.error('Set LCC_ORACLE (env or .env) to the cuh63 lcc binary.'); process.exit(2); }
const LCCJS_ASM = path.join(REPO, 'src/core/assembler.js');

// Assemble-only and return the emitted .e hex (null if assembly failed / no .e).
function asmE(bin, args, src) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'e157-'));
  fs.writeFileSync(path.join(tmp, 't.a'), src);
  fs.writeFileSync(path.join(tmp, 'name.nnn'), 'TestUser\n');
  spawnSync(bin, args, { cwd: tmp, encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] });
  const p = path.join(tmp, 't.e');
  const hex = fs.existsSync(p) && fs.statSync(p).size > 2 ? fs.readFileSync(p).toString('hex') : null;
  fs.rmSync(tmp, { recursive: true, force: true });
  return hex;
}
const oracle = (src) => asmE(ORACLE, ['t.a'], src);
const lccjs = (src) => asmE('node', [LCCJS_ASM, 't.a'], src);
const prog = (body) => `lbl: .string "A${body}B${body}"\n\thalt\n`;

const escapes = [
  ['\\n', 'newline'], ['\\t', 'tab'], ['\\r', 'carriage return'],
  ['\\\\', 'backslash'], ['\\"', 'quote'], ['\\0', 'NUL'],
  ['\\a', 'bell'], ['\\b', 'backspace'], ['\\f', 'formfeed'],
  ['\\v', 'vtab'], ["\\'", 'single-quote'], ['\\x41', 'hex \\x41'],
  ['\\101', 'octal \\101'], ['\\q', 'bogus \\q'],
];

console.log('escape    desc              lccjs            oracle           verdict');
for (const [seq, desc] of escapes) {
  const j = lccjs(prog(seq));
  const o = oracle(prog(seq));
  const jt = j ? 'ok' : 'ERR/no .e';
  const ot = o ? 'ok' : 'ERR/no .e';
  let verdict;
  if (j && o) verdict = (j === o) ? 'MATCH' : 'BYTES-DIFFER';
  else if (!j && !o) verdict = 'both-reject';
  else verdict = j ? 'lccjs-accepts/oracle-rejects' : 'oracle-accepts/lccjs-rejects';
  console.log(`${seq.padEnd(9)} ${desc.padEnd(17)} ${jt.padEnd(16)} ${ot.padEnd(16)} ${verdict}`);
}
console.log('\nNote: "oracle-accepts" = oracle assembles by DROPPING the backslash and');
console.log('keeping the literal char (verified by sout hexdump), not by honoring a C escape.');
