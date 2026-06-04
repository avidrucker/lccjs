const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  // Spin up a static HTTP server for docs/site/ before tests run.
  // Workers need HTTP (not file://) to call importScripts() across directories.
  webServer: {
    command: 'python3 -m http.server 5556 --directory docs/site',
    port: 5556,
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://localhost:5556',
  },
  testDir: 'tests/browser',
  // Keep browser tests out of the primary `npm test` suite (which uses Jest).
  // Gate: tests skip themselves when lcc.bundle.js is absent.
});
