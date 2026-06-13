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
 *
 *   npm run dev:site       # --dev: watch sources, auto-rebuild, live-reload (#1028)
 *
 * Dev mode (#1028, approach decided in #1027): a source change runs the MINIMAL
 * build step and the open browser tab reloads itself over SSE. It still serves
 * the BUILT docs/site (never a source-importing page) so what you see stays
 * byte-identical to deploy — the dev-only reload <script> is injected into HTML
 * responses ONLY under --dev, so the plain `serve:site` page is identical to the
 * Pages artifact. `serve:site` + docs/showcase-local-dev.md remains the
 * authoritative pre-deploy check, run against the plain (non-dev) page.
 */

'use strict';

const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const { spawn } = require('child_process');

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

function parseArgs(argv) {
  const opts = { port: 8080, root: path.join('docs', 'site'), dev: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port' || a === '-p') opts.port = parseInt(argv[++i], 10);
    else if (a === '--root') opts.root = argv[++i];
    else if (a === '--dev' || a === '--watch') opts.dev = true;
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
  console.log('Usage: node scripts/serve-site.js [--port N] [--root DIR] [--dev]');
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

// ──────────────────────────────────────────────────────────────────────────────
// Dev mode (#1028): watch sources → minimal rebuild → live-reload over SSE.
// Everything below is inert unless --dev is passed.
// ──────────────────────────────────────────────────────────────────────────────

const LIVERELOAD_PATH = '/__livereload';

// Dev-only reload client. Injected into HTML responses ONLY under --dev, so the
// plain serve:site page stays byte-identical to the deployed Pages artifact.
const DEV_SNIPPET =
  '\n<script>/* dev live-reload (#1028) — injected only under --dev */\n' +
  '(function(){try{var es=new EventSource(' + JSON.stringify(LIVERELOAD_PATH) + ');' +
  'es.addEventListener("reload",function(){location.reload();});}catch(e){}})();\n' +
  '</script>\n';

// Open SSE connections; each gets a "reload" event after a successful rebuild.
const liveClients = new Set();
function broadcastReload() {
  for (const c of liveClients) {
    try { c.write('event: reload\ndata: 1\n\n'); } catch (_) { /* client gone */ }
  }
}
function handleLiveReload(req, res) {
  res.writeHead(200, {
    'Content-Type':  'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
  });
  res.write('retry: 1000\n\n');
  liveClients.add(res);
  req.on('close', () => liveClients.delete(res));
}
function injectReloadSnippet(fsPath, data) {
  if (!opts.dev || path.extname(fsPath).toLowerCase() !== '.html') return data;
  let html = data.toString('utf8');
  const idx = html.lastIndexOf('</body>');
  return idx !== -1 ? html.slice(0, idx) + DEV_SNIPPET + html.slice(idx)
                    : html + DEV_SNIPPET;
}

// The minimal build steps, run as child processes (Node built-ins only).
// build:browser writes dist/lcc.bundle.js + dist/lcc-injector.js (NOT watched);
// build:site writes docs/site/** (NOT watched) — so a rebuild never re-triggers
// the watcher, i.e. no feedback loop.
const BUILD = {
  site:    [process.execPath, [path.join(ROOT, 'scripts', 'build-site.js')]],
  browser: [process.execPath, [path.join(ROOT, 'node_modules', 'webpack', 'bin', 'webpack.js'),
                               '--config', path.join(ROOT, 'webpack.browser.config.js')]],
};
function runStep(name) {
  const [cmd, args] = BUILD[name];
  console.log(`dev:site — build:${name} …`);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`build:${name} exited ${code}`)));
  });
}

// Map a set of changed absolute paths to the minimal steps needed. Adapted from
// the #1027 plan for the post-#1075 layout: the hand-maintained CDN language
// support lives at src/lang-lcc/lang-lcc.cdn.js (#1176) and is COPIED into
// docs/site by build:site, so a change to it needs build:site, not "reload only".
// Other files under src/lang-lcc/ are the Lezer grammar/parser — editing those
// does NOT auto-propagate into the CDN file (manual port), so they only warn.
function classifyChanges(paths) {
  const srcBrowser = path.join(ROOT, 'src', 'browser') + path.sep;
  const srcLang    = path.join(ROOT, 'src', 'lang-lcc') + path.sep;
  const buildSite  = path.join(ROOT, 'scripts', 'build-site.js');
  const cdnLang    = path.join(ROOT, 'src', 'lang-lcc', 'lang-lcc.cdn.js');
  const plan = { browser: false, site: false, langReminder: false };
  for (const p of paths) {
    if (p.startsWith(srcBrowser))   { plan.browser = true; plan.site = true; }
    else if (p === buildSite)       { plan.site = true; }
    else if (p === cdnLang)         { plan.site = true; }
    else if (p.startsWith(srcLang)) { plan.langReminder = true; }
  }
  return plan;
}

const pending = new Set();
let flushTimer = null;
let building = false;
function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushChanges, 150); // debounce editor multi-event bursts
}
function flushChanges() {
  flushTimer = null;
  if (building || pending.size === 0) return; // post-build finally re-schedules
  const paths = [...pending];
  pending.clear();
  const plan = classifyChanges(paths);
  if (!plan.browser && !plan.site) {
    if (plan.langReminder) {
      console.log('dev:site — src/lang-lcc/ grammar changed, but the browser parser ' +
        '(src/lang-lcc/lang-lcc.cdn.js) is a MANUAL port today (#1075). Re-port by ' +
        'hand, then save lang-lcc.cdn.js to rebuild + reload.');
    }
    return;
  }
  building = true;
  (async () => { if (plan.browser) await runStep('browser'); if (plan.site) await runStep('site'); })()
    .then(() => { broadcastReload(); console.log('dev:site — rebuilt → reloaded.'); })
    .catch((e) => console.error('dev:site — rebuild FAILED (page not reloaded):', e.message))
    .finally(() => { building = false; if (pending.size) scheduleFlush(); });
}
function startWatchers() {
  const targets = [
    path.join(ROOT, 'scripts', 'build-site.js'),
    path.join(ROOT, 'src', 'browser'),
    path.join(ROOT, 'src', 'lang-lcc'),   // includes the hand-maintained lang-lcc.cdn.js (#1176)
  ];
  for (const t of targets) {
    if (!fs.existsSync(t)) {
      console.warn(`dev:site — watch target missing (skipped): ${path.relative(ROOT, t)}`);
      continue;
    }
    const isDir = fs.statSync(t).isDirectory();
    try {
      fs.watch(t, (_evt, filename) => {
        onChange(isDir && filename ? path.join(t, filename) : t);
      });
    } catch (e) {
      console.warn(`dev:site — cannot watch ${path.relative(ROOT, t)}: ${e.message}`);
    }
  }
}
function onChange(absPath) {
  pending.add(absPath);
  scheduleFlush();
}

const server = http.createServer((req, res) => {
  // Strip query string, decode, then resolve within the served root.
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch (_) {
    return send(res, 400, 'Bad Request');
  }
  if (opts.dev && urlPath === LIVERELOAD_PATH) {
    return handleLiveReload(req, res);
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
      send(res, 200, injectReloadSnippet(fsPath, data), { 'Content-Type': type });
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
  if (opts.dev) {
    startWatchers();
    console.log('  dev mode: watching scripts/build-site.js, src/browser/, ' +
      'src/lang-lcc/ (incl. lang-lcc.cdn.js) → auto-rebuild + live-reload.');
    console.log('  NOTE: dev injects a reload <script>; run the pre-deploy ' +
      'checklist against plain `npm run serve:site` (no --dev).');
  }
  console.log('  Ctrl-C to stop. See docs/showcase-local-dev.md for the checklist.');
});
