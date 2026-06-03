# Browser-bundle feasibility — spike findings (#591)

**Date:** 2026-06-03  
**Agent:** CHERRY  
**Prereq completed:** #592 (writeOutput → `this._write` callback)

---

## Q1: Can `assembleSource` + `executeBuffer({inputBuffer})` be bundled with `fs` polyfilled as no-op?

**Verdict: YES.**

All `fs` calls in `assembler.js` and `interpreter.js` are on dead-code paths when using the in-memory API:

| Call site | Guard | Reachable in browser path? |
|-----------|-------|---------------------------|
| `assembler.js` `fs.openSync/writeSync/closeSync` | Inside `writeOutputFile()`, called only from `main()` | No — `assembleSource()` returns before `writeOutputFile()` |
| `interpreter.js` `fs.readSync` in `readLineFromStdin` | Guarded by `if (this.inputBuffer …)` (line 1310) | No — pre-supplied `inputBuffer` takes the early-return branch |
| `interpreter.js` `fs.readSync` in `readCharFromStdin` | Guarded by `if (this.inputBuffer …)` (line 1366) | No — same |
| `name.js` `fs.existsSync/readFileSync/writeFileSync` | Guarded by `this.generateStats` (default `false`) | No — `generateStats` is only set to `true` by the CLI |

Setting `resolve.fallback: {fs: false}` in webpack (which makes `require('fs')` resolve to `{}`) is sufficient. A runtime error only occurs if a dead-code path is reached — which it won't be for the target use case.

**One caveat:** `Buffer.alloc(1)` appears in `readLineFromStdin` and `readCharFromStdin`. These are also dead-code paths, but webpack 5 no longer auto-polyfills `Buffer`. If webpack emits a warning, add `fallback: {buffer: require.resolve('buffer/')}`. This has no effect on the live code path; it only satisfies webpack's static analysis.

---

## Q2: Minimum viable `webpack.config.js` — can Babel be dropped?

**Verdict: YES, Babel can be dropped.**

lccjs uses CommonJS (`require`/`module.exports`), classes, arrow functions, template literals, `const`/`let`, optional chaining, and `??`. All of these are natively supported by Chrome 85+, Firefox 78+, Safari 14+, Edge 85+. No transpilation step is needed for the slide-embed use case.

Minimum config (see `spike/webpack.config.js` for the full file):

```js
module.exports = {
  mode: 'production',
  entry: './spike/browser-entry.js',
  output: {
    filename: 'lcc.bundle.js',
    path: path.resolve(__dirname, 'dist'),
    library: { name: 'lcc', type: 'umd', export: 'default' },
    globalObject: 'typeof self !== "undefined" ? self : this',
  },
  resolve: {
    fallback: {
      fs:   false,
      path: require.resolve('path-browserify'),
    },
  },
};
```

Dev dependencies needed: `webpack`, `webpack-cli`, `path-browserify` (optionally `buffer` if the Buffer warning appears).

The old `browserify` branch's config included `babel-loader`, `style-loader`, `css-loader`, a complex `processWrapper.js`, and a 200-line `fsWrapper.js` with Proxy-based localStorage simulation — none of that is needed for the in-memory API path.

**`process.platform`** is used at module load time to set `newline`. Webpack 5's built-in process shim sets `process.platform = 'browser'`, so `newline = '\n'` (correct for browser output).

**`process.exit`** in `cliExit.js` is called only on fatal errors. For library use (vs CLI), callers should catch thrown typed errors (`AssemblerError`, `InterpreterRuntimeError`) rather than relying on `process.exit`. Webpack's process shim provides a no-op `exit`, which is fine.

---

## Q3: Does `dist/lcc.bundle.js` work in a plain `<script>` tag on a `file://` page?

**Verdict: YES — no special headers required.**

The blocking-stdin architecture in the old `browserify` branch required `Atomics.wait()` in a Web Worker, which mandates `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`. These headers are unavailable on GitHub Pages without custom server config, on local `file://` pages, and on most slide-hosting environments.

The in-memory API avoids this entirely:
- Input is pre-supplied via `inputBuffer` string — no blocking read, no Web Worker needed
- Output is captured via `{write: m => (domBuffer += m)}` — no `process.stdout` interception
- The bundle runs synchronously in the main thread for short programs

A `<script src="dist/lcc.bundle.js">` tag on a `file://` page is sufficient. See `spike/test-bundle.html` for a smoke-test.

---

## Remaining gaps before #593 (minimal browser API)

1. `Buffer.alloc` in dead-code branches — add `buffer` polyfill or restructure to avoid
2. No bundle smoke-test has been executed yet (webpack not installed in this repo; spike config is conceptual)
3. `assembleSource` currently returns the binary buffer; the API wrapper for #593 will need to handle errors (thrown `AssemblerError`) and expose a friendlier interface
4. Programs using `sin`/`ain`/`hin` traps with user-supplied `inputBuffer` work; programs that exhaust the buffer will call `fs.readSync` and fail — document this limitation clearly

---

## References

- Old browserify branch: `origin/browserify` (webpack config + polyfills)
- Pure seam documentation: `CLAUDE.md` "Architecture: pure seams vs CLI wrappers"
- writeOutput decoupling: #592 (merged 2026-06-03)
- Next step: #593 DEV: minimal browser API
