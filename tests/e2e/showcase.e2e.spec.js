// tests/e2e/showcase.e2e.spec.js
//
// Regression / smoke tests for the GitHub Pages showcase/playground (#775).
// Catches page-load failures (e.g. CDN import breakage like #772), editor
// mount failures, and broken Run pipelines.
//
// Prerequisites (auto-skipped when absent):
//   npm run build        (npm run build:browser && npm run build:site)
//   npx playwright install chromium
//
// Run:
//   npm run test:e2e

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs   = require('fs');

const BUNDLE   = path.resolve(__dirname, '../../docs/site/dist/lcc.bundle.js');
const SHOWCASE = path.resolve(__dirname, '../../docs/site/showcase/index.html');

const canRun = fs.existsSync(BUNDLE) && fs.existsSync(SHOWCASE);

// Set CodeMirror 6 editor content by dispatching a transaction through the
// `cmView` property CM6 attaches to its root .cm-editor DOM element.
// (EditorView.findFromDOM uses the same property internally.)
async function setEditorContent(page, src) {
  await page.evaluate((source) => {
    const dom = document.querySelector('.cm-editor');
    if (!dom || !dom.cmView)
      throw new Error('CM6 editor not found or not yet mounted');
    dom.cmView.dispatch({
      changes: { from: 0, to: dom.cmView.state.doc.length, insert: source },
    });
  }, src);
}

// Wait for #exec-output to leave the idle/running states.
async function waitForOutput(page) {
  await page.waitForFunction(() => {
    const el = document.getElementById('exec-output');
    if (!el) return false;
    const t = el.textContent;
    return t !== 'Running…' && t !== '(click Run to execute)';
  }, { timeout: 15_000 });
}

test.describe('Showcase E2E (#775)', () => {
  test.skip(!canRun, 'build artefacts absent — run: npm run build');

  // T1 — catches CDN import failures (#772) which surface as uncaught SyntaxErrors.
  test('T1 — page loads without uncaught JavaScript errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/showcase/');
    await page.waitForLoadState('domcontentloaded');
    expect(errors).toEqual([]);
  });

  // T2 — confirms CodeMirror mounted; would be an empty div if CDN import failed.
  test('T2 — CodeMirror editor mounts (.cm-editor element is visible)', async ({ page }) => {
    await page.goto('/showcase/');
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 10_000 });
  });

  // T3 — happy path: the pre-loaded Hello World starter runs to correct output.
  test('T3 — happy path: starter Hello World produces expected output', async ({ page }) => {
    await page.goto('/showcase/');
    await page.locator('.cm-editor').waitFor({ timeout: 10_000 });

    await page.click('#run-btn');
    await waitForOutput(page);

    const text  = await page.locator('#exec-output').textContent();
    const isErr = await page.locator('#exec-output').evaluate(
      el => el.classList.contains('lcc-error'),
    );

    expect(text).toContain('Hello, World!');
    expect(isErr).toBe(false);
  });

  // T4 — error path: a bad mnemonic triggers the error display, not a silent hang.
  test('T4 — assembly error: bad mnemonic shows lcc-error class and error message', async ({ page }) => {
    await page.goto('/showcase/');
    await page.locator('.cm-editor').waitFor({ timeout: 10_000 });

    await setEditorContent(page, 'notanopcode r0\nhalt');
    await page.click('#run-btn');
    await waitForOutput(page);

    const text  = await page.locator('#exec-output').textContent();
    const isErr = await page.locator('#exec-output').evaluate(
      el => el.classList.contains('lcc-error'),
    );

    expect(text).toMatch(/assembly error/i);
    expect(isErr).toBe(true);
  });
});
