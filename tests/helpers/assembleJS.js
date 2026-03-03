// tests/helpers/assembleJS.js
const fs = require('fs');
const path = require('path');
const Assembler = require('../../src/core/assembler');
const {
  createTempWorkspace,
  runInWorkspaceCwd,
  stageFileInWorkspace,
} = require('./tempWorkspace');

function assembleWithJS(sourcePath) {
  // Write outputs into a temp dir, let assembler write its files normally.
  const tmp = createTempWorkspace('lccjs-asm-');
  const base = path.basename(sourcePath, path.extname(sourcePath));
  const tmpSrc = stageFileInWorkspace(sourcePath, tmp, `${base}.a`);

  const asm = new Assembler();
  runInWorkspaceCwd(tmp, () => {
    // assembler.main reads provided args as file list
    asm.main([path.basename(tmpSrc)]);
  });

  // Convention (your assembler writes .e alongside input)
  const outE = path.join(tmp, `${base}.e`);
  if (!fs.existsSync(outE)) {
    throw new Error(`JS assembler did not produce expected .e: ${outE}`);
  }
  const bytes = fs.readFileSync(outE);
  return { bytes, outPath: outE, tmpDir: tmp };
}

module.exports = { assembleWithJS };
