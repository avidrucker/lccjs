#!/usr/bin/env node
// Build script: generates docs/site/ — landing page + docs subpages.
// Run via: npm run build:site
// Grammar: docs/lcc.tmLanguage.json (stable path, Shiki-ready)
// All themes pre-generated at build time; a JS switcher toggles visibility (no CDN at runtime).

const fs = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..');
const GRAMMAR_PATH = path.join(ROOT, 'docs', 'lcc.tmLanguage.json');
const OUT_DIR    = path.join(ROOT, 'docs', 'site');

const retroDarkTheme = {
  name: 'retro-console-dark',
  settings: [
    { settings: { background: '#233501', foreground: '#d0cf9d' } },
    { scope: ['comment'],                                          settings: { foreground: '#446710' } },
    { scope: ['keyword', 'keyword.other', 'keyword.control'],     settings: { foreground: '#8d9a4a' } },
    { scope: ['entity.name.label', 'string', 'constant.numeric'], settings: { foreground: '#d0cf9d' } },
  ],
};

const retroLightTheme = {
  name: 'retro-console-light',
  settings: [
    { settings: { background: '#d0cf9d', foreground: '#233501' } },
    { scope: ['comment'],                                          settings: { foreground: '#446710', fontStyle: 'italic' } },
    { scope: ['keyword', 'keyword.other', 'keyword.control'],     settings: { foreground: '#446710', fontStyle: 'bold'   } },
    { scope: ['entity.name.label', 'string', 'constant.numeric'], settings: { foreground: '#233501' } },
  ],
};

const THEMES = [
  { id: 'github-dark',          label: 'GitHub Dark',          dark: true  },
  { id: 'github-light',         label: 'GitHub Light',         dark: false },
  { id: 'monokai',              label: 'Monokai',              dark: true  },
  { id: 'one-dark-pro',         label: 'One Dark Pro',         dark: true  },
  { id: 'dracula',              label: 'Dracula',              dark: true  },
  { id: 'nord',                 label: 'Nord',                 dark: true  },
  { id: 'tokyo-night',          label: 'Tokyo Night',          dark: true  },
  { id: 'solarized-light',      label: 'Solarized Light',      dark: false },
  { id: 'retro-console-dark',   label: 'Retro Console Dark',   dark: true  },
  { id: 'retro-console-light',  label: 'Retro Console Light',  dark: false },
];
const DEFAULT_THEME = 'github-dark';

const CURATED_SAMPLES = [
  { file: 'demos/demoA.a',               label: 'demos/demoA.a',               title: 'Hello register — mov, dout, halt' },
  { file: 'demos/demoO.a',               label: 'demos/demoO.a',               title: 'I/O with labels and directives' },
  { file: 'demos/demoN.a',               label: 'demos/demoN.a',               title: 'Division-by-zero trap' },
  { file: 'plusdemos/charTypewriter.ap', label: 'plusdemos/charTypewriter.ap', title: 'LCC+ — clear, sleep, aout loop' },
];

// Docs subfolders to expose as subpages.
const DOCS_SECTIONS = [
  { id: 'research', label: 'Research',  srcDir: path.join(ROOT, 'docs', 'research')  },
  { id: 'learnings', label: 'Learnings', srcDir: path.join(ROOT, 'docs', 'learnings') },
  { id: 'glossary', label: 'Glossary',  srcDir: path.join(ROOT, 'docs', 'glossary')  },
];

const DARK_IDS = THEMES.filter(t => t.dark).map(t => t.id);

// Shared CSS (inlined per page — avoids relative-path complexity with a multi-depth site).
const CSS = `
@font-face {
  font-family:"UnifontMedium";
  src:url("https://cdn.jsdelivr.net/gh/avidrucker/anki-card-test-1/public/UnifontMedium.woff") format("woff");
}
:root { --mono-font:monospace; }
body.dark  { --bg:#0d1117; --fg:#e6edf3; --muted:#8b949e; --border:#30363d; }
body.light { --bg:#f6f8fa; --fg:#24292e; --muted:#57606a; --border:#d0d7de; }
body.dark.retro  { --bg:#233501; --fg:#d0cf9d; --muted:#446710; --border:#446710; --mono-font:"UnifontMedium",monospace; font-family:"UnifontMedium",monospace; -webkit-font-smoothing:none; }
body.light.retro { --bg:#d0cf9d; --fg:#233501; --muted:#8d9a4a; --border:#8d9a4a; --mono-font:"UnifontMedium",monospace; font-family:"UnifontMedium",monospace; -webkit-font-smoothing:none; }
*,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
body {
  background:var(--bg); color:var(--fg);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  max-width:860px; margin:0 auto; padding:2.5rem 1.25rem;
  line-height:1.5;
}
nav { display:flex; gap:1.25rem; margin-bottom:2rem; padding-bottom:.75rem; border-bottom:1px solid var(--border); flex-wrap:wrap; }
nav a { color:#58a6ff; text-decoration:none; font-size:.9rem; }
nav a:hover { text-decoration:underline; }
nav a.active { color:var(--fg); font-weight:600; pointer-events:none; }
h1 { font-size:1.5rem; margin-bottom:.3rem; }
h2 { font-size:1.2rem; margin:2rem 0 .75rem; }
.subtitle { color:var(--muted); font-size:.9rem; margin-bottom:1.75rem; }
.subtitle a, footer a, .file-list a { color:#58a6ff; text-decoration:none; }
.subtitle a:hover, footer a:hover, .file-list a:hover { text-decoration:underline; }
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
.filename { font-family:var(--mono-font); font-size:.9rem; color:var(--fg); }
.description { font-size:.8rem; color:var(--muted); }
pre.shiki { border-radius:6px; padding:1.1rem 1.25rem; overflow-x:auto; font-size:.85rem; line-height:1.6; font-family:var(--mono-font); }
footer { margin-top:3.5rem; font-size:.8rem; color:var(--muted); border-top:1px solid var(--border); padding-top:1rem; }
code { font-family:var(--mono-font); }
.file-list { list-style:none; margin:.5rem 0 1rem; }
.file-list li { padding:.3rem 0; border-bottom:1px solid var(--border); font-size:.9rem; }
.prose { padding:0; }
.prose h1,.prose h2,.prose h3,.prose h4 { margin:1.5rem 0 .5rem; line-height:1.3; }
.prose h1 { font-size:1.4rem; }
.prose h2 { font-size:1.15rem; }
.prose h3 { font-size:1rem; }
.prose p { margin:.75rem 0; }
.prose ul,.prose ol { margin:.5rem 0 .5rem 1.5rem; }
.prose li { margin:.2rem 0; }
.prose pre { background:var(--border); border-radius:4px; padding:.75rem 1rem; overflow-x:auto; font-size:.82rem; margin:.75rem 0; }
.prose code { background:var(--border); border-radius:3px; padding:.1em .3em; font-size:.88em; }
.prose pre code { background:none; padding:0; }
.prose blockquote { border-left:3px solid var(--muted); padding-left:1rem; color:var(--muted); margin:.75rem 0; }
.prose table { border-collapse:collapse; width:100%; margin:.75rem 0; font-size:.88rem; }
.prose th,.prose td { border:1px solid var(--border); padding:.4rem .6rem; text-align:left; }
.prose th { background:var(--border); }
.prose a { color:#58a6ff; text-decoration:none; }
.prose a:hover { text-decoration:underline; }
.back-link { margin-bottom:1.5rem; font-size:.85rem; }
.back-link a { color:#58a6ff; text-decoration:none; }
.back-link a:hover { text-decoration:underline; }
`;

const JS = `
(function () {
  var DARK = new Set(${JSON.stringify(DARK_IDS)});
  var sel = document.getElementById('theme-select');
  function apply(t) {
    document.querySelectorAll('.theme-panel').forEach(function (p) {
      p.hidden = p.dataset.theme !== t;
    });
    document.body.className = (DARK.has(t) ? 'dark' : 'light') + (t.indexOf('retro-console') === 0 ? ' retro' : '');
  }
  sel.addEventListener('change', function () { apply(sel.value); });
  apply(sel.value);
}());
`;

// Build the <nav> bar. activeId matches a DOCS_SECTIONS id or 'home'.
function buildNav(rootPath, activeId) {
  const home  = `<a href="${rootPath}"${activeId === 'home' ? ' class="active"' : ''}>Home</a>`;
  const links = DOCS_SECTIONS.map(s => {
    const href = `${rootPath}docs/${s.id}/`;
    const cls  = activeId === s.id ? ' class="active"' : '';
    return `<a href="${href}"${cls}>${s.label}</a>`;
  });
  return `<nav>${[home, ...links].join('\n  ')}\n</nav>`;
}

// Render one code snippet as a <section> with per-theme panels.
function renderSnippet(hl, file, label, title) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8').trimEnd();
  const panels = THEMES.map(({ id }) => {
    const html   = hl.codeToHtml(code, { lang: 'lcc', theme: id });
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
}

// Extract a description from line 1 of an assembly file (strips leading '; ').
function demoTitle(filePath) {
  const first = fs.readFileSync(filePath, 'utf8').split('\n')[0] || '';
  return first.startsWith(';') ? first.slice(1).trim() : '';
}

// Wrap content in a full HTML doc (dark body class for landing, light for docs).
function makePage({ title, bodyClass = 'dark', nav, themeToolbar = '', content, footer, script = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>${CSS}</style>
</head>
<body class="${bodyClass}">
${nav}
${themeToolbar}${content}
${footer}${script ? `\n  <script>${script}</script>` : ''}
</body>
</html>
`;
}

(async () => {
  const { createHighlighter } = await import('shiki');
  const { marked }            = await import('marked');

  const grammar  = JSON.parse(fs.readFileSync(GRAMMAR_PATH, 'utf8'));
  const themeIds = THEMES.filter(t => !t.id.startsWith('retro-console')).map(t => t.id);
  const hl = await createHighlighter({ themes: [retroDarkTheme, retroLightTheme, ...themeIds], langs: [grammar] });

  // ── Landing page ─────────────────────────────────────────────────────────────

  const themeOptions = THEMES.map(({ id, label }) =>
    `    <option value="${id}"${id === DEFAULT_THEME ? ' selected' : ''}>${label}</option>`
  ).join('\n');

  const themeToolbar = `  <div class="theme-toolbar">
    <label for="theme-select">Theme:</label>
    <select id="theme-select">
${themeOptions}
    </select>
  </div>
`;

  // 4 curated snippets.
  const curatedSections = CURATED_SAMPLES.map(({ file, label, title }) =>
    renderSnippet(hl, file, label, title)
  ).join('\n');

  // Alphabet demos demoA–demoZ, auto-discovered.
  const demoLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const alphabetSections = demoLetters.map(letter => {
    const rel  = `demos/demo${letter}.a`;
    const file = path.join(ROOT, rel);
    const title = demoTitle(file) || rel;
    return renderSnippet(hl, rel, rel, title);
  }).join('\n');

  const landingContent = `
  <h1>LCC Assembly — Syntax Highlighting</h1>
  <p class="subtitle">
    Curated samples and the full alphabet demo suite, highlighted with the custom TextMate grammar
    (<a href="../lcc.tmLanguage.json"><code>docs/lcc.tmLanguage.json</code></a>)
    via <a href="https://shiki.style">Shiki</a>.
    Grammar covers core LCC and LCC+ instruction sets.
  </p>
${themeToolbar}
  <h2>Curated samples</h2>
${curatedSections}

  <h2>Alphabet demo suite (demoA – demoZ)</h2>
${alphabetSections}
  <footer>
    Built by <code>npm run build:site</code> &mdash;
    <a href="https://github.com/avidrucker/lccjs">avidrucker/lccjs</a>
  </footer>`;

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const landingHtml = makePage({
    title: 'LCC Assembly — Syntax Highlighting',
    bodyClass: 'dark',
    nav: buildNav('./', 'home'),
    content: landingContent,
    footer: '',
    script: JS,
  });
  const landingFile = path.join(OUT_DIR, 'index.html');
  fs.writeFileSync(landingFile, landingHtml);
  console.log(`build:site — landing: ${path.relative(ROOT, landingFile)} (${THEMES.length} themes × ${CURATED_SAMPLES.length + demoLetters.length} samples)`);

  // ── Docs subpages ─────────────────────────────────────────────────────────────

  for (const section of DOCS_SECTIONS) {
    const sectionOut = path.join(OUT_DIR, 'docs', section.id);
    fs.mkdirSync(sectionOut, { recursive: true });

    const mdFiles = fs.readdirSync(section.srcDir)
      .filter(f => f.endsWith('.md'))
      .sort();

    // Render each .md file to its own .html.
    const fileLinks = [];
    for (const mdFile of mdFiles) {
      const mdContent  = fs.readFileSync(path.join(section.srcDir, mdFile), 'utf8');
      const htmlBody   = marked.parse(mdContent);
      const slug       = mdFile.replace(/\.md$/, '');
      const outFile    = path.join(sectionOut, `${slug}.html`);
      const backNav    = `  <div class="back-link"><a href="./">← ${section.label} index</a></div>`;

      const pageHtml = makePage({
        title: `${slug} — LCC Docs`,
        bodyClass: 'light',
        nav: buildNav('../../', section.id),
        content: `${backNav}\n  <div class="prose">\n${htmlBody}\n  </div>`,
        footer: `  <footer>
    <a href="https://github.com/avidrucker/lccjs">avidrucker/lccjs</a>
  </footer>`,
      });
      fs.writeFileSync(outFile, pageHtml);
      fileLinks.push({ href: `./${slug}.html`, label: mdFile });
    }

    // Generate section index.
    const listItems = fileLinks.map(({ href, label }) =>
      `    <li><a href="${href}">${label}</a></li>`
    ).join('\n');

    const indexContent = `
  <h1>${section.label}</h1>
  <p class="subtitle">${mdFiles.length} document${mdFiles.length !== 1 ? 's' : ''} from <code>docs/${section.id}/</code></p>
  <ul class="file-list">
${listItems}
  </ul>`;

    const indexHtml = makePage({
      title: `${section.label} — LCC Docs`,
      bodyClass: 'light',
      nav: buildNav('../../', section.id),
      content: indexContent,
      footer: `  <footer>
    <a href="https://github.com/avidrucker/lccjs">avidrucker/lccjs</a>
  </footer>`,
    });
    const indexFile = path.join(sectionOut, 'index.html');
    fs.writeFileSync(indexFile, indexHtml);
    console.log(`build:site — ${section.id}: ${path.relative(ROOT, indexFile)} + ${mdFiles.length} pages`);
  }

  console.log('build:site — done.');
})();
