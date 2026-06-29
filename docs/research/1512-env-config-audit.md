# `.env` usage audit — private vs. safe-for-public config (#1512)

**Author:** agent BANANA · **Date:** 2026-06-29 · **Type:** research / scoping

## TL;DR

1. **lccjs stores no secrets.** There is not a single credential, API key, token, or
   password anywhere in its environment surface. Every variable is one of: a
   machine-specific *path*, a behavior *toggle*, public *attribution*, an OS variable,
   or a *test* hook. The "private vs public" question is therefore about
   **machine-specificity and noise**, not confidentiality.
2. **The current structure is appropriate as-is.** `.env` is gitignored
   (`.gitignore:42`); `.env.example` is the committed, documented template. No security
   restructuring is warranted, and **a separate committed "public config" file is *not*
   recommended** — the code already carries sane defaults for every non-machine var, so a
   second config layer would add complexity without removing a real risk.
3. **Two concrete follow-ups** came out of the audit: (a) `.env.example` has stale/wrong
   sound-var entries (a real doc bug); (b) optionally promote this taxonomy into a living
   `docs/env-config.md`. See [Recommendations](#recommendations).
4. **One thing to keep watching:** the `CONTRIBUTOR_*` block ships real GitHub handles.
   Handles are *public* identifiers (intentional — it's the canonical registry), so this
   is not a leak; but it is the one place a careless edit could introduce real PII
   (an email, a real-world phone/address). That boundary must be guarded, not the handles.

## Method

```bash
grep -rnoE "process\.env\.[A-Z_]+" src/ scripts/ tests/   # every consumer
cat .env.example                                            # committed template
grep -n env .gitignore                                      # .env is line 42
```
Plus reading each consumer in context (`src/core/soundEngine.js`, `src/plus/interpreterplus.js`,
`scripts/db-path.js`, `scripts/velocity-log.js`, `scripts/close.js`, `tests/helpers/*`).

## Full inventory

| Variable | Consumer(s) | Default if unset | Class |
|---|---|---|---|
| `LCC_ORACLE` | `tests/helpers/env.js`, `scripts/potato-input-test.js` | none (oracle suites use golden caches) | **machine-path** |
| `LCC_TIMEOUT_MS` | `tests/helpers/env.js` | `20000` | safe-toggle |
| `GOLDEN_AUTO_UPDATE` | `tests/helpers/env.js` | `0` | safe-toggle |
| `SOUND_FILES_FROM_SYSTEM` | `src/core/soundEngine.js` | `0` (bundled WAVs) | safe-toggle |
| `LCCPLUS_SOUND_DING/DOINK/BEEP/PING/POPSOUND/SOFTBEEP/BOP` | `src/core/soundEngine.js` (read dynamically via `slot.envVar`) | bundled WAV per slot | **machine-path** |
| `LCCPLUS_BOOP_MESSAGE` | `src/plus/interpreterplus.js` (#1511) | `Boop!` | safe-toggle |
| `LCCJS_DB` / `VELOCITY_DB` (legacy alias) | `scripts/db-path.js` | `~/.lccjs/lccjs.db` | **machine-path** (mostly test) |
| `VELOCITY_CSV` | `scripts/velocity-export.js` | derived path | **machine-path** (mostly test) |
| `ERRORS_CSV` | `scripts/errors-export.js` | derived path | **machine-path** (mostly test) |
| `RICE_CSV` | `scripts/archive/rice-export.js` | derived path | **machine-path** (archived script) |
| `VELOCITY_LOG_GH` | `scripts/velocity-log.js` | `gh` | test-hook (fake gh binary) |
| `KEEP_ORACLE_TMP`, `DEBUG_ORACLE` | `tests/helpers/runOracle.js`, `tests/.../linker.oracle.e2e.spec.js` | off | test-hook (debug) |
| `CLAUDE_AGENT_NAME` | `scripts/close.js` | branch prefix | identity (session, non-secret) |
| `CONTRIBUTOR_PROF_DOS_REIS`, `CONTRIBUTOR_AVI_DRUCKER`, `CONTRIBUTOR_CHARLIE` | `.env.example` only (sourced ad-hoc by agents) | n/a | **public registry** |
| `HOME`, `USERPROFILE`, `PATH` | several scripts/tests | OS-provided | system (not app config) |

## Classification

- **machine-path** — absolute paths that differ per machine (oracle binary, local audio
  files, DB/CSV locations). Not secret, but committing a concrete value is meaningless on
  another machine. **Correct home: gitignored `.env`**, documented with a placeholder in
  `.env.example`. This is already how they work.
- **safe-toggle** — universal sane default already in code; no machine-specificity. Could
  live in a committed config, but the code default already serves that role, so leaving
  them as code defaults (overridable via `.env`) is simplest.
- **public registry** — `CONTRIBUTOR_*`: GitHub *handles* are public usernames and are the
  intentional single source of truth (#514/#1314), already committed in `.env.example` and
  cross-referenced from `CLAUDE.md`. **Safe to be public by design.**
- **system / test-hook** — not lccjs configuration; no action.

## Exposure assessment

- **Secret leakage risk: none.** No credentials exist to leak. A committed `.env` would
  expose machine paths and the (already-public) contributor handles — embarrassing noise,
  not a breach. The wholesale `.env` gitignore is adequate.
- **PII risk: low but real at one boundary.** The `CONTRIBUTOR_*` block is the natural place
  someone might "helpfully" add an email or real-world contact. RULES (no-PII) already
  forbids PII in committed files; this audit reinforces that the contributor registry must
  stay handles-only. Variable *names* contain real names ("Avi Drucker", "Prof Dos Reis"),
  which is fine — Avi is the public repo owner; Dos Reis is the publicly-credited oracle
  author.

## Findings (bugs surfaced during the audit)

- **`.env.example` sound-var drift.** It lists `LCCPLUS_SOUND_DEEP` (no such slot — "deep"
  is the same wrong name #1510 fixed in `plusdemos.md`), and is **missing**
  `LCCPLUS_SOUND_PING`, `LCCPLUS_SOUND_POPSOUND`, `LCCPLUS_SOUND_SOFTBEEP`, and
  `LCCPLUS_BOOP_MESSAGE` (#1511). Its comment also says "`sound 0`..`sound 4`" (5 slots;
  there are now 7). The authoritative names are in `src/core/soundEngine.js` `SOUND_SLOTS`.
  → filed as **#1514**.

## Recommendations

1. **Keep the current model.** `.env` (gitignored) for machine overrides; `.env.example`
   (committed) as the documented template. **Do not add a separate committed config file** —
   it would duplicate code defaults and add a layer to keep in sync, with no risk removed.
2. **Fix `.env.example` sound-var drift** (concrete bug — **#1514**).
3. **Optional:** promote this taxonomy into a short living `docs/env-config.md` so
   contributors have a single reference for "which var, where, private or not." Low value
   given the small surface; filed as **#1515** for the maintainer to triage.
4. **Guard the one PII boundary:** the `CONTRIBUTOR_*` registry stays handles-only; never
   emails or other personal contact info (already covered by the no-PII rule).
