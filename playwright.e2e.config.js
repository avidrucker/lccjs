const { defineConfig } = require('@playwright/test');

// Playwright config for the showcase/playground e2e suite (tests/e2e/).
// Distinct from tests/browser/ (BANANA's read-only test run).
//
// Prerequisites:
//   npm run build        (build:browser + build:site)
//   npx playwright install chromium
//
// Run:
//   npm run test:e2e

module.exports = defineConfig({
  // Spin up a static HTTP server for docs/site/ before running tests.
  // Web Workers require HTTP (not file://) to call importScripts() cross-directory.
  webServer: {
    command: 'python3 -m http.server 5556 --directory docs/site',
    port: 5556,
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://localhost:5556',
  },
  testDir: 'tests/e2e',
});
