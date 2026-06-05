'use strict';
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'docs', 'site');
const PORT = 9755, TIMEOUT = 60_000;

async function waitPort(port) {
  const net = require('net');
  for (let i = 0; i < 50; i++) {
    try {
      await new Promise((r, j) => {
        const s = net.createConnection(port, '127.0.0.1');
        s.on('connect', () => { s.destroy(); r(); });
        s.on('error', j);
      });
      return;
    } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  throw new Error('port timeout');
}

(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT)],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  srv.stderr.on('data', () => {});

  try {
    await waitPort(PORT);
    const br = await chromium.launch({ headless: true });
    const pg = await br.newPage();
    const msgs = [];
    pg.on('pageerror', e => msgs.push({ t: 'PAGE_ERR', m: e.message }));
    pg.on('console', m => msgs.push({ t: m.type(), m: m.text() }));
    pg.on('requestfailed', r => msgs.push({ t: 'FAIL', m: r.url() + ' ' + r.failure()?.errorText }));

    await pg.goto(`http://localhost:${PORT}/showcase/index.html`,
      { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

    // Wait up to 30s for either the editor to appear or an error
    let hasCm = false;
    for (let i = 0; i < 30; i++) {
      hasCm = !!await pg.$('.cm-editor');
      if (hasCm) break;
      await pg.waitForTimeout(1000);
    }

    console.log('cm-editor found:', hasCm);
    console.log('\n--- Messages (last 30) ---');
    msgs.slice(-30).forEach(m => console.log(`[${m.t}] ${m.m.slice(0, 200)}`));
    await br.close();
  } finally {
    srv.kill();
  }
})().catch(e => { console.error('Error:', e.message); process.exit(2); });
