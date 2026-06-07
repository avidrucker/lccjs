# #1103 background — where did YAML come from, and what problem is it actually solving?

**Agent:** ELDERBERRY · **Date:** 2026-06-06 · For: #1103 (spec-format research) · Background note, not the research deliverable.

This note pins down the *provenance* of YAML in the test-runner design so the
#1103 comparison starts from the real problem, not from an inherited default.

## The original problem (the actual need)

From #1044's "Have" section:

> No self-contained way for teachers/students to run input→expected-output checks
> against an `.a` program without writing Jest.

Stated neutrally, the need is:

> A **structured file** that lists a **program** plus a series of **cases**, each
> pairing **stdin input** with **expected stdout** (and optionally an expected
> exit code / timeout), runnable with one command and yielding pass/fail.

Nothing in that need names a file format. The format is a free variable.

## Where YAML entered

YAML was **not** introduced by the #1044 spike, and not by any implementation
decision. It came in as the *illustrative encoding* in the upstream code review:

- `docs/deep-code-review-claude-2026-06-03.md`, item **7.3** proposed a
  "YAML-spec test runner" as one of the five highest-leverage items.
- The #931 triage carried 7.3 forward as a priority and filed #1044.
- #1044's body reproduced the review's YAML example verbatim:

  ```yaml
  program: mySort.a
  tests:
    - input: "3 1 2"
      expected_output: "1 2 3"
  ```

So YAML is a **means proposed in the review to express "a declarative, Jest-free
test spec"** — it was never part of the problem statement itself. It rode in as
the example syntax and then looked like a requirement because it was repeated.

## What the #1044 spike already did with it

The scope spike (#1044, `docs/research/1044-yaml-test-runner-scope.md`) did **not**
adopt YAML uncritically. It:

- flagged the YAML-parser-vs-zero-runtime-dep tension as the *central open question*;
- recommended making the **internal spec object** the contract and shipping
  **JSON-canonical first** (zero dep);
- demoted a YAML front-end to an **optional** fast-follow (#1095);
- ruled out vendoring a full YAML library outright (dep policy).

## Why this matters for #1103

Because YAML is an inherited example rather than a derived requirement, #1103 is
free to evaluate the format purely on fit for *this* spec shape — and to
recommend a non-YAML primary format (or close #1095 as wont-do) without
contradicting any real constraint. Avi's dislike of YAML and the zero-dep rule
both point the same direction; this note confirms there is no upstream commitment
to YAML that #1103 would be overturning.

## One-line answer

YAML was introduced (in the upstream review, not by us) to express a
**declarative, Jest-free assignment test** — program + (input, expected_output)
cases. The problem is that testing need; YAML was only the suggested notation,
and is now up for reconsideration in #1103.
