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

// Browser-side CDN import for the playground/showcase. Must stay aligned with the @cmshiki/shiki
// peer dep (shiki@^3). Separate from the npm "shiki" dep below, which is a Node.js-only build
// tool used for static site code block rendering and can diverge from this version.
const SHIKI_CDN_URL = 'https://esm.sh/shiki@3';

const retroDarkTheme = {
  name: 'retro-console-dark',
  settings: [
    { settings: { background: '#233501', foreground: '#d0cf9d' } },
    { scope: ['comment'],                                          settings: { foreground: '#446710' } },
    { scope: ['keyword', 'keyword.other', 'keyword.control'],     settings: { foreground: '#8d9a4a' } },
    { scope: ['storage.type.directive'],                           settings: { foreground: '#c8a35d' } },
    { scope: ['entity.name.label', 'string', 'constant.numeric'], settings: { foreground: '#d0cf9d' } },
  ],
};

const retroLightTheme = {
  name: 'retro-console-light',
  settings: [
    { settings: { background: '#d0cf9d', foreground: '#233501' } },
    { scope: ['comment'],                                          settings: { foreground: '#446710', fontStyle: 'italic' } },
    { scope: ['keyword', 'keyword.other', 'keyword.control'],     settings: { foreground: '#446710', fontStyle: 'bold'   } },
    { scope: ['storage.type.directive'],                           settings: { foreground: '#7d4a00' } },
    { scope: ['entity.name.label', 'string', 'constant.numeric'], settings: { foreground: '#233501' } },
  ],
};

const zenburnTheme = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'docs', 'themes', 'zenburn.json'), 'utf8')
);

const THEMES = [
  { id: 'github-dark',          label: 'GitHub Dark',          dark: true  },
  { id: 'github-light',         label: 'GitHub Light',         dark: false },
  { id: 'monokai',              label: 'Monokai',              dark: true  },
  { id: 'one-dark-pro',         label: 'One Dark Pro',         dark: true  },
  { id: 'dracula',              label: 'Dracula',              dark: true  },
  { id: 'nord',                 label: 'Nord',                 dark: true  },
  { id: 'tokyo-night',          label: 'Tokyo Night',          dark: true  },
  { id: 'solarized-light',      label: 'Solarized Light',      dark: false },
  { id: 'zenburn',              label: 'Zenburn',              dark: true  },
  { id: 'retro-console-dark',   label: 'Retro Console Dark',   dark: true  },
  { id: 'retro-console-light',  label: 'Retro Console Light',  dark: false },
];
const DEFAULT_THEME = 'github-dark';
const DOCS_CODE_THEME = 'github-light';

const CURATED_SAMPLES = [
  { file: 'demos/helloWorld.a', label: 'demos/helloWorld.a', title: 'Hello, World! — lea, sout, halt' },
];

const LCCPLUS_SAMPLES = [
  { file: 'plusdemos/charTypewriter.ap', label: 'plusdemos/charTypewriter.ap', title: 'LCC+ — clear, sleep, aout loop' },
];

// Docs sections to expose as subpages.
// Use srcDir for folder-based sections; use files[] for explicit per-file lists.
const DOCS_SECTIONS = [
  { id: 'guides',    label: 'Guides',    srcDir: path.join(ROOT, 'docs', 'guides')    },
  { id: 'research',  label: 'Research',  srcDir: path.join(ROOT, 'docs', 'research')  },
  { id: 'learnings', label: 'Learnings', srcDir: path.join(ROOT, 'docs', 'learnings') },
  { id: 'glossary',  label: 'Glossary',  srcDir: path.join(ROOT, 'docs', 'glossary')  },
  { id: 'parity',    label: 'Parity',    files: [
    path.join(ROOT, 'docs', 'parity_deviations.md'),
    path.join(ROOT, 'docs', 'cuh63-nocomma-negative-operand-family-bug-report.md'),
    path.join(ROOT, 'docs', 'cuh63-ldr-str-silent-miscompile-bug-report.md'),
    path.join(ROOT, 'docs', 'cuh63-mov-immediate-bug-report.md'),
    path.join(ROOT, 'docs', 'cuh63-line-length-silent-split-bug-report.md'),
    path.join(ROOT, 'docs', 'cuh63-o-assemble-exit-code-bug-report.md'),
  ]},
  { id: 'workflow',  label: 'Workflow',  files: [
    path.join(ROOT, 'docs', 'claude_workflow.md'),
    path.join(ROOT, 'RULES.md'),
  ]},
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

// Build the <nav> bar. activeId matches a DOCS_SECTIONS id, 'home', or 'showcase'.
function buildNav(rootPath, activeId) {
  const home  = `<a href="${rootPath}"${activeId === 'home' ? ' class="active"' : ''}>Home</a>`;
  const links = DOCS_SECTIONS.map(s => {
    const href = `${rootPath}docs/${s.id}/`;
    const cls  = activeId === s.id ? ' class="active"' : '';
    return `<a href="${href}"${cls}>${s.label}</a>`;
  });
  const playgroundCls = activeId === 'showcase' ? ' class="active"' : '';
  const playground = `<a href="${rootPath}showcase/"${playgroundCls}>Playground</a>`;
  return `<nav>${[home, ...links, playground].join('\n  ')}\n</nav>`;
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
function makePage({ title, bodyClass = 'dark', nav, themeToolbar = '', content, footer, script = '', extraCss = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>${CSS}${extraCss}</style>
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
  const themeIds = THEMES.filter(t => !t.id.startsWith('retro-console') && t.id !== 'zenburn').map(t => t.id);
  const hl = await createHighlighter({ themes: [retroDarkTheme, retroLightTheme, zenburnTheme, ...themeIds], langs: [grammar] });

  // Shiki-highlight ```lcc fenced blocks in docs .md files processed by marked.
  marked.use({
    renderer: {
      code(token) {
        if (token.lang === 'lcc') {
          return hl.codeToHtml(token.text, { lang: 'lcc', theme: DOCS_CODE_THEME });
        }
        return false;
      },
    },
  });

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

  const curatedSections = CURATED_SAMPLES.map(({ file, label, title }) =>
    renderSnippet(hl, file, label, title)
  ).join('\n');

  const lccplusSections = LCCPLUS_SAMPLES.map(({ file, label, title }) =>
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

  <h2>LCC+ demos</h2>
${lccplusSections}
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
  console.log(`build:site — landing: ${path.relative(ROOT, landingFile)} (${THEMES.length} themes × ${CURATED_SAMPLES.length + demoLetters.length + LCCPLUS_SAMPLES.length} samples)`);

  // ── Docs subpages ─────────────────────────────────────────────────────────────

  for (const section of DOCS_SECTIONS) {
    const sectionOut = path.join(OUT_DIR, 'docs', section.id);
    fs.mkdirSync(sectionOut, { recursive: true });

    const mdEntries = section.files
      ? section.files.map(fp => ({ fullPath: fp, mdFile: path.basename(fp) }))
      : fs.readdirSync(section.srcDir).filter(f => f.endsWith('.md')).sort()
          .map(f => ({ fullPath: path.join(section.srcDir, f), mdFile: f }));

    // Render each .md file to its own .html.
    const fileLinks = [];
    for (const { fullPath, mdFile } of mdEntries) {
      const mdContent  = fs.readFileSync(fullPath, 'utf8');
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
  <p class="subtitle">${mdEntries.length} document${mdEntries.length !== 1 ? 's' : ''}${section.srcDir ? ` from <code>docs/${section.id}/</code>` : ''}</p>
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
    console.log(`build:site — ${section.id}: ${path.relative(ROOT, indexFile)} + ${mdEntries.length} pages`);
  }

  // ── Playground page ──────────────────────────────────────────────────────────

  // Copy grammar to site root so the playground page can fetch it at ../lcc.tmLanguage.json.
  fs.copyFileSync(GRAMMAR_PATH, path.join(OUT_DIR, 'lcc.tmLanguage.json'));

  // Copy the browser bundle into docs/site/dist/ so that showcase/index.html's
  // <script src="../dist/lcc.bundle.js"> resolves correctly on file://, local HTTP,
  // and GitHub Pages (where docs/site/ is the pages root).
  const BUNDLE_SRC  = path.join(ROOT, 'dist', 'lcc.bundle.js');
  const BUNDLE_DEST = path.join(OUT_DIR, 'dist', 'lcc.bundle.js');
  if (fs.existsSync(BUNDLE_SRC)) {
    fs.mkdirSync(path.dirname(BUNDLE_DEST), { recursive: true });
    fs.copyFileSync(BUNDLE_SRC, BUNDLE_DEST);
    console.log(`build:site — bundle:  ${path.relative(ROOT, BUNDLE_DEST)}`);
  } else {
    console.warn('build:site — WARNING: dist/lcc.bundle.js not found; run `npm run build:browser` first');
  }

  const playgroundThemeOptions = THEMES.map(({ id, label }) =>
    `      <option value="${id}"${id === DEFAULT_THEME ? ' selected' : ''}>${label}</option>`
  ).join('\n');

  // Serialize custom themes so the runtime script can pass them to createHighlighter.
  const customThemesJson = JSON.stringify([retroDarkTheme, retroLightTheme, zenburnTheme]);
  const builtinThemeIds  = JSON.stringify(
    THEMES.filter(t => !t.id.startsWith('retro-console') && t.id !== 'zenburn').map(t => t.id)
  );
  const darkIdsJson = JSON.stringify(DARK_IDS);

  const starterCode = fs.readFileSync(path.join(ROOT, 'demos', 'helloWorld.a'), 'utf8').trimEnd();
  const starterCodeJson = JSON.stringify(starterCode);

  const playgroundScript = `
<style>
#run-btn { background:var(--fg);color:var(--bg);border:none;border-radius:4px;padding:.4rem 1.1rem;font-size:.9rem;cursor:pointer;font-weight:600; }
#run-btn:hover { opacity:.85; }
#stop-btn { background:#c0392b;color:#fff;border:none;border-radius:4px;padding:.4rem 1.1rem;font-size:.9rem;cursor:pointer;font-weight:600;display:none; }
#stop-btn:hover { opacity:.85; }
.run-bar { display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem; }
#exec-output { min-height:300px;border-radius:6px;padding:1.1rem 1.25rem;overflow:auto;font-size:.85rem;line-height:1.6;font-family:var(--mono-font);background:#0a0a0a;color:#4af626;white-space:pre-wrap;word-break:break-word;margin:0; }
#exec-output.lcc-error { color:#ff5555; }
.panel-label { font-size:.8rem;color:var(--muted);margin-bottom:.4rem; }
#stdin-prompt-submit { background:var(--fg);color:var(--bg);border:none;border-radius:4px;padding:.35rem .9rem;font-size:.85rem;cursor:pointer;font-weight:600; }
#stdin-prompt-submit:hover { opacity:.85; }
</style>
<script src="../dist/lcc.bundle.js"></script>
<script type="module">
// The codemirror@6 umbrella re-exports EditorView etc. from @codemirror/*
// subpackages; esm.sh cannot surface those re-exports regardless of ?bundle.
// Fix: import each symbol from its source package, pinning them all to the same
// @codemirror/state@6 instance via ?deps= so instanceof checks work. (#772)
import { EditorView, keymap, lineNumbers } from 'https://esm.sh/@codemirror/view@6?deps=@codemirror/state@6';
import { basicSetup } from 'https://esm.sh/@codemirror/basic-setup@0.20?deps=@codemirror/state@6';
import { indentWithTab, toggleLineComment } from 'https://esm.sh/@codemirror/commands@6?deps=@codemirror/state@6';
import { autocompletion } from 'https://esm.sh/@codemirror/autocomplete@6?deps=@codemirror/state@6';
// language@6 must pin @lezer/highlight@1 in ?deps= so defaultHighlightStyle's tags
// share identity with lang-lcc.js's styleTags — otherwise zero highlight spans. (#986)
import { syntaxHighlighting, defaultHighlightStyle } from 'https://esm.sh/@codemirror/language@6?deps=@codemirror/state@6,@lezer/highlight@1';
import { lcc } from '../dist/lang-lcc.js';

const LCC_COMPLETIONS = [
  { label: 'r0', type: 'variable', detail: 'general-purpose' },
  { label: 'r1', type: 'variable', detail: 'general-purpose' },
  { label: 'r2', type: 'variable', detail: 'general-purpose' },
  { label: 'r3', type: 'variable', detail: 'general-purpose' },
  { label: 'r4', type: 'variable', detail: 'general-purpose' },
  { label: 'r5', type: 'variable', detail: 'fp (frame pointer)' },
  { label: 'r6', type: 'variable', detail: 'sp (stack pointer)' },
  { label: 'r7', type: 'variable', detail: 'ra / lr (return address)' },
  { label: 'fp', type: 'variable', detail: '= r5 (frame pointer)' },
  { label: 'sp', type: 'variable', detail: '= r6 (stack pointer)' },
  { label: 'ra', type: 'variable', detail: '= r7 (return address)' },
  { label: 'lr', type: 'variable', detail: '= r7 (link register)' },
  { label: 'add',  type: 'keyword', detail: 'rd, rs1, rs2' },
  { label: 'sub',  type: 'keyword', detail: 'rd, rs1, rs2' },
  { label: 'and',  type: 'keyword', detail: 'rd, rs1, rs2' },
  { label: 'not',  type: 'keyword', detail: 'rd, rs' },
  { label: 'ldr',  type: 'keyword', detail: 'rd, rs, offset' },
  { label: 'str',  type: 'keyword', detail: 'rs, rd, offset' },
  { label: 'mov',  type: 'keyword', detail: 'rd, rs  |  rd, imm' },
  { label: 'mvi',  type: 'keyword', detail: 'rd, imm' },
  { label: 'lea',  type: 'keyword', detail: 'rd, label' },
  { label: 'br',   type: 'keyword', detail: 'label (unconditional)' },
  { label: 'brz',  type: 'keyword', detail: 'label (if zero)' },
  { label: 'brn',  type: 'keyword', detail: 'label (if negative)' },
  { label: 'brp',  type: 'keyword', detail: 'label (if positive)' },
  { label: 'brnz', type: 'keyword', detail: 'label (if negative or zero)' },
  { label: 'brnp', type: 'keyword', detail: 'label (if nonzero)' },
  { label: 'brzp', type: 'keyword', detail: 'label (if nonnegative)' },
  { label: 'jmp',  type: 'keyword', detail: 'rs (jump register)' },
  { label: 'bl',   type: 'keyword', detail: 'label (branch with link)' },
  { label: 'halt', type: 'keyword', detail: 'stop execution' },
  { label: 'dout', type: 'keyword', detail: 'rs (decimal output)' },
  { label: 'din',  type: 'keyword', detail: 'rd (decimal input)' },
  { label: 'hout', type: 'keyword', detail: 'rs (hex output)' },
  { label: 'hin',  type: 'keyword', detail: 'rd (hex input)' },
  { label: 'aout', type: 'keyword', detail: 'rs (ASCII char output)' },
  { label: 'ain',  type: 'keyword', detail: 'rd (ASCII char input)' },
  { label: 'sout', type: 'keyword', detail: 'rs (string output)' },
  { label: 'sin',  type: 'keyword', detail: 'rd (string input)' },
  { label: 'nl',   type: 'keyword', detail: 'output newline' },
  { label: 'bp',   type: 'keyword', detail: 'software breakpoint' },
];
const LCC_DIRECTIVES = [
  { label: '.word',    type: 'type', detail: 'value' },
  { label: '.string',  type: 'type', detail: '"text"' },
  { label: '.blkw',   type: 'type', detail: 'n (reserve n words)' },
  { label: '.org',    type: 'type', detail: 'addr (set location counter)' },
  { label: '.global', type: 'type', detail: 'label (export symbol)' },
  { label: '.extern', type: 'type', detail: 'label (import symbol)' },
  { label: '.lccplus', type: 'type', detail: 'enable LCC+ extensions' },
  { label: '.end',    type: 'type', detail: 'end of source' },
];
function lccCompletionSource(context) {
  const line = context.state.doc.lineAt(context.pos);
  const prefix = line.text.slice(0, context.pos - line.from);
  let inStr = false;
  for (let i = 0; i < prefix.length; i++) {
    const c = prefix[i];
    if (inStr) { if (c === '"') inStr = false; }
    else if (c === '"') { inStr = true; }
    else if (c === ';') return null;
  }
  if (inStr) return null;
  const word = context.matchBefore(/\\.\\w*|\\w+/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  const options = word.text.startsWith('.') ? LCC_DIRECTIVES : LCC_COMPLETIONS;
  return { from: word.from, options };
}

const CUSTOM_THEMES  = ${customThemesJson};
const BUILTIN_THEMES = ${builtinThemeIds};
const DARK           = new Set(${darkIdsJson});

const sel        = document.getElementById('theme-select');
const stdinInput = document.getElementById('stdin-input');

let debounce;
let renderFn = null;

const editor = new EditorView({
  doc: ${starterCodeJson},
  extensions: [
    basicSetup,
    lineNumbers(), // basicSetup@0.20's gutter is inert under the @6 view; add an explicit @6 gutter (#1024, mirrors #985)
    lcc(),
    syntaxHighlighting(defaultHighlightStyle),
    keymap.of([indentWithTab, { key: 'Mod-/', run: toggleLineComment }]),
    autocompletion({ override: [lccCompletionSource] }),
    EditorView.updateListener.of(function(update) {
      if (update.docChanged && renderFn) {
        clearTimeout(debounce);
        debounce = setTimeout(renderFn, 150);
      }
    }),
    EditorView.theme({
      '&': { height: '100%', fontSize: '.85rem' },
      '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--mono-font)' },
      '.cm-content': { background: 'var(--border)', color: 'var(--fg)', caretColor: 'var(--fg)' },
      '.cm-gutters': { background: 'var(--border)', borderRight: '1px solid var(--muted)', color: 'var(--muted)' },
      '.cm-activeLineGutter': { background: 'rgba(128,128,128,0.1)' },
      '&.cm-focused': { outline: 'none' },
    }),
  ],
  parent: document.getElementById('editor'),
});
// Test hook: Playwright e2e suite uses this to set editor content without
// depending on CM6 internals or a defunct #playground-input element.
window.__lccSetSource = function(src) {
  editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: src } });
};
const output            = document.getElementById('playground-output');
const runStatus         = document.getElementById('playground-status');
const shikiStatus       = document.getElementById('shiki-status');
const runBtn            = document.getElementById('run-btn');
const stopBtn           = document.getElementById('stop-btn');
const execOut           = document.getElementById('exec-output');
const stdinPrompt       = document.getElementById('stdin-prompt');
const stdinPromptLabel  = document.getElementById('stdin-prompt-label');
const stdinPromptInput  = document.getElementById('stdin-prompt-input');
const stdinPromptSubmit = document.getElementById('stdin-prompt-submit');

const TRAP_LABELS = { din: 'decimal integer', hin: 'hex integer', ain: 'integer', sin: 'string' };

function showPrompt(trapType, onSubmit) {
  const kind = TRAP_LABELS[trapType] || 'input';
  stdinPromptLabel.textContent = \`Program is waiting for \${kind} input (\\\`\${trapType}\\\`):\`;
  stdinPromptInput.value = '';
  stdinPrompt.style.display = '';
  stdinPromptInput.focus();
  function submit() {
    hidePrompt();
    onSubmit(stdinPromptInput.value);
  }
  stdinPromptSubmit.onclick = submit;
  stdinPromptInput.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); submit(); } };
}

function hidePrompt() {
  stdinPrompt.style.display = 'none';
  stdinPromptSubmit.onclick = null;
  stdinPromptInput.onkeydown = null;
}

function applyBodyClass(themeId) {
  document.body.className = (DARK.has(themeId) ? 'dark' : 'light') +
    (themeId.startsWith('retro-console') ? ' retro' : '');
}

let currentWorker = null;

function setRunning(active) {
  runBtn.style.display  = active ? 'none' : '';
  stopBtn.style.display = active ? 'inline-block' : 'none';
}

function finishRun() {
  currentWorker = null;
  setRunning(false);
  hidePrompt();
}

function displayWithSeparator(fullOutput, preResumeLen) {
  if (!preResumeLen || !fullOutput || fullOutput.length <= preResumeLen) {
    return fullOutput || '(no output)';
  }
  const pre = fullOutput.slice(0, preResumeLen);
  const post = fullOutput.slice(preResumeLen);
  return (pre.endsWith('\\n') ? pre : pre + '\\n') + post;
}

stopBtn.addEventListener('click', () => {
  if (currentWorker) {
    currentWorker.terminate();
    finishRun();
    execOut.classList.add('lcc-error');
    execOut.textContent += '\\n(stopped by user)';
    runStatus.textContent = 'stopped';
  }
});

runBtn.addEventListener('click', () => {
  runStatus.textContent = '';
  execOut.classList.remove('lcc-error');
  execOut.textContent = 'Running…';

  let worker;
  try {
    worker = new Worker('./lcc-worker.js');
  } catch (_) {
    const api = window.lcc;
    if (!api || typeof api.assemble !== 'function') {
      execOut.textContent = '(lcc.bundle.js not loaded — execution unavailable)';
      return;
    }
    const src = editor.state.doc.toString();
    const stdinLines = stdinInput.value.trim() ? stdinInput.value.split('\\n') : [];
    const asmResult = api.assemble(src);
    if (!asmResult.ok) {
      execOut.classList.add('lcc-error');
      execOut.textContent = 'Assembly error:\\n' + asmResult.errors;
      return;
    }
    (function handleFallback(result) {
      execOut.classList.remove('lcc-error');
      if (result.status === 'waiting-for-input') {
        execOut.textContent = result.partialOutput || '';
        showPrompt(result.trapType, (input) => handleFallback(result.resume(input)));
      } else {
        execOut.textContent = displayWithSeparator(result.stdout, result.preResumeOutputLength);
        if (result.maxStepsReached) {
          runStatus.textContent = 'Program did not halt — possible infinite loop';
          execOut.classList.add('lcc-error');
        } else if (result.exitCode && result.exitCode !== 0) {
          runStatus.textContent = 'exited with code ' + result.exitCode;
        }
      }
    })(api.run(asmResult.binary, { stdin: stdinLines, maxSteps: 50000, pauseOnInput: true }));
    return;
  }

  currentWorker = worker;
  setRunning(true);

  worker.onmessage = (e) => {
    const { status, output: out, message, partialOutput, trapType } = e.data;
    execOut.classList.remove('lcc-error');
    if (status === 'halted') {
      execOut.textContent = displayWithSeparator(out, e.data.preResumeLen);
      worker.terminate();
      finishRun();
    } else if (status === 'waiting-for-input') {
      execOut.textContent = partialOutput || '';
      showPrompt(trapType, (userInput) => {
        worker.postMessage({ type: 'resume', input: userInput });
      });
    } else if (status === 'max-steps-reached') {
      execOut.classList.add('lcc-error');
      execOut.textContent = (out || '') + '\\n… (truncated)';
      runStatus.textContent = 'Program did not halt — possible infinite loop';
      worker.terminate();
      finishRun();
    } else if (status === 'assembly-error') {
      execOut.classList.add('lcc-error');
      execOut.textContent = 'Assembly error:\\n' + message;
      worker.terminate();
      finishRun();
    } else {
      execOut.classList.add('lcc-error');
      execOut.textContent = 'Error: ' + (message || 'unknown');
      worker.terminate();
      finishRun();
    }
  };

  worker.onerror = (e) => {
    execOut.classList.add('lcc-error');
    execOut.textContent = 'Worker error: ' + e.message;
    finishRun();
  };

  const stdinLines = stdinInput.value.trim() ? stdinInput.value.split('\\n') : [];
  worker.postMessage({ type: 'run', src: editor.state.doc.toString(), stdinLines, maxSteps: 50000 });
});

(async () => {
  applyBodyClass(sel.value);

  let hl;
  try {
    const [{ createHighlighter }, grammarRes] = await Promise.all([
      import('${SHIKI_CDN_URL}'),
      fetch('../lcc.tmLanguage.json'),
    ]);
    const grammar = await grammarRes.json();
    hl = await createHighlighter({ langs: [grammar], themes: [...CUSTOM_THEMES, ...BUILTIN_THEMES] });
    shikiStatus.textContent = '';
  } catch (err) {
    shikiStatus.textContent = 'Highlighting unavailable: ' + err.message;
    return;
  }

  function render() {
    const theme = sel.value;
    applyBodyClass(theme);
    try {
      output.innerHTML = hl.codeToHtml(editor.state.doc.toString(), { lang: 'lcc', theme });
    } catch (err) {
      shikiStatus.textContent = 'Highlight error: ' + err.message;
    }
  }

  renderFn = render;
  sel.addEventListener('change', render);

  render();
})();
</script>`;

  const playgroundContent = `
  <h1>Playground</h1>
  <p class="subtitle">Assemble and run LCC assembly in the browser — syntax highlighting updates live.</p>
  <div class="theme-toolbar">
    <label for="theme-select">Theme:</label>
    <select id="theme-select">
${playgroundThemeOptions}
    </select>
  </div>
  <div class="run-bar">
    <button id="run-btn">Run</button>
    <button id="stop-btn">Stop</button>
    <span id="playground-status" style="color:#f85149;font-size:.8rem;"></span>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
    <div>
      <p class="panel-label">LCC Assembly</p>
      <div id="editor" style="width:100%;height:280px;border:1px solid var(--muted);border-radius:6px;overflow:hidden;"></div>
      <p class="panel-label" style="margin-top:.75rem;">stdin <span style="font-style:italic;">(pre-supply lines, or leave blank — an interactive prompt appears when the program waits for input)</span></p>
      <textarea id="stdin-input" spellcheck="false" style="width:100%;height:80px;background:var(--border);color:var(--fg);border:1px solid var(--muted);border-radius:6px;padding:.75rem;font-family:var(--mono-font);font-size:.85rem;line-height:1.6;resize:vertical;tab-size:4;"></textarea>
    </div>
    <div>
      <p class="panel-label">Output</p>
      <pre id="exec-output">(click Run to execute)</pre>
      <div id="stdin-prompt" style="display:none;margin-top:.5rem;padding:.65rem .9rem;background:var(--border);border-radius:6px;border:1px solid var(--muted);">
        <p id="stdin-prompt-label" style="font-size:.8rem;color:var(--fg);margin-bottom:.45rem;font-family:var(--mono-font);"></p>
        <div style="display:flex;gap:.5rem;align-items:center;">
          <input id="stdin-prompt-input" type="text" spellcheck="false" autocomplete="off" style="flex:1;background:var(--bg);color:var(--fg);border:1px solid var(--muted);border-radius:4px;padding:.35rem .6rem;font-family:var(--mono-font);font-size:.85rem;" />
          <button id="stdin-prompt-submit">Submit</button>
        </div>
      </div>
    </div>
  </div>
  <section style="margin-top:2rem;">
    <h2>Syntax preview</h2>
    <p class="panel-label">Highlights as you type</p>
    <div id="playground-output" style="min-height:200px;border-radius:6px;overflow:auto;font-size:.85rem;"></div>
    <p id="shiki-status" style="color:#f85149;font-size:.8rem;margin-top:.5rem;"></p>
  </section>
  <footer style="margin-top:3.5rem;font-size:.8rem;color:var(--muted);border-top:1px solid var(--border);padding-top:1rem;">
    <a href="https://github.com/avidrucker/lccjs">avidrucker/lccjs</a>
  </footer>`;

  const playgroundDir = path.join(OUT_DIR, 'showcase');
  fs.mkdirSync(playgroundDir, { recursive: true });

  // Deploy the Web Worker script alongside index.html.
  const workerSrc = path.join(ROOT, 'src', 'browser', 'lcc-worker.js');
  const workerDst = path.join(playgroundDir, 'lcc-worker.js');
  if (fs.existsSync(workerSrc)) {
    fs.copyFileSync(workerSrc, workerDst);
    console.log(`build:site — worker: ${path.relative(ROOT, workerDst)}`);
  }

  const playgroundHtml = makePage({
    title: 'Playground — LCC Assembly',
    bodyClass: 'dark',
    nav: buildNav('../', 'showcase'),
    content: playgroundContent,
    footer: '',
    script: '',
    extraCss: '',
  }).replace('</body>', playgroundScript + '\n</body>');

  const playgroundFile = path.join(playgroundDir, 'index.html');
  fs.writeFileSync(playgroundFile, playgroundHtml);
  console.log(`build:site — playground: ${path.relative(ROOT, playgroundFile)}`);

  console.log('build:site — done.');
})();
