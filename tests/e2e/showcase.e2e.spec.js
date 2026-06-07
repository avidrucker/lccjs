// tests/e2e/showcase.e2e.spec.js
//
// Regression / e2e suite for the GitHub Pages sandbox (#774, #775).
// Catches page-load failures (e.g. CDN import breakage like #772), editor mount
// failures, broken Run pipelines, and the pre/post-pause separator case (#793).
//
// Prerequisites (auto-skipped when absent):
//   npm run build        (npm run build:browser && npm run build:site)
//   npx playwright install chromium
//
// Run:
//   npm run test:e2e
//
// Editor content is set via window.__lccSetSource(), a test hook added by
// build-site.js so tests do not depend on CM6 internals or the defunct
// #playground-input textarea removed in the CM6 migration. (#774)

'use strict';

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs   = require('fs');

const BUNDLE  = path.resolve(__dirname, '../../docs/site/dist/lcc.bundle.js');
const SANDBOX = path.resolve(__dirname, '../../docs/site/sandbox/index.html');

const canRun = fs.existsSync(BUNDLE) && fs.existsSync(SANDBOX);

// ---------------------------------------------------------------------------
// Test programs
// ---------------------------------------------------------------------------

const HELLO_WORLD = [
  '; helloWorld.a: print Hello, World! and halt',
  '        lea  r0, msg',
  '        sout r0',
  '        nl',
  '        halt',
  'msg:    .string "Hello, World!"',
].join('\n');

const BAD_MNEMONIC = 'notanopcode r0\nhalt';

const DIN_DOUT = [
  '        din  r0',
  '        dout r0',
  '        nl',
  '        halt',
].join('\n');

// Outputs "Enter: " (no trailing \n), pauses for din, then prints the value.
// displayWithSeparator must inject \n between the prompt and the din echo
// because "Enter: " does not end with \n. See #793.
const PROMPT_DIN_DOUT = [
  '        lea  r0, prompt',
  '        sout r0',
  '        din  r1',
  '        dout r1',
  '        nl',
  '        halt',
  'prompt: .string "Enter: "',
].join('\n');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Set editor content via the test hook added to build-site.js / showcase HTML.
// Requires waitForEditor() to have been called first.
async function setSource(page, src) {
  await page.evaluate((s) => window.__lccSetSource(s), src);
}

// Wait for the module script to finish — signals both CM6 mount and test hook.
async function waitForEditor(page) {
  await page.waitForFunction(
    () => typeof window.__lccSetSource === 'function',
    { timeout: 15_000 },
  );
}

// Wait for #exec-output to leave the idle / running sentinel states.
async function waitForOutput(page) {
  await page.waitForFunction(() => {
    const el = document.getElementById('exec-output');
    if (!el) return false;
    const t = el.textContent;
    return t !== 'Running…' && t !== '(click Run to execute)';
  }, { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('Sandbox E2E', () => {
  test.skip(!canRun, 'build artefacts absent — run: npm run build');

  // T1 — catches CDN import failures (#772) which surface as uncaught
  // SyntaxErrors ("does not provide an export named …").
  test('T1 — page loads without uncaught JavaScript errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/sandbox/');
    await waitForEditor(page);

    const importErrors = errors.filter(m =>
      /does not provide an export named|Failed to resolve module|SyntaxError/i.test(m),
    );
    expect(importErrors).toHaveLength(0);
  });

  // T2 — confirms CodeMirror mounted; would be an empty div if CDN import failed.
  test('T2 — CodeMirror editor mounts (.cm-editor element is visible)', async ({ page }) => {
    await page.goto('/sandbox/');
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 15_000 });

    // Editor must contain starter content (not an empty blank div).
    const text = await page.locator('.cm-content').textContent();
    expect(text.length).toBeGreaterThan(0);
  });

  // T3 — golden path: the pre-loaded Hello World starter runs to correct output.
  test('T3 — happy path: starter Hello World produces expected output', async ({ page }) => {
    await page.goto('/sandbox/');
    await waitForEditor(page);

    await setSource(page, HELLO_WORLD);
    await page.click('#run-btn');
    await waitForOutput(page);

    const text  = await page.locator('#exec-output').textContent();
    const isErr = await page.locator('#exec-output').evaluate(
      el => el.classList.contains('lcc-error'),
    );

    expect(text).toContain('Hello, World!');
    expect(isErr).toBe(false);
  });

  // T4 — error path: a bad mnemonic triggers the error display.
  test('T4 — assembly error: bad mnemonic shows lcc-error class and error message', async ({ page }) => {
    await page.goto('/sandbox/');
    await waitForEditor(page);

    await setSource(page, BAD_MNEMONIC);
    await page.click('#run-btn');
    await waitForOutput(page);

    const text  = await page.locator('#exec-output').textContent();
    const isErr = await page.locator('#exec-output').evaluate(
      el => el.classList.contains('lcc-error'),
    );

    expect(text).toMatch(/assembly error/i);
    expect(isErr).toBe(true);
  });

  // T5 — stdin pre-supply: pre-supplied lines are consumed by din without
  // pausing for interactive input; dout echoes the value to output.
  test('T5 — stdin pre-supply: din/dout echoes pre-supplied integer', async ({ page }) => {
    await page.goto('/sandbox/');
    await waitForEditor(page);

    await setSource(page, DIN_DOUT);
    await page.fill('#stdin-input', '42');
    await page.click('#run-btn');
    await waitForOutput(page);

    const text  = await page.locator('#exec-output').textContent();
    const isErr = await page.locator('#exec-output').evaluate(
      el => el.classList.contains('lcc-error'),
    );

    expect(text).toContain('42');
    expect(isErr).toBe(false);
  });

  // T6 — pre/post-pause separator (#793): displayWithSeparator injects a \n
  // after "Enter: " (which has no trailing newline) so the din echo appears
  // on its own line rather than concatenated with the prompt string.
  //
  // Requires interactive input (not pre-supplied stdin) because preResumeOutputLength
  // is only recorded when the program actually pauses. With pre-supplied stdin, din
  // consumes the line without pausing and preResumeLen stays 0 (no separator).
  //
  // Interactive flow:
  //   sout r0      → outputs "Enter: " (no \n); preResumeOutputLength = 7
  //   din r1       → pauses; #stdin-prompt appears
  //   [user types "42", submits]
  //   din echo     → "42\n" written to stdout
  //   dout r1      → "42\n"
  //   halted       → displayWithSeparator("Enter: 42\n42\n", 7) = "Enter: \n42\n42\n"
  test('T6 — separator: displayWithSeparator injects \\n after prompt lacking trailing newline', async ({ page }) => {
    await page.goto('/sandbox/');
    await waitForEditor(page);

    // No pre-supplied stdin — din must pause so preResumeOutputLength is captured.
    await setSource(page, PROMPT_DIN_DOUT);
    await page.click('#run-btn');

    // Wait for the interactive prompt to appear (din pause), then submit "42".
    await page.waitForSelector('#stdin-prompt', { state: 'visible', timeout: 10_000 });
    await page.fill('#stdin-prompt-input', '42');
    await page.click('#stdin-prompt-submit');

    // Wait for #stdin-prompt to hide — finishRun() hides it when the Worker halts.
    await page.waitForSelector('#stdin-prompt', { state: 'hidden', timeout: 10_000 });

    const text  = await page.locator('#exec-output').textContent();
    const isErr = await page.locator('#exec-output').evaluate(
      el => el.classList.contains('lcc-error'),
    );

    expect(isErr).toBe(false);
    expect(text).toContain('Enter: ');
    expect(text).toContain('42');
    // Key assertion: separator \n must be present — "Enter: \n", not "Enter: 42".
    expect(text).toMatch(/Enter: \n/);
  });
});
