'use strict';

const { assemble, run } = require('./api');

const TERMINAL_CSS = `
.lcc-output {
  background: #0a0a0a;
  color: #4af626;
  font-family: monospace;
  font-size: .85rem;
  line-height: 1.6;
  padding: 1rem 1.25rem;
  border-radius: 6px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin-top: .5rem;
}
.lcc-output.lcc-error {
  color: #ff5555;
  border-left: 3px solid #f44336;
}
`;

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = TERMINAL_CSS;
  document.head.appendChild(style);
}

function processBlock(codeEl) {
  const src = codeEl.textContent;
  const stdinRaw = codeEl.dataset.stdin || '';
  const stdin = stdinRaw ? stdinRaw.split('\n') : [];

  const out = document.createElement('pre');
  out.className = 'lcc-output';

  const asmResult = assemble(src);
  if (!asmResult.ok) {
    out.textContent = '$ lcc input.a\nAssembly error:\n' + asmResult.errors;
    out.classList.add('lcc-error');
  } else {
    const runResult = run(asmResult.binary, { stdin });
    out.textContent = '$ lcc input.a\n' + runResult.stdout;
    if (runResult.exitCode !== 0) {
      out.classList.add('lcc-error');
    }
  }

  const parent = codeEl.parentNode;
  parent.insertAdjacentElement('afterend', out);
}

function runInjector() {
  injectStyles();
  document.querySelectorAll('code.language-lcc').forEach(processBlock);
}

// In a reveal-md static export, DOMContentLoaded fires before Reveal.initialize()
// processes Markdown into real DOM nodes — code blocks don't exist yet at that point.
// When Reveal is present, defer until the 'ready' event so slides are fully rendered.
if (typeof window !== 'undefined' && window.Reveal) {
  Reveal.addEventListener('ready', runInjector);
} else {
  document.addEventListener('DOMContentLoaded', runInjector);
}
