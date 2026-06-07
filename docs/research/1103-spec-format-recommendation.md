# RESEARCH #1103 — test-runner spec format: why YAML, and what beats it?

**Agent:** ELDERBERRY · **Date:** 2026-06-06 · **Parent:** #1044 · Research-only, no code.
**Companion:** `docs/research/1103-spec-format-provenance.md` (where YAML came from).

## TL;DR — recommendation

Adopt a **fenced literal-block format** (a tiny, hand-parsed text format with
explicit `--- input ---` / `--- expected ---` blocks) as the **human-authoring**
spec format, and keep **JSON** as the zero-dep machine/interchange format the same
loader also accepts. **Reject YAML in both forms**: full YAML violates the zero-dep
rule, and a restricted-YAML subset is *strictly dominated* by the fenced format on
every axis. **Close #1095** (restricted-YAML front-end) as wont-do; **#1090**
(JSON loader) stays valid; **file one new puzzle** for the fenced-format reader.

This settles the format question so the build cluster (#1090–#1094) can proceed.

---

## The decision is driven by one fact about the data

The spec's dominant content is **multi-line text payloads** — `input` (stdin) and
`expected_output` (stdout), which students will *paste* from real program runs
(newlines, leading spaces, prompts, punctuation). Scalars (`program`, `exit_code`,
`timeout_sec`) are trivial in any format. So the format comparison is really:

> Which format lets a student paste a block of literal program output with the
> least escaping, the least whitespace fragility, and the fewest surprises —
> **without adding a runtime dependency** (CLAUDE.md zero-dep rule)?

## Hard constraint first (eliminates several candidates)

The zero-runtime-dep rule is non-negotiable here. It immediately rules out any
format that needs a real parser library:

- **Full YAML** (js-yaml ≈ 4k LOC / new dep) — ❌ rule violation.
- **TOML** — ❌ needs a ~1k-LOC parser; no stdlib support.
- **JSON5 / JSONC via a library** — ❌ dep.

Survivors (all parseable with `JSON.parse` or <150 LOC of our own code):
**JSON**, **restricted-YAML subset (hand-rolled)**, **bespoke fenced DSL**,
**Markdown-fenced**.

## Scoring the survivors

Criteria (weighted by how much they matter for *this* spec + *these* users):

| Criterion | Weight | Why |
|---|---|---|
| Multi-line ergonomics | ★★★ | The payloads are the whole point |
| Footgun surface (for students) | ★★★ | Non-programmers author these |
| Zero-dep / parser cost | ★★ | Hard rule + maintenance burden |
| Familiarity | ★ | Nice-to-have; reduces learning |

| Format | Multi-line | Footguns | Zero-dep / cost | Familiarity | Verdict |
|---|---|---|---|---|---|
| **JSON** | ✗ must `\n`-escape; pasting output is painful | medium: trailing-comma rejection, escape `"` `\` | ✅ `JSON.parse`, 0 LOC | high | Great fallback, poor for hand-authoring |
| **Restricted-YAML** | ✅ `\|` block scalars | **high**: significant whitespace (copy-paste breaks), Norway/`yes`/`on`→bool, numeric coercion (`1.20`, leading zero), tabs forbidden, trailing-space-in-block traps | ⚠️ ~80–120 LOC, block scalars fiddly + ongoing "why doesn't my YAML work" support | medium *(but misleads: users expect full YAML)* | **Dominated — see below** |
| **Bespoke fenced DSL** | ✅✅ literal blocks, zero escaping, no significant whitespace | low: only risk is output containing a line identical to a delimiter (mitigable) | ✅ <100 LOC, tight grammar we control | low (new format to learn) | **Strong** |
| **Markdown-fenced** | ✅✅ fenced code blocks, literal | low: inner ``` collision (solved by longer fences) | ✅ ~120–150 LOC | high (everyone knows md fences); renders on GitHub | **Strong** |

### Key finding: restricted-YAML is dominated

If we are going to hand-roll a parser anyway (which any non-JSON option requires),
restricted-YAML is the **worst** hand-rolled choice:

- It keeps YAML's footguns we don't want — significant whitespace and type
  coercion (a student's `expected_output: no` silently becomes boolean `false`).
- It costs *more* to implement than a fenced format (block-scalar indentation
  rules are the fiddliest part of YAML).
- It actively misleads: a file that "looks like YAML" invites users to reach for
  anchors, flow syntax, multi-doc `---`, etc., all of which we must reject —
  generating support load and confusion.

A bespoke or Markdown-fenced format gives the **same** zero-dep multi-line win
with **fewer** footguns and **less** parser code. There is no axis on which
restricted-YAML wins. → **Close #1095.**

### Steel-manning YAML honestly (per the brief)

YAML's genuine strengths *for this spec*: block scalars (`|`) are excellent for
literal multi-line text, low syntactic noise on simple cases, inline comments, and
broad familiarity. The block-scalar strength is real — but it is **exactly the
capability a fenced format also provides**, minus the coercion and whitespace
hazards. So YAML's one real advantage here is fully captured by the alternative
without importing its disadvantages. (And full YAML's other advantages — anchors,
references, rich typing — are irrelevant to a flat list of test cases.)

### Why YAML is disliked — and which parts bite *students* specifically

- **Significant whitespace** — a pasted output block with mixed tabs/spaces or an
  off-by-one indent fails cryptically. Students paste a lot; this bites hardest.
- **Type coercion / the Norway problem** — `no`, `yes`, `on`, `off` → booleans;
  `1.20` → number `1.2` (drops the zero); leading-zero and `:`-containing values
  misparse. An assignment that prints `no` or `08:00` as expected output silently
  corrupts. This is the most dangerous one because it fails *silently*, not loudly.
- **Tabs forbidden** — invisible-character errors students can't see.
- These all hit the exact population (non-expert authors pasting literal text)
  this feature targets. JSON's footguns (escaping, trailing comma) at least fail
  *loudly* with a line/column.

## Recommendation in detail

1. **Canonical/interchange format = JSON.** Zero-dep, deterministic, ideal for
   machine-generated specs (the future `--record`/replay items 5.3/7.4 will emit
   this). The loader's native shape; `#1090` is unchanged and still wanted.
2. **Human-authoring format = fenced literal-block.** A small text format whose
   multi-line blocks are taken verbatim. Both formats parse into the **same
   internal spec object** (`{program, tests[]}`), so the runner core (#1091) and
   CLI (#1092) are format-agnostic.
3. **Reject YAML.** Don't vendor a full parser (rule); don't hand-roll a subset
   (dominated). **Close #1095.**

### Concrete fenced-format sketch (final grammar = impl ticket's call)

```
program: examples/mySort.a

test: sorts three numbers
exit: 0
timeout: 10
--- input ---
3 1 2
--- expected ---
1 2 3
--- end ---
```

Rules: scalar `key: value` lines for header/per-case metadata; everything between
`--- input ---` and the next delimiter is **literal** (no escaping, no whitespace
significance); a new `test:` line starts the next case. Collision mitigation:
delimiters must sit alone on a line at column 0; if program output could contain
such a line, the impl can support a longer/parameterized fence (the same trick
Markdown uses). **Markdown-fenced is the viable runner-up** — same architecture,
trades a little parser code for GitHub-rendering + familiarity; the impl ticket
may pick it instead. Both are zero-dep and share the internal object, so this
sub-choice does not block the cluster.

## Impact on the build cluster

| Issue | Disposition |
|---|---|
| #1090 spec loader (JSON) | **Keep** — JSON stays the interchange/zero-dep format. |
| #1091 runner core | **Unaffected** — consumes the internal object. |
| #1092 CLI `--test` | **Unaffected** — format-agnostic. |
| #1093 e2e tests | **Unaffected** (add a fenced-format fixture later). |
| #1094 docs | Document the fenced format as primary, JSON as alternative. |
| #1095 restricted-YAML front-end | **Close as wont-do** (dominated). |
| *(new)* fenced-format reader | **File a puzzle** — `loadFencedSpec(text) → internal object`, ~100 LOC, sibling to #1090. |

## Open sub-question (non-blocking)

Bespoke-fenced vs Markdown-fenced is a minor ergonomics/familiarity trade the
implementer can settle; both satisfy zero-dep + literal-blocks + shared internal
object. Defaulting to **bespoke-fenced** for tighter grammar and error messages;
Markdown-fenced if GitHub-rendering of spec files is judged valuable.

## Bottom line

The need is *declarative, Jest-free assignment testing with pasteable multi-line
I/O, zero deps*. YAML's only real strength here (literal block scalars) is matched
by a fenced format that drops every YAML hazard and costs less to build. Ship
**JSON (interchange) + fenced (human)**; **reject YAML**; **close #1095**.
