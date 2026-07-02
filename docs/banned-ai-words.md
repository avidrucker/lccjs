# Banned AI words

_Audience: AI agents, contributors · Tier: reference_

Words to avoid in tickets, docs, commit messages, and agent replies for this repo.
They tend to be vague filler or unearned jargon — replace with concrete, plain wording.

These are **defaults, not hard prohibitions**: if there is no suitable alternative and
the word is genuinely the right one, use it. The goal is to curb over-use, not to forbid
the underlying concept. This is a **living list** — append new over-used words as they show up.

Modeled on (and partly adopted from) the sibling project's
`~/Documents/Study/Python/pycats/docs/banned_words.md`.

| Word | Why it's banned | Prefer instead |
|---|---|---|
| honest / honesty / honestly | Over-used throat-clearing ("to be honest", "the honest move", "honestly, …"). Implies the rest might not be, and adds no information. | Just state the thing plainly. If you mean a specific quality, name it: "accurate", "direct", "candid", "faithful to the facts". Fine when genuinely describing honesty/candor with no fitting substitute. |
| gospel | Over-used metaphor for authoritative/certain/final ("not gospel", "treat it as gospel", "gospel truth"). Dresses up the claim without saying what kind of authority it has. | Say what you actually mean: "authoritative", "the source of truth" (or `SSOT`), "ratified", "fixed", "canonical" — or, for the negative, "a first-pass proposal, not final", "not settled". |
| crisp | Vague praise-filler ("a crisp spec", "crisp repro") — says "good" without saying what's actually good. | State the concrete property: "specific", "unambiguous", "has exact repro steps", "machine-verifiable". |
| load-bearing | Over-used metaphor ("a load-bearing guard/comment/import") — dresses up "required" without saying what actually breaks without it. | Say what depends on it concretely: "required", "the test fails without it", "removing it breaks X", "the only thing setting Y". |
| neuter | Odd, slightly-off metaphor for disabling code ("neuter the check", "neutered the fix"). | "disable", "stub out", "comment out", "temporarily remove". |

## Related

- [`docs/glossary/`](./glossary/) — the positive counterpart: **approved** acronyms/terms and their expansions.
- pycats `docs/banned_words.md` — the source model this list adopts from.
