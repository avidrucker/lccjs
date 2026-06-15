// Playground end-to-end tests — requires Playwright + a built bundle.
//
// Install once:
//   npm install
//   npx playwright install chromium
//
// Run:
//   npm run test:browser
//
// Gate: all tests are skipped when lcc.bundle.js has not been built yet,
// matching the oracle-test pattern (gate on LCC_ORACLE env var).

const { test, expect } = require('playwright/test');
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

const DIN_DOUT = [
  '        din  r0',
  '        dout r0',
  '        nl',
  '        halt',
].join('\n');

const DIN_STDIN_VALUE = '42';               // arbitrary stdin for din tests
const DIN_PROMPT_OUTPUT = 'Enter: \n42\n42\n'; // prompt + separator + din echo + dout + nl

// Program with a prompt (no trailing newline) before din — verifies displayWithSeparator
// separates pre-pause and post-resume output.
const DIN_PROMPT = [
  '        lea  r0, prompt',
  '        sout r0',
  '        din  r1',
  '        dout r1',
  '        nl',
  '        halt',
  'prompt: .string "Enter: "',
].join('\n');

// Wait for the output element to leave "Running…" / initial state
async function waitForOutput(page) {
  await page.waitForFunction(() => {
    const el = document.getElementById('exec-output');
    if (!el) return false;
    const t = el.textContent;
    return t !== 'Running…' && t !== '(click Run to execute)';
  }, { timeout: 10_000 });
}

test.describe('Sandbox E2E', () => {
  test.skip(!bundleExists, 'lcc.bundle.js not built — run npm run build first');

  test('happy path: Hello World runs and prints output', async ({ page }) => {
    await page.goto('/sandbox/');

    // Replace editor content via the CM6 test hook exposed on window
    await page.evaluate((src) => { window.__lccSetSource(src); }, HELLO_WORLD);

    await page.click('#run-btn');
    await waitForOutput(page);

    const text = await page.locator('#exec-output').textContent();
    expect(text).toContain('Hello, World!');

    const cls = await page.locator('#exec-output').getAttribute('class');
    expect(cls ?? '').not.toContain('lcc-error');
  });

  test('assembly error: bad mnemonic shows error class and text', async ({ page }) => {
    await page.goto('/sandbox/');

    await page.evaluate((src) => { window.__lccSetSource(src); }, BAD_MNEMONIC);

    await page.click('#run-btn');
    await waitForOutput(page);

    const text = await page.locator('#exec-output').textContent();
    expect(text).toMatch(/assembly error/i);

    const cls = await page.locator('#exec-output').getAttribute('class');
    expect(cls ?? '').toContain('lcc-error');
  });

  test('stdin pass-through: din/dout echoes input value', async ({ page }) => {
    await page.goto('/sandbox/');

    await page.evaluate((src) => { window.__lccSetSource(src); }, DIN_DOUT);

    await page.fill('#stdin-input', DIN_STDIN_VALUE);

    await page.click('#run-btn');
    await waitForOutput(page);

    const text = await page.locator('#exec-output').textContent();
    expect(text).toContain(DIN_STDIN_VALUE);

    const cls = await page.locator('#exec-output').getAttribute('class');
    expect(cls ?? '').not.toContain('lcc-error');
  });

  test('displayWithSeparator: prompt before din stays inline with echo', async ({ page }) => {
    await page.goto('/sandbox/');

    await page.evaluate((src) => { window.__lccSetSource(src); }, DIN_PROMPT);
    await page.fill('#stdin-input', DIN_STDIN_VALUE);

    await page.click('#run-btn');
    await waitForOutput(page);

    const text = await page.locator('#exec-output').textContent();
    // "Enter: " (no trailing newline) gets a separator before din echo + dout + nl.
    expect(text).toBe(DIN_PROMPT_OUTPUT);

    const cls = await page.locator('#exec-output').getAttribute('class');
    expect(cls ?? '').not.toContain('lcc-error');
  });
});
