# Playground E2E test strategy — spike findings (#711)

**Date:** 2026-06-04  
**Agent:** GRAPE  
**Parent:** #705 (Run button broken)  
**Tracker:** #677

---

## Summary

**Recommendation: Playwright + local HTTP server.**

Playwright is the only option that exercises the full stack (DOM, Web Worker, bundle load) reliably in CI, and its `webServer` config handles server spin-up automatically. File `tests/browser/playground.e2e.spec.js` is the minimal working implementation; it is gated on bundle existence so `npm test` keeps passing without a build.

---

## Q1 — What tool is the right fit?

| Option | CI-friendly | Workers work? | `file://` support | Setup cost | Verdict |
|---|---|---|---|---|---|
| **Playwright** | ✅ headless Chromium bundled | ✅ via HTTP | ⚠️ see below | Low (1 dep) | **Chosen** |
| Puppeteer | ✅ headless Chrome bundled | ✅ via HTTP | ⚠️ same caveat | Low (1 dep) | Skip — Playwright is strictly better |
| jsdom/vm harness | ✅ pure Node | ✗ no Worker support | N/A | Medium | Skip — can't exercise the real code path |
| Manual checklist | ✗ | ✅ | ✅ | None | Use only as fallback |

### Critical: `file://` + Web Worker restriction

The playground loads the bundle via a Web Worker:

```
docs/site/showcase/index.html
  → new Worker('./lcc-worker.js')           (same dir)
    → importScripts('../dist/lcc.bundle.js') (cross-dir)
```

Chrome 96+ restricts `importScripts()` across directory boundaries for `file://` Workers.
The #591 spike confirmed `file://` works for a `<script>` tag, but the Worker path was not
tested there. An HTTP server avoids the restriction entirely and matches the production
deployment (GitHub Pages).

**Verdict: use an HTTP server, not `file://`.** Playwright's `webServer` config makes this
a one-liner (`python3 -m http.server 5556 --directory docs/site`).

---

## Q2 — Minimum viable test cases

### Test 1 — Happy path (Hello World)

| Step | Expected |
|---|---|
| Navigate to `/showcase/` | Page loads; starter Hello World program is pre-filled in `#playground-input` |
| Click `#run-btn` | `#exec-output` changes to "Running…" then to program output |
| Output assertion | `#exec-output` text contains `Hello, World!` |
| Class assertion | `#exec-output` does **not** have class `lcc-error` |

### Test 2 — Assembly error path

| Step | Expected |
|---|---|
| Set `#playground-input` to `notanopcode r0, r1\nhalt` | — |
| Click `#run-btn` | — |
| Class assertion | `#exec-output` has class `lcc-error` |
| Output assertion | text begins with `Assembly error:` |

### Test 3 — stdin pass-through

| Step | Expected |
|---|---|
| Set `#playground-input` to `din r0\ndout r0\nnl\nhalt` | — |
| Set `#stdin-input` to `42` | — |
| Click `#run-btn` | — |
| Output assertion | `#exec-output` text contains `42` |
| Class assertion | `#exec-output` does **not** have class `lcc-error` |

---

## Q3 — Recommendation and rationale

**Use Playwright.** Three reasons:

1. **Workers run reliably.** An HTTP server sidesteps the `file://` Worker restriction.
2. **CI-friendly by default.** `npx playwright install chromium` pulls a pinned headless build; no system Chrome needed.
3. **The fixture already exercises the real bug.** #705 is "Run button is broken." A Playwright test that clicks the button and asserts output is the minimal reproducible proof-of-fix.

**Bundle-existence gate** mirrors the oracle gate pattern already in use:
```js
test.skip(!bundleExists, 'lcc.bundle.js not built — run npm run build first');
```
This keeps `npm test` green without a build, while `npm run test:browser` fails clearly.

---

## Setup (one-time, performed by the DEV who closes #705 or a follow-on ticket)

```bash
# Install Playwright and download headless Chromium
npm install --save-dev @playwright/test
npx playwright install chromium
```

`playwright.config.js` and the test file are already committed (this spike).
Add to `package.json` scripts:

```json
"test:browser": "playwright test tests/browser/"
```

Once Playwright is installed, run:

```bash
npm run build          # build:browser + build:site
npm run test:browser   # runs tests/browser/playground.e2e.spec.js
```

---

## Files committed by this spike

- `docs/research/playground-e2e-test-strategy.md` — this document
- `tests/browser/playground.e2e.spec.js` — minimal Playwright spec (3 test cases)
- `playwright.config.js` — webServer config; routes to `docs/site/` on port 5556

`@playwright/test` is **not** yet a devDependency — the install step is left for the DEV ticket that closes #705.

---

## References

- #591 — browser-bundle feasibility spike (confirmed UMD + `file://` for `<script>` tags)
- #705 — Run button broken (the bug this test strategy targets)
- #706 / #706b — bundle path fix (prerequisite)
- `docs/research/browser-bundle-feasibility.md` — full #591 findings
- `src/browser/api.js` — `window.lcc.assemble` + `window.lcc.run` entry points
- `src/browser/lcc-worker.js` — worker wrapper for the playground run path
