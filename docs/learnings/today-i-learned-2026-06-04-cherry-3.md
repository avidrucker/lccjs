# TIL 2026-06-04 — CHERRY s3

**Context:** Third CHERRY session of the day. Closed three tickets: added `.e`/`.hex`
format-verification tests (#756), wired LCC register/mnemonic/directive autocomplete
into the CodeMirror playground (#755), and built the first showcase e2e regression
suite with Playwright (#775). Also filed #772 after the autocomplete work broke the
GitHub Pages showcase CDN import.

---

## 1. Regex patterns in JS template literals need doubled backslashes

**What happened:** In `build-site.js`, the CodeMirror autocomplete source lives inside
a backtick template literal — the template's content becomes JavaScript that ships in
`docs/site/showcase/index.html`. I wrote `context.matchBefore(/\.\w*|\w+/)` directly
inside the template. The first build produced `/..*/` in the output HTML — the
backslashes had been silently consumed.

**What I learned:** In a JavaScript template literal (non-tagged, sloppy mode),
unrecognised escape sequences like `\w` and `\.` are processed: the backslash is
consumed and only the following character survives. So `\w` → `w` and `\.` → `.` in
the emitted string. To produce a literal `\w` in the template's output, write `\\w`.
The correct source for `/\.\w*|\w+/` inside a template literal is `/\\.\\w*|\\w+/`.

A secondary mistake compounded this: I initially wrote `\\.\\.\\w*` — doubling both
the dot-escape and the `\w`, yielding `/\.\.\w*/` (two dots) in the output. The
correct form is `\\.\\w*` (one escaped dot, then `\\w*`).

**The rule:** When embedding JavaScript regex literals inside a JS template literal,
double every backslash that must survive into the emitted source. Sanity-check by
grepping the output file: if you see `\w`, you have it right; if you see bare `w`, you
need another backslash in the template source.

---

## 2. `esm.sh/codemirror@6` does not expose `EditorView` as a named export

**What happened:** After #755 shipped, the GitHub Pages showcase threw
`Uncaught SyntaxError: The requested module 'https://esm.sh/codemirror@6' does not
provide an export named 'EditorView'`. The import had never been validated in a real
browser — local builds don't exercise the CDN path.

**What I learned:** The `codemirror` npm metapackage re-exports everything from its
sub-packages (`@codemirror/view`, `@codemirror/state`, etc.) via `export *`. But
esm.sh does **not** surface those transitive barrel re-exports as named exports on the
`codemirror@6` bundle URL. Any named import of a sub-package symbol (`EditorView`,
`keymap`, `basicSetup`) against that URL fails with a SyntaxError in the browser, even
though the same import works fine in a local Node/bundler context. Filed as #772; fix
requires per-sub-package imports with `?deps=` pinning or a different CDN strategy.

**The rule:** Verify CDN imports in an actual browser (or `npm run test:e2e`) after
every change to the `import {...}` line in `build-site.js`. Local builds and `node`
don't exercise the CDN resolution path.

---

## 3. CM6 attaches the `EditorView` to its root DOM element via `dom.cmView`

**What happened:** The showcase's `editor` variable is module-scoped — inaccessible
from `page.evaluate()` in Playwright. I needed to set the editor's content
programmatically in tests without adding a global variable to production code.

**What I learned:** CodeMirror 6 stores a back-reference from the root `.cm-editor`
DOM element to the `EditorView` instance via `dom.cmView`. This is the same property
that `EditorView.findFromDOM()` uses internally. From Playwright's `page.evaluate()`,
the following reliably replaces the editor's full content:

```js
const dom = document.querySelector('.cm-editor');
dom.cmView.dispatch({
  changes: { from: 0, to: dom.cmView.state.doc.length, insert: src },
});
```

No public-API export, no global, no keyboard simulation needed. If `dom.cmView` is
`undefined`, the editor hasn't mounted yet — which is itself a testable failure
condition (T2 in the e2e suite).

**The rule:** To interact with a CM6 editor from a headless browser test, reach it via
`document.querySelector('.cm-editor').cmView`. A missing or undefined `cmView` means
the editor failed to mount — assert on it explicitly.

---

## 4. `page.on('pageerror')` catches CDN SyntaxErrors; console events do not

**What happened:** Writing T1 of the showcase e2e suite, I needed to detect the #772
`SyntaxError` from the broken CDN import. A module-level `SyntaxError` is not printed
via `console.error()` — it fires as an uncaught exception before any of the page's JS
runs.

**What I learned:** Playwright distinguishes two error streams:
`page.on('console', ...)` captures `console.*` calls from the page's JS;
`page.on('pageerror', ...)` captures uncaught JavaScript exceptions — including
`SyntaxError` from failed `import` statements. The T1 test used `pageerror` and the
error array contained the exact #772 message on the first run, confirming the test
catches what it was written for.

**The rule:** For CDN import failure detection, use `page.on('pageerror', ...)`, not
`page.on('console', 'error', ...)`. The latter misses thrown exceptions that never
reach a `console.error()` call.

---

## 5. Running a new test suite against a known-broken target is a useful calibration step

**What happened:** The four showcase e2e tests were written while #772 was still open
(CDN import broken). All four failed on the first run. That was the intended outcome.

**What I learned:** When the failure set exactly matches the scope of the open bug —
T1 captured the SyntaxError message verbatim, T2–T4 timed out waiting for `.cm-editor`
— it confirms that the tests are detecting the right things for the right reasons. A
test suite that passed against a known-broken target would be suspect. Running against
broken state is a free first-pass validity check.

**The rule:** After writing a regression suite, run it once against the broken state it
was designed to catch before the fix lands. Correct failure is as informative as
correct success.

---

## What landed

| Artifact | Change |
|---|---|
| `tests/new/assembler.e-format.integration.spec.js` | 2 tests: `.e` preamble bytes and `.hex` round-trip (#756) |
| `scripts/build-site.js` | `lccCompletionSource`: registers, mnemonics, directives with comment/string guard (#755) |
| `docs/site/showcase/index.html` | Rebuilt with autocomplete wired in (#755) |
| `tests/e2e/showcase.e2e.spec.js` | 4 Playwright tests: page errors, CM mount, happy path, error path (#775) |
| `playwright.e2e.config.js` | HTTP-server-backed Playwright config; `testDir: tests/e2e` (#775) |
| `package.json` | `test:e2e` script (#775) |
| GitHub issue #772 | Filed: esm.sh CDN barrel-export gap breaks showcase |

## Open threads

- #772: FIG is fixing the `esm.sh` CDN import — e2e tests will turn green once that lands.

## Related artifacts

- [TIL 2026-06-04 CHERRY s2](./today-i-learned-2026-06-04-cherry-2.md) — previous session; covered the `.e`/`.hex` format distinction that #756 then tested
