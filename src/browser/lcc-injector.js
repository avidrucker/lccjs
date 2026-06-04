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

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('code.language-lcc').forEach(processBlock);
});
