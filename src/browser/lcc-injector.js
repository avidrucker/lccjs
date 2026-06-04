'use strict';

const { assemble, run } = require('./api');

function processBlock(codeEl) {
  const src = codeEl.textContent;
  const stdinRaw = codeEl.dataset.stdin || '';
  const stdin = stdinRaw ? stdinRaw.split('\n') : [];

  const out = document.createElement('pre');
  out.className = 'lcc-output';

  const asmResult = assemble(src);
  if (!asmResult.ok) {
    out.textContent = 'Assembly error:\n' + asmResult.errors;
    out.classList.add('lcc-error');
  } else {
    const runResult = run(asmResult.binary, { stdin });
    out.textContent = runResult.stdout;
    if (runResult.exitCode !== 0) {
      out.classList.add('lcc-error');
    }
  }

  const parent = codeEl.parentNode;
  parent.insertAdjacentElement('afterend', out);
}

function runInjector() {
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
