# Playground verification spike — tool selection and test strategy (#711)

**Date:** 2026-06-04 · **Agent:** DRAGONFRUIT  
**Parent:** #705 · **Tracker:** #677

---

## Summary

This spike confirms end-to-end that the playground page works after build, chooses Playwright as the verification tool, and commits three working browser tests to `tests/browser/`.

---

## Tool assessment

| Option | CI-friendly | `file://` support | Setup cost | Verdict |
|--------|:-----------:|:-----------------:|:----------:|---------|
| **Playwright** | ✓ (headless Chromium) | ✓ (confirmed) | Low — `npx playwright install chromium` | **Chosen** |
| Puppeteer | ✓ | ✓ | Medium — separate binary management | Not chosen |
| jsdom/vm harness | ✓ | n/a | Low | Cannot simulate `<script type="module">` or browser globals |
| Manual checklist | ✗ | n/a | None | No CI coverage |

**Why Playwright:** The playground uses `<script type="module">` and dynamically loads `lcc.bundle.js` — jsdom cannot simulate this. Playwright 1.x is already available globally (`npx playwright`), supports `file://` URLs with headless Chromium, and the fallback execution path (window.lcc synchronous API, triggered when Workers are unavailable on `file://`) exercises the full assemble → run → output pipeline. The `file://` approach requires no HTTP server, matching the injector test fixture pattern already in the repo.

---

## Bugs discovered during verification

Two bugs blocked the playground from working — both fixed as part of this spike:

### Bug 1 — `process.platform` at module level crashes bundle load

`src/core/interpreter.js:18` and `src/utils/name.js:18` both had:

```javascript
const newline = process.platform === 'win32' ? '\r\n' : '\n';
```

These module-level statements run when the bundle is first parsed. In the browser, `process` is not defined, so the entire bundle script throws immediately — `window.lcc` is never set and every Run click shows `"(lcc.bundle.js not loaded — execution unavailable)"`.

**Fix:** Guarded with `typeof process !== 'undefined'` in both files. Also fixed the `_write` default in `interpreter.js` similarly.

### Bug 2 — `Buffer` not available in browser bundle

The assembler and interpreter use `Buffer.alloc()` / `Buffer.from()` as global references without `require('buffer')`. Webpack 5 does not polyfill Node built-ins automatically.

**Fix:** Added `buffer: require.resolve('buffer/')` to `resolve.fallback` and a `ProvidePlugin({ Buffer: ['buffer', 'Buffer'] })` to `webpack.browser.config.js`.

---

## Minimum viable test cases

All three implemented in `tests/browser/playground.browser.spec.js`:

| # | Case | Assertion |
|---|------|-----------|
| T1 | Happy path — Hello World | `exec-output` contains `"Hello, World!"` |
| T2 | Assembly error — bad mnemonic | `exec-output.classList` has `lcc-error`; text matches `/assembly error/i` |
| T3 | stdin pass-through — `din`/`dout` | `exec-output` contains the pre-supplied value `"42"` |

---

## Running the tests

```bash
npm run build:browser    # builds dist/lcc.bundle.js
npm run build:site       # copies bundle to docs/site/dist/ + generates playground HTML
npx playwright install chromium   # one-time if not already cached
NODE_PATH=<playwright-location> npm run test:browser
```

The suite auto-skips if `docs/site/dist/lcc.bundle.js` does not exist, mirroring the oracle test gate pattern.

---

## Recommendation

Add `playwright` to `devDependencies` (done) and run `npm run test:browser` as a CI step gated on `docs/site/dist/lcc.bundle.js` existing. The `test:browser` script uses `jest --runInBand tests/browser` — consistent with the rest of the test suite. Playwright 1.x is stable and headless Chromium download is ~120 MB, acceptable for a dev-only install.

The `test:all` script does not include `tests/browser` by default (it matches `tests/new` only). Add `tests/browser` to `test:all`'s pattern if CI should run it automatically after every `build:browser`.
