const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('Interpreter CLI E2E', () => {
  test('should prompt for a name and create name.nnn when running interpreter.js directly', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-interpreter-e2e-'));

    try {
      const eFilePath = path.join(tmpDir, 'promptForName.e');
      const interpreterPath = path.resolve(__dirname, '../../src/core/interpreter.js');

      fs.writeFileSync(eFilePath, Buffer.from([0x6F, 0x43, 0x00, 0xF0]));

      const result = spawnSync(process.execPath, [interpreterPath, 'promptForName.e'], {
        cwd: tmpDir,
        encoding: 'utf8',
        input: 'MilkyWay\n',
        timeout: 5000,
      });

      expect(result.status).toBe(0);
      expect(fs.readFileSync(path.join(tmpDir, 'name.nnn'), 'utf8')).toBe('MilkyWay\n');
      expect(fs.existsSync(path.join(tmpDir, 'promptForName.lst'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'promptForName.bst'))).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
