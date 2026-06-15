// ==UserScript==
// @name         LCC Assembly Syntax Highlighting for GitHub
// @namespace    https://github.com/avidrucker/lccjs
// @version      1.1
// @description  Replaces GitHub's NASM-style highlighting with real LCC syntax highlighting via Shiki for .a and .ap files
// @author       avidrucker
// @match        https://github.com/avidrucker/lccjs/blob/*/*.a
// @match        https://github.com/avidrucker/lccjs/blob/*/*.ap
// @match        https://github.com/avidrucker/lccjs/blob/*/**/*.a
// @match        https://github.com/avidrucker/lccjs/blob/*/**/*.ap
// @grant        GM_addStyle
// @grant        GM.xmlHttpRequest
// @connect      raw.githubusercontent.com
// @connect      cdn.jsdelivr.net
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ── Configuration ────────────────────────────────────────────────────────
  const REPO = 'avidrucker/lccjs';
  const BRANCH = 'main';
  const GRAMMAR_URL = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/docs/lcc.tmLanguage.json`;
  // Pin a specific Shiki version to avoid silent breakage
  const SHIKI_VERSION = '1.24.2';
  const SHIKI_CDN = `https://cdn.jsdelivr.net/npm/shiki@${SHIKI_VERSION}/dist/index.mjs`;

  // ── State ────────────────────────────────────────────────────────────────
  let highlighter = null;
  let initPromise = null;
  let replacementInjected = false;

  // ── URL detection ────────────────────────────────────────────────────────
  function isLccFile() {
    // github.com/avidrucker/lccjs/blob/{branch}/{path}.a or .ap
    return /^\/avidrucker\/lccjs\/blob\/[^/]+\/.+\.(a|ap)$/.test(window.location.pathname);
  }

  // ── GitHub DOM helpers ──────────────────────────────────────────────────
  // GitHub's file viewer has used two different DOM structures over time.
  // Try both the classic table-based layout and the newer div-based layout.

  function findCodeTable() {
    // Classic layout: div.blob-wrapper > table.highlight
    const wrapper = document.querySelector('div.blob-wrapper');
    if (wrapper) {
      const table = wrapper.querySelector('table.highlight');
      if (table) return { type: 'table', wrapper, table, rows: table.querySelectorAll('tbody tr') };
    }
    return null;
  }

  function findCodeDiv() {
    // Newer layout: div[data-testid="code-view"] or similar container with pre/code or div blocks
    // Look for the data-line-number attribute which is GitHub's current convention
    const firstLine = document.querySelector('[data-line-number="1"]');
    if (!firstLine) return null;
    // Walk up to find the container
    let el = firstLine;
    for (let i = 0; i < 10; i++) {
      el = el.parentElement;
      if (!el) break;
      // The container typically has role="rowgroup" or is a direct parent of rows
      if (el.getAttribute('role') === 'rowgroup' || el.tagName === 'TBODY') {
        const container = el.parentElement;
        return { type: 'div', container, lineElements: document.querySelectorAll('[data-line-number]') };
      }
    }
    // Fallback: use the row's parent as container
    const row = firstLine.closest('[role="row"]');
    if (row) {
      const grid = row.closest('[role="grid"]') || row.parentElement;
      return { type: 'div', container: grid, lineElements: document.querySelectorAll('[data-line-number]') };
    }
    return null;
  }

  function getCodeFromTable(table) {
    const lines = [];
    for (const row of table.querySelectorAll('tbody tr')) {
      const cell = row.querySelector('td.blob-code-inner') || row.querySelector('td[class*="blob-code"]');
      if (cell) lines.push(cell.textContent);
    }
    return lines.join('\n');
  }

  function getCodeFromDiv(lineElements) {
    const lines = [];
    for (const el of lineElements) {
      // The text content of the line element
      lines.push(el.textContent);
    }
    return lines.join('\n');
  }

  function findCodeContainer() {
    // Try table layout first
    const table = findCodeTable();
    if (table) return table;
    // Try div layout
    return findCodeDiv();
  }

  function getCodeText(container) {
    if (container.type === 'table') return getCodeFromTable(container.table);
    if (container.type === 'div') return getCodeFromDiv(container.lineElements);
    return null;
  }

  function getCodeWrapper(container) {
    if (container.type === 'table') return container.wrapper;
    if (container.type === 'div') return container.container;
    return null;
  }

  function hideOriginal(container) {
    const wrapper = getCodeWrapper(container);
    if (wrapper) {
      // Hide the wrapper's direct child that contains the code
      const codeEl = container.type === 'table'
        ? container.table
        : container.container;
      if (codeEl) {
        codeEl.style.display = 'none';
        codeEl.dataset.lccHidden = 'true';
      }
    }
  }

  function showOriginal(container) {
    const el = container.type === 'table' ? container.table : container.container;
    if (el) {
      el.style.display = '';
      delete el.dataset.lccHidden;
    }
  }

  // ── Shiki initialization ─────────────────────────────────────────────────
  async function loadGrammar() {
    return new Promise((resolve, reject) => {
      GM.xmlHttpRequest({
        method: 'GET',
        url: GRAMMAR_URL,
        onload: (resp) => {
          if (resp.status === 200) {
            try {
              const g = JSON.parse(resp.responseText);
              resolve(g);
            } catch (e) {
              reject(new Error('Failed to parse LCC grammar JSON: ' + e.message));
            }
          } else {
            reject(new Error('Failed to fetch grammar: HTTP ' + resp.status));
          }
        },
        onerror: (resp) => reject(new Error('Failed to fetch grammar: ' + (resp.status || 'network error'))),
      });
    });
  }

  async function initHighlighter() {
    if (highlighter) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      const grammar = await loadGrammar();
      const shiki = await import(/* @vite-ignore */ SHIKI_CDN);

      // Register LCC language with all metadata
      const lccLang = {
        name: 'lcc',
        displayName: grammar.displayName || 'LCC Assembly',
        aliases: grammar.aliases || ['lcc', 'lcc-assembly'],
        fileTypes: grammar.fileTypes || ['a', 'ap'],
        scopeName: grammar.scopeName || 'source.lcc',
        patterns: grammar.patterns,
        repository: grammar.repository,
      };

      highlighter = await shiki.createHighlighter({
        themes: ['github-dark'],
        langs: [lccLang],
      });
    })();

    return initPromise;
  }

  // ── Replacement ──────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('lcc-highlight-styles')) return;
    const style = document.createElement('style');
    style.id = 'lcc-highlight-styles';
    style.textContent = `
      .lcc-highlight-replacement {
        margin: 0;
      }
      .lcc-highlight-replacement pre {
        background-color: #24292e !important;
        border-radius: 6px;
        padding: 16px 0;
        margin: 0;
        overflow-x: auto;
        tab-size: 2;
        -moz-tab-size: 2;
        font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
        font-size: 12px;
        line-height: 20px;
        white-space: pre;
      }
      .lcc-highlight-replacement pre code {
        display: block;
        padding: 0 16px;
      }
      .lcc-highlight-replacement pre .line {
        display: block;
        min-height: 20px;
      }
      /* Read-only banner */
      .lcc-highlight-banner {
        background: #ddf4ff;
        color: #1f2328;
        font-size: 12px;
        padding: 4px 12px;
        margin-bottom: 4px;
        border-radius: 6px;
        border: 1px solid #80ccff;
      }
      @media (prefers-color-scheme: dark) {
        .lcc-highlight-banner {
          background: #0d2847;
          color: #c9d1d9;
          border-color: #388bfd;
        }
      }
    `;
    document.head.appendChild(style);
  }

  async function replaceHighlighting() {
    if (replacementInjected) return;

    const container = findCodeContainer();
    if (!container) {
      console.warn('[LCC highlight] No code container found — GitHub DOM may have changed');
      return;
    }

    const code = getCodeText(container);
    if (!code || !code.trim()) {
      console.warn('[LCC highlight] No code text extracted');
      return;
    }

    let html;
    try {
      html = highlighter.codeToHtml(code, { lang: 'lcc', theme: 'github-dark' });
    } catch (e) {
      console.error('[LCC highlight] Shiki render failed:', e);
      return;
    }

    injectStyles();

    // Create replacement UI
    const banner = document.createElement('div');
    className = 'lcc-highlight-banner';
    banner.textContent = 'LCC highlighting (via Tampermonkey)';

    const preWrap = document.createElement('div');
    preWrap.className = 'lcc-highlight-replacement';
    preWrap.innerHTML = html;

    const replacement = document.createElement('div');
    replacement.appendChild(banner);
    replacement.appendChild(preWrap);

    // Insert before original, hide original
    const wrapper = getCodeWrapper(container);
    if (wrapper && wrapper.parentNode) {
      wrapper.parentNode.insertBefore(replacement, wrapper);
    } else {
      // Fallback: append near the container
      container.container.parentElement.insertBefore(replacement, container.container);
    }

    hideOriginal(container);
    replacementInjected = true;

    // Listen for Turbo navigation (PJAX) -- re-apply after page replaces
    document.addEventListener('turbo:load', () => {
      replacementInjected = false;
      setTimeout(tryReplace, 100);
    });
    document.addEventListener('turbolinks:load', () => {
      replacementInjected = false;
      setTimeout(tryReplace, 100);
    });

    console.log('[LCC highlight] Applied LCC syntax highlighting');
  }

  function tryReplace() {
    if (!isLccFile()) {
      // Clean up if navigating away from an .a file
      if (replacementInjected) {
        revertHighlighting();
      }
      return;
    }
    replaceHighlighting();
  }

  function revertHighlighting() {
    const el = document.querySelector('.lcc-highlight-replacement');
    if (el) el.remove();
    // Unhide any hidden original
    const hidden = document.querySelector('[data-lcc-hidden]');
    if (hidden) {
      hidden.style.display = '';
      delete hidden.dataset.lccHidden;
    }
    replacementInjected = false;
  }

  // ── Main entry ────────────────────────────────────────────────────────────
  function main() {
    if (!isLccFile()) return;

    console.log('[LCC highlight] LCC file detected, initializing...');

    // Use MutationObserver to handle PJAX/Turbo navigation
    const observer = new MutationObserver(() => {
      if (replacementInjected && !isLccFile()) {
        revertHighlighting();
      }
    });

    initHighlighter()
      .then(() => replaceHighlighting())
      .catch((e) => {
        console.error('[LCC highlight] Init failed:', e);
      });

    observer.observe(document.body, { childList: true, subtree: false });
  }

  // Run when DOM is ready (document-idle already delays, but be safe)
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    main();
  } else {
    document.addEventListener('DOMContentLoaded', main);
  }
})();
