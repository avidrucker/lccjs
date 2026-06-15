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

const { test, expect } = require('playwright/test');
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

const SAFE_PAD = '        add r0, r0, 0';

const COMMON_ASSEMBLY_ERRORS = [
  {
    name: 'invalid mnemonic',
    src: '        notanopcode r0\n        halt',
    sourceLine: 'notanopcode r0',
    message: 'Invalid operation',
  },
  {
    name: 'bad register',
    src: '        add r8, r0, r1\n        halt',
    sourceLine: 'add r8, r0, r1',
    message: 'Bad register',
  },
  {
    name: 'missing operand',
    src: '        add r0, r1\n        halt',
    sourceLine: 'add r0, r1',
    message: 'Missing operand',
  },
  {
    name: 'undefined branch label',
    src: '        br missing\n        halt',
    sourceLine: 'br missing',
    message: 'Undefined label',
  },
  {
    name: 'duplicate label',
    src: 'loop:   halt\nloop:   halt',
    sourceLine: 'loop:   halt',
    message: 'Duplicate label',
  },
  {
    name: 'numeric label',
    src: '1bad:   halt',
    sourceLine: '1bad:   halt',
    message: 'Bad label',
  },
  {
    name: 'imm5 out of range',
    src: '        add r0, r0, 16\n        halt',
    sourceLine: 'add r0, r0, 16',
    message: 'imm5 out of range',
  },
  {
    name: 'mvi immediate out of range',
    src: '        mvi r0, 256\n        halt',
    sourceLine: 'mvi r0, 256',
    message: 'mvi immediate out of range',
  },
  {
    name: 'offset6 out of range',
    src: '        ldr r0, r1, 32\n        halt',
    sourceLine: 'ldr r0, r1, 32',
    message: 'offset6 out of range',
  },
  {
    name: 'pcoffset9 out of range',
    src: ['        br far', ...Array(260).fill(SAFE_PAD), 'far:    halt'].join('\n'),
    sourceLine: 'br far',
    message: 'pcoffset9 out of range',
  },
  {
    name: 'pcoffset11 out of range',
    src: ['        bl far', ...Array(1100).fill(SAFE_PAD), 'far:    halt'].join('\n'),
    sourceLine: 'bl far',
    message: 'pcoffset11 out of range',
  },
  {
    name: 'unknown string escape',
    src: 'msg:    .string "bad\\q"\n        halt',
    sourceLine: 'msg:    .string "bad\\q"',
    message: 'Unknown escape sequence: \\q',
  },
  {
    name: 'missing string quote',
    src: 'msg:    .string "unterminated\n        halt',
    sourceLine: 'msg:    .string "unterminated',
    message: 'Missing terminating quote',
  },
  {
    name: 'invalid character literal',
    src: "        mvi r0, 'ab'\n        halt",
    sourceLine: "mvi r0, 'ab'",
    message: 'Bad number',
  },
  {
    name: 'invalid directive',
    src: '        .bad 1\n        halt',
    sourceLine: '.bad 1',
    message: 'Invalid operation',
  },
  {
    name: 'nonnumeric .blkw count',
    src: '        .blkw nope\n        halt',
    sourceLine: '.blkw nope',
    message: 'Bad number',
  },
  {
    name: 'negative .blkw count',
    src: '        .blkw -1\n        halt',
    sourceLine: '.blkw -1',
    message: 'Bad number',
  },
  {
    name: 'nonnumeric .org',
    src: '        .org nope\n        halt',
    sourceLine: '.org nope',
    message: 'Invalid number for .org directive',
  },
  {
    name: 'out-of-range .org',
    src: '        .org 70000\n        halt',
    sourceLine: '.org 70000',
    message: 'Bad number',
  },
  {
    name: 'backward .org',
    src: '        .org 10\n        .org 5\n        halt',
    sourceLine: '.org 5',
    message: 'Backward address on .org',
  },
];

const INFINITE_LOOP = [
  'loop:   br loop',
].join('\n');

const DIVIDE_BY_ZERO = [
  '        mov r0, 5',
  '        mov r1, 0',
  '        div r0, r1',
  '        halt',
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

async function outputIsError(page) {
  return page.locator('#exec-output').evaluate(
    el => el.classList.contains('lcc-error'),
  );
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
    const isErr = await outputIsError(page);

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
    const isErr = await outputIsError(page);

    expect(text).toMatch(/assembly error/i);
    expect(isErr).toBe(true);
  });

  test('T4b — common assembly errors: 20 diagnostics are surfaced with source context', async ({ page }) => {
    await page.goto('/sandbox/');
    await waitForEditor(page);

    for (const c of COMMON_ASSEMBLY_ERRORS) {
      await test.step(c.name, async () => {
        await setSource(page, c.src);
        await page.fill('#stdin-input', '');
        await page.click('#run-btn');
        await waitForOutput(page);

        const text  = await page.locator('#exec-output').textContent();
        const isErr = await outputIsError(page);

        expect(isErr).toBe(true);
        expect(text).toContain('Assembly error:');
        expect(text).toContain('Error on line');
        expect(text).toContain(c.sourceLine);
        expect(text).toContain(c.message);
      });
    }
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
    const isErr = await outputIsError(page);

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
    const isErr = await outputIsError(page);

    expect(isErr).toBe(false);
    expect(text).toContain('Enter: ');
    expect(text).toContain('42');
    // Key assertion: separator \n must be present — "Enter: \n", not "Enter: 42".
    expect(text).toMatch(/Enter: \n/);
  });

  test('T7 — runner failure: possible infinite loop is surfaced as an error', async ({ page }) => {
    await page.goto('/sandbox/');
    await waitForEditor(page);

    await setSource(page, INFINITE_LOOP);
    await page.click('#run-btn');
    await waitForOutput(page);

    const text   = await page.locator('#exec-output').textContent();
    const status = await page.locator('#playground-status').textContent();
    const isErr  = await outputIsError(page);

    expect(isErr).toBe(true);
    expect(text).toContain('truncated');
    expect(status).toContain('Program did not halt');
  });

  test('T8 — runner failure: runtime exception is surfaced as an error', async ({ page }) => {
    await page.goto('/sandbox/');
    await waitForEditor(page);

    await setSource(page, DIVIDE_BY_ZERO);
    await page.click('#run-btn');
    await waitForOutput(page);

    const text   = await page.locator('#exec-output').textContent();
    const status = await page.locator('#playground-status').textContent();
    const isErr  = await outputIsError(page);

    expect(isErr).toBe(true);
    expect(text).toContain('Runtime error:');
    expect(text).toContain('Floating point exception');
    expect(status).toContain('exited with code 1');
  });
});
