// Probe #257: does the ldr/str no-comma negative-immediate silent-drop (OG BUG #1)
// extend to OTHER immediate-taking instructions? Diff oracle vs lcc.js emitted .e.
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

function eHex(dir) {
  const p = path.join(dir, 't.e');
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p).toString('hex');
}
function runOracle(src) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p257o-'));
  fs.writeFileSync(path.join(tmp, 't.a'), src);
  fs.writeFileSync(path.join(tmp, 'name.nnn'), 'TestUser\n');
  const res = spawnSync(ORACLE, ['t.a'], { cwd: tmp, encoding: 'utf8', timeout: 10000, stdio: ['ignore','pipe','pipe'] });
  const hex = eHex(tmp);
  fs.rmSync(tmp, { recursive: true, force: true });
  return { status: res.status, hex, out: (res.stdout||'').trim() };
}
function runLccjs(src) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p257j-'));
  fs.writeFileSync(path.join(tmp, 't.a'), src);
  const res = spawnSync('node', [LCCJS_ASM, 't.a'], { cwd: tmp, encoding: 'utf8', timeout: 10000, stdio: ['ignore','pipe','pipe'] });
  const hex = eHex(tmp);
  fs.rmSync(tmp, { recursive: true, force: true });
  return { status: res.status, hex, out: (res.stdout||'').trim() };
}

// For each instruction: a comma form and a no-comma form, both with the SAME
// negative immediate. If both tools encode them identically AND comma==no-comma,
// no bug. A divergence (oracle no-comma != lcc.js no-comma, or oracle
// no-comma != oracle comma) flags the silent-drop family.
const cases = [
  { name: 'ldr offset6 -1 (KNOWN BUG, control)', comma: 'ldr r1, fp, -1', nocomma: 'ldr r1 fp -1' },
  { name: 'str offset6 -1 (KNOWN BUG, control)', comma: 'str r1, fp, -1', nocomma: 'str r1 fp -1' },
  { name: 'add imm5 -1',  comma: 'add r0, r0, -1', nocomma: 'add r0 r0 -1' },
  { name: 'sub imm5 -1',  comma: 'sub r0, r0, -1', nocomma: 'sub r0 r0 -1' },
  { name: 'and imm5 -1',  comma: 'and r0, r0, -1', nocomma: 'and r0 r0 -1' },
  { name: 'cmp imm5 -1',  comma: 'cmp r0, -1',     nocomma: 'cmp r0 -1' },
  { name: 'mvi imm9 -1',  comma: 'mvi r0, -1',     nocomma: 'mvi r0 -1' },
  { name: 'mov imm9 -1 (OB-008: mov rejects neg)', comma: 'mov r0, -1', nocomma: 'mov r0 -1' },
  { name: 'jmp offset6 -1', comma: 'jmp r1, -1',   nocomma: 'jmp r1 -1' },
  { name: 'blr offset6 -1', comma: 'blr r1, -1',   nocomma: 'blr r1 -1' },
];

const wrap = (instr) => `\t${instr}\n\thalt\n`;
console.log('instruction'.padEnd(38), 'oracle:comma  no-comma   | lccjs:comma  no-comma  | flag');
for (const c of cases) {
  const oc = runOracle(wrap(c.comma)), on = runOracle(wrap(c.nocomma));
  const jc = runLccjs(wrap(c.comma)), jn = runLccjs(wrap(c.nocomma));
  // Compare the .e hex; reduce to a short tag. null hex => assembly failed (no .e).
  const tag = (r) => r.hex ? r.hex.slice(-8) /* last code word region */ : `FAIL(${r.status})`;
  // Flag: oracle no-comma differs from oracle comma => oracle silent-drop on this instr.
  const oracleDrops = oc.hex && on.hex && oc.hex !== on.hex;
  const parityGap = on.hex !== jn.hex;
  let flag = '';
  if (oracleDrops) flag += 'ORACLE-DROPS ';
  if (parityGap) flag += 'PARITY-GAP';
  console.log(
    c.name.padEnd(38),
    `${tag(oc)} ${tag(on)}  | ${tag(jc)} ${tag(jn)}  | ${flag}`
  );
}
