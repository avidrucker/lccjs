#!/usr/bin/env node
// Build script: generates docs/highlight/index.html with Shiki-highlighted LCC samples.
// Run via: npm run build:highlight
// Grammar: docs/lcc.tmLanguage.json (stable path, Shiki-ready)
// All themes pre-generated at build time; a JS switcher toggles visibility (no CDN at runtime).

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GRAMMAR_PATH = path.join(ROOT, 'docs', 'lcc.tmLanguage.json');
const OUT_DIR = path.join(ROOT, 'docs', 'highlight');
const OUT_FILE = path.join(OUT_DIR, 'index.html');

const THEMES = [
  { id: 'github-dark',     label: 'GitHub Dark',     dark: true  },
  { id: 'github-light',    label: 'GitHub Light',    dark: false },
  { id: 'monokai',         label: 'Monokai',         dark: true  },
  { id: 'one-dark-pro',    label: 'One Dark Pro',    dark: true  },
  { id: 'dracula',         label: 'Dracula',         dark: true  },
  { id: 'nord',            label: 'Nord',            dark: true  },
  { id: 'tokyo-night',     label: 'Tokyo Night',     dark: true  },
  { id: 'solarized-light', label: 'Solarized Light', dark: false },
];
const DEFAULT_THEME = 'github-dark';

const SAMPLES = [
  { file: 'demos/demoA.a',               label: 'demos/demoA.a',               title: 'Hello register — mov, dout, halt' },
  { file: 'demos/demoO.a',               label: 'demos/demoO.a',               title: 'I/O with labels and directives' },
  { file: 'demos/demoN.a',               label: 'demos/demoN.a',               title: 'Division-by-zero trap' },
  { file: 'plusdemos/charTypewriter.ap', label: 'plusdemos/charTypewriter.ap', title: 'LCC+ — clear, sleep, aout loop' },
];

const DARK_IDS = THEMES.filter(t => t.dark).map(t => t.id);

const CSS = `
body.dark  { --bg:#0d1117; --fg:#e6edf3; --muted:#8b949e; --border:#30363d; }
body.light { --bg:#f6f8fa; --fg:#24292e; --muted:#57606a; --border:#d0d7de; }
*,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
body {
  background:var(--bg); color:var(--fg);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  max-width:860px; margin:0 auto; padding:2.5rem 1.25rem;
  line-height:1.5;
}
h1 { font-size:1.5rem; margin-bottom:.3rem; }
.subtitle { color:var(--muted); font-size:.9rem; margin-bottom:1.75rem; }
.subtitle a, footer a { color:#58a6ff; text-decoration:none; }
.subtitle a:hover, footer a:hover { text-decoration:underline; }
.theme-toolbar {
  display:flex; align-items:center; gap:.6rem; margin-bottom:2.25rem;
  padding:.6rem .9rem; background:var(--border); border-radius:6px;
}
.theme-toolbar label { color:var(--muted); font-size:.85rem; white-space:nowrap; }
.theme-toolbar select {
  background:var(--bg); color:var(--fg); border:1px solid var(--muted);
  border-radius:4px; padding:.25rem .5rem; font-size:.85rem; cursor:pointer;
}
section { margin:2rem 0; }
.sample-header { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:.5rem; }
.filename { font-family:monospace; font-size:.9rem; color:var(--fg); }
.description { font-size:.8rem; color:var(--muted); }
pre.shiki { border-radius:6px; padding:1.1rem 1.25rem; overflow-x:auto; font-size:.85rem; line-height:1.6; }
footer { margin-top:3.5rem; font-size:.8rem; color:var(--muted); border-top:1px solid var(--border); padding-top:1rem; }
code { font-family:monospace; }
`;

const JS = `
(function () {
  var DARK = new Set(${JSON.stringify(DARK_IDS)});
  var sel = document.getElementById('theme-select');
  function apply(t) {
    document.querySelectorAll('.theme-panel').forEach(function (p) {
      p.hidden = p.dataset.theme !== t;
    });
    document.body.className = DARK.has(t) ? 'dark' : 'light';
  }
  sel.addEventListener('change', function () { apply(sel.value); });
  apply(sel.value);
}());
`;

const themeOptions = THEMES.map(({ id, label }) =>
  `    <option value="${id}"${id === DEFAULT_THEME ? ' selected' : ''}>${label}</option>`
).join('\n');

(async () => {
  const { createHighlighter } = await import('shiki');

  const grammar = JSON.parse(fs.readFileSync(GRAMMAR_PATH, 'utf8'));
  const themeIds = THEMES.map(t => t.id);
  const hl = await createHighlighter({ themes: themeIds, langs: [grammar] });

  const sections = SAMPLES.map(({ file, label, title }) => {
    const code = fs.readFileSync(path.join(ROOT, file), 'utf8').trimEnd();
    const panels = THEMES.map(({ id }) => {
      const html = hl.codeToHtml(code, { lang: 'lcc', theme: id });
      const hidden = id !== DEFAULT_THEME ? ' hidden' : '';
      return `    <div class="theme-panel" data-theme="${id}"${hidden}>\n      ${html}\n    </div>`;
    }).join('\n');
    return `
  <section>
    <div class="sample-header">
      <span class="filename">${label}</span>
      <span class="description">${title}</span>
    </div>
${panels}
  </section>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>LCC Assembly — Syntax Highlighting</title>
  <style>${CSS}</style>
</head>
<body class="dark">
  <h1>LCC Assembly — Syntax Highlighting</h1>
  <p class="subtitle">
    Four curated samples highlighted with the custom TextMate grammar
    (<a href="../lcc.tmLanguage.json"><code>docs/lcc.tmLanguage.json</code></a>)
    via <a href="https://shiki.style">Shiki</a>.
    Grammar covers core LCC and LCC+ instruction sets.
  </p>
  <div class="theme-toolbar">
    <label for="theme-select">Theme:</label>
    <select id="theme-select">
${themeOptions}
    </select>
  </div>
${sections}
  <footer>
    Built by <code>npm run build:highlight</code> &mdash;
    <a href="https://github.com/avidrucker/lccjs">avidrucker/lccjs</a>
  </footer>
  <script>${JS}</script>
</body>
</html>
`;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, html);
  console.log(`build:highlight — wrote ${path.relative(ROOT, OUT_FILE)} (${THEMES.length} themes × ${SAMPLES.length} samples)`);
})();
