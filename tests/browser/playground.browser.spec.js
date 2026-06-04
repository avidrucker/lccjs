/**
 * Playwright smoke tests for the lccjs playground page.
 *
 * Prerequisites (auto-skipped if missing):
 *   - docs/site/dist/lcc.bundle.js  (npm run build:browser && npm run build:site)
 *   - Playwright + Chromium installed  (npx playwright install chromium)
 *
 * Run: npm run test:browser
 *
 * The tests open docs/site/showcase/index.html via file:// using the fallback
 * synchronous execution path (window.lcc) — Web Workers are not available on
 * file:// in Chromium, but the playground has a try/catch that falls back
 * automatically. (#711)
 */

'use strict';

const path = require('path');
const fs   = require('fs');

const BUNDLE = path.join(__dirname, '..', '..', 'docs', 'site', 'dist', 'lcc.bundle.js');
const PAGE   = 'file://' + path.join(__dirname, '..', '..', 'docs', 'site', 'showcase', 'index.html');

// Auto-skip when the bundle hasn't been built yet (mirrors oracle test pattern).
const SKIP = !fs.existsSync(BUNDLE);

let chromium, browser, page;

beforeAll(async () => {
  if (SKIP) return;
  ({ chromium } = require('playwright'));
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  page = await ctx.newPage();
  await page.goto(PAGE);
  await page.waitForLoadState('networkidle');
}, 30000);

afterAll(async () => {
  if (browser) await browser.close();
});

function maybeSkip() {
  if (SKIP) {
    console.log('SKIP: docs/site/dist/lcc.bundle.js not found — run build:browser && build:site first');
    return true;
  }
  return false;
}

async function waitForOutput(notText, timeoutMs = 15000) {
  await page.waitForFunction(
    (nt) => {
      const el = document.getElementById('exec-output');
      return el && el.textContent !== nt && el.textContent !== 'Running…';
    },
    notText,
    { timeout: timeoutMs },
  );
  return page.locator('#exec-output').textContent();
}

// ── Test cases ───────────────────────────────────────────────────────────────

test('T1 — happy path: Hello World starter runs and produces correct output', async () => {
  if (maybeSkip()) return;

  await page.locator('#run-btn').click();
  const out = await waitForOutput('(click Run to execute)');

  expect(out).toContain('Hello, World!');
}, 20000);

test('T2 — assembly error: bad mnemonic shows red error text with lcc-error class', async () => {
  if (maybeSkip()) return;

  await page.locator('#playground-input').fill('        badmnemonic r0\n        halt');
  await page.locator('#run-btn').click();
  const out = await waitForOutput('Hello, World!');

  expect(out).toMatch(/assembly error/i);
  const hasErrClass = await page.locator('#exec-output').evaluate(
    el => el.classList.contains('lcc-error'),
  );
  expect(hasErrClass).toBe(true);
}, 20000);

test('T3 — stdin pass-through: din/dout program reads and echoes pre-supplied input', async () => {
  if (maybeSkip()) return;

  const prog = [
    '        din  r0',
    '        dout r0',
    '        nl',
    '        halt',
  ].join('\n');

  await page.locator('#playground-input').fill(prog);
  await page.locator('#stdin-input').fill('42');
  await page.locator('#run-btn').click();
  const out = await waitForOutput('Assembly error');

  expect(out).toContain('42');
}, 20000);
