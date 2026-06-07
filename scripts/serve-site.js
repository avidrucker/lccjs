#!/usr/bin/env node
/*
 * serve-site.js — a zero-dependency static file server for the BUILT site
 * (docs/site), so showcase/playground changes can be verified in a real browser
 * before they ship to GitHub Pages.
 *
 * Why this exists (#987): the live showcase is the GENERATED page
 * docs/site/showcase/index.html (emitted by scripts/build-site.js, with
 * docs/site as the Pages artifact root per .github/workflows/pages.yml). CM6
 * features (line numbers, syntax highlighting) were twice declared working from
 * a source reading while the deployed page silently lacked them (#985, #986) —
 * the fixes had landed on standalone source pages that were never deployed
 * (those legacy pages, docs/showcase + docs/playground, were removed in #1045).
 * Serving the built artifact locally is the only way to catch that gap before
 * deploy.
 *
 * It deliberately uses only Node built-ins — the repo ships with no runtime
 * dependencies (Node >=18), and `npx serve` would pull from the registry every
 * run. See docs/showcase-local-dev.md for the pre-deploy verification checklist.
 *
 * Usage:
 *   npm run build          # build:browser + build:site (regenerate docs/site)
 *   npm run serve:site     # serve docs/site at http://localhost:8080
 *   npm run serve:site -- --port 9000   # pick a different port
 *   npm run serve:site -- --root docs   # serve a different root (rarely needed)
 */

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Minimal MIME map. .mjs/.js MUST be served as a JS type or the browser refuses
// the ES module imports the playground relies on; .json covers the tmLanguage
// grammar the Shiki preview fetches.
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.map':  'application/json; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

// @todo #1028:45/DEV add a --dev (alias --watch) mode: fs.watch over
// scripts/build-site.js, src/browser/, src/lang-lcc/, docs/site/dist/lang-lcc.js
// (debounced) dispatching the MINIMAL build step, plus an SSE /__livereload
// endpoint + dev-only injected reload snippet. Keep non-dev bytes identical. See
// docs/research/1027-fast-showcase-dev-loop.md for the full recommendation.
function parseArgs(argv) {
  const opts = { port: 8080, root: path.join('docs', 'site') };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port' || a === '-p') opts.port = parseInt(argv[++i], 10);
    else if (a === '--root') opts.root = argv[++i];
    else if (a === '--help' || a === '-h') opts.help = true;
    else { console.error(`serve-site: unknown argument "${a}"`); process.exit(2); }
  }
  if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65535) {
    console.error(`serve-site: invalid --port`); process.exit(2);
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
if (opts.help) {
  console.log('Usage: node scripts/serve-site.js [--port N] [--root DIR]');
  process.exit(0);
}

// Resolve and confine all requests under the served root to block path-traversal.
const SERVE_ROOT = path.resolve(ROOT, opts.root);
if (!fs.existsSync(SERVE_ROOT)) {
  console.error(`serve-site: root not found: ${SERVE_ROOT}\n` +
    '  Run `npm run build` first to generate docs/site.');
  process.exit(1);
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-cache', ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  // Strip query string, decode, then resolve within the served root.
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch (_) {
    return send(res, 400, 'Bad Request');
  }
  let fsPath = path.resolve(SERVE_ROOT, '.' + urlPath);
  // Confinement: resolved path must stay under SERVE_ROOT.
  if (fsPath !== SERVE_ROOT && !fsPath.startsWith(SERVE_ROOT + path.sep)) {
    return send(res, 403, 'Forbidden');
  }

  fs.stat(fsPath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      fsPath = path.join(fsPath, 'index.html');
    }
    fs.readFile(fsPath, (err2, data) => {
      if (err2) {
        return send(res, 404, `Not Found: ${urlPath}`,
          { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      const type = MIME[path.extname(fsPath).toLowerCase()] ||
        'application/octet-stream';
      send(res, 200, data, { 'Content-Type': type });
    });
  });
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`serve-site: port ${opts.port} is already in use. ` +
      `Try: npm run serve:site -- --port ${opts.port + 1}`);
    process.exit(1);
  }
  throw e;
});

server.listen(opts.port, () => {
  const rel = path.relative(ROOT, SERVE_ROOT) || '.';
  console.log(`serve-site: serving ${rel} at http://localhost:${opts.port}`);
  console.log(`  showcase:  http://localhost:${opts.port}/showcase/`);
  console.log('  Ctrl-C to stop. See docs/showcase-local-dev.md for the checklist.');
});
