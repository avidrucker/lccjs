// tests/helpers/env.js
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

function expandTilde(p) {
  if (!p) return p;
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  if (p === '~') return os.homedir();
  return p;
}

const cfg = {
  lccPath: expandTilde(process.env.LCC_ORACLE || ''),
  lccTimeoutMs: Number(process.env.LCC_TIMEOUT_MS || 20000),
  goldenAutoUpdate: String(process.env.GOLDEN_AUTO_UPDATE || '0') === '1',
};

function assertOracleConfigured() {
  if (!cfg.lccPath) return false;
  try { return fs.existsSync(cfg.lccPath); } catch { return false; }
}

module.exports = { cfg, assertOracleConfigured };
