// webpack config for the lcc browser bundles (#591, #595).
//
// Produces two outputs in dist/:
//   lcc-injector.js  — self-contained IIFE; finds <code class="language-lcc">
//                      on DOMContentLoaded, assembles+runs each block, appends output.
//   lcc.bundle.js    — raw assemble()/run() API for custom integrations.
//
// Build: npx webpack --config webpack.browser.config.js
// Or:    npm run build:browser
//
// Dev deps required (already in package.json devDependencies):
//   webpack  webpack-cli  path-browserify  process
'use strict';

const path = require('path');
const webpack = require('webpack');

const sharedFallback = {
  // fs call-sites are dead code on the in-memory API path — safe to stub.
  fs: false,
  // path-browserify polyfills path.extname / path.resolve used at module load.
  path: require.resolve('path-browserify'),
  // Buffer is used by the assembler and interpreter; browsers need the polyfill.
  buffer: require.resolve('buffer/'),
  // Webpack 5 no longer shims process automatically; several modules reference process.*.
  process: require.resolve('process/browser'),
};

// Inject Buffer and process as globals for modules that use them without require().
const sharedPlugins = [
  new webpack.ProvidePlugin({
    Buffer:  ['buffer', 'Buffer'],
    process: 'process/browser',
  }),
];

module.exports = [

  // ── lcc-injector.js ────────────────────────────────────────────────────────
  // Self-contained: bundles the browser API + DOM injection side-effect.
  // No library export — IIFE that runs on load.
  {
    name: 'injector',
    mode: 'production',
    entry: path.resolve(__dirname, 'src/browser/lcc-injector.js'),
    output: {
      filename: 'lcc-injector.js',
      path: path.resolve(__dirname, 'dist'),
      // IIFE; no global export needed — side-effect only.
      globalObject: 'typeof self !== "undefined" ? self : this',
    },
    resolve: { fallback: sharedFallback },
    plugins: sharedPlugins,
  },

  // ── lcc.bundle.js ──────────────────────────────────────────────────────────
  // Raw API bundle for custom integrations: window.lcc.assemble() / .run().
  {
    name: 'api',
    mode: 'production',
    entry: path.resolve(__dirname, 'src/browser/api.js'),
    output: {
      filename: 'lcc.bundle.js',
      path: path.resolve(__dirname, 'dist'),
      library: { name: 'lcc', type: 'umd' },
      globalObject: 'typeof self !== "undefined" ? self : this',
    },
    resolve: { fallback: sharedFallback },
    plugins: sharedPlugins,
  },

  // ── editor.bundle.js ───────────────────────────────────────────────────────
  // CodeMirror 6 + Lezer + the lcc() language for the playground editor, bundled
  // into one local asset so the sandbox no longer fetches ~58 modules from esm.sh
  // (#1284). UMD → window.LccEditor. Pure browser ESM — no Node polyfills needed.
  {
    name: 'editor',
    mode: 'production',
    entry: path.resolve(__dirname, 'src/browser/editor.js'),
    output: {
      filename: 'editor.bundle.js',
      path: path.resolve(__dirname, 'dist'),
      library: { name: 'LccEditor', type: 'umd' },
      globalObject: 'typeof self !== "undefined" ? self : this',
    },
  },
];
