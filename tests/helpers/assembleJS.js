// tests/helpers/assembleJS.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const Assembler = require('../../src/core/assembler');

function assembleWithJS(sourcePath) {
  // Write outputs into a temp dir, let assembler write its files normally.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-asm-'));
  const base = path.basename(sourcePath, path.extname(sourcePath));
  const tmpSrc = path.join(tmp, `${base}.a`);
  fs.copyFileSync(sourcePath, tmpSrc);

  const asm = new Assembler();
  // assembler.main reads provided args as file list
  asm.main([tmpSrc]);

  // Convention (your assembler writes .e alongside input)
  const outE = path.join(tmp, `${base}.e`);
  if (!fs.existsSync(outE)) {
    throw new Error(`JS assembler did not produce expected .e: ${outE}`);
  }
  const bytes = fs.readFileSync(outE);
  return { bytes, outPath: outE, tmpDir: tmp };
}

module.exports = { assembleWithJS };
