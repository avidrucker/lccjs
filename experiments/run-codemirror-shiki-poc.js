/**
 * Headless Playwright runner for the @cmshiki/shiki PoC (#753).
 *
 * Usage:  node experiments/run-codemirror-shiki-poc.js
 *
 * Spins up a temporary static HTTP server for the project root, opens
 * experiments/codemirror-shiki-poc.html in headless Chromium, waits for the
 * PoC to finish, then prints the PASS/FAIL result with all logged steps.
 *
 * Requires: playwright (already a dev dep), python3 (for the HTTP server).
 */

'use strict';

const { chromium } = require('playwright');
const { spawn }    = require('child_process');
const path         = require('path');

const ROOT     = path.join(__dirname, '..');
const PORT     = 9753;
const BASE_URL = `http://localhost:${PORT}`;
const PAGE_URL = `${BASE_URL}/experiments/codemirror-shiki-poc.html`;
const TIMEOUT  = 60_000; // 60 s — CDN loads can be slow

async function waitForPort(port, ms = 5000) {
  const net = require('net');
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      await new Promise((res, rej) => {
        const s = net.createConnection(port, '127.0.0.1');
        s.on('connect', () => { s.destroy(); res(); });
        s.on('error', rej);
      });
      return;
    } catch {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  throw new Error(`Port ${port} not ready after ${ms} ms`);
}

(async () => {
  // Start a static HTTP server for the project root.
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', () => {}); // suppress python3 request logs

  try {
    await waitForPort(PORT, 5000);
    console.log(`HTTP server ready on port ${PORT}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page    = await context.newPage();

    // Capture console messages from the page.
    const consoleLogs = [];
    page.on('console', msg => consoleLogs.push(`[console.${msg.type()}] ${msg.text()}`));

    console.log(`Opening ${PAGE_URL}`);
    await page.goto(PAGE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });

    // Wait for the PoC to finish: status element gets class 'pass' or 'fail'.
    await page.waitForSelector('#status.pass, #status.fail', { timeout: TIMEOUT });

    const result = await page.$eval('#status', el => ({
      cls:  el.className,
      text: el.textContent,
    }));

    // Collect all log entries from the page.
    const logLines = await page.$$eval('#log span', spans =>
      spans.map(s => `  [${s.className}] ${s.textContent.trim()}`),
    );

    // Screenshot for evidence.
    const screenshotPath = path.join(__dirname, 'codemirror-shiki-poc-result.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });

    await browser.close();

    // Report.
    console.log('\n══ PoC Result ══════════════════════════════════════════');
    logLines.forEach(l => console.log(l));
    if (consoleLogs.length) {
      console.log('\n── Browser console ─────────────────────────────────────');
      consoleLogs.forEach(l => console.log(' ', l));
    }
    console.log('\n── Final status ────────────────────────────────────────');
    console.log(`  class="${result.cls}"  text="${result.text}"`);
    console.log(`  Screenshot: ${screenshotPath}`);
    console.log('════════════════════════════════════════════════════════\n');

    process.exit(result.cls === 'pass' ? 0 : 1);

  } finally {
    server.kill();
  }
})().catch(err => {
  console.error('Runner error:', err);
  process.exit(2);
});
