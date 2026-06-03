// Minimal webpack config for lccjs browser bundle — spike for #591.
// Bundles assembleSource + executeBuffer (in-memory API) only.
// No Babel, no SharedArrayBuffer, no COOP/COEP headers needed.
//
// Install deps before running:
//   npm install --save-dev webpack webpack-cli path-browserify
//
// Then: npx webpack --config spike/webpack.config.js

const path = require('path');

module.exports = {
  mode: 'production',
  entry: path.resolve(__dirname, 'browser-entry.js'),
  output: {
    filename: 'lcc.bundle.js',
    path: path.resolve(__dirname, '..', 'dist'),
    library: {
      name: 'lcc',
      type: 'umd',
      export: 'default',
    },
    globalObject: 'typeof self !== "undefined" ? self : this',
  },
  resolve: {
    fallback: {
      // fs is required at module top level but all call-sites in the in-memory
      // path (assembleSource + executeBuffer with inputBuffer) are dead code.
      // Setting false makes webpack emit {} for require('fs'); runtime errors
      // only occur if a dead-code path is actually reached (it won't be).
      fs: false,
      // path-browserify polyfills path.extname / path.resolve etc.
      // Used only in CLI main() — dead code for the in-memory path too,
      // but webpack resolves it statically so we need the polyfill.
      path: require.resolve('path-browserify'),
      // Buffer appears in executeSIN/executeAIN dead-code branches.
      // If webpack warns, add: buffer: require.resolve('buffer/')
      // and npm install buffer.
    },
  },
};
