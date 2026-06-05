/**
 * Headless Playwright verification for the Lezer LCC language support (#754).
 * Loads the generated showcase page, checks:
 *  1. Editor mounts without errors
 *  2. Syntax highlighting is applied (colour spans visible in CM editor DOM)
 *  3. toggleLineComment keybinding is wired (Mod+/ on a line with a comment)
 *
 * Usage: node experiments/verify-lang-lcc.js
 */

'use strict';

const { chromium } = require('playwright');
const { spawn }    = require('child_process');
const path         = require('path');

const ROOT     = path.join(__dirname, '..', 'docs', 'site');
const PORT     = 9754;
const BASE_URL = `http://localhost:${PORT}`;
const PAGE_URL = `${BASE_URL}/showcase/index.html`;
const TIMEOUT  = 60_000;

async function waitForPort(port, ms = 5000) {
  const net = require('net');
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      await new Promise((res, rej) => {
        const s = net.createConnection(port, '127.0.0.1');
        s.on('connect', () => { s.destroy(); res(); });
        s.on('error', rej);
      });
      return;
    } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  throw new Error(`Port ${port} not ready`);
}

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', () => {});

  const errors  = [];
  const results = {};

  try {
    await waitForPort(PORT, 5000);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page    = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto(PAGE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });

    // 1. Editor mounted — check the .cm-editor element exists
    const hasEditor = await page.$('.cm-editor') !== null;
    results['1. cm-editor mounted'] = hasEditor ? 'PASS' : 'FAIL';

    // 2. Colour tokens — look for cm-line spans with inline colour styles or
    //    named token classes added by syntaxHighlighting(defaultHighlightStyle).
    await page.waitForTimeout(500); // brief settle for highlights
    const hasTokens = await page.$$eval('.cm-line span', spans =>
      spans.some(s => s.style.color || s.className.includes('tok-'))
    );
    results['2. syntax tokens visible'] = hasTokens ? 'PASS' : 'FAIL (no colour spans)';

    // 3. toggleLineComment — click in the first line, send Ctrl+/
    await page.click('.cm-editor');
    await page.keyboard.press('Control+/');
    const firstLine = await page.$eval('.cm-line:first-child', el => el.textContent);
    const commentToggled = firstLine.trimStart().startsWith(';');
    results['3. toggleLineComment (Ctrl+/)'] = commentToggled
      ? 'PASS'
      : 'FAIL — first line after toggle: ' + JSON.stringify(firstLine.slice(0, 60));

    await browser.close();

    // Report
    console.log('\n══ lang-lcc integration check ════════════════════════════');
    for (const [k, v] of Object.entries(results)) console.log(`  ${v === 'PASS' ? '✓' : '✗'} ${k}: ${v}`);
    if (errors.length) {
      console.log('\n── Page errors ─────────────────────────────────────────');
      errors.slice(0, 10).forEach(e => console.log('  [err]', e.slice(0, 200)));
    }
    const allPass = Object.values(results).every(v => v === 'PASS');
    console.log(`\n  Overall: ${allPass ? 'PASS ✓' : 'FAIL ✗'}`);
    console.log('════════════════════════════════════════════════════════\n');
    process.exit(allPass ? 0 : 1);

  } finally {
    server.kill();
  }
})().catch(err => { console.error('Runner error:', err); process.exit(2); });
