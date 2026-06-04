# TIL 2026-06-04 — GRAPE

**Context:** Full playground + browser execution cluster session. Tickets: #676 (playground skeleton), #427 tracker triage → #701 (velocity analytics batch), #703 (Web Worker execution wrapper with step cap). Also filed follow-up tickets #706, #712, #724.

---

## 1. Check `git log` before filing a child issue

**What happened:** #427 (Tier 2 tracker) listed H5 — disassembler guard-clause flatten — as an open work item. I filed child issue #699 for it and claimed a worktree before checking git history. One command later: `git log src/extra/disassembler.js` showed commit `a3851ad refactor(disassembler): guard-clause flatten`, closing #678, shipped the day before.

**What I learned:** The tracker's item list is a snapshot written when the tracker was filed. Child issues may have been completed under different issue numbers since then. The tracker issue body doesn't update automatically.

**The rule:** Run `git log <relevant-file>` (or `gh issue list --search "..."`) before filing a child for any tracker sub-item — close the misfiled issue immediately if the work is already done.

---

## 2. webpack UMD + CJS `module.exports` + `export: 'default'` = `undefined`

**What happened:** `dist/lcc.bundle.js` was built with `library: { name: 'lcc', type: 'umd', export: 'default' }`. In a browser `window.lcc` was `undefined`. Node's `require('./dist/lcc.bundle.js')` correctly returned `{ assemble, run }` — only the browser global was broken.

**What I learned:** webpack's `export: 'default'` targets the module's `default` named export. For a CommonJS file (`module.exports = { assemble, run }`), there is no `.default` property, so the UMD browser branch (`e.lcc = t()`) gets `undefined`. The CJS branch (`module.exports = t()`) works because it returns the whole factory result. The fix is to drop `export: 'default'` entirely, letting webpack expose `module.exports` as `window.lcc` directly.

**The rule:** Only use `export: 'default'` with ES module entry points that have an explicit `export default`. CJS entry points should use `library: { name: 'X', type: 'umd' }` with no `export` key.

---

## 3. `build-site.js` generates `docs/site/showcase/index.html` — direct edits get overwritten

**What happened:** After shipping playground changes to `docs/site/showcase/index.html` in #676, I found `scripts/build-site.js` generates that file from `playgroundContent` and `playgroundScript` template literals. The next `npm run build:site` would silently discard all of #676's HTML work. BANANA's open issue #705 was specifically about this overwrite problem.

**What I learned:** For any generated file in `docs/site/`, the source of truth is `build-site.js`, not the file itself. Editing the output directly works until the next build and is actively misleading to other agents who run the build.

**The rule:** Before editing any file under `docs/site/`, check whether `build-site.js` generates it. If so, update the generator — not the output file.

---

## 4. Two parallel step caps can silently coexist

**What happened:** While adding `maxSteps` (#703) to `executeBuffer`, I discovered `step()` already had `this.instructionsCap = 500000` — a completely separate ceiling that fires in `step()` and triggers the debugger or silently stops. The new `maxSteps` cap lives in `run()` and sets `maxStepsReached`. Neither knew about the other; a browser run hitting 50k would never reach the 500k `step()` check, but a CLI run would never see `maxStepsReached`.

**What I learned:** When adding a new mechanism that parallels an existing one, search the full call chain for prior art first. Two mechanisms with overlapping purpose and no coordination produce inconsistent observable behaviour depending on which fires first.

**The rule:** Before adding a new resource-limiting mechanism, grep for existing ones in the same call chain. If one already exists, extend it; don't add a second. (#724 tracks the unification.)

---

## 5. Rebase conflicts from parallel agents: both sides are often right

**What happened:** `npm run close 703` hit rebase conflicts in `src/core/interpreter.js` and `src/browser/api.js`. DRAGONFRUIT's #702 had landed `pauseOnInput` in `executeBuffer`; my #703 had landed `maxSteps`. The conflict markers showed two independent additions to the same options destructure — neither side was wrong.

**What I learned:** In a parallel-agent repo, rebase conflicts in options/config objects usually mean *both* additions are correct. The resolution is to keep both sides. The instinct to "pick one" is wrong here.

**The rule:** When resolving conflicts in an options destructure or config object, check whether both sides represent independent valid additions. If so, merge them — don't discard either side.

---

## What landed

| Artifact | Change |
|---|---|
| `docs/site/showcase/index.html` | Run/Stop buttons, stdin textarea, exec output, Shiki preview section (#676) |
| `src/core/interpreter.js` | `maxSteps` option, step counter in `run()`, `maxStepsReached` in result (#703) |
| `src/browser/api.js` | `maxSteps` + `pauseOnInput` unified (#703 merged with #702) |
| `src/browser/lcc-worker.js` | Web Worker wrapper, 50k step cap, Stop support (#703) |
| `scripts/build-site.js` | Generates full playground + copies worker on build (#703) |
| `docs/research/velocity-analytics-batch.md` | Q4/Q17/Q18/Q28/Q29 findings (#701) |

## Open threads

- #706 — C-overshoot predictors and ELDERBERRY calibration drift
- #712 — textbook C/assembly output parity test suite
- #724 — unify `instructionsCap` + `maxSteps` into one configurable mechanism
