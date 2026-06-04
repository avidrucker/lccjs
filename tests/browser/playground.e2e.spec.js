// Playground end-to-end tests — requires Playwright + a built bundle.
//
// Install once:
//   npm install --save-dev @playwright/test
//   npx playwright install chromium
//
// Run:
//   npm run test:browser
//
// Gate: all tests are skipped when lcc.bundle.js has not been built yet,
// matching the oracle-test pattern (gate on LCC_ORACLE env var).

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs   = require('fs');

const BUNDLE = path.resolve(__dirname, '../../docs/site/dist/lcc.bundle.js');

const bundleExists = fs.existsSync(BUNDLE);

// Source programs
const HELLO_WORLD = [
  '; helloWorld.a',
  '        lea r0, msg',
  '        sout r0',
  '        nl',
  '        halt',
  'msg:    .string "Hello, World!"',
].join('\n');

const BAD_MNEMONIC = 'notanopcode r0, r1\nhalt';

const DIN_DOUT = 'din r0\ndout r0\nnl\nhalt';

// Wait for the output element to leave "Running…" / initial state
async function waitForOutput(page) {
  await page.waitForFunction(() => {
    const el = document.getElementById('exec-output');
    if (!el) return false;
    const t = el.textContent;
    return t !== 'Running…' && t !== '(click Run to execute)';
  }, { timeout: 10_000 });
}

test.describe('Playground E2E', () => {
  test.skip(!bundleExists, 'lcc.bundle.js not built — run npm run build first');

  test('happy path: Hello World runs and prints output', async ({ page }) => {
    await page.goto('/showcase/');

    // Replace editor content with the Hello World program
    await page.evaluate((src) => {
      document.getElementById('playground-input').value = src;
    }, HELLO_WORLD);

    await page.click('#run-btn');
    await waitForOutput(page);

    const text = await page.locator('#exec-output').textContent();
    expect(text).toContain('Hello, World!');

    const cls = await page.locator('#exec-output').getAttribute('class');
    expect(cls ?? '').not.toContain('lcc-error');
  });

  test('assembly error: bad mnemonic shows error class and text', async ({ page }) => {
    await page.goto('/showcase/');

    await page.evaluate((src) => {
      document.getElementById('playground-input').value = src;
    }, BAD_MNEMONIC);

    await page.click('#run-btn');
    await waitForOutput(page);

    const text = await page.locator('#exec-output').textContent();
    expect(text).toMatch(/assembly error/i);

    const cls = await page.locator('#exec-output').getAttribute('class');
    expect(cls ?? '').toContain('lcc-error');
  });

  test('stdin pass-through: din/dout echoes input value', async ({ page }) => {
    await page.goto('/showcase/');

    await page.evaluate((src) => {
      document.getElementById('playground-input').value = src;
    }, DIN_DOUT);

    await page.fill('#stdin-input', '42');

    await page.click('#run-btn');
    await waitForOutput(page);

    const text = await page.locator('#exec-output').textContent();
    expect(text).toContain('42');

    const cls = await page.locator('#exec-output').getAttribute('class');
    expect(cls ?? '').not.toContain('lcc-error');
  });
});
