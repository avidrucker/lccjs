# Today I Learned — 2026-06-04 (BANANA)

A day of test infrastructure and browser playground work: migrating 18 oracle
tests from live-binary to golden-cache (#692), fixing a missing bundle copy
that broke the playground's Run button (#709), and updating the site generator
to produce the full execution UI rather than a stripped-down preview (#710).

---

## 1. Golden-cache pattern: commit oracle output once, run tests anywhere

The oracle test suite had four files using this pattern:

```js
const itOracle = assertOracleConfigured() ? test : test.skip;
// ...
itOracle('brlt: lccjs .e matches oracle', () => {
  const oracle = Buffer.from(runOracleOnDemo(writeProg('brlt')).bytes);
  expect(jsBytes('brlt').equals(oracle)).toBe(true);
});
```

Without `LCC_ORACLE` set (i.e., always in CI), 18 tests silently skipped every
run. The golden-cache pattern fixes this in three steps:

1. **Generate once with the binary.** Run `GOLDEN_AUTO_UPDATE=1 npm run test:oracle`
   — each test calls the oracle, captures its output (binary `.e` bytes, LST text,
   or raw stdout), and writes it to `tests/goldens/<dir>/`.
2. **Commit the golden files.** They become the permanent reference.
3. **Replace `itOracle` with a golden-reader.** The test loads the committed file
   and compares lccjs output against it. No oracle binary needed at runtime.

```js
const goldenFile = path.join(GOLDEN_DIR, `${mn}.e`);
if (!fs.existsSync(goldenFile)) {
  if (cfg.goldenAutoUpdate && assertOracleConfigured()) {
    writeBytes(goldenFile, runOracleOnDemo(writeProg(mn)).bytes);
  } else {
    test.skip(`${mn}: missing golden`, () => {});
    continue;
  }
}
test(`${mn}: lccjs .e matches oracle golden`, () => {
  expect(jsBytes(mn).equals(readBytes(goldenFile))).toBe(true);
});
```

Result: the oracle suite went from 106 pass + 18 skip → **124/124 pass** with
`LCC_ORACLE` unset. The pattern also works for text output (LST code regions) and
raw stdout (the `bp` deviation proof), not just binary files.

**The general lesson:** when a test depends on an external binary for *reference
output* (not for *execution*), replace the live call with a committed snapshot.
Regenerate the snapshot only when the reference intentionally changes
(`GOLDEN_AUTO_UPDATE=1`). Unexpected drift becomes a failing test, not a skip.

---

## 2. Build generators must own all features — never hand-edit generated output

The playground page (`docs/site/showcase/index.html`) was hand-crafted to add a
Run button, stdin textarea, terminal output panel, and the
`<script src="../dist/lcc.bundle.js">` tag. But `npm run build:site` calls
`build-site.js`, which generates and writes the same file — silently overwriting
everything hand-crafted every time a rebuild ran.

The correct fix is to move *all* features into the generator so the committed file
is always the generated one. Hand-editing generated output is fragile: the next
build erases the edit with no warning.

For the CSS, a subtle trap: adding playground-specific rules to the shared `CSS`
constant regens *every* page on the site (all 160+ HTML files) just because the
playground got a `#run-btn` style. The fix was a targeted `extraCss` parameter on
`makePage` so the extra rules only appear in the one page that needs them:

```js
function makePage({ ..., extraCss = '' }) {
  return `...<style>${CSS}${extraCss}</style>...`;
}

// Only the playground call passes extra rules:
makePage({ ..., extraCss: playgroundCss })
```

This keeps other pages byte-for-byte identical across builds where only the
playground changes — important when those pages are tracked in git for GitHub Pages.

---

## 3. Bundle paths: repo root ≠ GitHub Pages root

The playground's script tag was:

```html
<script src="../dist/lcc.bundle.js"></script>
```

From `docs/site/showcase/`, `..` is `docs/site/` — so the browser looks for
`docs/site/dist/lcc.bundle.js`. Webpack writes to repo-root `dist/`, not there.
On GitHub Pages the mismatch is permanent: the pages root is `docs/site/`, so
`/dist/lcc.bundle.js` also maps to `docs/site/dist/lcc.bundle.js`.

Fix: add a copy step to `build-site.js`:

```js
const BUNDLE_SRC  = path.join(ROOT, 'dist', 'lcc.bundle.js');
const BUNDLE_DEST = path.join(OUT_DIR, 'dist', 'lcc.bundle.js');
fs.mkdirSync(path.dirname(BUNDLE_DEST), { recursive: true });
fs.copyFileSync(BUNDLE_SRC, BUNDLE_DEST);
```

And a combined `npm run build` script so the ordering is enforced:

```json
"build": "npm run build:browser && npm run build:site"
```

**The general lesson:** when a build artifact is served from a subdirectory rather
than the repo root, all paths that cross that boundary need an explicit copy step —
relative paths that look correct in the source tree will silently 404 in production.

---

## What landed

| Issue | Change |
|---|---|
| [#685](https://github.com/avidrucker/lccjs/issues/685) | Code quality audit of `plusdemos/gameflappyBird.ap`: 5-area assessment posted; child ticket #691 filed (restart-after-game-over). |
| [#692](https://github.com/avidrucker/lccjs/issues/692) | 4 oracle spec files migrated to golden-cache; 18 goldens committed; oracle suite 124/124 with no binary. |
| [#709](https://github.com/avidrucker/lccjs/issues/709) | `build:site` copies `dist/lcc.bundle.js` → `docs/site/dist/`; `npm run build` added. |
| [#710](https://github.com/avidrucker/lccjs/issues/710) | `build-site.js` generates full playground: Run button, stdin, terminal panel, run handler, `extraCss` scoping. |
| [#722](https://github.com/avidrucker/lccjs/issues/722) | This TIL. |
