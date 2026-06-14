# BDD feature specs (jest-cucumber pilot)

Gherkin `.feature` files documenting the toolchain's **user-facing CLI behavior**
in plain language. Adopted as a bounded pilot — decision #1250, spike #1249,
tracer bullet #1252.

## Why these exist

The `*.spec.js` suites (and the `*.oracle.e2e` parity suites) already *test*
behavior; these `.feature` files add **living documentation** of the CLI contract
that reads as prose. They **complement, not replace, oracle parity**: scenarios
assert the user-visible contract (exit code, key output lines, generated
artifacts) and leave byte-for-byte output diffing to the `*.oracle.e2e` suites.

## Layout

- **`tests/features/*.feature`** — the Gherkin (this directory).
- **`tests/new/*.bdd.spec.js`** — the step definitions. They live under `tests/new/`
  so the default `npm test` run picks them up; each `loadFeature()`s its `.feature`
  by path. Steps drive the real CLI via `spawnSync` (same approach as the e2e specs)
  and are `--runInBand`-safe (own temp dir per scenario, pre-written `name.nnn`).

## Running

```bash
npm test            # includes the BDD specs (they are *.spec.js under tests/new)
npm run test:bdd    # just the *.bdd.spec.js step-definition specs
```

## Adding a feature (pilot scope)

Keep scenarios at the user-observable level. Per-area features (`explain-errors`,
`linking`, `interactive-debug`) are filed as follow-ups to this tracer bullet once
the step-definition helpers settle.
