#!/usr/bin/env node
// Build script: generates docs/site/ — landing page + docs subpages.
// Run via: npm run build:site
// Grammar: docs/lcc.tmLanguage.json (stable path, Shiki-ready)
// All themes pre-generated at build time; a JS switcher toggles visibility (no CDN at runtime).

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ignore = require('ignore');

const ROOT       = path.join(__dirname, '..');
const GRAMMAR_PATH = path.join(ROOT, 'docs', 'lcc.tmLanguage.json');
const OUT_DIR    = path.join(ROOT, 'docs', 'site');

// Curation policy for the folder-based docs sections (#1182): every .md in a
// section's srcDir is published UNLESS its repo-root-relative path is matched by
// .pages-ignore (gitignore syntax). A missing .pages-ignore publishes everything
// (back-compat). The `parity` section uses an explicit include list and is not
// subject to this filter. Ruling/rationale: docs/github-pages-docs-audit.md (#1123).
const PAGES_IGNORE_FILE = path.join(ROOT, '.pages-ignore');
const pagesIgnore = ignore().add(
  fs.existsSync(PAGES_IGNORE_FILE) ? fs.readFileSync(PAGES_IGNORE_FILE, 'utf8') : ''
);
// `ignore` matches forward-slash paths relative to the repo root.
const relFromRoot = (p) => path.relative(ROOT, p).split(path.sep).join('/');

// NOTE: the playground editor no longer loads Shiki at runtime (#1283). The npm
// "shiki" dep below is Node.js-only, used at build time to (a) render the static
// docs code blocks and (b) precompute per-theme editor highlight styles, which are
// inlined into the playground script (see buildEditorThemeStyles).

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

// ── Editor syntax-highlight precompute (#1283) ───────────────────────────────
// The playground editor colors its Lezer tokens from each Shiki theme's TextMate
// token colors. Rather than ship Shiki to the browser (~60 esm.sh modules + a WASM
// engine) only to call getTheme() at runtime, we resolve those colors HERE at build
// time (Node Shiki is already loaded for the static code blocks) and inline a compact
// per-theme style table. These mirror the former browser-side lccTokenStyle /
// lccThemeBackground exactly — verified in-browser against the prior output.

// Longest-prefix TextMate scope match (mirrors how Shiki resolves a token color).
function resolveTokenStyle(themeObj, targetScopes, fallback) {
  const rules = (themeObj && (themeObj.settings || themeObj.tokenColors)) || [];
  let best = null;
  let bestLen = -1;
  for (const rule of rules) {
    const s = rule && rule.settings;
    if (!s || (!s.foreground && !s.fontStyle)) continue;
    let scopes = rule.scope;
    if (typeof scopes === 'string') scopes = scopes.split(',');
    if (!Array.isArray(scopes)) continue;
    for (const raw of scopes) {
      const rs = String(raw).trim();
      if (!rs) continue;
      for (const t of targetScopes) {
        if ((t === rs || t.indexOf(rs + '.') === 0) && rs.length > bestLen) {
          best = s;
          bestLen = rs.length;
        }
      }
    }
  }
  const out = { color: (best && best.foreground) || fallback };
  const fs = (best && best.fontStyle) ? best.fontStyle : '';
  if (fs.indexOf('italic') >= 0) out.fontStyle = 'italic';
  if (fs.indexOf('bold') >= 0) out.fontWeight = 'bold';
  if (fs.indexOf('underline') >= 0) out.textDecoration = 'underline';
  return out;
}

function resolveThemeBackground(themeObj) {
  if (!themeObj) return null;
  if (themeObj.bg) return themeObj.bg;
  const rules = themeObj.settings || themeObj.tokenColors || [];
  for (const rule of rules) {
    const s = rule && rule.settings;
    if (s && s.background) return s.background;
  }
  return null;
}

// The TextMate scope list (most specific first) each Lezer tag maps to. Order MUST
// match LCC_TAG_LIST in the browser script — index i pairs style[i] with tag[i].
const LCC_HIGHLIGHT_SCOPES = [
  ['comment.line.semicolon.lcc', 'comment'],
  ['storage.type.directive.lcc', 'storage.type', 'storage', 'keyword'],
  ['entity.name.label.lcc', 'entity.name', 'variable'],
  ['string.quoted.double.lcc', 'string'],
  ['string.quoted.single.lcc', 'string'],
  ['variable.language.register.lcc', 'variable.language', 'variable'],
  ['variable.language.pc.lcc', 'variable.language', 'variable'],
  ['keyword.other.io.lcc', 'keyword.other', 'keyword'],
  ['keyword.control.branch.lcc', 'keyword.control', 'keyword'],
  ['keyword.mnemonic.lcc', 'keyword'],
  ['keyword.mnemonic.extension.lcc', 'keyword'],
  ['constant.numeric.lcc', 'constant.numeric', 'constant'],
  ['entity.name.label.lcc', 'entity.name', 'variable'],
];

// Force an alpha channel onto a #rgb / #rrggbb / #rrggbbaa color, returning
// #rrggbbaa. Used to synthesize a translucent overlay from a theme's fg when the
// theme ships no workbench color map (#1347).
function withAlpha(hex, alphaHex) {
  if (!hex) return null;
  let h = String(hex).trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length >= 6) return '#' + h.slice(0, 6) + alphaHex;
  return hex;
}

// → { [themeId]: { bg, fg, selBg, activeLine, styles: [ {color, …}, … ] } }
function buildEditorThemeStyles(hl, themeIds) {
  const out = {};
  for (const id of themeIds) {
    let themeObj = null;
    try { themeObj = hl.getTheme(id); } catch (err) { themeObj = null; }
    if (!themeObj) console.warn(`build:site — getTheme("${id}") failed; editor highlight will fall back`);
    const fg = (themeObj && themeObj.fg) || '#c9d1d9';
    // Palette-derived editor chrome (#1347): prefer the theme author's OWN
    // workbench colors (editor.selectionBackground / editor.lineHighlightBackground)
    // so selection + active-line harmonize with each theme. The custom retro themes
    // ship no `colors` map, so fall back to a translucent overlay built from fg —
    // a soft 20%-alpha selection and a barely-there 8%-alpha active line.
    const colors = (themeObj && themeObj.colors) || {};
    out[id] = {
      bg: resolveThemeBackground(themeObj),
      fg,
      selBg: colors['editor.selectionBackground'] || withAlpha(fg, '33'),
      activeLine: colors['editor.lineHighlightBackground']
                || colors['editor.lineHighlightBorder']
                || withAlpha(fg, '14'),
      styles: LCC_HIGHLIGHT_SCOPES.map(scopes => resolveTokenStyle(themeObj, scopes, fg)),
    };
  }
  return out;
}

const CURATED_SAMPLES = [
  { file: 'demos/helloWorld.a', label: 'demos/helloWorld.a', title: 'Hello, World! — lea, sout, halt' },
];

const LCCPLUS_SAMPLES = [
  { file: 'plusdemos/charTypewriter.ap', label: 'plusdemos/charTypewriter.ap', title: 'LCC+ — clear, sleep, aout loop' },
];

// Docs sections to expose as subpages.
// Use srcDir for folder-based sections; use files[] for explicit per-file lists.
// Folder-based sections (guides/research/learnings/glossary) publish every .md in
// their srcDir EXCEPT paths matched by .pages-ignore (see pagesIgnore above) —
// research/learnings are thereby curated to a user-facing subset without a
// hand-edited list here (#1182). `parity` stays an explicit include list because
// it cherry-picks a few root-level docs/*.md, not a folder. The former internal
// `workflow` section was dropped in #1153. Curation ruling: docs/github-pages-docs-audit.md (#1123).
const DOCS_SECTIONS = [
  { id: 'guides',    label: 'Guides',    srcDir: path.join(ROOT, 'docs', 'guides')    },
  { id: 'research',  label: 'Research',  srcDir: path.join(ROOT, 'docs', 'research')  },
  { id: 'learnings', label: 'Learnings', srcDir: path.join(ROOT, 'docs', 'learnings') },
  { id: 'glossary',  label: 'Glossary',  srcDir: path.join(ROOT, 'docs', 'glossary')  },
  { id: 'parity',    label: 'Parity',    files: [
    path.join(ROOT, 'docs', 'lccjs-unique-features.md'),
    path.join(ROOT, 'docs', 'parity_deviations.md'),
    path.join(ROOT, 'docs', 'cuh63-nocomma-negative-operand-family-bug-report.md'),
    path.join(ROOT, 'docs', 'cuh63-ldr-str-silent-miscompile-bug-report.md'),
    path.join(ROOT, 'docs', 'cuh63-mov-immediate-bug-report.md'),
    path.join(ROOT, 'docs', 'cuh63-line-length-silent-split-bug-report.md'),
    path.join(ROOT, 'docs', 'cuh63-o-assemble-exit-code-bug-report.md'),
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
html.dark,  body.dark  { --bg:#0d1117; --fg:#e6edf3; --muted:#8b949e; --border:#30363d; }
html.light, body.light { --bg:#f6f8fa; --fg:#24292e; --muted:#57606a; --border:#d0d7de; }
html.dark.retro,  body.dark.retro  { --bg:#233501; --fg:#d0cf9d; --muted:#446710; --border:#446710; --mono-font:"UnifontMedium",monospace; font-family:"UnifontMedium",monospace; -webkit-font-smoothing:none; }
html.light.retro, body.light.retro { --bg:#d0cf9d; --fg:#233501; --muted:#8d9a4a; --border:#8d9a4a; --mono-font:"UnifontMedium",monospace; font-family:"UnifontMedium",monospace; -webkit-font-smoothing:none; }
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

// Inline script injected into <head> to set the correct theme class before the
// body renders, preventing a flash of the wrong theme. Runs synchronously.
const HEAD_SCRIPT = `
<script>
(function(){
  var DARK=${JSON.stringify(DARK_IDS)};
  var LIGHT_ID='github-light';
  var DARK_ID='github-dark';
  function isDark(t){return DARK.indexOf(t)>=0;}
  function pick(){
    var s=localStorage.getItem('lcc-theme');
    if(s)return s;
    return window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches?DARK_ID:LIGHT_ID;
  }
  var t=pick();
  var cls=isDark(t)?'dark':'light';
  if(t.indexOf('retro-console')===0)cls+=' retro';
  document.documentElement.className=cls;
})();
</script>`;

// Shared JS for landing + docs pages: the single theme control is the
// #theme-select dropdown (the standalone light/dark toggle was removed in #1379).
const JS = `
(function () {
  var DARK = new Set(${JSON.stringify(DARK_IDS)});
  var LIGHT_ID = 'github-light';
  var DARK_ID = 'github-dark';
  var sel = document.getElementById('theme-select');
  if (!sel) return;
  function isDark(t) { return DARK.has(t); }
  function apply(t) {
    document.querySelectorAll('.theme-panel').forEach(function (p) {
      p.hidden = p.dataset.theme !== t;
    });
    var cls = (isDark(t) ? 'dark' : 'light') + (t.indexOf('retro-console') === 0 ? ' retro' : '');
    document.body.className = cls;
    document.documentElement.className = cls;
    localStorage.setItem('lcc-theme', t);
    sel.value = t;
  }
  sel.addEventListener('change', function () { apply(sel.value); });
  // On load, resolve the initial theme with the SAME precedence the head script
  // uses (#1143): saved choice, else prefers-color-scheme. The dropdown is now the
  // single theme control on every page incl. docs (#1379) — setting sel.value to
  // the resolved theme (not its default 'selected' option) keeps the dropdown in
  // sync with the <html> class the head script set pre-paint, and applies it to
  // <body> (docs bake no body theme class, #1334).
  var saved = localStorage.getItem('lcc-theme');
  var initial = saved || ((window.matchMedia && window.matchMedia('(prefers-color-scheme:dark)').matches) ? DARK_ID : LIGHT_ID);
  apply(initial);
}());
`;

// Build the <nav> bar. activeId matches a DOCS_SECTIONS id, 'home', or 'showcase'.
// The theme control is the #theme-select dropdown (rendered in the theme toolbar),
// not a nav button — the standalone light/dark toggle was removed in #1379.
function buildNav(rootPath, activeId) {
  const home  = `<a href="${rootPath}"${activeId === 'home' ? ' class="active"' : ''}>Home</a>`;
  const links = DOCS_SECTIONS.map(s => {
    const href = `${rootPath}docs/${s.id}/`;
    const cls  = activeId === s.id ? ' class="active"' : '';
    return `<a href="${href}"${cls}>${s.label}</a>`;
  });
  const playgroundCls = activeId === 'sandbox' ? ' class="active"' : '';
  const playground = `<a href="${rootPath}sandbox/"${playgroundCls}>Sandbox</a>`;
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
// includeHeadScript injects the inline theme script into <head> to prevent flash.
function makePage({ title, bodyClass = 'dark', nav, themeToolbar = '', content, footer, script = '', extraCss = '', includeHeadScript = false }) {
  const headScript = includeHeadScript ? HEAD_SCRIPT : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>${CSS}${extraCss}</style>${headScript}
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
    includeHeadScript: true,
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
          .map(f => ({ fullPath: path.join(section.srcDir, f), mdFile: f }))
          // Curate folder sections through .pages-ignore (#1182).
          .filter(({ fullPath }) => !pagesIgnore.ignores(relFromRoot(fullPath)));

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
        bodyClass: '', // #1334: bake no theme class — the pre-paint <html> class drives the theme (a baked body.* var block would shadow it and force light)
        nav: buildNav('../../', section.id),
        themeToolbar,
        content: `${backNav}\n  <div class="prose">\n${htmlBody}\n  </div>`,
        footer: `  <footer>
    <a href="https://github.com/avidrucker/lccjs">avidrucker/lccjs</a>
  </footer>`,
        script: JS,
        includeHeadScript: true,
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
      bodyClass: '', // #1334: bake no theme class — the pre-paint <html> class drives the theme (a baked body.* var block would shadow it and force light)
      nav: buildNav('../../', section.id),
      themeToolbar,
      content: indexContent,
      footer: `  <footer>
    <a href="https://github.com/avidrucker/lccjs">avidrucker/lccjs</a>
  </footer>`,
      script: JS,
      includeHeadScript: true,
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
  // The webpack bundles are no longer committed (#1178) — gitignored and rebuilt
  // by CI on deploy. For local `build:site`/`serve:site`, build them on demand if
  // EITHER the API bundle or the editor bundle (#1284) is missing, so the
  // playground works without a prior `build:browser`.
  const EDITOR_BUNDLE_SRC = path.join(ROOT, 'dist', 'editor.bundle.js');
  if (!fs.existsSync(BUNDLE_SRC) || !fs.existsSync(EDITOR_BUNDLE_SRC)) {
    console.log('build:site — a webpack bundle is missing; running `npm run build:browser`…');
    execSync('npm run build:browser', { cwd: ROOT, stdio: 'inherit' });
  }
  if (fs.existsSync(BUNDLE_SRC)) {
    fs.mkdirSync(path.dirname(BUNDLE_DEST), { recursive: true });
    fs.copyFileSync(BUNDLE_SRC, BUNDLE_DEST);
    console.log(`build:site — bundle:  ${path.relative(ROOT, BUNDLE_DEST)}`);
  } else {
    console.warn('build:site — WARNING: dist/lcc.bundle.js still not found after `npm run build:browser`');
  }

  // Copy the editor bundle (CodeMirror 6 + Lezer + the lcc() language) into
  // docs/site/dist/ so the playground's <script src="../dist/editor.bundle.js">
  // resolves on file://, local HTTP, and GitHub Pages. Produced by webpack
  // (src/browser/editor.js → dist/editor.bundle.js); replaces the former
  // per-subpackage esm.sh imports and the hand-maintained dist/lang-lcc.js (#1284).
  const EDITOR_SRC  = EDITOR_BUNDLE_SRC;
  const EDITOR_DEST = path.join(OUT_DIR, 'dist', 'editor.bundle.js');
  if (fs.existsSync(EDITOR_SRC)) {
    fs.mkdirSync(path.dirname(EDITOR_DEST), { recursive: true });
    fs.copyFileSync(EDITOR_SRC, EDITOR_DEST);
    console.log(`build:site — editor:  ${path.relative(ROOT, EDITOR_DEST)}`);
  } else {
    console.warn('build:site — WARNING: dist/editor.bundle.js not found; run `npm run build:browser` first');
  }

  const playgroundThemeOptions = THEMES.map(({ id, label }) =>
    `      <option value="${id}"${id === DEFAULT_THEME ? ' selected' : ''}>${label}</option>`
  ).join('\n');

  // Precompute per-theme editor highlight styles at build time so the browser needs
  // no Shiki at runtime (#1283). hl already has every theme loaded (see createHighlighter).
  const editorThemeStylesJson = JSON.stringify(buildEditorThemeStyles(hl, THEMES.map(t => t.id)));
  const darkIdsJson = JSON.stringify(DARK_IDS);

  const starterCode = fs.readFileSync(path.join(ROOT, 'demos', 'helloWorld.a'), 'utf8').trimEnd();
  const starterCodeJson = JSON.stringify(starterCode);
  // HTML-escaped starter code for the static first-paint placeholder (#1248).
  const starterCodeHtml = starterCode
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const playgroundScript = `
<style>
#run-btn { background:#1f883d;color:#fff;border:none;border-radius:4px;padding:.4rem 1.1rem;font-size:.9rem;cursor:pointer;font-weight:600; }
html.dark #run-btn { background:#238636; }
#run-btn:hover { opacity:.85; }
#stop-btn { background:#c0392b;color:#fff;border:none;border-radius:4px;padding:.4rem 1.1rem;font-size:.9rem;cursor:pointer;font-weight:600;display:none; }
#stop-btn:hover { opacity:.85; }
.run-bar { display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem; }
#exec-output { min-height:300px;border-radius:6px;padding:1.1rem 1.25rem;overflow:auto;font-size:.85rem;line-height:1.6;font-family:var(--mono-font);background:var(--surface-bg,var(--border));color:var(--surface-fg,var(--fg));white-space:pre-wrap;word-break:break-word;margin:0; }
#exec-output.lcc-error { color:#cf222e; }
html.dark #exec-output.lcc-error { color:#ff7b72; }
.panel-label { font-size:.8rem;color:var(--muted);margin-bottom:.4rem; }
#stdin-prompt-submit { background:var(--fg);color:var(--bg);border:none;border-radius:4px;padding:.35rem .9rem;font-size:.85rem;cursor:pointer;font-weight:600; }
#stdin-prompt-submit:hover { opacity:.85; }
</style>
<script src="../dist/lcc.bundle.js"></script>
<script src="../dist/editor.bundle.js"></script>
<script type="module">
// CodeMirror 6 + Lezer + the lcc() language are bundled into one local asset
// (dist/editor.bundle.js → window.LccEditor) instead of ~58 per-subpackage esm.sh
// imports (#1284). The single bundle means one @codemirror/state instance, so the
// instanceof / tag-identity pinning the esm.sh imports needed (#772/#986) is moot.
const {
  EditorView, keymap, lineNumbers, drawSelection, dropCursor,
  highlightActiveLine, highlightActiveLineGutter, rectangularSelection,
  crosshairCursor, highlightSpecialChars,
  Compartment,
  history, defaultKeymap, historyKeymap, indentWithTab,
  toggleLineComment, insertNewlineAndIndent,
  autocompletion, completionKeymap,
  syntaxHighlighting, HighlightStyle, indentOnInput, bracketMatching,
  foldGutter, foldKeymap,
  tags,
  lcc,
} = window.LccEditor;

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

const LCC_THEME_STYLES = ${editorThemeStylesJson};
const DARK             = new Set(${darkIdsJson});

const sel        = document.getElementById('theme-select');
const stdinInput = document.getElementById('stdin-input');

let debounce;

// ── Per-theme editor highlighting & background (#1124, #1142, #1283) ──────────
// Per-theme token colors are PRECOMPUTED at build time and inlined as
// LCC_THEME_STYLES above (no Shiki at runtime, #1283). On theme change we rebuild
// the CM HighlightStyle from that table and swap it via a Compartment; a second
// compartment swaps the editor background (#1142).
const highlightCompartment = new Compartment();
const backgroundCompartment = new Compartment();

// Lezer tags the lcc() parser emits, in the SAME order as LCC_HIGHLIGHT_SCOPES in
// the Node build script: precomputed LCC_THEME_STYLES[id].styles[i] pairs with tag i.
const LCC_TAG_LIST = [
  tags.comment,
  tags.definitionKeyword,
  tags.labelName,
  tags.string,
  tags.character,
  tags.variableName,
  tags.special(tags.variableName),
  tags.operatorKeyword,
  tags.controlKeyword,
  tags.keyword,
  tags.atom,
  tags.number,
  tags.name,
];

// Build a CM HighlightStyle for a theme id from the inlined precomputed table (#1283).
function lccHighlightStyle(themeId) {
  const entry = LCC_THEME_STYLES[themeId] || LCC_THEME_STYLES['${DEFAULT_THEME}'] || { styles: [] };
  const styles = entry.styles || [];
  return HighlightStyle.define(LCC_TAG_LIST.map((tag, i) => Object.assign({ tag }, styles[i] || {})));
}

// Per-theme editor "chrome": background, text-selection color, and active-line
// highlight — all derived from the theme's own palette (#1347). selBg/activeLine
// come from each theme author's editor.selectionBackground /
// editor.lineHighlightBackground (precomputed into LCC_THEME_STYLES), replacing
// CM's fixed light-mode defaults (bright lavender selection + strong blue active
// line) that ignored the theme. The focused-selection selector mirrors CM's own
// high-specificity rule so our color wins. Background lives on .cm-scroller, not
// .cm-content, so the z-index -2 selection layer stays visible (#1339).
function chromeTheme(themeId) {
  const e = LCC_THEME_STYLES[themeId] || {};
  const bg = e.bg || 'var(--border)';
  const spec = {
    '.cm-scroller': { background: bg },
    '.cm-gutters':  { background: bg },
  };
  if (e.selBg) {
    spec['.cm-selectionBackground'] = { background: e.selBg };
    spec['&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground'] = { background: e.selBg };
  }
  if (e.activeLine) {
    spec['.cm-activeLine'] = { backgroundColor: e.activeLine };
  }
  return EditorView.theme(spec);
}

// Editor will be initialized inside the async IIFE after Shiki loads,
// so it starts with the correct theme and avoids flicker.
// Test hook reference — set after editor creation in the async IIFE.
let editor;
window.__lccSetSource = function(src) {
  if (editor) {
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: src } });
  }
};
window.__lccGetSource = function() {
  return editor ? editor.state.doc.toString() : '';
};
window.__lccSetSelection = function(from, to = from) {
  if (editor) {
    editor.dispatch({ selection: { anchor: from, head: to } });
  }
};
const runStatus         = document.getElementById('playground-status');
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
  var cls = (DARK.has(themeId) ? 'dark' : 'light') +
    (themeId.startsWith('retro-console') ? ' retro' : '');
  document.body.className = cls;
  document.documentElement.className = cls;
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
          execOut.classList.add('lcc-error');
          execOut.textContent = ((result.stdout || '') ? result.stdout + '\\n' : '') +
            'Runtime error:\\n' + (result.stderr || ('exit code ' + result.exitCode));
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
    } else if (status === 'runtime-error') {
      execOut.classList.add('lcc-error');
      execOut.textContent = ((out || '') ? out + '\\n' : '') + 'Runtime error:\\n' + (message || 'runtime error');
      runStatus.textContent = 'exited with code 1';
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

  // First paint: mount the editor IMMEDIATELY. CM6 is a static import (already
  // loaded by the time this runs) and per-theme highlight styles are precomputed
  // inline (#1283), so the editor mounts already-themed — no Shiki at runtime and no
  // default→themed flicker (#1248). Drop the static #editor-placeholder (same text,
  // same mono font) as the real editor mounts.
  var placeholder = document.getElementById('editor-placeholder');
  if (placeholder) placeholder.remove();

  editor = new EditorView({
    doc: ${starterCodeJson},
    extensions: [
      lineNumbers(),
      history(),
      drawSelection(),
      dropCursor(),
      highlightSpecialChars(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      rectangularSelection(),
      crosshairCursor(),
      indentOnInput(),
      bracketMatching(),
      foldGutter(),
      keymap.of([
        indentWithTab,
        { key: 'Enter', run: insertNewlineAndIndent },
        { key: 'Mod-/', run: toggleLineComment },
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
      ]),
      lcc(),
      // While a non-empty selection exists, suppress the active-line highlight so it
      // can't mask the selection layer beneath it (the active-line bg sits at z-index 0,
      // above the z-index -2 selection layer, so an opaque per-theme active-line color
      // would hide a partial/mid-line selection — #1355, a regression from #1347).
      // VS Code does the same: the current-line highlight yields to the selection.
      // Toggle a class the CSS rule below keys off of (no extra bundle exports needed).
      EditorView.updateListener.of((u) => {
        if (u.selectionSet || u.docChanged || u.focusChanged) {
          const hasSelection = u.state.selection.ranges.some((r) => !r.empty);
          u.view.dom.classList.toggle('cm-has-selection', hasSelection);
        }
      }),
      // Per-theme highlight from the inlined precomputed table (#1283).
      highlightCompartment.of(syntaxHighlighting(lccHighlightStyle(sel.value))),
      // Per-theme background + selection + active-line chrome (#1142, #1283, #1339, #1347)
      backgroundCompartment.of(chromeTheme(sel.value)),
      autocompletion({ override: [lccCompletionSource] }),
      EditorView.theme({
        '&': { height: '100%', fontSize: '.85rem' },
        // Background/selection/active-line live in chromeTheme() (per-theme compartment).
        '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--mono-font)' },
        // Keep only text/caret color on .cm-content so the z-index -2 selection layer
        // stays visible behind it (#1339).
        '.cm-content': { color: 'var(--fg)', caretColor: 'var(--fg)' },
        '.cm-gutters': { background: 'var(--border)', borderRight: '1px solid var(--muted)', color: 'var(--muted)' },
        '.cm-activeLineGutter': { background: 'rgba(128,128,128,0.1)' },
        // When a selection is active, drop the active-line (and its gutter) highlight so
        // the selection shows uninterrupted on the cursor's line (#1355). Higher
        // specificity than the per-theme .cm-activeLine rule in chromeTheme(), so it wins.
        '&.cm-has-selection .cm-activeLine': { backgroundColor: 'transparent' },
        '&.cm-has-selection .cm-activeLineGutter': { background: 'transparent' },
        '&.cm-focused': { outline: 'none' },
      }),
    ],
    parent: document.getElementById('editor'),
  });

  // Reconfigure the CM editor's HighlightStyle AND background on theme change,
  // both from the inlined precomputed table (#1283) — synchronous, no async load.
  function applyEditorHighlight(theme) {
    editor.dispatch({
      effects: highlightCompartment.reconfigure(syntaxHighlighting(lccHighlightStyle(theme))),
    });
    // Swap background + selection + active-line in one reconfigure (#1339, #1347).
    editor.dispatch({
      effects: backgroundCompartment.reconfigure(chromeTheme(theme)),
    });
    applySurfaceTheme(theme);
  }

  // Drive the non-CodeMirror surfaces (output pane #exec-output, stdin textarea,
  // stdin prompt) from the SAME per-theme palette the editor's chromeTheme() uses
  // (#1333). Previously these read the page light/dark vars (var(--border)/var(--fg)),
  // so on e.g. Monokai the editor showed Monokai's background but the terminal did
  // not. Setting --surface-bg/--surface-fg from LCC_THEME_STYLES[theme] makes them
  // track the code theme. The CSS falls back to var(--border)/var(--fg) until this
  // runs, and the .lcc-error color rule (higher specificity) still wins for errors.
  function applySurfaceTheme(theme) {
    var e = LCC_THEME_STYLES[theme] || {};
    var root = document.documentElement.style;
    if (e.bg) { root.setProperty('--surface-bg', e.bg); } else { root.removeProperty('--surface-bg'); }
    if (e.fg) { root.setProperty('--surface-fg', e.fg); } else { root.removeProperty('--surface-fg'); }
  }
  // Single theme control (#1379): the #theme-select dropdown drives everything;
  // the standalone light/dark toggle button was removed. Resolve the initial theme
  // with the head script's precedence (#1143): saved choice, else prefers-color-scheme.
  var savedTheme = localStorage.getItem('lcc-theme');
  var initialTheme = savedTheme ||
    ((window.matchMedia && window.matchMedia('(prefers-color-scheme:dark)').matches) ? 'github-dark' : 'github-light');
  sel.value = initialTheme;
  applyBodyClass(initialTheme);
  applyEditorHighlight(initialTheme); // also refreshes the surfaces (applySurfaceTheme)

  sel.addEventListener('change', () => {
    applyBodyClass(sel.value);
    applyEditorHighlight(sel.value);
    localStorage.setItem('lcc-theme', sel.value);
  });

})();
</script>`;

  const playgroundContent = `
  <h1>Sandbox</h1>
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
      <div id="editor" style="width:100%;height:280px;border:1px solid var(--muted);border-radius:6px;overflow:hidden;"><pre id="editor-placeholder" style="margin:0;padding:4px 6px 4px 30px;height:100%;box-sizing:border-box;overflow:hidden;background:var(--border);color:var(--fg);font-family:var(--mono-font);font-size:.85rem;line-height:1.4;white-space:pre;">${starterCodeHtml}</pre></div>
      <p class="panel-label" style="margin-top:.75rem;">stdin <span style="font-style:italic;">(pre-supply lines, or leave blank — an interactive prompt appears when the program waits for input)</span></p>
      <textarea id="stdin-input" spellcheck="false" style="width:100%;height:80px;background:var(--surface-bg,var(--border));color:var(--surface-fg,var(--fg));border:1px solid var(--muted);border-radius:6px;padding:.75rem;font-family:var(--mono-font);font-size:.85rem;line-height:1.6;resize:vertical;tab-size:4;"></textarea>
    </div>
    <div>
      <p class="panel-label">Output</p>
      <pre id="exec-output">(click Run to execute)</pre>
      <div id="stdin-prompt" style="display:none;margin-top:.5rem;padding:.65rem .9rem;background:var(--surface-bg,var(--border));border-radius:6px;border:1px solid var(--muted);">
        <p id="stdin-prompt-label" style="font-size:.8rem;color:var(--surface-fg,var(--fg));margin-bottom:.45rem;font-family:var(--mono-font);"></p>
        <div style="display:flex;gap:.5rem;align-items:center;">
          <input id="stdin-prompt-input" type="text" spellcheck="false" autocomplete="off" style="flex:1;background:var(--surface-bg,var(--bg));color:var(--surface-fg,var(--fg));border:1px solid var(--muted);border-radius:4px;padding:.35rem .6rem;font-family:var(--mono-font);font-size:.85rem;" />
          <button id="stdin-prompt-submit">Submit</button>
        </div>
      </div>
    </div>
  </div>\n  <footer style="margin-top:3.5rem;font-size:.8rem;color:var(--muted);border-top:1px solid var(--border);padding-top:1rem;">\n    <a href="https://github.com/avidrucker/lccjs">avidrucker/lccjs</a>\n  </footer>`;

  const playgroundDir = path.join(OUT_DIR, 'sandbox');
  fs.mkdirSync(playgroundDir, { recursive: true });

  // Deploy the Web Worker script alongside index.html.
  const workerSrc = path.join(ROOT, 'src', 'browser', 'lcc-worker.js');
  const workerDst = path.join(playgroundDir, 'lcc-worker.js');
  if (fs.existsSync(workerSrc)) {
    fs.copyFileSync(workerSrc, workerDst);
    console.log(`build:site — worker: ${path.relative(ROOT, workerDst)}`);
  }

  const playgroundHtml = makePage({
    title: 'Sandbox — LCC Assembly',
    bodyClass: 'dark',
    nav: buildNav('../', 'sandbox'),
    content: playgroundContent,
    footer: '',
    script: '',
    extraCss: '',
    includeHeadScript: true,
  }).replace('</body>', playgroundScript + '\n</body>');

  const playgroundFile = path.join(playgroundDir, 'index.html');
  fs.writeFileSync(playgroundFile, playgroundHtml);
  console.log(`build:site — playground: ${path.relative(ROOT, playgroundFile)}`);

  // Generate redirect from old /showcase/ route to new /sandbox/ route.
  const redirectDir = path.join(OUT_DIR, 'showcase');
  fs.mkdirSync(redirectDir, { recursive: true });
  const redirectHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=../sandbox/">
  <title>Redirecting to Sandbox</title>
</head>
<body>
  <p>Redirecting to <a href="../sandbox/">Sandbox</a>...</p>
  <script>window.location.href = "../sandbox/";</script>
</body>
</html>`;
  const redirectFile = path.join(redirectDir, 'index.html');
  fs.writeFileSync(redirectFile, redirectHtml);
  console.log(`build:site — redirect: ${path.relative(ROOT, redirectFile)}`);

  console.log('build:site — done.');
})();
